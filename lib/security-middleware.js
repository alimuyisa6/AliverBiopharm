 import { supabase, hashToken, parseCookies, getClientIp as coreGetClientIp, verifyCsrf as coreVerifyCsrf, validateSession as coreValidateSession, isAdmin as coreIsAdmin } from './core.js';
import crypto from 'crypto';

const MAX_BODY_SIZE = 5 * 1024 * 1024;
const SESSION_FINGERPRINT_SALT = process.env.SESSION_FINGERPRINT_SALT || crypto.randomBytes(32).toString('hex');
const MAX_SESSION_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function getSessionFingerprint(req, userId) {
  const userAgent = (req.headers['user-agent'] || '').substring(0, 256);
  const acceptLanguage = (req.headers['accept-language'] || '').substring(0, 128);
  const raw = `${userId}:${userAgent}:${acceptLanguage}:${SESSION_FINGERPRINT_SALT}`;
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

  if (!res.getHeader('Content-Security-Policy')) {
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; frame-src 'none'; object-src 'none'"
    );
  }
}

export async function createAuthenticatedContext(req, res) {
  const cookies = parseCookies(req);
  const token = cookies.session || '';

  if (!token) {
    return {
      userId: null,
      adminData: null,
      csrfSecret: null,
      sessionId: null,
      authenticated: false,
      fingerprint: null,
      adminLocked: false
    };
  }

  const session = await coreValidateSession(token);

  if (!session) {
    return {
      userId: null,
      adminData: null,
      csrfSecret: null,
      sessionId: null,
      authenticated: false,
      fingerprint: null,
      adminLocked: false
    };
  }

  const currentFingerprint = getSessionFingerprint(req, session.user_id);

  const { data: sessionData } = await supabase
    .from('user_sessions')
    .select('id, session_token_hash, fingerprint, csrf_secret, created_at')
    .eq('session_token_hash', hashToken(token))
    .eq('is_active', true)
    .single();

  if (!sessionData) {
    return {
      userId: null,
      adminData: null,
      csrfSecret: null,
      sessionId: null,
      authenticated: false,
      fingerprint: null,
      adminLocked: false
    };
  }

  if (sessionData.fingerprint && sessionData.fingerprint !== currentFingerprint) {
    return {
      userId: session.user_id,
      adminData: null,
      csrfSecret: sessionData.csrf_secret,
      sessionId: sessionData.id,
      authenticated: true,
      fingerprint: currentFingerprint,
      adminWarning: 'fingerprint_changed'
    };
  }

  if (!sessionData.fingerprint) {
    await supabase
      .from('user_sessions')
      .update({ fingerprint: currentFingerprint })
      .eq('id', sessionData.id);
  }

  const sessionAge = Date.now() - new Date(sessionData.created_at).getTime();

  if (sessionAge > MAX_SESSION_AGE_MS / 2 && sessionAge <= MAX_SESSION_AGE_MS) {
    const newToken = crypto.randomBytes(48).toString('base64url');
    const newHashedToken = hashToken(newToken);
    const newExpiresAt = new Date(Date.now() + MAX_SESSION_AGE_MS).toISOString();

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
      `session=${newToken}; HttpOnly; Secure; SameSite=None; Max-Age=${Math.floor(MAX_SESSION_AGE_MS / 1000)}; Path=/`
    );
  }

  const adminData = await coreIsAdmin(session.user_id);

  if (adminData && adminData.is_locked) {
    return {
      userId: session.user_id,
      adminData: null,
      csrfSecret: sessionData.csrf_secret,
      sessionId: sessionData.id,
      authenticated: true,
      fingerprint: currentFingerprint,
      adminLocked: true
    };
  }

  return {
    userId: session.user_id,
    adminData,
    csrfSecret: sessionData.csrf_secret,
    sessionId: sessionData.id,
    authenticated: true,
    fingerprint: currentFingerprint,
    adminLocked: false
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

    this.AUTH_ATTEMPT_LIMIT = 5;
    this.AUTH_ATTEMPT_WINDOW_MS = 900000;
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

  check(ip, userId, action = null) {
    if (!this.checkGlobal()) return false;

    const now = Date.now();
    const ipKey = `ip:${ip}`;
    const userKey = userId ? `user:${userId}` : null;

    if (action === 'auth_attempt') {
      const authKey = `auth:${ip}`;
      const authWindow = this.getOrCreateWindow(authKey, this.AUTH_ATTEMPT_WINDOW_MS);

      this.pruneWindow(authWindow, this.AUTH_ATTEMPT_WINDOW_MS);

      if (authWindow.timestamps.length >= this.AUTH_ATTEMPT_LIMIT) return false;

      authWindow.timestamps.push(now);
      return true;
    }

    const ipWindow = this.getOrCreateWindow(ipKey, this.IP_BURST_WINDOW_MS);

    this.pruneWindow(ipWindow, this.IP_BURST_WINDOW_MS);

    if (ipWindow.timestamps.length >= this.IP_BURST_LIMIT) return false;

    ipWindow.timestamps.push(now);

    if (userKey) {
      const userWindow = this.getOrCreateWindow(userKey, this.USER_MINUTE_WINDOW_MS);

      this.pruneWindow(userWindow, this.USER_MINUTE_WINDOW_MS);

      if (userWindow.timestamps.length >= this.USER_MINUTE_LIMIT) return false;

      userWindow.timestamps.push(now);
    }

    return true;
  }

  getOrCreateWindow(key, windowMs) {
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

  getAuthAttemptsRemaining(ip) {
    const authKey = `auth:${ip}`;
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
