import { supabase } from './core.js';

function interpolateTemplate(template, vars) {
  if (!template) return '';
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    return vars[key] !== undefined ? String(vars[key]) : match;
  });
}

export async function createNotification(userId, templateKey, metadata = {}, overrides = {}) {
  try {
    const { data: template } = await supabase
      .from('notification_templates')
      .select('*')
      .eq('template_key', templateKey)
      .eq('is_active', true)
      .single();
    if (!template) return null;

    const { data: prefs } = await supabase
      .from('notification_preferences')
      .select('in_app')
      .eq('user_id', userId)
      .eq('module', template.module)
      .maybeSingle();
    if (prefs && !prefs.in_app) return null;

    const title = interpolateTemplate(template.title_template, metadata);
    const body = interpolateTemplate(template.body_template, metadata);

    const { data: notification, error } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        template_key: templateKey,
        module: template.module,
        title: overrides.title || title,
        body: overrides.body || body,
        icon: overrides.icon || template.icon,
        color: overrides.color || template.color,
        priority: overrides.priority || template.priority,
        action_url: overrides.action_url || null,
        action_text: overrides.action_text || null,
        metadata,
        expires_at: overrides.expires_at || null
      })
      .select('id')
      .single();
    if (error) throw error;

    await supabase.from('notification_delivery_log').insert({
      notification_id: notification.id,
      user_id: userId,
      channel: 'in_app',
      status: 'sent'
    });

    return notification;
  } catch (e) {
    console.error('[Notifications] createNotification failed:', e.message);
    return null;
  }
}

export async function createBulkNotifications(userIds, templateKey, metadata = {}, overrides = {}) {
  const results = [];
  for (const userId of userIds) {
    const result = await createNotification(userId, templateKey, metadata, overrides);
    if (result) results.push(result);
  }
  return results;
}
 export async function getNotifications(userId, { limit = 50, offset = 0, module = null, unreadOnly = false } = {}) {
  let query = supabase
    .from('notifications')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .eq('is_dismissed', false)
    .order('created_at', { ascending: false })
    
  if (module) query = query.eq('module', module);
  if (unreadOnly) query = query.eq('is_read', false);

  const { data, error, count } = await query;
  
  // ADD THESE FOUR LINES
  console.log('[getNotifications] userId:', userId);
  console.log('[getNotifications] error:', error);
  console.log('[getNotifications] data:', JSON.stringify(data));
  console.log('[getNotifications] count:', count);
  
  if (error) {
    console.error('[getNotifications] Query error:', error.message);
    return { notifications: [], total: 0, unread_count: 0 };
  }

  const { count: unreadCount, error: unreadError } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false)
    .eq('is_dismissed', false);

  console.log('[getNotifications] unreadCount:', unreadCount);
  console.log('[getNotifications] unreadError:', unreadError);

  return { notifications: data || [], total: count || 0, unread_count: unreadCount || 0 };
 }

export async function markNotificationRead(userId, notificationId) {
  await supabase
    .from('notifications')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('id', notificationId)
    .eq('user_id', userId);
}

export async function markAllNotificationsRead(userId) {
  await supabase
    .from('notifications')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('is_read', false);
}

export async function dismissNotification(userId, notificationId) {
  await supabase
    .from('notifications')
    .update({ is_dismissed: true, dismissed_at: new Date().toISOString() })
    .eq('id', notificationId)
    .eq('user_id', userId);
}

export async function updateNotificationPreferences(userId, preferences) {
  const entries = Object.entries(preferences).map(([module, settings]) => ({
    user_id: userId,
    module,
    in_app: settings.in_app !== undefined ? settings.in_app : true,
    email: settings.email || false,
    push: settings.push || false,
    updated_at: new Date().toISOString()
  }));
  await supabase.from('notification_preferences').upsert(entries, { onConflict: 'user_id,module' });
}

export async function getNotificationPreferences(userId) {
  const { data } = await supabase.from('notification_preferences').select('module, in_app, email, push').eq('user_id', userId);
  return data || [];
}
