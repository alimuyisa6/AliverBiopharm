import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

function setCorsHeaders(res, req) {
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'https://aliverbiopharm.com').split(',').map(o => o.trim());
  const requestOrigin = req.headers.origin || '';
  const corsOrigin = allowedOrigins.includes(requestOrigin) ? requestOrigin : allowedOrigins[0];
  res.setHeader('Access-Control-Allow-Origin', corsOrigin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-CSRF-Token, Cookie');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Cache-Control', 'no-store, must-revalidate');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
}

function parseCookies(req) {
  const cookieHeader = req.headers.cookie || '';
  return Object.fromEntries(cookieHeader.split(';').map(c => {
    const [k, ...v] = c.trim().split('=');
    return [k.trim(), decodeURIComponent(v.join('='))];
  }));
}

function hashToken(token) { return require('crypto').createHash('sha256').update(token).digest('hex'); }

async function validateSession(token) {
  if (!token || token.length < 20) return null;
  const hashedToken = hashToken(token);
  const { data, error } = await supabase.from('user_sessions').select('user_id, expires_at, is_active').eq('session_token_hash', hashedToken).eq('is_active', true).single();
  if (error || !data) return null;
  if (new Date(data.expires_at) < new Date()) {
    await supabase.from('user_sessions').update({ is_active: false }).eq('session_token_hash', hashedToken);
    return null;
  }
  return data;
}

async function isAdmin(userId, ip) {
  if (!userId) return null;
  const { data } = await supabase.from('admin_master').select('admin_role, permissions, is_active, is_locked, ip_whitelist').eq('admin_id', userId).eq('is_active', true).maybeSingle();
  if (!data) return null;
  if (data.ip_whitelist && data.ip_whitelist.length > 0 && !data.ip_whitelist.includes(ip)) return null;
  return data;
}

export default async function handler(req, res) {
  setCorsHeaders(res, req);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { path } = req.query;
  const cookies = parseCookies(req);
  const token = cookies.session || '';
  let userId = null;
  let adminData = null;
  if (token) {
    const session = await validateSession(token);
    if (session) userId = session.user_id;
    adminData = await isAdmin(userId, req.headers['x-forwarded-for'] || 'unknown');
  }
  if (!adminData) return res.status(403).json({ error: 'Admin access required' });

  if (req.method === 'GET') {
    switch (path) {
      case 'stats': return getAdminStats(req, res);
      case 'submissions': return getSubmissions(req, res);
      case 'messages': return getContactMessages(req, res);
      case 'get_admin_users': return getAdminUsers(req, res);
      case 'get_newsletter_subscribers': return getNewsletterSubscribers(req, res);
      case 'get_donations': return getDonations(req, res);
      case 'get_page_activity': return getPageActivity(req, res, adminData);
      default: return res.status(400).json({ error: 'Invalid action' });
    }
  }
  if (req.method === 'POST') {
    switch (path) {
      case 'update_user_role': return updateUserRole(req, res, adminData);
      case 'update_user_lock': return updateUserLock(req, res, adminData);
      case 'update_user_restriction': return updateUserRestriction(req, res, adminData);
      case 'update_app_feature': return updateAppFeature(req, res);
      case 'delete_quiz_topic': return deleteQuizTopic(req, res, adminData);
      default: return res.status(400).json({ error: 'Invalid action' });
    }
  }
  res.status(405).json({ error: 'Method not allowed' });
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
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json(data || []);
}

async function getContactMessages(req, res) {
  const { data, error } = await supabase.from('contact_messages').select('*').order('created_at', { ascending: false }).limit(50);
  if (error) return res.status(500).json({ error: error.message });
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

async function getPageActivity(req, res, adminData) {
  if (adminData.admin_role !== 'super_admin') return res.status(403).json({ error: 'Super admin access required' });
  const { data, error } = await supabase.from('page_activity').select('*').order('created_at', { ascending: false }).limit(100);
  if (error) return res.status(500).json({ error: error.message });
  const activities = [];
  for (const act of (data || [])) {
    const activity = { ...act };
    if (act.user_id) {
      try {
        const { data: { user } } = await supabase.auth.admin.getUserById(act.user_id);
        activity.user_email = user?.email || 'Unknown';
        activity.user_name = user?.email ? user.email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'User';
      } catch { activity.user_email = 'Unknown'; activity.user_name = 'User'; }
    }
    activities.push(activity);
  }
  return res.status(200).json(activities);
}

async function updateUserRole(req, res, adminData) {
  if (adminData.admin_role !== 'super_admin') return res.status(403).json({ error: 'Super admin only' });
  const { userId, role } = req.body;
  if (!userId || !role) return res.status(400).json({ error: 'userId and role required' });
  if (role === 'super_admin') return res.status(403).json({ error: 'Cannot promote to super admin via API' });
  if (role === 'admin' || role === 'content_manager' || role === 'resource_manager') {
    const { data: existingAdmin } = await supabase.from('admin_master').select('id').eq('admin_id', userId).maybeSingle();
    if (!existingAdmin) {
      const { data: { user } } = await supabase.auth.admin.getUserById(userId);
      await supabase.from('admin_master').insert({ admin_id: userId, admin_email: user?.email || '', admin_role: role, permissions: { can_manage_resources: true, can_manage_site_sections: role !== 'resource_manager', can_view_analytics: true, can_upload_files: true } });
    } else {
      await supabase.from('admin_master').update({ admin_role: role, is_active: true }).eq('admin_id', userId);
    }
  }
  return res.status(200).json({ success: true });
}

async function updateUserLock(req, res, adminData) {
  if (adminData.admin_role !== 'super_admin') return res.status(403).json({ error: 'Super admin only' });
  const { userId, lock, reason } = req.body;
  if (lock) {
    await supabase.from('admin_master').update({ is_locked: true, lock_reason: reason || 'Locked by admin' }).eq('admin_id', userId);
  } else {
    await supabase.from('admin_master').update({ is_locked: false, lock_reason: null }).eq('admin_id', userId);
  }
  return res.status(200).json({ success: true });
}

async function updateUserRestriction(req, res, adminData) {
  if (adminData.admin_role !== 'super_admin') return res.status(403).json({ error: 'Super admin only' });
  const { userId, restriction_type, reason, duration_hours } = req.body;
  if (!userId || !restriction_type) return res.status(400).json({ error: 'userId and restriction_type required' });
  if (restriction_type === 'disabled') {
    await supabase.from('user_restrictions').upsert({ user_id: userId, restriction_type: 'disabled', lock_reason: reason || '', locked_by: adminData.admin_id, locked_at: new Date().toISOString(), is_permanent: true, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  } else if (restriction_type === 'suspended') {
    await supabase.from('user_restrictions').upsert({ user_id: userId, restriction_type: 'suspended', lock_reason: reason || '', locked_by: adminData.admin_id, locked_at: new Date().toISOString(), is_permanent: true, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  } else if (restriction_type === 'locked') {
    const expiresAt = new Date(Date.now() + (duration_hours || 24) * 60 * 60 * 1000).toISOString();
    await supabase.from('user_restrictions').upsert({ user_id: userId, restriction_type: 'locked', lock_reason: reason || '', locked_by: adminData.admin_id, locked_at: new Date().toISOString(), expires_at: expiresAt, is_permanent: false, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  } else if (restriction_type === 'remove') {
    await supabase.from('user_restrictions').delete().eq('user_id', userId);
  }
  return res.status(200).json({ success: true });
}

async function updateAppFeature(req, res) {
  const { feature_key, settings, is_enabled } = req.body;
  await supabase.from('app_features').update({ settings: settings || {}, is_enabled: is_enabled !== undefined ? is_enabled : true, updated_at: new Date().toISOString() }).eq('feature_key', feature_key);
  return res.status(200).json({ success: true });
}

async function deleteQuizTopic(req, res, adminData) {
  if (adminData.admin_role !== 'super_admin') return res.status(403).json({ error: 'Super admin only' });
  const { topic, level } = req.body;
  if (!topic || !level) return res.status(400).json({ error: 'topic and level required' });
  await supabase.from('quiz_questions').delete().eq('level', level).eq('topic', topic);
  await supabase.from('quiz_topics').delete().eq('level', level).eq('topic_name', topic);
  return res.status(200).json({ success: true });
}
