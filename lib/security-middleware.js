 import { supabase, hashToken, parseCookies, getClientIp as coreGetClientIp, getIpNetwork, verifyCsrf as coreVerifyCsrf, validateSession as coreValidateSession, isAdmin as coreIsAdmin, getUserClient, auditLog } from './core.js';
import crypto from 'crypto';

const MAX_BODY_SIZE = 5 * 1024 * 1024;
const SESSION_FINGERPRINT_SALT = process.env.SESSION_FINGERPRINT_SALT;
if (!SESSION_FINGERPRINT_SALT) {
  console.error('[FATAL] SESSION_FINGERPRINT_SALT is not set. Set it in your environment before deploying.');
}
const EFFECTIVE_SALT = SESSION_FINGERPRINT_SALT || crypto.randomBytes(32).toString('hex');
const DEFAULT_SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const NETWORK_MISMATCH_THRESHOLD = 5;

export function getSessionFingerprint(req, userId) {
  const userAgent = (req.headers['user-agent'] || '').substring(0, 256);
  const acceptLanguage = (req.headers['accept-language'] || '').substring(0, 128);
  const secChUa = (req.headers['sec-ch-ua'] || '').substring(0, 256);
  const raw = `${userId}:${userAgent}:${acceptLanguage}:${secChUa}:${EFFECTIVE_SALT}`;
  return crypto.createHash('sha256').update(raw).digest('hex');
}

export function parseAndValidateBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalSize = 0;

    req.on('data', (chunk) => {
      totalSize += chunk.length;
      if (totalSize > MAX_BODY_SIZE) {
        reject(new Error('Request body too large'));
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString();
        if (!raw.trim()) {
          resolve({});
          return;
        }
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(new Error('Invalid JSON body'));
      }
    });

    req.on('error', reject);
  });
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

  if (!res.getHeader('Content-Security-Policy')) {
    if (process.env.STRICT_CSP === 'true') {
      const nonce = crypto.randomBytes(16).toString('base64');
      res.locals = res.locals || {};
      res.locals.cspNonce = nonce;
      res.setHeader(
        'Content-Security-Policy',
        `default-src 'self'; script-src 'self' 'nonce-${nonce}' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; frame-src https://challenges.cloudflare.com; object-src 'none'; base-uri 'self'; form-action 'self'`
      );
    } else {
      res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; frame-src https://challenges.cloudflare.com; object-src 'none'; base-uri 'self'; form-action 'self'"
      );
    }
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
    mfaVerifiedSession: false
  });

  if (!token) return anonymousCtx();

  const session = await coreValidateSession(token);
  if (!session) return anonymousCtx();

  const currentFingerprint = getSessionFingerprint(req, session.user_id);
  const clientIp = coreGetClientIp(req);
  const currentIpNetwork = getIpNetwork(clientIp);

  const { data: sessionData } = await supabase
    .from('user_sessions')
    .select('id, session_token_hash, fingerprint, csrf_secret, created_at, mfa_verified, ip_network, network_mismatch_count, session_max_age_ms')
    .eq('session_token_hash', hashToken(token))
    .eq('is_active', true)
    .single();

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
        .update({
          is_active: false,
          terminated_reason: 'Account disabled',
          terminated_at: new Date().toISOString()
        })
        .eq('user_id', session.user_id)
        .eq('is_active', true);

      res.setHeader('Set-Cookie', 'session=; HttpOnly; Secure; SameSite=None; Max-Age=0; Path=/');

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
        .update({
          is_active: false,
          terminated_reason: 'Account suspended',
          terminated_at: new Date().toISOString()
        })
        .eq('user_id', session.user_id)
        .eq('is_active', true);

      res.setHeader('Set-Cookie', 'session=; HttpOnly; Secure; SameSite=None; Max-Age=0; Path=/');

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
          .update({
            is_active: false,
            terminated_reason: 'Account locked',
            terminated_at: new Date().toISOString()
          })
          .eq('user_id', session.user_id)
          .eq('is_active', true);

        res.setHeader('Set-Cookie', 'session=; HttpOnly; Secure; SameSite=None; Max-Age=0; Path=/');

        const hoursLeft = Math.ceil((expiresAt - now) / (1000 * 60 * 60));
        return {
          ...anonymousCtx(),
          userId: session.user_id,
          restricted: true,
          restrictionReason: `Your account is temporarily locked. Please try again in ${hoursLeft} hour${hoursLeft > 1 ? 's' : ''}.`,
          restrictionType: 'locked',
          restrictionExpiresAt: restriction.expires_at
        };
      } else {
        await supabase
          .from('user_restrictions')
          .delete()
          .eq('user_id', session.user_id);
      }
    }
  }

  if (!sessionData.fingerprint || sessionData.fingerprint !== currentFingerprint) {
    await supabase
      .from('user_sessions')
      .update({ is_active: false, terminated_reason: 'fingerprint_mismatch', terminated_at: new Date().toISOString() })
      .eq('id', sessionData.id);

    await auditLog({ actorId: session.user_id, action: 'session_fingerprint_rejected', ip: clientIp });

    res.setHeader('Set-Cookie', 'session=; HttpOnly; Secure; SameSite=None; Max-Age=0; Path=/');

    return {
      ...anonymousCtx(),
      fingerprintRejected: true
    };
  }

  if (sessionData.ip_network && sessionData.ip_network !== currentIpNetwork) {
    const newCount = (sessionData.network_mismatch_count || 0) + 1;

    if (newCount >= NETWORK_MISMATCH_THRESHOLD) {
      await supabase
        .from('user_sessions')
        .update({ is_active: false, terminated_reason: 'network_mismatch_threshold', terminated_at: new Date().toISOString() })
        .eq('id', sessionData.id);

      await auditLog({ actorId: session.user_id, action: 'session_network_mismatch_threshold', ip: clientIp, metadata: { mismatch_count: newCount } });

      res.setHeader('Set-Cookie', 'session=; HttpOnly; Secure; SameSite=None; Max-Age=0; Path=/');

      return {
        ...anonymousCtx(),
        fingerprintRejected: true
      };
    }

    await supabase
      .from('user_sessions')
      .update({ network_mismatch_count: newCount })
      .eq('id', sessionData.id);

    await auditLog({ actorId: session.user_id, action: 'session_network_mismatch', ip: clientIp, metadata: { mismatch_count: newCount } });
  }

  const effectiveMaxAgeMs = sessionData.session_max_age_ms || DEFAULT_SESSION_MAX_AGE_MS;
  const sessionAge = Date.now() - new Date(sessionData.created_at).getTime();

  if (sessionAge > effectiveMaxAgeMs / 2 && sessionAge <= effectiveMaxAgeMs) {
    const newToken = crypto.randomBytes(48).toString('base64url');
    const newHashedToken = hashToken(newToken);
    const newExpiresAt = new Date(Date.now() + effectiveMaxAgeMs).toISOString();

    await supabase
      .from('user_sessions')
      .update({
        session_token_hash: newHashedToken,
        expires_at: newExpiresAt,
        fingerprint: currentFingerprint
      })
      .eq('id', sessionData.id);

    res.setHeader(
      'Set-Cookie',
      `session=${newToken}; HttpOnly; Secure; SameSite=None; Max-Age=${Math.floor(effectiveMaxAgeMs / 1000)}; Path=/`
    );
  }

  const adminData = await coreIsAdmin(session.user_id, clientIp);

  if (adminData && adminData.is_locked) {
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
    mfaVerifiedSession: !!sessionData.mfa_verified
  };
}

export function requireAuth(ctx) {
  if (!ctx.authenticated || !ctx.userId) {
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

export function enforceCsrf(req, ctx) {
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];

  if (safeMethods.includes(req.method)) return true;

  if (!ctx.csrfSecret) {
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

async function redisIncrWithExpiry(key, windowSeconds) {
  const res = await fetch(`${UPSTASH_URL}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}`, 'Content-Type': 'application/json' },
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
  auth_attempt: { limit: 5, windowMs: 900000 },
  change_password: { limit: 5, windowMs: 900000 },
  handoff_create: { limit: 10, windowMs: 60000 },
  handoff_exchange: { limit: 10, windowMs: 60000 }
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

    this.AUTH_ATTEMPT_LIMIT = ACTION_LIMITS.auth_attempt.limit;
    this.AUTH_ATTEMPT_WINDOW_MS = ACTION_LIMITS.auth_attempt.windowMs;
  }

  cleanup() {
    const now = Date.now();
    for (const [key, window] of this.windows.entries()) {
      if (
        now - window.lastAccess >
        Math.max(this.IP_BURST_WINDOW_MS, this.USER_MINUTE_WINDOW_MS, this.AUTH_ATTEMPT_WINDOW_MS) * 2
      ) {
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
    this.globalWindow.count++;
    return this.globalWindow.count <= this.MAX_GLOBAL_PER_SECOND;
  }

  async checkRedis(ip, userId, action) {
    try {
      const cfg = ACTION_LIMITS[action] || ACTION_LIMITS.default;
      const windowSeconds = Math.ceil(cfg.windowMs / 1000);
      const ipKey = `rl:ip:${action || 'default'}:${ip}`;
      const ipCount = await redisIncrWithExpiry(ipKey, windowSeconds);
      if (ipCount > cfg.limit) return false;

      if (userId) {
        const userCfg = ACTION_LIMITS.default;
        const userKey = `rl:user:${userId}`;
        const userCount = await redisIncrWithExpiry(userKey, Math.ceil(userCfg.windowMs / 1000));
        if (userCount > userCfg.limit) return false;
      }
      return true;
    } catch (e) {
      console.error('[RATE_LIMIT_REDIS_ERROR]', e.message);
      return true;
    }
  }

  checkMemory(ip, userId, action) {
    const now = Date.now();
    const ipKey = `ip:${ip}`;
    const userKey = userId ? `user:${userId}` : null;

    if (action === 'auth_attempt' || action === 'change_password' || action === 'handoff_create' || action === 'handoff_exchange') {
      const cfg = ACTION_LIMITS[action];
      const authKey = `${action}:${ip}${userId ? ':' + userId : ''}`;
      const authWindow = this.getOrCreateWindow(authKey);
      this.pruneWindow(authWindow, cfg.windowMs);
      if (authWindow.timestamps.length >= cfg.limit) return false;
      authWindow.timestamps.push(now);
      return true;
    }

    const ipWindow = this.getOrCreateWindow(ipKey);
    this.pruneWindow(ipWindow, this.IP_BURST_WINDOW_MS);
    if (ipWindow.timestamps.length >= this.IP_BURST_LIMIT) return false;
    ipWindow.timestamps.push(now);

    if (userKey) {
      const userWindow = this.getOrCreateWindow(userKey);
      this.pruneWindow(userWindow, this.USER_MINUTE_WINDOW_MS);
      if (userWindow.timestamps.length >= this.USER_MINUTE_LIMIT) return false;
      userWindow.timestamps.push(now);
    }

    return true;
  }

  async check(ip, userId, action = null) {
    if (!this.checkGlobal()) return false;
    if (REDIS_ENABLED) return this.checkRedis(ip, userId, action);
    return this.checkMemory(ip, userId, action);
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
    window.timestamps = window.timestamps.filter((t) => t > cutoff);
  }

  async getAuthAttemptsRemaining(ip) {
    if (REDIS_ENABLED) {
      try {
        const res = await fetch(`${UPSTASH_URL}/get/${encodeURIComponent(`rl:ip:auth_attempt:${ip}`)}`, {
          headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` }
        });
        const data = await res.json();
        const count = parseInt(data?.result || '0', 10);
        return Math.max(0, this.AUTH_ATTEMPT_LIMIT - count);
      } catch {
        return this.AUTH_ATTEMPT_LIMIT;
      }
    }
    const authKey = `auth_attempt:${ip}`;
    const window = this.windows.get(authKey);
    if (!window) return this.AUTH_ATTEMPT_LIMIT;
    this.pruneWindow(window, this.AUTH_ATTEMPT_WINDOW_MS);
    return Math.max(0, this.AUTH_ATTEMPT_LIMIT - window.timestamps.length);
  }

  destroy() {
    clearInterval(this.cleanupInterval);
    this.windows.clear();
  }
}

export const rateLimiter = new RateLimiter();

export function sanitizeError(error) {
  if (
    error.statusCode === 400 ||
    error.statusCode === 401 ||
    error.statusCode === 403 ||
    error.statusCode === 404
  ) {
    return error.message;
  }

  if (error.code && error.code.startsWith('PGRST')) {
    return 'A database error occurred. Please try again.';
  }

  if (error.message && error.message.includes('duplicate key')) {
    return 'This record already exists.';
  }

  if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
    return error.message;
  }

  return 'Internal server error';
}

export class SecurityError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'SecurityError';
  }
}
