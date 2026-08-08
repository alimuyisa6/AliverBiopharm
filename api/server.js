 /* api/server.js */
import { passGate, gatemanErrorResponse } from '../lib/gateman.js';
import { getVagueErrorMessage } from '../lib/threat-shield.js';

 const MODULE_MAP = {
  auth:                   () => import('../lib/auth.js'),
  admin:                  () => import('../lib/admin.js'),
  security:               () => import('../lib/security-center.js'),
  chat:                   () => import('../lib/chat.js'),
  classroom:              () => import('../lib/classroom.js'),
  community:              () => import('../lib/community.js'),
  contact:                () => import('../lib/contact.js'),
  content:                () => import('../lib/content.js'),
  'content-guide-images': () => import('../lib/content-guide-images.js'),
  curriculum:             () => import('../lib/curriculum.js'),
  'daily-challenge':      () => import('../lib/daily-challenge.js'),
  flashcards:             () => import('../lib/flashcards.js'),
  glossary:               () => import('../lib/glossary.js'),
  'institutions':         () => import('../lib/institutions.js'),      // NEW
  interactions:           () => import('../lib/interactions.js'),
  lab:                    () => import('../lib/lab.js'),
  notes:                  () => import('../lib/notes.js'),
  'past-papers':          () => import('../lib/past-papers.js'),
  'payments-escrow':      () => import('../lib/payments-escrow.js'),   // NEW
  platform:               () => import('../lib/platform.js'),
  premium:                () => import('../lib/premium.js'),
  profile:                () => import('../lib/profile.js'),
  'profile-picture':      () => import('../lib/profile-picture.js'),
  quiz:                   () => import('../lib/quiz.js'),
  recall:                 () => import('../lib/recall.js'),
  resources:              () => import('../lib/resources.js'),
  search:                 () => import('../lib/search.js'),
  'site-sections':        () => import('../lib/site.js'),
  'trust-safety':         () => import('../lib/trust-safety.js'),      // NEW
  upload:                 () => import('../lib/upload.js'),
  tutors:                 () => import('../lib/tutors.js'),
  articles:               () => import('../lib/articles.js'),
  'pdf-resources':        () => import('../lib/pdf-resources.js'),
};

export default async function handler(req, res) {
  const { module: moduleName, path } = req.query;
  const importFn = moduleName ? MODULE_MAP[moduleName] : null;

  if (!importFn) {
    const ctx = await passGate(req, res, moduleName, path);
    if (!ctx) return;
    return res.status(404).json({ error: getVagueErrorMessage() });
  }

  let mod;
  try {
    mod = await importFn();
  } catch (importErr) {
    console.error(`[IMPORT ERROR] ${moduleName}`, importErr.message);
    return res.status(500).json({ error: getVagueErrorMessage() });
  }

  const ctx = await passGate(req, res, moduleName, path);
  if (!ctx) return;

  try {
    if (mod.setContext) await mod.setContext(ctx);
    await mod.handler(req, res, path, ctx);
    if (!res.writableEnded) res.status(405).json({ error: getVagueErrorMessage() });
  } catch (err) {
    await gatemanErrorResponse(res, err, moduleName, path, ctx);
  }
}
