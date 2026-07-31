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

import * as authModule from '../lib/auth.js';
import * as adminModule from '../lib/admin.js';
import * as chatModule from '../lib/chat.js';
import * as classroomModule from '../lib/classroom.js';
import * as communityModule from '../lib/community.js';
import * as contactModule from '../lib/contact.js';
import * as contentModule from '../lib/content.js';
import * as contentguideModule from '../lib/content-guide.js';
import * as curriculumModule from '../lib/curriculum.js';
import * as flashcardsModule from '../lib/flashcards.js';
import * as glossaryModule from '../lib/glossary.js';
import * as interactionsModule from '../lib/interactions.js';
import * as labModule from '../lib/lab.js';
import * as levelModule from '../lib/level.js';
import * as notesModule from '../lib/notes.js';
import * as pastPapersModule from '../lib/past-papers.js';
import * as platformModule from '../lib/platform.js';
import * as premiumModule from '../lib/premium.js';
import * as profileModule from '../lib/profile.js';
import * as profilePictureModule from '../lib/profile-picture.js';
import * as quizModule from '../lib/quiz.js';
import * as recallModule from '../lib/recall.js';
import * as resourcesModule from '../lib/resources.js';
import * as searchModule from '../lib/search.js';
import * as siteModule from '../lib/site.js';
import * as uploadModule from '../lib/upload.js';
import * as weeklyChallengeModule from '../lib/weekly-challenge.js';

const MODULE_MAP = {
  auth: authModule,
  admin: adminModule,
  chat: chatModule,
  classroom: classroomModule,
  community: communityModule,
  contact: contactModule,
  content: contentModule,
  contentguide: contentguideModule,
  curriculum: curriculumModule,
  flashcards: flashcardsModule,
  glossary: glossaryModule,
  interactions: interactionsModule,
  lab: labModule,
  level: levelModule,
  notes: notesModule,
  'past-papers': pastPapersModule,
  platform: platformModule,
  premium: premiumModule,
  profile: profileModule,
  'profile-picture': profilePictureModule,
  quiz: quizModule,
  recall: recallModule,
  resources: resourcesModule,
  search: searchModule,
  site: siteModule,
  upload: uploadModule,
  'weekly-challenge': weeklyChallengeModule,
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

  const mod = MODULE_MAP[moduleName];
  if (!mod) return res.status(404).json({ error: 'Module not found' });

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
