// /lib/recall.js
import { supabase, validateSession, hashToken, parseCookies, checkRateLimit, generateCsrfToken, verifyCsrf, handleSessionCheck, handleGetSession, handleContinueSession, handleSubmitAnswer, handleCompleteSession, handleGetStats, handleGetAchievements, handleGetDashboard, getTopicsForLevel, handleSetLevel, handleGetLevel } from './core.js';

async function parseBody(req) { const chunks = []; for await (const chunk of req) chunks.push(chunk); return JSON.parse(Buffer.concat(chunks).toString()); }

export async function handler(req, res, path, ctx) {
  const { userId, ip, csrfSecret } = ctx;
  if (!userId) return res.status(401).json({ error: 'Authentication required' });

  if (!(await checkRateLimit(ip, userId))) return res.status(429).json({ error: 'Too many requests' });

  try {
    let result;
    switch (path) {
      case 'session': result = await handleGetSession(userId, { level: req.query.level, topic: req.query.topic }); break;
      case 'session_check': result = await handleSessionCheck(userId, { level: req.query.level, topic: req.query.topic }); break;
      case 'stats': result = await handleGetStats(userId); break;
      case 'achievements': result = await handleGetAchievements(userId); break;
      case 'dashboard': result = await handleGetDashboard(userId); break;
      case 'topics': if (!req.query.level) throw new Error('Level required'); result = await getTopicsForLevel(req.query.level); break;
      case 'first_visit': if (!req.query.level) throw new Error('Level required'); result = { firstVisit: true }; break;
      case 'get_selected_level': result = await handleGetLevel(userId); break;
      case 'continue':
      case 'answer':
      case 'complete':
      case 'set_selected_level': {
        if (!csrfSecret) throw new Error('CSRF secret not available');
        verifyCsrf(req, csrfSecret, userId, ip);
        const body = await parseBody(req);
        if (path === 'continue') result = await handleContinueSession(userId, body);
        else if (path === 'answer') result = await handleSubmitAnswer(userId, body, ip);
        else if (path === 'complete') result = await handleCompleteSession(userId, body);
        else if (path === 'set_selected_level') result = await handleSetLevel(userId, body.level);
        break;
      }
      default: return res.status(400).json({ error: `Unknown path: ${path}` });
    }
    const csrfToken = csrfSecret ? generateCsrfToken(csrfSecret) : null;
    return res.status(200).json({ data: result, csrf_token: csrfToken });
  } catch (error) {
    if (error.message === 'Invalid CSRF token') return res.status(403).json({ error: 'Invalid or missing CSRF token' });
    const status = error.message.includes('already completed') || error.message.includes('already answered') ? 400 : 500;
    return res.status(status).json({ error: error.message || 'Internal server error' });
  }
}
