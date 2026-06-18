 import { supabase, checkRateLimit, generateCsrfToken, verifyCsrf, handleSessionCheck, handleGetSession, handleContinueSession, handleSubmitAnswer, handleCompleteSession, handleGetStats, handleGetAchievements, handleGetDashboard, getTopicsForLevel, handleSetLevel, handleGetLevel } from './core.js';
import { parseAndValidateBody, requireAuth, SecurityError } from './security-middleware.js';

export async function handler(req, res, path, ctx) {
  requireAuth(ctx);

  try {
    let result;
    switch (path) {
      case 'session': result = await handleGetSession(ctx.userId, { level: req.query.level, topic: req.query.topic }); break;
      case 'session_check': result = await handleSessionCheck(ctx.userId, { level: req.query.level, topic: req.query.topic }); break;
      case 'stats': result = await handleGetStats(ctx.userId); break;
      case 'achievements': result = await handleGetAchievements(ctx.userId); break;
      case 'dashboard': result = await handleGetDashboard(ctx.userId); break;
      case 'topics': if (!req.query.level) throw new SecurityError('Level required', 400); result = await getTopicsForLevel(req.query.level); break;
      case 'first_visit': if (!req.query.level) throw new SecurityError('Level required', 400); result = { firstVisit: true }; break;
      case 'get_selected_level': result = await handleGetLevel(ctx.userId); break;
      case 'continue':
      case 'answer':
      case 'complete':
      case 'set_selected_level': {
        if (!ctx.csrfSecret) throw new SecurityError('CSRF secret not available', 403);
        verifyCsrf(req, ctx.csrfSecret, ctx.userId, ctx.fingerprint);
        const body = await parseAndValidateBody(req);
        if (path === 'continue') result = await handleContinueSession(ctx.userId, body);
        else if (path === 'answer') result = await handleSubmitAnswer(ctx.userId, body, ctx.fingerprint);
        else if (path === 'complete') result = await handleCompleteSession(ctx.userId, body);
        else if (path === 'set_selected_level') result = await handleSetLevel(ctx.userId, body.level);
        break;
      }
      default: throw new SecurityError(`Unknown path: ${path}`, 400);
    }
    const csrfToken = ctx.csrfSecret ? generateCsrfToken(ctx.csrfSecret) : null;
    return res.status(200).json({ data: result, csrf_token: csrfToken });
  } catch (error) {
    if (error instanceof SecurityError) throw error;
    if (error.message === 'Invalid CSRF token') throw new SecurityError('Invalid or missing CSRF token', 403);
    const status = error.message.includes('already completed') || error.message.includes('already answered') ? 400 : 500;
    throw new SecurityError(error.message || 'Internal server error', status);
  }
}
