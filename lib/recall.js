 import { checkRateLimit, generateCsrfToken, verifyCsrf, handleSessionCheck, handleGetSession, handleContinueSession, handleSubmitAnswer, handleCompleteSession, handleGetStats, handleGetAchievements, handleGetDashboard, getTopicsForLevel, handleSetLevel, handleGetLevel } from './core.js';
import { parseAndValidateBody, requireAuth, SecurityError } from './security-middleware.js';
import { getNotifications, markNotificationRead, markAllNotificationsRead, dismissNotification, getNotificationPreferences, updateNotificationPreferences } from './notifications.js';
export async function handler(req, res, path, ctx) {
  requireAuth(ctx);

  const rateLimitKey = ctx.userId ? `${ctx.fingerprint}:${ctx.userId}` : ctx.fingerprint;
  const rl = checkRateLimit(rateLimitKey);
  if (!rl.allowed) {
    throw new SecurityError('Too many requests, please slow down', 429);
  }

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
      case 'set_selected_level': {
        const body = await parseAndValidateBody(req);
        result = await handleSetLevel(ctx.userId, body.level);
        break;
      }
      case 'continue': {
        const body = await parseAndValidateBody(req);
        result = await handleContinueSession(ctx.userId, body);
        break;
      }
      case 'answer': {
        const body = await parseAndValidateBody(req);
        result = await handleSubmitAnswer(ctx.userId, body, ctx.fingerprint);
        break;
      }
      case 'complete': {
        const body = await parseAndValidateBody(req);
        result = await handleCompleteSession(ctx.userId, body);
        break;
      }
     case 'notifications': result = await getNotifications(ctx.userId, { limit: parseInt(req.query.limit) || 50, offset: parseInt(req.query.offset) || 0, module: req.query.module || null, unreadOnly: req.query.unreadOnly === 'true' }); break;
case 'notification_read': { const body = await parseAndValidateBody(req); await markNotificationRead(ctx.userId, body.notification_id); result = { success: true }; break; }
case 'notification_read_all': await markAllNotificationsRead(ctx.userId); result = { success: true }; break;
case 'notification_dismiss': { const body = await parseAndValidateBody(req); await dismissNotification(ctx.userId, body.notification_id); result = { success: true }; break; }
case 'notification_prefs': result = await getNotificationPreferences(ctx.userId); break;
case 'notification_prefs_update': { const body = await parseAndValidateBody(req); await updateNotificationPreferences(ctx.userId, body.preferences); result = { success: true }; break; }
     
     default: throw new SecurityError(`Unknown path: ${path}`, 400);
    }
    return res.status(200).json({ data: result });
  } catch (error) {
    if (error instanceof SecurityError) throw error;
    const status = error.message.includes('already completed') || error.message.includes('already answered') ? 400 : 500;
    throw new SecurityError(error.message || 'Internal server error', status);
  }
}
