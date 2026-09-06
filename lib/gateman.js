  /* lib/gateman.js */
import { setCorsHeaders, generateCsrfToken, getClientIp, supabase } from './core.js';
import {
  enforceSecurityHeaders,
  createAuthenticatedContext,
  enforceCsrf,
  rateLimiter,
  sanitizeError,
  SecurityError
} from './security-middleware.js';
import {
  isIpBlocked,
  evaluateAndRespond,
  getVagueErrorMessage,
  killAllSessionsForUser,
  recordSecurityEvent,
  createSecurityAlert
} from './threat-shield.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const AUTH_ATTEMPT_PATHS = new Set(['signup', 'signin']);

const CSRF_EXEMPT_KEYS = new Set([
  'auth:signup',
  'auth:signin',
  'auth:handoff_exchange',
  'contact:submit_contact',
  'contact:subscribe_newsletter'
]);

const USER_INCIDENT_WINDOW_MS = 15 * 60 * 1000;
const USER_INCIDENT_AUTO_SUSPEND_THRESHOLD = 8;
const userIncidentCounters = new Map();

function bumpUserIncident(userId) {
  const now = Date.now();
  const entry = userIncidentCounters.get(userId);

  if (!entry || now - entry.windowStart > USER_INCIDENT_WINDOW_MS) {
    userIncidentCounters.set(userId, { count: 1, windowStart: now });
    return 1;
  }

  entry.count += 1;
  return entry.count;
}

setInterval(() => {
  const now = Date.now();

  for (const [key, entry] of userIncidentCounters.entries()) {
    if (now - entry.windowStart > USER_INCIDENT_WINDOW_MS * 2) {
      userIncidentCounters.delete(key);
    }
  }
}, 300000).unref?.();

async function autoTerminateAccount(userId, ip, reason) {
  const { data: existingRestriction } = await supabase
    .from('user_restrictions')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (existingRestriction) return;

  await supabase.from('user_restrictions').upsert({
    user_id: userId,
    restriction_type: 'suspended',
    lock_reason: `Automatically suspended: ${reason}`,
    locked_at: new Date().toISOString(),
    is_permanent: false,
    updated_at: new Date().toISOString()
  }, { onConflict: 'user_id' });

  await killAllSessionsForUser(userId, 'gateman_auto_suspend');

  await supabase.from('audit_log').insert({
    actor_id: null,
    actor_role: 'system',
    action: 'gateman_auto_suspend',
    target_type: 'user',
    target_id: userId,
    ip_address: ip || null,
    metadata: { reason }
  });

  await createSecurityAlert({
    alertType: 'gateman_auto_suspend',
    severity: 'critical',
    ip,
    userId,
    summary: `User ${userId} auto-suspended by gateman after repeated incidents`,
    details: { reason }
  });
}

export async function passGate(req, res, moduleName, path) {
  enforceSecurityHeaders(req, res);
  setCorsHeaders(res, req);

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return null;
  }

  const clientIp = getClientIp(req);

  if (await isIpBlocked(clientIp)) {
    res.status(403).json({ error: getVagueErrorMessage() });
    return null;
  }

  if (!moduleName || !path) {
    res.status(400).json({ error: getVagueErrorMessage() });
    return null;
  }

  const preCheck = await evaluateAndRespond({
    req,
    body: null,
    ctx: null,
    ip: clientIp,
    moduleName,
    path
  });

  if (preCheck.blocked) {
    res.status(403).json({ error: preCheck.message });
    return null;
  }

  const ctx = await createAuthenticatedContext(req, res);

  if (ctx.fingerprintRejected) {
    await recordSecurityEvent({
      eventType: 'fingerprint_rejected',
      severity: 'high',
      ip: clientIp,
      path,
      module: moduleName,
      method: req.method,
      actionTaken: 'session_terminated'
    });

    res.status(401).json({ error: getVagueErrorMessage() });
    return null;
  }

  if (ctx.restricted) {
    res.status(403).json({
      error: ctx.restrictionReason,
      restricted: true,
      restriction_type: ctx.restrictionType,
      expires_at: ctx.restrictionExpiresAt
    });

    return null;
  }

  if (ctx.csrfSecret) {
    const originalJson = res.json.bind(res);

    res.json = (data) => {
      if (data && typeof data === 'object' && !data.error) {
        data.csrf_token = generateCsrfToken(ctx.csrfSecret, ctx.fingerprint);
      }

      return originalJson(data);
    };
  }

  const isAuthAttempt = moduleName === 'auth' && AUTH_ATTEMPT_PATHS.has(path);
  const isCsrfExempt = CSRF_EXEMPT_KEYS.has(`${moduleName}:${path}`);

  // FIX: 'auth_attempt' matched nothing in ACTION_LIMITS, so this silently
  // fell back to the generic IP-burst window instead of the intended
  // 5-per-15-minutes limit on signup/signin. Use the real action names so
  // this check and auth.js's own internal check agree.
  const rateLimitAction = isAuthAttempt
    ? (path === 'signup' ? 'signup_attempt' : 'signin_attempt')
    : null;

  const allowed = await rateLimiter.check(ctx.fingerprint || clientIp, ctx.userId, rateLimitAction);

  if (!allowed) {
    if (isAuthAttempt) {
      // FIX: getAuthAttemptsRemaining() didn't exist on RateLimiter, so a
      // 429 here previously threw an unhandled TypeError. Now implemented
      // in security-middleware.js and called with the matching action.
      const remaining = await rateLimiter.getAuthAttemptsRemaining(clientIp, rateLimitAction);

      res.status(429).json({
        error: 'Too many login attempts. Please try again later.',
        retry_after_minutes: 15,
        attempts_remaining: remaining
      });

      return null;
    }

    res.status(429).json({ error: 'Too many requests. Please try again later.' });
    return null;
  }

  if (!SAFE_METHODS.has(req.method) && !isCsrfExempt) {
    try {
      enforceCsrf(req, ctx);
    } catch (csrfError) {
      res.status(csrfError.statusCode || 403).json({ error: csrfError.message });
      return null;
    }
  }

  ctx.clientIp = clientIp;
  ctx.moduleName = moduleName;
  ctx.path = path;

  return ctx;
}

export async function reportIncident(ctx, reason, severity = 'high') {
  if (!ctx) return;

  await recordSecurityEvent({
    eventType: 'gateman_incident',
    severity,
    ip: ctx.clientIp,
    userId: ctx.userId,
    path: ctx.path,
    module: ctx.moduleName,
    actionTaken: 'logged',
    reasons: [reason]
  });

  if (!ctx.userId) return;

  const count = bumpUserIncident(ctx.userId);

  if (count >= USER_INCIDENT_AUTO_SUSPEND_THRESHOLD) {
    await autoTerminateAccount(ctx.userId, ctx.clientIp, reason);
  }
}

export async function gatemanErrorResponse(res, err, moduleName, path, ctx = null) {
  // FIX: previously only SecurityError instances counted toward incident
  // tracking, but requireAuth/requireAdmin throw plain Error objects with
  // .statusCode set — so repeated 401/403s from those never accumulated
  // toward auto-suspend. Now any 401/403, regardless of error class, counts.
  if (ctx?.userId && (err.statusCode === 401 || err.statusCode === 403)) {
    await reportIncident(ctx, `${err.statusCode}:${moduleName}/${path}:${err.message}`, 'high');
  }

  if (err instanceof SecurityError) {
    console.error(`[SECURITY] ${moduleName}/${path}:`, err.message);
    return res.status(err.statusCode).json({ error: err.message });
  }

  if (!res.writableEnded) {
    const statusCode = err.statusCode || 500;
    const message = statusCode === 500 ? getVagueErrorMessage() : sanitizeError(err);

    console.error(`[ERROR] ${moduleName}/${path}:`, err.message);

    res.status(statusCode).json({ error: message });
  }
}

export { SecurityError };
