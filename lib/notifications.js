 /* lib/notifications.js */
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
  } catch (error) {
    console.error('[Notifications] createNotification failed:', error.message);
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

export async function createQuizNotification(userId, type, metadata = {}) {
  const templateMap = {
    quiz_passed: 'quiz_passed',
    quiz_failed: 'quiz_failed',
    quiz_auto_submitted: 'quiz_auto_submitted',
    review_due: 'review_due',
    mastery_achieved: 'mastery_achieved',
    quiz_streak: 'quiz_streak'
  };

  const templateKey = templateMap[type] || type;

  return createNotification(userId, templateKey, metadata);
}
