/* lib/security-middleware.js */
import {
  supabase,
  hashToken,
  parseCookies,
  getClientIp as coreGetClientIp,
  getIpNetwork,
  verifyCsrf as coreVerifyCsrf,
  validateSession as coreValidateSession,
  isAdmin as coreIsAdmin,
  getUserClient,
  auditLog
} from './core.js';
import {
  isIpBlocked,
  evaluateAndRespond,
  getVagueErrorMessage
} from './threat-shield.js';
import crypto from 'crypto';

const MAX_BODY_SIZE = 5 * 1024 * 1024;
const SESSION_FINGERPRINT_SALT = process.env.SESSION_FINGERPRINT_SALT;

if (!SESSION_FINGERPRINT_SALT) {
  throw new Error('SESSION_FINGERPRINT_SALT is required');
}

const EFFECTIVE_SALT = SESSION_FINGERPRINT_SALT;
const DEFAULT_SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const NETWORK_MISMATCH_THRESHOLD = 5;
const FINGERPRINT_MISMATCH_THRESHOLD = 3;
const TOKEN_ROTATION_GRACE_MS = 30 * 1000;

export function getSessionFingerprint(req, userId) {
  const userAgent = (req.headers['user-agent'] || '').substring(0, 256);
  const acceptLanguage = (req.headers['accept-language'] || '').substring(0, 128);

  const raw = `${userId}:${userAgent}:${acceptLanguage}:${EFFECTIVE_SALT}`;

  return crypto.createHash('sha256').update(raw).digest('hex');
}

export async function parseAndValidateBody(req) {
  const contentType = req.headers['content-type'] || '';

  if (contentType.startsWith('multipart/form-data') || contentType.startsWith('multipart/related')) {
    return {};
  }

  const parsed = await new Promise((resolve, reject) => {
    const chunks = [];
    let totalSize = 0;
    let timedOut = false;

    const readTimeout = setTimeout(() => {
      timedOut = true;
      reject(new SecurityError(getVagueErrorMessage(), 408));
      req.destroy();
    }, 10000);

    req.on('data', (chunk) => {
      if (timedOut) return;

      totalSize += chunk.length;

      if (totalSize > MAX_BODY_SIZE) {
        clearTimeout(readTimeout);
        reject(new SecurityError(getVagueErrorMessage(), 400));
        return;
      }

      chunks.push(chunk);
    });

    req.on('end', () => {
      if (timedOut) return;

      clearTimeout(readTimeout);

      try {
        const raw = Buffer.concat(chunks).toString();

        if (!raw.trim()) {
          resolve({});
          return;
        }

        resolve(JSON.parse(raw));
      } catch {
        reject(new SecurityError(getVagueErrorMessage(), 400));
      }
    });

    req.on('error', () => {
      if (timedOut) return;

      clearTimeout(readTimeout);
      reject(new SecurityError(getVagueErrorMessage(), 400));
    });
  });

  const ip = coreGetClientIp(req);

  if (await isIpBlocked(ip)) {
    throw new SecurityError(getVagueErrorMessage(), 403);
  }

  const moduleName = req.query?.module || null;
  const routePath = req.query?.path || req.url;

  const evalResult = await evaluateAndRespond({
    req,
    body: parsed,
    ctx: null,
    ip,
    moduleName,
    path: routePath
  });

  if (evalResult.blocked) {
    throw new SecurityError(evalResult.message, 403);
  }

  return parsed;
}

export function enforceSecurityHeaders(req, res) {
  res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '0');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  res.removeHeader('X-Powered-By');

  if (!res.getHeader('Content-Security-Policy')) {
    const nonce = crypto.randomBytes(16).toString('base64');

    res.locals = res.locals || {};
    res.locals.cspNonce = nonce;

    res.setHeader(
      'Content-Security-Policy',
      `default-src 'self'; script-src 'self' 'nonce-${nonce}' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; frame-src https://challenges.cloudflare.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`
    );
  }
}

export async function createAuthenticatedContext(req, res) {
  const cookies = parseCookies(req);
  const token = cookies.session || '';

  const anonymousCtx = () => ({
    userId: null,
    adminData: null,
    csrfSecret: null,
    sessionId: null,
    authenticated: false,
    fingerprint: null,
    adminLocked: false,
    db: getUserClient(null),
    restricted: false,
    restrictionReason: null,
    restrictionType: null,
    restrictionExpiresAt: null,
    fingerprintRejected: false,
    mfaVerifiedSession: false,
    passkeyVerifiedSession: false
  });

  if (!token) return anonymousCtx();

  const session = await coreValidateSession(token);

  if (!session) return anonymousCtx();

  const currentFingerprint = getSessionFingerprint(req, session.user_id);
  const clientIp = coreGetClientIp(req);
  const currentIpNetwork = getIpNetwork(clientIp);
  const hashedToken = hashToken(token);
  const nowIso = new Date().toISOString();

  const { data: sessionData } = await supabase
    .from('user_sessions')
    .select('id, session_token_hash, fingerprint, csrf_secret, created_at, mfa_verified, passkey_verified, ip_network, network_mismatch_count, fingerprint_mismatch_count, session_max_age_ms')
    .eq('is_active', true)
    .or(`session_token_hash.eq.${hashedToken},and(prev_session_token_hash.eq.${hashedToken},prev_token_grace_until.gt.${nowIso})`)
    .limit(1)
    .maybeSingle();

  if (!sessionData) return anonymousCtx();

  const { data: restriction } = await supabase
    .from('user_restrictions')
    .select('restriction_type, lock_reason, expires_at')
    .eq('user_id', session.user_id)
    .maybeSingle();

  if (restriction) {
    const now = new Date();
    const expiresAt = restriction.expires_at ? new Date(restriction.expires_at) : null;

    if (restriction.restriction_type === 'disabled') {
      await supabase
        .from('user_sessions')
        .update({ is_active: false, terminated_reason: 'Account disabled', terminated_at: new Date().toISOString() })
        .eq('user_id', session.user_id)
        .eq('is_active', true);

      res.setHeader('Set-Cookie', 'session=; HttpOnly; Secure; SameSite=None; Partitioned; Max-Age=0; Path=/');

      return {
        ...anonymousCtx(),
        userId: session.user_id,
        restricted: true,
        restrictionReason: 'Your account has been permanently disabled. Please contact support.',
        restrictionType: 'disabled',
        restrictionExpiresAt: null
      };
    }

    if (restriction.restriction_type === 'suspended') {
      await supabase
        .from('user_sessions')
        .update({ is_active: false, terminated_reason: 'Account suspended', terminated_at: new Date().toISOString() })
        .eq('user_id', session.user_id)
        .eq('is_active', true);

      res.setHeader('Set-Cookie', 'session=; HttpOnly; Secure; SameSite=None; Partitioned; Max-Age=0; Path=/');

      return {
        ...anonymousCtx(),
        userId: session.user_id,
        restricted: true,
        restrictionReason: restriction.lock_reason || 'Your account has been suspended. Please contact support.',
        restrictionType: 'suspended',
        restrictionExpiresAt: null
      };
    }

    if (restriction.restriction_type === 'locked') {
      if (expiresAt && expiresAt > now) {
        await supabase
          .from('user_sessions')
          .update({ is_active: false, terminated_reason: 'Account locked', terminated_at: new Date().toISOString() })
          .eq('user_id', session.user_id)
          .eq('is_active', true);

        res.setHeader('Set-Cookie', 'session=; HttpOnly; Secure; SameSite=None; Partitioned; Max-Age=0; Path=/');

        const hoursLeft = Math.ceil((expiresAt - now) / (1000 * 60 * 60));

        return {
          ...anonymousCtx(),
          userId: session.user_id,
          restricted: true,
          restrictionReason: `Your account is temporarily locked. Please try again in ${hoursLeft} hour${hoursLeft > 1 ? 's' : ''}.`,
          restrictionType: 'locked',
          restrictionExpiresAt: restriction.expires_at
        };
      }

      await supabase.from('user_restrictions').delete().eq('user_id', session.user_id);
    }
  }

  if (!sessionData.fingerprint) {
    await supabase
      .from('user_sessions')
      .update({ is_active: false, terminated_reason: 'fingerprint_missing', terminated_at: new Date().toISOString() })
      .eq('id', sessionData.id);

    await auditLog({ actorId: session.user_id, action: 'session_fingerprint_rejected', ip: clientIp });

    res.setHeader('Set-Cookie', 'session=; HttpOnly; Secure; SameSite=None; Partitioned; Max-Age=0; Path=/');

    return { ...anonymousCtx(), fingerprintRejected: true };
  }

  if (sessionData.fingerprint !== currentFingerprint) {
    const newCount = (sessionData.fingerprint_mismatch_count || 0) + 1;

    if (newCount >= FINGERPRINT_MISMATCH_THRESHOLD) {
      await supabase
        .from('user_sessions')
        .update({ is_active: false, terminated_reason: 'fingerprint_mismatch_threshold', terminated_at: new Date().toISOString() })
        .eq('id', sessionData.id);

      await auditLog({
        actorId: session.user_id,
        action: 'session_fingerprint_mismatch_threshold',
        ip: clientIp,
        metadata: { mismatch_count: newCount }
      });

      res.setHeader('Set-Cookie', 'session=; HttpOnly; Secure; SameSite=None; Partitioned; Max-Age=0; Path=/');

      return { ...anonymousCtx(), fingerprintRejected: true };
    }

    await supabase
      .from('user_sessions')
      .update({ fingerprint_mismatch_count: newCount })
      .eq('id', sessionData.id);

    await auditLog({
      actorId: session.user_id,
      action: 'session_fingerprint_mismatch',
      ip: clientIp,
      metadata: { mismatch_count: newCount }
    });
  } else if (sessionData.fingerprint_mismatch_count) {
    await supabase
      .from('user_sessions')
      .update({ fingerprint_mismatch_count: 0 })
      .eq('id', sessionData.id);
  }

  if (sessionData.ip_network && sessionData.ip_network !== currentIpNetwork) {
    const newCount = (sessionData.network_mismatch_count || 0) + 1;

    if (newCount >= NETWORK_MISMATCH_THRESHOLD) {
      await supabase
        .from('user_sessions')
        .update({ is_active: false, terminated_reason: 'network_mismatch_threshold', terminated_at: new Date().toISOString() })
        .eq('id', sessionData.id);

      await auditLog({
        actorId: session.user_id,
        action: 'session_network_mismatch_threshold',
        ip: clientIp,
        metadata: { mismatch_count: newCount }
      });

      res.setHeader('Set-Cookie', 'session=; HttpOnly; Secure; SameSite=None; Partitioned; Max-Age=0; Path=/');

      return { ...anonymousCtx(), fingerprintRejected: true };
    }

    await supabase
      .from('user_sessions')
      .update({ network_mismatch_count: newCount })
      .eq('id', sessionData.id);

    await auditLog({
      actorId: session.user_id,
      action: 'session_network_mismatch',
      ip: clientIp,
      metadata: { mismatch_count: newCount }
    });
  }

  const effectiveMaxAgeMs = Number(sessionData.session_max_age_ms) || DEFAULT_SESSION_MAX_AGE_MS;
  const sessionAge = Date.now() - new Date(sessionData.created_at).getTime();

  if (
    sessionData.session_token_hash === hashedToken &&
    sessionAge > effectiveMaxAgeMs / 2 &&
    sessionAge <= effectiveMaxAgeMs
  ) {
    const newToken = crypto.randomBytes(48).toString('base64url');
    const newHashedToken = hashToken(newToken);
    const newExpiresAt = new Date(Date.now() + effectiveMaxAgeMs).toISOString();
    const graceUntil = new Date(Date.now() + TOKEN_ROTATION_GRACE_MS).toISOString();

    const { data: rotated } = await supabase
      .from('user_sessions')
      .update({
        session_token_hash: newHashedToken,
        prev_session_token_hash: hashedToken,
        prev_token_grace_until: graceUntil,
        expires_at: newExpiresAt,
        fingerprint: currentFingerprint,
        created_at: new Date().toISOString()
      })
      .eq('id', sessionData.id)
      .eq('session_token_hash', hashedToken)
      .select('id')
      .maybeSingle();

    if (rotated) {
      res.setHeader(
        'Set-Cookie',
        `session=${newToken}; HttpOnly; Secure; SameSite=None; Partitioned; Max-Age=${Math.floor(effectiveMaxAgeMs / 1000)}; Path=/`
      );
    }
  }

  const adminData = await coreIsAdmin(session.user_id, clientIp);

  if (adminData?.is_locked) {
    return {
      ...anonymousCtx(),
      userId: session.user_id,
      adminData: null,
      csrfSecret: sessionData.csrf_secret,
      sessionId: sessionData.id,
      authenticated: true,
      fingerprint: currentFingerprint,
      adminLocked: true,
      db: getUserClient(session.user_id)
    };
  }

  return {
    userId: session.user_id,
    adminData,
    csrfSecret: sessionData.csrf_secret,
    sessionId: sessionData.id,
    authenticated: true,
    fingerprint: currentFingerprint,
    adminLocked: false,
    db: getUserClient(session.user_id),
    restricted: false,
    restrictionReason: null,
    restrictionType: null,
    restrictionExpiresAt: null,
    fingerprintRejected: false,
    mfaVerifiedSession: !!sessionData.mfa_verified,
    passkeyVerifiedSession: !!sessionData.passkey_verified
  };
}

export function requireAuth(ctx) {
  if (!ctx?.authenticated || !ctx?.userId) {
    const error = new Error('Authentication required');
    error.statusCode = 401;
    throw error;
  }

  return true;
}

export function requireAdmin(ctx) {
  requireAuth(ctx);

  if (!ctx.adminData) {
    const error = new Error('Admin access required');
    error.statusCode = 403;
    throw error;
  }

  if (ctx.adminData.is_locked || ctx.adminLocked) {
    const error = new Error('Admin account is locked');
    error.statusCode = 403;
    throw error;
  }

  if (ctx.adminData.ip_rejected) {
    const error = new Error('Admin access from this IP is not permitted');
    error.statusCode = 403;
    throw error;
  }

  if (ctx.adminData.mfa_enabled && !ctx.mfaVerifiedSession) {
    const error = new Error('MFA verification required for this session');
    error.statusCode = 403;
    throw error;
  }

  if (ctx.adminData.passkey_enabled && !ctx.passkeyVerifiedSession) {
    const error = new Error('Passkey verification required for this session');
    error.statusCode = 403;
    throw error;
  }

  return true;
}

export function requireSuperAdmin(ctx) {
  requireAdmin(ctx);

  if (ctx.adminData.admin_role !== 'super_admin') {
    const error = new Error('Super admin access required');
    error.statusCode = 403;
    throw error;
  }

  return true;
}

export function isFullyAuthorizedAdmin(ctx) {
  if (!ctx?.authenticated || !ctx?.userId || !ctx?.adminData) return false;
  if (ctx.adminData.is_locked || ctx.adminLocked) return false;
  if (ctx.adminData.ip_rejected) return false;
  if (ctx.adminData.mfa_enabled && !ctx.mfaVerifiedSession) return false;
  if (ctx.adminData.passkey_enabled && !ctx.passkeyVerifiedSession) return false;

  return true;
}

export function requireMfaEnrolled(ctx) {
  requireAdmin(ctx);

  if (!ctx.adminData.mfa_enabled) {
    const error = new Error('Two-factor authentication setup is required for this account before continuing');
    error.statusCode = 403;
    throw error;
  }

  return true;
}

export function requirePasskeyEnrolled(ctx) {
  requireAdmin(ctx);

  if (!ctx.adminData.passkey_enabled) {
    const error = new Error('Passkey setup is required for this account before continuing');
    error.statusCode = 403;
    throw error;
  }

  return true;
}

export function enforceCsrf(req, ctx) {
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];

  if (safeMethods.includes(req.method)) return true;

  if (!ctx?.csrfSecret) {
    const error = new Error('CSRF token not available');
    error.statusCode = 403;
    throw error;
  }

  try {
    coreVerifyCsrf(req, ctx.csrfSecret, ctx.userId, ctx.fingerprint);
  } catch {
    const error = new Error('Invalid or missing CSRF token');
    error.statusCode = 403;
    throw error;
  }

  return true;
}

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const REDIS_ENABLED = !!(UPSTASH_URL && UPSTASH_TOKEN);

if (process.env.NODE_ENV === 'production' && !REDIS_ENABLED) {
  throw new Error('UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required in production');
}

async function redisIncrWithExpiry(key, windowSeconds) {
  const res = await fetch(`${UPSTASH_URL}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${UPSTASH_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify([
      ['INCR', key],
      ['EXPIRE', key, String(windowSeconds), 'NX']
    ])
  });

  const data = await res.json();
  const count = data?.[0]?.result;

  return typeof count === 'number' ? count : parseInt(count, 10) || 1;
}

const ACTION_LIMITS = {
  default: { limit: 60, windowMs: 60000 },
  signup_attempt: { limit: 5, windowMs: 900000 },
  signin_attempt: { limit: 5, windowMs: 900000 },
  change_password: { limit: 5, windowMs: 900000 },
  handoff_create: { limit: 10, windowMs: 60000 },
  handoff_exchange: { limit: 10, windowMs: 60000 },
  quiz_start_session: { limit: 5, windowMs: 60000 },
  quiz_check_answer: { limit: 40, windowMs: 60000 },
  quiz_tab_switch: { limit: 10, windowMs: 60000 },
  quiz_submit: { limit: 3, windowMs: 60000 },
  quiz_heartbeat: { limit: 6, windowMs: 60000 },
  quiz_bookmark: { limit: 30, windowMs: 60000 },
  quiz_question_note: { limit: 30, windowMs: 60000 }
};

export class RateLimiter {
  constructor() {
    this.windows = new Map();
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);

    if (this.cleanupInterval.unref) this.cleanupInterval.unref();

    this.globalWindow = { count: 0, resetAt: Date.now() + 1000 };
    this.MAX_GLOBAL_PER_SECOND = 500;
    this.IP_BURST_LIMIT = 20;
    this.IP_BURST_WINDOW_MS = 10000;
    this.USER_MINUTE_LIMIT = 60;
    this.USER_MINUTE_WINDOW_MS = 60000;
  }

  cleanup() {
    const now = Date.now();
    const maxWindow = Math.max(
      this.IP_BURST_WINDOW_MS,
      this.USER_MINUTE_WINDOW_MS,
      ...Object.values(ACTION_LIMITS).map((cfg) => cfg.windowMs)
    );

    for (const [key, window] of this.windows.entries()) {
      if (now - window.lastAccess > maxWindow * 2) {
        this.windows.delete(key);
      }
    }
  }

  checkGlobal() {
    const now = Date.now();

    if (now >= this.globalWindow.resetAt) {
      this.globalWindow.count = 0;
      this.globalWindow.resetAt = now + 1000;
    }

    this.globalWindow.count += 1;

    return this.globalWindow.count <= this.MAX_GLOBAL_PER_SECOND;
  }

  async checkRedisDetailed(ip, userId, action) {
    try {
      const cfg = ACTION_LIMITS[action] || ACTION_LIMITS.default;
      const windowSeconds = Math.ceil(cfg.windowMs / 1000);
      const ipKey = `rl:ip:${action || 'default'}:${ip}`;
      const ipCount = await redisIncrWithExpiry(ipKey, windowSeconds);

      if (ipCount > cfg.limit) {
        return { allowed: false, remaining: 0 };
      }

      if (userId) {
        const userCfg = ACTION_LIMITS.default;
        const userKey = `rl:user:${userId}`;
        const userCount = await redisIncrWithExpiry(userKey, Math.ceil(userCfg.windowMs / 1000));

        if (userCount > userCfg.limit) {
          return { allowed: false, remaining: 0 };
        }
      }

      return { allowed: true, remaining: Math.max(0, cfg.limit - ipCount) };
    } catch (error) {
      console.error('[RATE_LIMIT_REDIS_ERROR]', error.message);
      return this.checkMemoryDetailed(ip, userId, action);
    }
  }

  checkMemoryDetailed(ip, userId, action) {
    const now = Date.now();

    if (action && ACTION_LIMITS[action]) {
      const cfg = ACTION_LIMITS[action];
      const authKey = `${action}:${ip}${userId ? ':' + userId : ''}`;
      const authWindow = this.getOrCreateWindow(authKey);

      this.pruneWindow(authWindow, cfg.windowMs);

      if (authWindow.timestamps.length >= cfg.limit) {
        return { allowed: false, remaining: 0 };
      }

      authWindow.timestamps.push(now);
      return { allowed: true, remaining: Math.max(0, cfg.limit - authWindow.timestamps.length) };
    }

    const ipKey = `ip:${ip}`;
    const userKey = userId ? `user:${userId}` : null;

    const ipWindow = this.getOrCreateWindow(ipKey);
    this.pruneWindow(ipWindow, this.IP_BURST_WINDOW_MS);

    if (ipWindow.timestamps.length >= this.IP_BURST_LIMIT) {
      return { allowed: false, remaining: 0 };
    }

    ipWindow.timestamps.push(now);

    if (userKey) {
      const userWindow = this.getOrCreateWindow(userKey);
      this.pruneWindow(userWindow, this.USER_MINUTE_WINDOW_MS);

      if (userWindow.timestamps.length >= this.USER_MINUTE_LIMIT) {
        return { allowed: false, remaining: 0 };
      }

      userWindow.timestamps.push(now);
    }

    return { allowed: true, remaining: Math.max(0, this.IP_BURST_LIMIT - ipWindow.timestamps.length) };
  }

  async checkDetailed(ip, userId, action = null) {
    if (!this.checkGlobal()) return { allowed: false, remaining: 0 };

    if (REDIS_ENABLED) return this.checkRedisDetailed(ip, userId, action);

    return this.checkMemoryDetailed(ip, userId, action);
  }

  async check(ip, userId, action = null) {
    const result = await this.checkDetailed(ip, userId, action);
    return result.allowed;
  }

  getOrCreateWindow(key) {
    if (!this.windows.has(key)) {
      this.windows.set(key, { timestamps: [], lastAccess: Date.now() });
    }

    const window = this.windows.get(key);
    window.lastAccess = Date.now();

    return window;
  }

  pruneWindow(window, windowMs) {
    const cutoff = Date.now() - windowMs;
    window.timestamps = window.timestamps.filter((timestamp) => timestamp > cutoff);
  }
}

export const rateLimiter = new RateLimiter();

export function sanitizeError(error) {
  if (
    error?.statusCode === 400 ||
    error?.statusCode === 401 ||
    error?.statusCode === 403 ||
    error?.statusCode === 404
  ) {
    return error.message;
  }

  if (error?.code?.startsWith('PGRST')) return getVagueErrorMessage();
  if (error?.message?.includes('duplicate key')) return 'This record already exists.';

  if (error?.statusCode >= 400 && error?.statusCode < 500) return error.message;

  return getVagueErrorMessage();
}

export class SecurityError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'SecurityError';
  }
}
