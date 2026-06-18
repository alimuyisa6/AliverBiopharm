 import { supabase } from './core.js';
import { parseAndValidateBody, requireAdmin, requireSuperAdmin, SecurityError } from './security-middleware.js';

export async function handler(req, res, path, ctx) {
  requireAdmin(ctx);

  if (req.method === 'GET') {
    switch (path) {
      case 'stats': return getAdminStats(req, res);
      case 'submissions': return getSubmissions(req, res);
      case 'messages': return getContactMessages(req, res);
      case 'get_admin_users': return getAdminUsers(req, res);
      case 'get_newsletter_subscribers': return getNewsletterSubscribers(req, res);
      case 'get_donations': return getDonations(req, res);
      case 'get_page_activity': return getPageActivity(req, res, ctx);
      default: throw new SecurityError('Invalid action', 400);
    }
  }

  if (req.method === 'POST') {
    const body = await parseAndValidateBody(req);
    switch (path) {
      case 'update_user_role': requireSuperAdmin(ctx); return updateUserRole(body, res, ctx);
      case 'update_user_lock': requireSuperAdmin(ctx); return updateUserLock(body, res, ctx);
      case 'update_user_restriction': requireSuperAdmin(ctx); return updateUserRestriction(body, res, ctx);
      case 'update_app_feature': return updateAppFeature(body, res, ctx);
      case 'delete_quiz_topic': requireSuperAdmin(ctx); return deleteQuizTopic(body, res, ctx);
      default: throw new SecurityError('Invalid action', 400);
    }
  }

  throw new SecurityError('Method not allowed', 405);
}

async function getAdminStats(req, res) {
  const [rc, sc, mc] = await Promise.all([
    supabase.from('biology_notes').select('id', { count: 'exact', head: true }),
    supabase.from('resource_submissions').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('contact_messages').select('id', { count: 'exact', head: true })
  ]);
  return res.status(200).json({ resources: rc.count || 0, pendingSubmissions: sc.count || 0, messages: mc.count || 0, donations: 0 });
}

async function getSubmissions(req, res) {
  const { data, error } = await supabase.from('resource_submissions').select('*').order('created_at', { ascending: false }).limit(50);
  if (error) throw new SecurityError('Failed to fetch submissions', 500);
  return res.status(200).json(data || []);
}

async function getContactMessages(req, res) {
  const { data, error } = await supabase.from('contact_messages').select('*').order('created_at', { ascending: false }).limit(50);
  if (error) throw new SecurityError('Failed to fetch messages', 500);
  return res.status(200).json({ messages: data || [] });
}

async function getAdminUsers(req, res) {
  const { data } = await supabase.from('admin_master').select('*');
  return res.status(200).json((data || []).map(a => ({ admin_id: a.admin_id, admin_email: a.admin_email, admin_role: a.admin_role, permissions: a.permissions, is_active: a.is_active, is_locked: a.is_locked || false, last_login: a.last_login || null })));
}

async function getNewsletterSubscribers(req, res) {
  const { data } = await supabase.from('newsletter_subscribers').select('*').order('created_at', { ascending: false });
  return res.status(200).json(data || []);
}

async function getDonations(req, res) {
  const { data } = await supabase.from('momo_donations').select('*').order('created_at', { ascending: false }).limit(50);
  return res.status(200).json(data || []);
}

async function getPageActivity(req, res, ctx) {
  requireSuperAdmin(ctx);
  const { data, error } = await supabase.from('page_activity').select('*').order('created_at', { ascending: false }).limit(100);
  if (error) throw new SecurityError('Failed to fetch page activity', 500);
  const activities = [];
  for (const act of (data || [])) {
    const activity = { ...act };
    if (act.user_id) {
      try { const { data: { user } } = await supabase.auth.admin.getUserById(act.user_id); activity.user_email = user?.email || 'Unknown'; activity.user_name = user?.email ? user.email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'User'; } catch { activity.user_email = 'Unknown'; activity.user_name = 'User'; }
    }
    activities.push(activity);
  }
  return res.status(200).json(activities);
}

async function updateUserRole(body, res, ctx) {
  const { userId, role } = body;
  if (!userId || !role) throw new SecurityError('userId and role required', 400);
  if (role === 'super_admin') throw new SecurityError('Cannot promote to super admin via API', 403);
  if (role === 'admin' || role === 'content_manager' || role === 'resource_manager') {
    const { data: existingAdmin } = await supabase.from('admin_master').select('id').eq('admin_id', userId).maybeSingle();
    if (!existingAdmin) {
      const { data: { user } } = await supabase.auth.admin.getUserById(userId);
      await supabase.from('admin_master').insert({ admin_id: userId, admin_email: user?.email || '', admin_role: role, permissions: { can_manage_resources: true, can_manage_site_sections: role !== 'resource_manager', can_view_analytics: true, can_upload_files: true }, is_active: true, created_at: new Date().toISOString() });
    } else {
      await supabase.from('admin_master').update({ admin_role: role, is_active: true, updated_at: new Date().toISOString() }).eq('admin_id', userId);
    }
  }
  return res.status(200).json({ success: true });
}

async function updateUserLock(body, res, ctx) {
  const { userId, lock, reason } = body;
  if (!userId) throw new SecurityError('userId required', 400);
  if (lock) {
    await supabase.from('admin_master').update({ is_locked: true, lock_reason: reason || 'Locked by admin', locked_by: ctx.adminData.id, locked_at: new Date().toISOString() }).eq('admin_id', userId);
  } else {
    await supabase.from('admin_master').update({ is_locked: false, lock_reason: null, locked_by: null, locked_at: null }).eq('admin_id', userId);
  }
  return res.status(200).json({ success: true });
}

async function updateUserRestriction(body, res, ctx) {
  const { userId, restriction_type, reason, duration_hours } = body;
  if (!userId || !restriction_type) throw new SecurityError('userId and restriction_type required', 400);
  if (restriction_type === 'disabled') {
    await supabase.from('user_restrictions').upsert({ user_id: userId, restriction_type: 'disabled', lock_reason: reason || '', locked_by: ctx.adminData.admin_id || ctx.adminData.id, locked_at: new Date().toISOString(), is_permanent: true, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  } else if (restriction_type === 'suspended') {
    await supabase.from('user_restrictions').upsert({ user_id: userId, restriction_type: 'suspended', lock_reason: reason || '', locked_by: ctx.adminData.admin_id || ctx.adminData.id, locked_at: new Date().toISOString(), is_permanent: true, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  } else if (restriction_type === 'locked') {
    const expiresAt = new Date(Date.now() + (duration_hours || 24) * 60 * 60 * 1000).toISOString();
    await supabase.from('user_restrictions').upsert({ user_id: userId, restriction_type: 'locked', lock_reason: reason || '', locked_by: ctx.adminData.admin_id || ctx.adminData.id, locked_at: new Date().toISOString(), expires_at: expiresAt, is_permanent: false, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  } else if (restriction_type === 'remove') {
    await supabase.from('user_restrictions').delete().eq('user_id', userId);
  }
  await supabase.from('user_sessions').update({ is_active: false, terminated_reason: `admin_${restriction_type}`, terminated_at: new Date().toISOString() }).eq('user_id', userId).eq('is_active', true);
  return res.status(200).json({ success: true });
}

async function updateAppFeature(body, res, ctx) {
  const { feature_key, settings, is_enabled } = body;
  if (!feature_key) throw new SecurityError('feature_key required', 400);
  await supabase.from('app_features').update({ settings: settings || {}, is_enabled: is_enabled !== undefined ? is_enabled : true, updated_at: new Date().toISOString(), updated_by: ctx.userId }).eq('feature_key', feature_key);
  return res.status(200).json({ success: true });
}

async function deleteQuizTopic(body, res, ctx) {
  const { topic, level } = body;
  if (!topic || !level) throw new SecurityError('topic and level required', 400);
  await supabase.from('quiz_questions').delete().eq('level', level).eq('topic', topic);
  await supabase.from('quiz_topics').delete().eq('level', level).eq('topic_name', topic);
  return res.status(200).json({ success: true });
}
