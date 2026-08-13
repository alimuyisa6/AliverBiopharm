 /* lib/security-center.js */
import { supabase, auditLog } from './core.js';
import {
  parseAndValidateBody,
  requireAuth,
  requireSuperAdmin,
  requireMfaEnrolled,
  SecurityError
} from './security-middleware.js';
import {
  blockIp,
  unblockIp,
  killAllSessionsForUser,
  killAllSessionsForIp
} from './threat-shield.js';

export async function handler(req, res, path, ctx) {
  if (path === 'ui_lock') {
    requireAuth(ctx);
    return getUiLock(req, res, ctx);
  }

  requireSuperAdmin(ctx);
  requireMfaEnrolled(ctx);

  if (req.method === 'GET') {
    switch (path) {
      case 'get_dashboard':
        return getDashboard(req, res);
      case 'get_events':
        return getEvents(req, res);
      case 'get_alerts':
        return getAlerts(req, res);
      case 'get_blocked_ips':
        return getBlockedIps(req, res);
      default:
        throw new SecurityError('Invalid action', 400);
    }
  }

  if (req.method === 'POST') {
    const body = await parseAndValidateBody(req);

    switch (path) {
      case 'block_ip':
        return blockIpHandler(body, res, ctx);
      case 'unblock_ip':
        return unblockIpHandler(body, res, ctx);
      case 'kill_user_sessions':
        return killUserSessionsHandler(body, res, ctx);
      case 'kill_ip_sessions':
        return killIpSessionsHandler(body, res, ctx);
      case 'resolve_alert':
        return resolveAlertHandler(body, res, ctx);
      default:
        throw new SecurityError('Invalid action', 400);
    }
  }

  throw new SecurityError('Method not allowed', 405);
}

async function getUiLock(req, res, ctx) {
  const { data } = await supabase.rpc('get_ui_security_lock', {
    p_user_id: ctx.userId
  });

  return res.status(200).json(data || { locked: false });
}

async function getDashboard(req, res) {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [
    { count: critical },
    { count: high },
    { count: total },
    { count: activeBlocks },
    { data: recentAlerts }
  ] = await Promise.all([
    supabase.from('security_events').select('id', { count: 'exact', head: true }).eq('severity', 'critical').gte('created_at', since24h),
    supabase.from('security_events').select('id', { count: 'exact', head: true }).eq('severity', 'high').gte('created_at', since24h),
    supabase.from('security_events').select('id', { count: 'exact', head: true }).gte('created_at', since24h),
    supabase.from('blocked_ips').select('id', { count: 'exact', head: true }),
    supabase.from('security_alerts').select('*').eq('is_resolved', false).order('created_at', { ascending: false }).limit(20)
  ]);

  return res.status(200).json({
    last_24h: {
      critical: critical || 0,
      high: high || 0,
      total: total || 0
    },
    active_blocks: activeBlocks || 0,
    open_alerts: recentAlerts || []
  });
}

async function getEvents(req, res) {
  const { severity, limit } = req.query;
  const parsedLimit = Math.min(parseInt(limit, 10) || 100, 500);

  let query = supabase
    .from('security_events')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(parsedLimit);

  if (severity) query = query.eq('severity', severity);

  const { data } = await query;

  return res.status(200).json({ events: data || [] });
}

async function getAlerts(req, res) {
  const { resolved } = req.query;

  let query = supabase
    .from('security_alerts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);

  if (resolved !== undefined) query = query.eq('is_resolved', resolved === 'true');

  const { data } = await query;

  return res.status(200).json({ alerts: data || [] });
}

async function getBlockedIps(req, res) {
  const { data } = await supabase
    .from('blocked_ips')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500);

  return res.status(200).json({ blocked: data || [] });
}

async function blockIpHandler(body, res, ctx) {
  const { ip, reason, duration_hours } = body;

  if (!ip) throw new SecurityError('ip required', 400);
  if (ip === ctx.clientIp) throw new SecurityError('You cannot block your own current IP address', 400);

  await blockIp(ip, reason || 'Blocked by admin', ctx.userId, duration_hours || null);
  await killAllSessionsForIp(ip, 'admin_manual_block');

  await auditLog({
    actorId: ctx.userId,
    actorRole: ctx.adminData?.admin_role,
    action: 'block_ip',
    targetType: 'ip',
    targetId: ip,
    metadata: { reason: reason || null, duration_hours: duration_hours || null }
  });

  return res.status(200).json({ success: true });
}

async function unblockIpHandler(body, res, ctx) {
  const { ip } = body;

  if (!ip) throw new SecurityError('ip required', 400);

  await unblockIp(ip);

  await auditLog({
    actorId: ctx.userId,
    actorRole: ctx.adminData?.admin_role,
    action: 'unblock_ip',
    targetType: 'ip',
    targetId: ip
  });

  return res.status(200).json({ success: true });
}

async function killUserSessionsHandler(body, res, ctx) {
  const { userId, reason } = body;

  if (!userId) throw new SecurityError('userId required', 400);
  if (userId === ctx.userId) throw new SecurityError('You cannot kill your own active sessions from here', 400);

  await killAllSessionsForUser(userId, reason || 'admin_manual_kill');

  await auditLog({
    actorId: ctx.userId,
    actorRole: ctx.adminData?.admin_role,
    action: 'kill_user_sessions',
    targetType: 'user',
    targetId: userId,
    metadata: { reason: reason || null }
  });

  return res.status(200).json({ success: true });
}

async function killIpSessionsHandler(body, res, ctx) {
  const { ip, reason } = body;

  if (!ip) throw new SecurityError('ip required', 400);
  if (ip === ctx.clientIp) throw new SecurityError('You cannot kill sessions on your own current IP address', 400);

  await killAllSessionsForIp(ip, reason || 'admin_manual_kill');

  await auditLog({
    actorId: ctx.userId,
    actorRole: ctx.adminData?.admin_role,
    action: 'kill_ip_sessions',
    targetType: 'ip',
    targetId: ip,
    metadata: { reason: reason || null }
  });

  return res.status(200).json({ success: true });
}

async function resolveAlertHandler(body, res, ctx) {
  const { alertId } = body;

  if (!alertId) throw new SecurityError('alertId required', 400);

  await supabase.from('security_alerts').update({
    is_resolved: true,
    resolved_by: ctx.userId,
    resolved_at: new Date().toISOString()
  }).eq('id', alertId);

  await auditLog({
    actorId: ctx.userId,
    actorRole: ctx.adminData?.admin_role,
    action: 'resolve_alert',
    targetType: 'alert',
    targetId: alertId
  });

  return res.status(200).json({ success: true });
}
