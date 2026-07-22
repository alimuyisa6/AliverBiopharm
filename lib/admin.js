 import { supabase, getUserProfileName, auditLog, generateTotpSecret, verifyTotp, totpProvisioningUri } from './core.js';
import { parseAndValidateBody, requireAdmin, requireSuperAdmin, SecurityError } from './security-middleware.js';
import { createBulkNotifications } from './notifications.js';

const VALID_ASSIGNABLE_ROLES = ['admin', 'content_manager', 'resource_manager'];
const VALID_RESTRICTION_TYPES = ['disabled', 'suspended', 'locked', 'remove'];
const VALID_TRACKS = ['O-Level', 'A-Level', 'Pharmacy', 'ALL'];

export async function handler(req, res, path, ctx) {
  requireAdmin(ctx);

  if (req.method === 'GET') {
    switch (path) {
      case 'stats': return getAdminStats(req, res);
      case 'submissions': return getSubmissions(req, res);
      case 'messages': return getContactMessages(req, res);
      case 'get_admin_users': return getAdminUsers(req, res);
      case 'list_users': return listUsers(req, res);
      case 'list_teacher_applications': return listTeacherApplications(req, res);
      case 'get_teacher_status': return getTeacherStatus(req, res, ctx);
      case 'get_newsletter_subscribers': return getNewsletterSubscribers(req, res);
      case 'get_donations': return getDonations(req, res);
      case 'get_page_activity': return getPageActivity(req, res, ctx);
      case 'get_notification_stats': requireSuperAdmin(ctx); return getNotificationStats(req, res);
      case 'get_app_features': return getAppFeatures(req, res);
      case 'get_user_activity_trace': return getUserActivityTrace(req, res, ctx);
      case 'get_audit_log': requireSuperAdmin(ctx); return getAuditLog(req, res);
      default: throw new SecurityError('Invalid action', 400);
    }
  }

  if (req.method === 'POST') {
    const body = await parseAndValidateBody(req);
    switch (path) {
      case 'update_user_role': requireSuperAdmin(ctx); return updateUserRole(body, res, ctx);
      case 'update_user_lock': requireSuperAdmin(ctx); return updateUserLock(body, res, ctx);
      case 'update_user_restriction': requireSuperAdmin(ctx); return updateUserRestriction(body, res, ctx);
      case 'update_app_feature': requireSuperAdmin(ctx); return updateAppFeature(body, res, ctx);
      case 'delete_quiz_topic': requireSuperAdmin(ctx); return deleteQuizTopic(body, res, ctx);
      case 'send_notification': requireSuperAdmin(ctx); return sendBulkNotification(body, res, ctx);
      case 'setup_mfa': return setupMfa(body, res, ctx);
      case 'confirm_mfa': return confirmMfa(body, res, ctx);
      case 'disable_mfa': requireSuperAdmin(ctx); return disableMfa(body, res, ctx);
      case 'approve_teacher': requireAdmin(ctx); return approveTeacher(body, res, ctx);
      case 'reject_teacher': requireAdmin(ctx); return rejectTeacher(body, res, ctx);
      default: throw new SecurityError('Invalid action', 400);
    }
  }

  throw new SecurityError('Method not allowed', 405);
}

async function getAdminStats(req, res) {
  const [rc, sc, mc, tc] = await Promise.all([
    supabase.from('biology_notes').select('id', { count: 'exact', head: true }),
    supabase.from('resource_submissions').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('contact_messages').select('id', { count: 'exact', head: true }),
    supabase.from('user_profiles').select('id', { count: 'exact', head: true }).eq('is_approved_teacher', false).eq('role', 'teacher')
  ]);
  return res.status(200).json({
    resources: rc.count || 0,
    pendingSubmissions: sc.count || 0,
    messages: mc.count || 0,
    pendingTeachers: tc.count || 0,
    donations: 0
  });
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
  return res.status(200).json((data || []).map(a => ({
    admin_id: a.admin_id,
    admin_email: a.admin_email,
    admin_role: a.admin_role,
    permissions: a.permissions,
    is_active: a.is_active,
    is_locked: a.is_locked || false,
    last_login: a.last_login || null,
    mfa_enabled: a.mfa_enabled || false
  })));
}

async function listUsers(req, res) {
  const { data: authData, error: authError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (authError) throw new SecurityError('Failed to fetch users', 500);

  const users = authData?.users || [];
  const userIds = users.map(u => u.id);

  const [{ data: admins }, { data: restrictions }, { data: presence }, { data: profiles }] = await Promise.all([
    supabase.from('admin_master').select('admin_id, admin_role'),
    supabase.from('user_restrictions').select('user_id, restriction_type, expires_at'),
    userIds.length ? supabase.from('user_presence').select('user_id, last_seen').in('user_id', userIds) : Promise.resolve({ data: [] }),
    userIds.length ? supabase.from('user_profiles').select('user_id, role, track, class_name, is_approved_teacher, approved_track').in('user_id', userIds) : Promise.resolve({ data: [] })
  ]);

  const adminMap = new Map((admins || []).map(a => [a.admin_id, a.admin_role]));
  const restrictionMap = new Map((restrictions || []).map(r => [r.user_id, r]));
  const presenceMap = new Map((presence || []).map(p => [p.user_id, p.last_seen]));
  const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));

  const profileNames = await Promise.all(users.map(u => getUserProfileName(u.id)));

  const list = users.map((u, idx) => {
    const restriction = restrictionMap.get(u.id);
    const profile = profileMap.get(u.id);
    const profileName = profileNames[idx];
    return {
      id: u.id,
      email: u.email || '—',
      display_name: profileName || u.email || '—',
      created_at: u.created_at,
      last_active: presenceMap.get(u.id) || null,
      is_admin: adminMap.has(u.id),
      admin_role: adminMap.get(u.id) || null,
      role: profile?.role || 'student',
      track: profile?.track || null,
      class_name: profile?.class_name || null,
      is_approved_teacher: profile?.is_approved_teacher || false,
      approved_track: profile?.approved_track || null,
      restriction_type: restriction?.restriction_type || null,
      restriction_expires_at: restriction?.expires_at || null
    };
  });

  return res.status(200).json({ list, total: list.length });
}

async function listTeacherApplications(req, res) {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('role', 'teacher')
    .order('updated_at', { ascending: false });

  if (error) throw new SecurityError('Failed to fetch teacher applications', 500);

  const applications = await Promise.all((data || []).map(async (profile) => {
    const profileName = await getUserProfileName(profile.user_id);
    return {
      user_id: profile.user_id,
      display_name: profileName || 'Unknown',
      track: profile.track,
      class_name: profile.class_name,
      is_approved: profile.is_approved_teacher || false,
      approved_track: profile.approved_track || null,
      approved_at: profile.approved_at || null,
      approved_by: profile.approved_by || null,
      approval_notes: profile.approval_notes || null,
      created_at: profile.created_at,
      updated_at: profile.updated_at
    };
  }));

  return res.status(200).json({ applications });
}

async function getTeacherStatus(req, res, ctx) {
  const { data: profile, error } = await supabase
    .from('user_profiles')
    .select('role, track, is_approved_teacher, approved_track, approval_notes, class_name')
    .eq('user_id', ctx.userId)
    .maybeSingle();

  if (error) throw new SecurityError('Failed to fetch teacher status', 500);

  if (!profile || profile.role !== 'teacher') {
    return res.status(200).json({ is_teacher: false });
  }

  return res.status(200).json({
    is_teacher: true,
    is_approved: profile.is_approved_teacher || false,
    track: profile.track,
    approved_track: profile.approved_track || null,
    class_name: profile.class_name || null,
    approval_notes: profile.approval_notes || null,
    status: profile.is_approved_teacher ? 'approved' : 'pending'
  });
}

async function approveTeacher(body, res, ctx) {
  const { userId, approved_track, notes } = body;

  if (!userId) throw new SecurityError('userId required', 400);
  if (!approved_track) throw new SecurityError('approved_track required', 400);
  if (!VALID_TRACKS.includes(approved_track)) {
    throw new SecurityError(`Invalid approved_track. Allowed: ${VALID_TRACKS.join(', ')}`, 400);
  }

  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('role, track')
    .eq('user_id', userId)
    .maybeSingle();

  if (profileError || !profile) throw new SecurityError('User profile not found', 404);
  if (profile.role !== 'teacher') throw new SecurityError('User is not a teacher', 400);

  const { error: updateError } = await supabase
    .from('user_profiles')
    .update({
      is_approved_teacher: true,
      approved_by: ctx.userId,
      approved_at: new Date().toISOString(),
      approved_track: approved_track,
      approval_notes: notes || null,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', userId);

  if (updateError) throw new SecurityError('Failed to approve teacher', 500);

  await auditLog({
    actorId: ctx.userId,
    actorRole: ctx.adminData?.admin_role,
    action: 'approve_teacher',
    targetType: 'user',
    targetId: userId,
    metadata: { approved_track, notes: notes || null }
  });

  return res.status(200).json({
    success: true,
    message: 'Teacher approved successfully',
    approved_track
  });
}

async function rejectTeacher(body, res, ctx) {
  const { userId, reason } = body;

  if (!userId) throw new SecurityError('userId required', 400);

  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle();

  if (profileError || !profile) throw new SecurityError('User profile not found', 404);
  if (profile.role !== 'teacher') throw new SecurityError('User is not a teacher', 400);

  const { error: updateError } = await supabase
    .from('user_profiles')
    .update({
      is_approved_teacher: false,
      approved_by: ctx.userId,
      approved_at: new Date().toISOString(),
      approved_track: null,
      approval_notes: reason || 'Rejected by admin',
      updated_at: new Date().toISOString()
    })
    .eq('user_id', userId);

  if (updateError) throw new SecurityError('Failed to reject teacher', 500);

  await auditLog({
    actorId: ctx.userId,
    actorRole: ctx.adminData?.admin_role,
    action: 'reject_teacher',
    targetType: 'user',
    targetId: userId,
    metadata: { reason: reason || null }
  });

  return res.status(200).json({
    success: true,
    message: 'Teacher rejected'
  });
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
      const profileName = await getUserProfileName(act.user_id);
      activity.user_email = profileName || 'Unknown';
      activity.user_name = profileName || 'User';
    }
    activities.push(activity);
  }
  return res.status(200).json(activities);
}

async function getAuditLog(req, res) {
  const { data, error } = await supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(200);
  if (error) throw new SecurityError('Failed to fetch audit log', 500);
  return res.status(200).json(data || []);
}

async function updateUserRole(body, res, ctx) {
  const { userId, role } = body;
  if (!userId || !role) throw new SecurityError('userId and role required', 400);
  if (role === 'super_admin') throw new SecurityError('Cannot promote to super admin via API', 403);

  if (!VALID_ASSIGNABLE_ROLES.includes(role)) {
    throw new SecurityError(`Invalid role. Allowed: ${VALID_ASSIGNABLE_ROLES.join(', ')}`, 400);
  }

  const { data: existingAdmin } = await supabase.from('admin_master').select('id').eq('admin_id', userId).maybeSingle();
  if (!existingAdmin) {
    const { data: { user } } = await supabase.auth.admin.getUserById(userId);
    await supabase.from('admin_master').insert({
      admin_id: userId,
      admin_email: user?.email || '',
      admin_role: role,
      permissions: {
        can_manage_resources: true,
        can_manage_site_sections: role !== 'resource_manager',
        can_view_analytics: true,
        can_upload_files: true
      },
      is_active: true,
      created_at: new Date().toISOString()
    });
  } else {
    await supabase.from('admin_master').update({
      admin_role: role,
      is_active: true,
      updated_at: new Date().toISOString()
    }).eq('admin_id', userId);
  }

  await auditLog({
    actorId: ctx.userId,
    actorRole: ctx.adminData?.admin_role,
    action: 'update_user_role',
    targetType: 'user',
    targetId: userId,
    metadata: { role }
  });
  return res.status(200).json({ success: true });
}

async function updateUserLock(body, res, ctx) {
  const { userId, lock, reason } = body;
  if (!userId) throw new SecurityError('userId required', 400);
  if (lock) {
    await supabase.from('admin_master').update({
      is_locked: true,
      lock_reason: reason || 'Locked by admin',
      locked_by: ctx.adminData.id,
      locked_at: new Date().toISOString()
    }).eq('admin_id', userId);
  } else {
    await supabase.from('admin_master').update({
      is_locked: false,
      lock_reason: null,
      locked_by: null,
      locked_at: null
    }).eq('admin_id', userId);
  }
  await auditLog({
    actorId: ctx.userId,
    actorRole: ctx.adminData?.admin_role,
    action: lock ? 'lock_admin' : 'unlock_admin',
    targetType: 'admin',
    targetId: userId,
    metadata: { reason: reason || null }
  });
  return res.status(200).json({ success: true });
}

async function updateUserRestriction(body, res, ctx) {
  const { userId, restriction_type, reason, duration_hours } = body;
  if (!userId || !restriction_type) throw new SecurityError('userId and restriction_type required', 400);

  if (!VALID_RESTRICTION_TYPES.includes(restriction_type)) {
    throw new SecurityError(`Invalid restriction_type. Allowed: ${VALID_RESTRICTION_TYPES.join(', ')}`, 400);
  }

  if (restriction_type === 'disabled') {
    await supabase.from('user_restrictions').upsert({
      user_id: userId,
      restriction_type: 'disabled',
      lock_reason: reason || '',
      locked_by: ctx.adminData.admin_id || ctx.adminData.id,
      locked_at: new Date().toISOString(),
      is_permanent: true,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });
  } else if (restriction_type === 'suspended') {
    await supabase.from('user_restrictions').upsert({
      user_id: userId,
      restriction_type: 'suspended',
      lock_reason: reason || '',
      locked_by: ctx.adminData.admin_id || ctx.adminData.id,
      locked_at: new Date().toISOString(),
      is_permanent: true,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });
  } else if (restriction_type === 'locked') {
    const expiresAt = new Date(Date.now() + (duration_hours || 24) * 60 * 60 * 1000).toISOString();
    await supabase.from('user_restrictions').upsert({
      user_id: userId,
      restriction_type: 'locked',
      lock_reason: reason || '',
      locked_by: ctx.adminData.admin_id || ctx.adminData.id,
      locked_at: new Date().toISOString(),
      expires_at: expiresAt,
      is_permanent: false,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });
  } else if (restriction_type === 'remove') {
    await supabase.from('user_restrictions').delete().eq('user_id', userId);
  }
  await supabase.from('user_sessions').update({
    is_active: false,
    terminated_reason: `admin_${restriction_type}`,
    terminated_at: new Date().toISOString()
  }).eq('user_id', userId).eq('is_active', true);

  await auditLog({
    actorId: ctx.userId,
    actorRole: ctx.adminData?.admin_role,
    action: 'update_user_restriction',
    targetType: 'user',
    targetId: userId,
    metadata: { restriction_type, reason: reason || null, duration_hours: duration_hours || null }
  });
  return res.status(200).json({ success: true });
}

async function updateAppFeature(body, res, ctx) {
  const { feature_key, settings, is_enabled } = body;
  if (!feature_key) throw new SecurityError('feature_key required', 400);
  await supabase.from('app_features').update({
    settings: settings || {},
    is_enabled: is_enabled !== undefined ? is_enabled : true,
    updated_at: new Date().toISOString(),
    updated_by: ctx.userId
  }).eq('feature_key', feature_key);
  await auditLog({
    actorId: ctx.userId,
    actorRole: ctx.adminData?.admin_role,
    action: 'update_app_feature',
    targetType: 'app_feature',
    targetId: feature_key,
    metadata: { is_enabled, settings: settings || {} }
  });
  return res.status(200).json({ success: true });
}

async function deleteQuizTopic(body, res, ctx) {
  const { topic, level } = body;
  if (!topic || !level) throw new SecurityError('topic and level required', 400);
  await supabase.from('quiz_questions').delete().eq('level', level).eq('topic', topic);
  await supabase.from('quiz_topics').delete().eq('level', level).eq('topic_name', topic);
  await auditLog({
    actorId: ctx.userId,
    actorRole: ctx.adminData?.admin_role,
    action: 'delete_quiz_topic',
    targetType: 'quiz_topic',
    targetId: `${level}:${topic}`,
    metadata: {}
  });
  return res.status(200).json({ success: true });
}

async function sendBulkNotification(body, res, ctx) {
  const { template_key, metadata } = body;
  if (!template_key) throw new SecurityError('template_key required', 400);

  const validTemplates = ['system_announcement', 'feature_update', 'maintenance_scheduled', 'terms_updated'];
  if (!validTemplates.includes(template_key)) {
    throw new SecurityError('Invalid template key. Allowed: system_announcement, feature_update, maintenance_scheduled, terms_updated', 400);
  }

  const { data: users } = await supabase.auth.admin.listUsers();
  if (!users || users.length === 0) {
    return res.status(200).json({ success: true, sent_count: 0, message: 'No users found' });
  }

  const userIds = users.map(u => u.id);
  const results = await createBulkNotifications(userIds, template_key, metadata || {});

  await auditLog({
    actorId: ctx.userId,
    actorRole: ctx.adminData?.admin_role,
    action: 'send_bulk_notification',
    targetType: 'notification',
    targetId: template_key,
    metadata: { recipient_count: userIds.length }
  });

  return res.status(200).json({
    success: true,
    sent_count: results.length,
    total_users: userIds.length
  });
}

async function getNotificationStats(req, res) {
  const { count: totalSent } = await supabase
    .from('notification_delivery_log')
    .select('id', { count: 'exact', head: true });

  const { count: totalRead } = await supabase
    .from('notification_delivery_log')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'clicked');

  const { count: totalDismissed } = await supabase
    .from('notification_delivery_log')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'dismissed');

  const { count: totalNotifications } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true });

  const { count: unreadNotifications } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('is_read', false)
    .eq('is_dismissed', false);

  return res.status(200).json({
    total_notifications: totalNotifications || 0,
    unread_notifications: unreadNotifications || 0,
    total_sent: totalSent || 0,
    total_read: totalRead || 0,
    total_dismissed: totalDismissed || 0
  });
}

async function getAppFeatures(req, res) {
  const { page_id } = req.query;
  let query = supabase.from('app_features').select('*').order('display_order', { ascending: true });
  if (page_id && page_id !== 'all') query = query.eq('page_id', page_id);
  const { data, error } = await query;
  if (error) throw new SecurityError('Failed to fetch features', 500);
  return res.status(200).json(data || []);
}

async function getUserActivityTrace(req, res, ctx) {
  requireSuperAdmin(ctx);

  const [{ data: pageActivity }, { data: userEvents }, { data: securityLogs }] = await Promise.all([
    supabase.from('page_activity').select('*').order('created_at', { ascending: false }).limit(500),
    supabase.from('user_analytics').select('*').order('created_at', { ascending: false }).limit(500),
    supabase.from('quiz_security_logs').select('*').order('created_at', { ascending: false }).limit(500)
  ]);

  const records = [];

  for (const act of (pageActivity || [])) {
    records.push({
      user_id: act.user_id,
      type: 'page_view',
      detail: act.page,
      metadata: act.metadata || {},
      ip_address: act.ip_address || null,
      user_agent: act.user_agent || null,
      is_anonymous: act.is_anonymous || !act.user_id,
      created_at: act.created_at
    });
  }

  for (const ev of (userEvents || [])) {
    records.push({
      user_id: ev.user_id,
      type: ev.event_name,
      detail: ev.event_name,
      metadata: ev.event_data || {},
      ip_address: null,
      user_agent: null,
      is_anonymous: !ev.user_id,
      created_at: ev.created_at
    });
  }

  for (const log of (securityLogs || [])) {
    records.push({
      user_id: log.user_id,
      type: `security:${log.event_type}`,
      detail: log.event_type,
      metadata: log.details || {},
      ip_address: null,
      user_agent: null,
      is_anonymous: !log.user_id,
      created_at: log.created_at
    });
  }

  const groups = new Map();

  for (const rec of records) {
    const key = rec.user_id || `anon:${rec.ip_address || 'unknown'}`;
    if (!groups.has(key)) {
      groups.set(key, { user_id: rec.user_id, is_anonymous: rec.is_anonymous, events: [] });
    }
    groups.get(key).events.push(rec);
  }

  const users = [];

  for (const [key, group] of groups.entries()) {
    let email = 'Anonymous';
    let profileName = 'Anonymous';
    if (group.user_id) {
      profileName = await getUserProfileName(group.user_id) || undefined;
      if (!profileName) {
        try {
          const { data: { user } } = await supabase.auth.admin.getUserById(group.user_id);
          email = user?.email || 'Unknown';
          profileName = email;
        } catch {
          email = 'Unknown';
          profileName = 'Unknown';
        }
      } else {
        email = profileName;
      }
    }

    const sortedEvents = group.events.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const ips = new Set(sortedEvents.map(e => e.ip_address).filter(Boolean));
    const timestamps = sortedEvents.map(e => new Date(e.created_at).getTime()).sort((a, b) => a - b);

    let burst = false;
    for (let i = 0; i < timestamps.length; i++) {
      let count = 1;
      for (let j = i + 1; j < timestamps.length && timestamps[j] - timestamps[i] <= 60000; j++) count++;
      if (count >= 10) { burst = true; break; }
    }

    const hasSecurityIncident = sortedEvents.some(e => e.type.startsWith('security:'));

    const flags = [];
    if (ips.size > 2) flags.push('multiple_ips');
    if (burst) flags.push('rapid_activity');
    if (hasSecurityIncident) flags.push('security_incident');

    users.push({
      key,
      user_id: group.user_id,
      email,
      display_name: profileName,
      is_anonymous: group.is_anonymous,
      total_events: sortedEvents.length,
      distinct_ips: ips.size,
      first_seen: sortedEvents[sortedEvents.length - 1]?.created_at || null,
      last_seen: sortedEvents[0]?.created_at || null,
      flags,
      events: sortedEvents
    });
  }

  users.sort((a, b) => new Date(b.last_seen) - new Date(a.last_seen));

  return res.status(200).json({ users });
}

async function setupMfa(body, res, ctx) {
  const secret = generateTotpSecret();
  await supabase.from('admin_master').update({ mfa_secret_pending: secret }).eq('admin_id', ctx.userId);
  const uri = totpProvisioningUri(secret, ctx.adminData?.admin_email || 'admin', 'AliverBiopharm');
  return res.status(200).json({ secret, provisioning_uri: uri });
}

async function confirmMfa(body, res, ctx) {
  const { code } = body;
  if (!code) throw new SecurityError('code required', 400);
  const { data: admin } = await supabase.from('admin_master').select('mfa_secret_pending').eq('admin_id', ctx.userId).maybeSingle();
  if (!admin?.mfa_secret_pending) throw new SecurityError('No pending MFA setup found', 400);
  if (!verifyTotp(admin.mfa_secret_pending, code)) throw new SecurityError('Invalid code', 400);

  await supabase.from('admin_master').update({
    mfa_secret: admin.mfa_secret_pending,
    mfa_secret_pending: null,
    mfa_enabled: true
  }).eq('admin_id', ctx.userId);

  await auditLog({
    actorId: ctx.userId,
    actorRole: ctx.adminData?.admin_role,
    action: 'mfa_enabled',
    targetType: 'admin',
    targetId: ctx.userId,
    metadata: {}
  });
  return res.status(200).json({ success: true });
}

async function disableMfa(body, res, ctx) {
  const { userId } = body;
  if (!userId) throw new SecurityError('userId required', 400);
  await supabase.from('admin_master').update({
    mfa_enabled: false,
    mfa_secret: null,
    mfa_secret_pending: null
  }).eq('admin_id', userId);
  await auditLog({
    actorId: ctx.userId,
    actorRole: ctx.adminData?.admin_role,
    action: 'mfa_disabled',
    targetType: 'admin',
    targetId: userId,
    metadata: {}
  });
  return res.status(200).json({ success: true });
}
