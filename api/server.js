 /* api/server.js */
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

import {
  isIpBlocked,
  evaluateAndRespond,
  getVagueErrorMessage
} from '../lib/threat-shield.js';

const MODULE_MAP = {
  auth:              () => import('../lib/auth.js'),
  admin:             () => import('../lib/admin.js'),
  security:          () => import('../lib/security-center.js'),
  chat:              () => import('../lib/chat.js'),
  classroom:         () => import('../lib/classroom.js'),
  community:         () => import('../lib/community.js'),
  contact:           () => import('../lib/contact.js'),
  content:           () => import('../lib/content.js'),
  contentguide:      () => import('../lib/content-guide.js'),
  curriculum:        () => import('../lib/curriculum.js'),
  flashcards:        () => import('../lib/flashcards.js'),
  glossary:          () => import('../lib/glossary.js'),
  interactions:      () => import('../lib/interactions.js'),
  lab:               () => import('../lib/lab.js'),
  level:             () => import('../lib/level.js'),
  notes:             () => import('../lib/notes.js'),
  'past-papers':     () => import('../lib/past-papers.js'),
  platform:          () => import('../lib/platform.js'),
  premium:           () => import('../lib/premium.js'),
  profile:           () => import('../lib/profile.js'),
  'profile-picture': () => import('../lib/profile-picture.js'),
  quiz:              () => import('../lib/quiz.js'),
  recall:            () => import('../lib/recall.js'),
  resources:         () => import('../lib/resources.js'),
  search:            () => import('../lib/search.js'),
  site:              () => import('../lib/site.js'),
  upload:            () => import('../lib/upload.js'),
  'weekly-challenge':() => import('../lib/weekly-challenge.js'),
};

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const AUTH_ATTEMPT_PATHS = new Set(['signup', 'signin']);

const CSRF_EXEMPT_KEYS = new Set([
  'auth:signup',
  'auth:signin',
  'auth:handoff_exchange',
  'contact:submit_contact',
  'site:subscribe_newsletter'
]);

export default async function handler(req, res) {
  enforceSecurityHeaders(req, res);
  setCorsHeaders(res, req);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const clientIp = getClientIp(req);

  if (await isIpBlocked(clientIp)) {
    return res.status(403).json({ error: getVagueErrorMessage() });
  }

  const { module: moduleName, path } = req.query;
  if (!moduleName || !path) return res.status(400).json({ error: getVagueErrorMessage() });

  const importFn = MODULE_MAP[moduleName];
  if (!importFn) {
    await evaluateAndRespond({ req, body: null, ctx: null, ip: clientIp, moduleName, path });
    return res.status(404).json({ error: getVagueErrorMessage() });
  }

  let mod;
  try {
    mod = await importFn();
  } catch (importErr) {
    console.error(`[IMPORT ERROR] ${moduleName}`, importErr.message);
    return res.status(500).json({ error: getVagueErrorMessage() });
  }

  try {
    const preCheck = await evaluateAndRespond({ req, body: null, ctx: null, ip: clientIp, moduleName, path });
    if (preCheck.blocked) {
      return res.status(403).json({ error: preCheck.message });
    }

    const ctx = await createAuthenticatedContext(req, res);
    if (ctx.fingerprintRejected) {
      return res.status(401).json({ error: getVagueErrorMessage() });
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
    const rateLimitAction = isAuthAttempt ? 'auth_attempt' : null;
    const allowed = await rateLimiter.check(ctx.fingerprint || clientIp, ctx.userId, rateLimitAction);
    if (!allowed) {
      if (isAuthAttempt) {
        const remaining = await rateLimiter.getAuthAttemptsRemaining(clientIp);
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

    if (!res.writableEnded) res.status(405).json({ error: getVagueErrorMessage() });
  } catch (err) {
    if (err instanceof SecurityError) {
      console.error(`[SECURITY DEBUG] ${moduleName}/${path}:`, err.message);
      return res.status(err.statusCode).json({ error: err.message });
    }
    if (!res.writableEnded) {
      const statusCode = err.statusCode || 500;
      const message = statusCode === 500 ? getVagueErrorMessage() : sanitizeError(err);
      console.error(`[ERROR] ${moduleName}/${path}:`, err.message);
      res.status(statusCode).json({ error: message });
    }
  }
}
