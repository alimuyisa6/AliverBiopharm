// /api/server.js
import { setCorsHeaders, parseCookies, hashToken, validateSession, isAdmin, getClientIp, checkRateLimit, supabase, generateCsrfToken } from '../lib/core.js';
import * as auth from '../lib/auth.js';
import * as admin from '../lib/admin.js';
import * as chat from '../lib/chat.js';
import * as community from '../lib/community.js';
import * as contact from '../lib/contact.js';
import * as flashcards from '../lib/flashcards.js';
import * as interactions from '../lib/interactions.js';
import * as pastPapers from '../lib/past-papers.js';
import * as quiz from '../lib/quiz.js';
import * as recall from '../lib/recall.js';
import * as resources from '../lib/resources.js';
import * as site from '../lib/site.js';
import * as weeklyChallenge from '../lib/weekly-challenge.js';

const modules = {
  auth, admin, chat, community, contact, flashcards,
  interactions, 'past-papers': pastPapers, quiz, recall,
  resources, site, 'weekly-challenge': weeklyChallenge
};

export default async function handler(req, res) {
  setCorsHeaders(res, req);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { module: moduleName, path } = req.query;
  if (!moduleName || !path) return res.status(400).json({ error: 'module and path required' });

  const mod = modules[moduleName];
  if (!mod) return res.status(404).json({ error: 'Module not found' });

  const cookies = parseCookies(req);
  const token = cookies.session || '';
  let userId = null, adminData = null, csrfSecret = null;
  const ip = getClientIp(req);

  if (token) {
    const session = await validateSession(token);
    if (session) {
      userId = session.user_id;
      adminData = await isAdmin(userId, ip);
      const { data: sessData } = await supabase.from('user_sessions').select('csrf_secret').eq('session_token_hash', hashToken(token)).single();
      csrfSecret = sessData?.csrf_secret || null;
    }
  }

  if (userId && !(await checkRateLimit(ip, userId))) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  const ctx = { userId, adminData, ip, csrfSecret };
  try {
    await mod.handler(req, res, path, ctx);
    if (!res.writableEnded) res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    if (!res.writableEnded) res.status(500).json({ error: err.message || 'Internal error' });
  }
}
