 import {
  setCorsHeaders,
  generateCsrfToken,
  getClientIp
} from '../lib/core.js';
import {
  enforceSecurityHeaders,
  createAuthenticatedContext,
  enforceCsrf,
  rateLimiter,
  sanitizeError,
  SecurityError
} from '../lib/security-middleware.js';

const MODULE_MAP = {
  auth:               '../lib/auth.js',
  admin:              '../lib/admin.js',
  chat:               '../lib/chat.js',
  community:          '../lib/community.js',
  contact:            '../lib/contact.js',
  flashcards:         '../lib/flashcards.js',
  glossary:           '../lib/glossary.js',
  interactions:       '../lib/interactions.js',
  'past-papers':      '../lib/past-papers.js',
  quiz:               '../lib/quiz.js',
  recall:             '../lib/recall.js',
  resources:          '../lib/resources.js',
  site:               '../lib/site.js',
  'weekly-challenge': '../lib/weekly-challenge.js',
};

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const AUTH_ATTEMPT_PATHS = new Set(['signup', 'signin']);
const CSRF_EXEMPT_PATHS = new Set([
  'signup', 'signin', 'submit_contact', 'subscribe_newsletter', 'set_selected_level'
]);

export default async function handler(req, res) {
  enforceSecurityHeaders(req, res);
  setCorsHeaders(res, req);

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { module: moduleName, path } = req.query;
  if (!moduleName || !path) {
    return res.status(400).json({ error: 'module and path required' });
  }

  const modulePath = MODULE_MAP[moduleName];
  if (!modulePath) {
    return res.status(404).json({ error: 'Module not found' });
  }

  let mod;
  try {
    mod = await import(modulePath);
  } catch (importErr) {
    console.error(`[IMPORT ERROR] Failed to load module "${moduleName}" from "${modulePath}":`, importErr.message, importErr.stack);
    return res.status(500).json({
      error: 'Module load failed',
      module: moduleName,
      detail: importErr.message
    });
  }

  try {
    const ctx = await createAuthenticatedContext(req, res);

    if (ctx.fingerprintRejected) {
      return res.status(401).json({ error: 'Session invalidated due to security concern. Please sign in again.' });
    }

    if (ctx.csrfSecret) {
      const originalJson = res.json.bind(res);
      res.json = (data) => {
        if (data && typeof data === 'object' && !data.error) {
          data.csrf_token = generateCsrfToken(ctx.csrfSecret);
        }
        return originalJson(data);
      };
    }

    const isAuthAttempt = moduleName === 'auth' && AUTH_ATTEMPT_PATHS.has(path);
    const isCsrfExempt = CSRF_EXEMPT_PATHS.has(path);
    const rateLimitAction = isAuthAttempt ? 'auth_attempt' : null;

    if (!rateLimiter.check(ctx.fingerprint || getClientIp(req), ctx.userId, rateLimitAction)) {
      if (isAuthAttempt) {
        const remaining = rateLimiter.getAuthAttemptsRemaining(getClientIp(req));
        return res.status(429).json({
          error: 'Too many login attempts. Please try again later.',
          retry_after_minutes: 15,
          attempts_remaining: remaining
        });
      }
      return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    }

    if (!SAFE_METHODS.has(req.method) && !isCsrfExempt) {
      try {
        enforceCsrf(req, ctx);
      } catch (csrfError) {
        return res.status(csrfError.statusCode || 403).json({ error: csrfError.message });
      }
    }

    if (mod.setContext) await mod.setContext(ctx);

    await mod.handler(req, res, path, ctx);

    if (!res.writableEnded) {
      res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (err) {
    if (err instanceof SecurityError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    if (!res.writableEnded) {
      const statusCode = err.statusCode || 500;
      const message = statusCode === 500 ? 'Internal server error' : sanitizeError(err);
      console.error(`[ERROR] ${new Date().toISOString()} ${moduleName}/${path}:`, err.message, err.stack);
      res.status(statusCode).json({ error: message });
    }
  }
}
