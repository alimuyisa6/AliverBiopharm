 import {
  checkRateLimit,
  generateCsrfToken,
  verifyCsrf,
  handleSessionCheck,
  handleGetSession,
  handleContinueSession,
  handleSubmitAnswer,
  handleCompleteSession,
  handleGetStats,
  handleGetAchievements,
  handleGetDashboard,
  getTopicsForLevel,
  handleSetLevel,
  handleGetLevel,
  canAccessLevel,
  isAdmin,
  isValidLevel,
  supabase
} from './core.js';
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

    const userLevel = ctx.userId ? await getUserEffectiveLevel(ctx.userId) : null;

    const adminData = await isAdmin(ctx.userId, 'unknown');
    const isAdminUser = !!(adminData && adminData.admin_role);

    switch (path) {
      case 'session': {
        const { level, topic, class_name } = req.query;
        if (level && !isAdminUser) {
          const canAccess = await canAccessLevel(ctx.userId, level);
          if (!canAccess) throw new SecurityError('You do not have access to this level', 403);
        }
        result = await handleGetSession(ctx.userId, { level: level || userLevel, topic, class_name: class_name || null });
        break;
      }

      case 'session_check': {
        const { level, topic, class_name } = req.query;
        if (level && !isAdminUser) {
          const canAccess = await canAccessLevel(ctx.userId, level);
          if (!canAccess) throw new SecurityError('You do not have access to this level', 403);
        }
        result = await handleSessionCheck(ctx.userId, { level: level || userLevel, topic, class_name: class_name || null });
        break;
      }

      case 'stats':
        result = await handleGetStats(ctx.userId);
        break;

      case 'achievements':
        result = await handleGetAchievements(ctx.userId);
        break;

      case 'dashboard':
        result = await handleGetDashboard(ctx.userId);
        break;

      case 'topics': {
        const { level, class_name } = req.query;
        if (!level) throw new SecurityError('Level required', 400);
        if (!isAdminUser) {
          const canAccess = await canAccessLevel(ctx.userId, level);
          if (!canAccess) throw new SecurityError('You do not have access to this level', 403);
        }
        result = await getTopicsForLevel(level, class_name || null);
        break;
      }

      case 'first_visit': {
        const { level } = req.query;
        if (!level) throw new SecurityError('Level required', 400);
        if (!isAdminUser) {
          const canAccess = await canAccessLevel(ctx.userId, level);
          if (!canAccess) throw new SecurityError('You do not have access to this level', 403);
        }
        result = { firstVisit: true };
        break;
      }

      case 'get_selected_level':
        result = await handleGetLevel(ctx.userId);
        break;

      case 'set_selected_level': {
        const body = await parseAndValidateBody(req);
        const { level } = body;
        if (!isValidLevel(level)) throw new SecurityError('Invalid level', 400);
        if (!isAdminUser) {
          const canAccess = await canAccessLevel(ctx.userId, level);
          if (!canAccess) throw new SecurityError('You do not have access to this level', 403);
        }
        result = await handleSetLevel(ctx.userId, level);
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

      case 'notifications':
        result = await getNotifications(ctx.userId, {
          limit: parseInt(req.query.limit) || 50,
          offset: parseInt(req.query.offset) || 0,
          module: req.query.module || null,
          unreadOnly: req.query.unreadOnly === 'true'
        });
        break;

      case 'notification_read': {
        const body = await parseAndValidateBody(req);
        await markNotificationRead(ctx.userId, body.notification_id);
        result = { success: true };
        break;
      }

      case 'notification_read_all':
        await markAllNotificationsRead(ctx.userId);
        result = { success: true };
        break;

      case 'notification_dismiss': {
        const body = await parseAndValidateBody(req);
        await dismissNotification(ctx.userId, body.notification_id);
        result = { success: true };
        break;
      }

      case 'notification_prefs':
        result = await getNotificationPreferences(ctx.userId);
        break;

      case 'notification_prefs_update': {
        const body = await parseAndValidateBody(req);
        await updateNotificationPreferences(ctx.userId, body.preferences);
        result = { success: true };
        break;
      }

      default:
        throw new SecurityError(`Unknown path: ${path}`, 400);
    }
    return res.status(200).json({ data: result });
  } catch (error) {
    if (error instanceof SecurityError) throw error;
    const status = error.message.includes('already completed') || error.message.includes('already answered') ? 400 : 500;
    throw new SecurityError(error.message || 'Internal server error', status);
  }
}

async function getUserEffectiveLevel(userId) {
  if (!userId) return null;

  const adminData = await isAdmin(userId, 'unknown');
  if (adminData && adminData.admin_role) return 'ALL';

  const { data: profile, error } = await supabase
    .from('user_profiles')
    .select('role, track, is_approved_teacher, approved_track')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !profile) return null;

  if (profile.role === 'student') {
    return profile.track;
  }

  if (profile.role === 'teacher') {
    if (!profile.is_approved_teacher) return null;
    return profile.approved_track || profile.track;
  }

  return null;
}
