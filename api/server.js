 import { setCorsHeaders, generateCsrfToken, getClientIp } from '../lib/core.js';
import { enforceSecurityHeaders, createAuthenticatedContext, enforceCsrf, rateLimiter, sanitizeError, SecurityError } from './lib/security-middleware.js';

const MODULE_MAP = {
  auth:              new URL('./lib/auth.js', import.meta.url).href,
  admin:             new URL('./lib/admin.js', import.meta.url).href,
  chat:              new URL('./lib/chat.js', import.meta.url).href,
  classroom:         new URL('./lib/classroom.js', import.meta.url).href,
  community:         new URL('./lib/community.js', import.meta.url).href,
  contact:           new URL('./lib/contact.js', import.meta.url).href,
  content:           new URL('./lib/content.js', import.meta.url).href,
  contentguide:      new URL('./lib/content-guide.js', import.meta.url).href,
  curriculum:        new URL('./lib/curriculum.js', import.meta.url).href,
  flashcards:        new URL('./lib/flashcards.js', import.meta.url).href,
  glossary:          new URL('./lib/glossary.js', import.meta.url).href,
  interactions:      new URL('./lib/interactions.js', import.meta.url).href,
  lab:               new URL('./lib/lab.js', import.meta.url).href,
  level:             new URL('./lib/level.js', import.meta.url).href,
  notes:             new URL('./lib/notes.js', import.meta.url).href,
  'past-papers':     new URL('./lib/past-papers.js', import.meta.url).href,
  platform:          new URL('./lib/platform.js', import.meta.url).href,
  premium:           new URL('./lib/premium.js', import.meta.url).href,
  profile:           new URL('./lib/profile.js', import.meta.url).href,
  'profile-picture': new URL('./lib/profile-picture.js', import.meta.url).href,
  quiz:              new URL('./lib/quiz.js', import.meta.url).href,
  recall:            new URL('./lib/recall.js', import.meta.url).href,
  resources:         new URL('./lib/resources.js', import.meta.url).href,
  search:            new URL('./lib/search.js', import.meta.url).href,
  site:              new URL('./lib/site.js', import.meta.url).href,
  upload:            new URL('./lib/upload.js', import.meta.url).href,
  'weekly-challenge':new URL('./lib/weekly-challenge.js', import.meta.url).href,
};

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const AUTH_ATTEMPT_PATHS = new Set(['signup', 'signin']);
const CSRF_EXEMPT_PATHS = new Set(['signup', 'signin', 'submit_contact', 'subscribe_newsletter', 'handoff_exchange']);

export default async function handler(req, res) {
  enforceSecurityHeaders(req, res);
  setCorsHeaders(res, req);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { module: moduleName, path } = req.query;
  if (!moduleName || !path) return res.status(400).json({ error: 'module and path required' });

  const modulePath = MODULE_MAP[moduleName];
  if (!modulePath) return res.status(404).json({ error: 'Module not found' });

  let mod;
  try {
    mod = await import(modulePath);
  } catch (importErr) {
    console.error(`[IMPORT ERROR] ${moduleName}`, importErr.message);
    return res.status(500).json({ error: 'Module load failed', module: moduleName, detail: importErr.message });
  }

  try {
    const ctx = await createAuthenticatedContext(req, res);
    if (ctx.fingerprintRejected) {
      return res.status(401).json({ error: 'Session invalidated due to a security concern. Please sign in again.' });
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
    const isCsrfExempt = CSRF_EXEMPT_PATHS.has(path);
    const rateLimitAction = isAuthAttempt ? 'auth_attempt' : null;
    const allowed = await rateLimiter.check(ctx.fingerprint || getClientIp(req), ctx.userId, rateLimitAction);
    if (!allowed) {
      if (isAuthAttempt) {
        const remaining = await rateLimiter.getAuthAttemptsRemaining(getClientIp(req));
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

    if (!res.writableEnded) res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    if (err instanceof SecurityError) {
      console.error(`[403 DEBUG] ${moduleName}/${path}:`, err.message);
      return res.status(err.statusCode).json({ error: err.message });
    }
    if (!res.writableEnded) {
      const statusCode = err.statusCode || 500;
      const message = statusCode === 500 ? 'Internal server error' : sanitizeError(err);
      console.error(`[ERROR] ${moduleName}/${path}:`, err.message);
      res.status(statusCode).json({ error: message });
    }
  }
}
