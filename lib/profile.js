import { supabase } from './core.js';
import {
  parseAndValidateBody,
  requireAuth,
  SecurityError
} from './security-middleware.js';
import crypto from 'crypto';

export async function handler(req, res, path, ctx) {
  if (req.method === 'GET') {
    requireAuth(ctx);

    switch (path) {
      case 'settings_bundle':
        return getSettingsBundle(req, res, ctx);
      case 'referral_stats':
        return getReferralStats(req, res, ctx);
      case 'certificates':
        return getCertificates(req, res, ctx);
      case 'devices':
        return getDevices(req, res, ctx);
      case 'billing_summary':
        return getBillingSummary(req, res, ctx);
      case 'api_keys':
        return getApiKeys(req, res, ctx);
      case 'webhooks':
        return getWebhooks(req, res, ctx);
      case 'notification_preferences':
        return getNotificationPreferences(req, res, ctx);
      case 'get_profile':
        return getProfile(req, res, ctx);
      default:
        throw new SecurityError('Invalid action', 400);
    }
  }

  if (req.method === 'POST') {
    requireAuth(ctx);
    const body = await parseAndValidateBody(req);

    switch (path) {
      case 'switch_class':
        return switchClass(body, res, ctx);
      case 'update_class':
        return updateClassByName(body, res, ctx);
      case 'update_bio':
        return updateBio(body, res, ctx);
      case 'update_preferences':
        return updatePreferences(body, res, ctx);
      case 'update_notification_preferences':
        return updateNotificationPreferences(body, res, ctx);
      case 'create_api_key':
        return createApiKey(body, res, ctx);
      case 'revoke_api_key':
        return revokeApiKey(body, res, ctx);
      case 'create_webhook':
        return createWebhook(body, res, ctx);
      case 'update_webhook':
        return updateWebhook(body, res, ctx);
      case 'delete_webhook':
        return deleteWebhook(body, res, ctx);
      case 'revoke_device':
        return revokeDevice(body, res, ctx);
      case 'save_parent_guardian':
        return saveParentGuardian(body, res, ctx);
      case 'request_data_export':
        return requestDataExport(res, ctx);
      case 'request_account_deletion':
        return requestAccountDeletion(res, ctx);
      case 'update_display_name':
        return updateDisplayName(body, res, ctx);
      case 'request_level_change':
        return requestLevelChange(body, res, ctx);
      default:
        throw new SecurityError('Invalid action', 400);
    }
  }

  throw new SecurityError('Method not allowed', 405);
}

async function switchClass(body, res, ctx) {
  const { group_id } = body;

  if (!group_id) {
    throw new SecurityError('group_id is required', 400);
  }

  const { data: group } = await supabase
    .from('curriculum_groups')
    .select('id, name, level_id, is_active')
    .eq('id', group_id)
    .maybeSingle();

  if (!group || group.is_active === false) {
    throw new SecurityError('Class not found or inactive', 404);
  }

  const { data, error } = await supabase
    .from('user_profiles')
    .update({
      active_group_id: group.id,
      active_level_id: group.level_id,
      class_name: group.name,
      track: group.level_id,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', ctx.userId)
    .select('active_group_id, active_level_id, class_name, track')
    .single();

  if (error) {
    throw new SecurityError('Failed to switch class', 500);
  }

  await supabase.from('audit_log').insert({
    actor_id: ctx.userId,
    action: 'switch_class',
    target_type: 'user_profile',
    target_id: ctx.userId,
    metadata: { group_id: group.id, group_name: group.name }
  });

  return res.status(200).json({ success: true, profile: data });
}

async function updateClassByName(body, res, ctx) {
  const { class_name } = body;

  if (!class_name) {
    throw new SecurityError('class_name is required', 400);
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('active_level_id')
    .eq('user_id', ctx.userId)
    .maybeSingle();

  if (!profile?.active_level_id) {
    throw new SecurityError('No active level set for this account', 400);
  }

  const { data: group } = await supabase
    .from('curriculum_groups')
    .select('id, name, level_id')
    .eq('level_id', profile.active_level_id)
    .eq('name', class_name)
    .eq('is_active', true)
    .maybeSingle();

  if (!group) {
    throw new SecurityError('Class not found for your current level', 404);
  }

  const { data, error } = await supabase
    .from('user_profiles')
    .update({
      active_group_id: group.id,
      class_name: group.name,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', ctx.userId)
    .select('active_group_id, active_level_id, class_name')
    .single();

  if (error) {
    throw new SecurityError('Failed to update class', 500);
  }

  return res.status(200).json({ success: true, profile: data });
}

async function getSettingsBundle(req, res, ctx) {
  const userId = ctx.userId;

  const [profile, referral, devices, subscription] = await Promise.all([
    supabase
      .from('user_profiles')
      .select('bio, referral_code, referred_by, accessibility, theme_color, language, timezone, preferences')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('user_referrals')
      .select('id, status, xp_awarded', { count: 'exact' })
      .eq('referrer_id', userId),
    supabase
      .from('user_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_active', true),
    supabase
      .from('user_subscriptions')
      .select('status, expires_at, plan_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
  ]);

  return res.status(200).json({
    profile: profile.data || null,
    referral_count: referral.count || 0,
    active_device_count: devices.count || 0,
    subscription: subscription.data || null
  });
}

async function updateBio(body, res, ctx) {
  const userId = ctx.userId;
  const { bio } = body;

  if (typeof bio !== 'string' || bio.length > 500) {
    throw new SecurityError('bio must be a string under 500 characters', 400);
  }

  const { data } = await supabase
    .from('user_profiles')
    .update({ bio: bio.trim(), updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .select('bio')
    .single();

  return res.status(200).json({ success: true, bio: data.bio });
}

async function updatePreferences(body, res, ctx) {
  const userId = ctx.userId;
  const updates = { updated_at: new Date().toISOString() };
  const allowedKeys = ['theme_color', 'language', 'timezone'];

  for (const key of allowedKeys) {
    if (body[key] !== undefined) updates[key] = String(body[key]).slice(0, 50);
  }

  if (body.accessibility !== undefined) {
    if (typeof body.accessibility !== 'object' || Array.isArray(body.accessibility)) {
      throw new SecurityError('accessibility must be an object', 400);
    }
    updates.accessibility = body.accessibility;
  }

  if (body.preferences !== undefined) {
    if (typeof body.preferences !== 'object' || Array.isArray(body.preferences)) {
      throw new SecurityError('preferences must be an object', 400);
    }
    updates.preferences = body.preferences;
  }

  const { data } = await supabase
    .from('user_profiles')
    .update(updates)
    .eq('user_id', userId)
    .select('theme_color, language, timezone, accessibility, preferences')
    .single();

  return res.status(200).json({ success: true, profile: data });
}

async function getReferralStats(req, res, ctx) {
  const userId = ctx.userId;

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('referral_code')
    .eq('user_id', userId)
    .maybeSingle();

  const { data: referrals, count } = await supabase
    .from('user_referrals')
    .select('id, referred_user_id, status, xp_awarded, created_at', { count: 'exact' })
    .eq('referrer_id', userId)
    .order('created_at', { ascending: false });

  const totalXp = (referrals || []).reduce((sum, r) => sum + (r.xp_awarded || 0), 0);

  return res.status(200).json({
    referral_code: profile?.referral_code || null,
    referral_count: count || 0,
    total_xp_earned: totalXp,
    referrals: referrals || []
  });
}

async function getCertificates(req, res, ctx) {
  const { data } = await supabase
    .from('certificates')
    .select('id, title, unit_id, score, issued_at, certificate_url, verification_code')
    .eq('user_id', ctx.userId)
    .order('issued_at', { ascending: false });

  return res.status(200).json(data || []);
}

async function getDevices(req, res, ctx) {
  const { data } = await supabase
    .from('user_sessions')
    .select('id, user_agent, ip_address, created_at, expires_at, is_active')
    .eq('user_id', ctx.userId)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  return res.status(200).json(data || []);
}

async function revokeDevice(body, res, ctx) {
  const { session_id } = body;

  if (!session_id) {
    throw new SecurityError('session_id is required', 400);
  }

  const { data: session } = await supabase
    .from('user_sessions')
    .select('id, user_id')
    .eq('id', session_id)
    .eq('user_id', ctx.userId)
    .maybeSingle();

  if (!session) {
    throw new SecurityError('Session not found', 404);
  }

  await supabase
    .from('user_sessions')
    .update({
      is_active: false,
      terminated_reason: 'user_revoked',
      terminated_at: new Date().toISOString()
    })
    .eq('id', session_id);

  await supabase.from('audit_log').insert({
    actor_id: ctx.userId,
    action: 'revoke_device_session',
    target_type: 'user_session',
    target_id: String(session_id)
  });

  return res.status(200).json({ success: true });
}

async function getBillingSummary(req, res, ctx) {
  const userId = ctx.userId;

  const { data: subscription } = await supabase
    .from('user_subscriptions')
    .select('id, status, starts_at, expires_at, auto_renew, plan_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let plan = null;
  if (subscription?.plan_id) {
    const { data } = await supabase
      .from('subscription_plans')
      .select('id, name, slug, price_amount, currency, duration_days, features')
      .eq('id', subscription.plan_id)
      .maybeSingle();
    plan = data;
  }

  const { data: plans } = await supabase
    .from('subscription_plans')
    .select('id, name, slug, price_amount, currency, duration_days, features')
    .eq('is_active', true)
    .order('display_order', { ascending: true });

  return res.status(200).json({
    subscription: subscription || null,
    current_plan: plan,
    available_plans: plans || []
  });
}

async function getApiKeys(req, res, ctx) {
  const { data } = await supabase
    .from('api_keys')
    .select('id, name, key_prefix, scopes, last_used_at, created_at, revoked_at, is_active')
    .eq('user_id', ctx.userId)
    .order('created_at', { ascending: false });

  return res.status(200).json(data || []);
}

async function createApiKey(body, res, ctx) {
  const userId = ctx.userId;
  const name = (body.name || 'Default Key').trim().slice(0, 100);

  const rawKey = `sk_live_${crypto.randomBytes(24).toString('hex')}`;
  const keyPrefix = rawKey.slice(0, 14);
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

  const { data } = await supabase
    .from('api_keys')
    .insert({
      user_id: userId,
      name,
      key_hash: keyHash,
      key_prefix: keyPrefix,
      scopes: ['read'],
      is_active: true
    })
    .select('id, name, key_prefix, created_at')
    .single();

  await supabase.from('audit_log').insert({
    actor_id: userId,
    action: 'create_api_key',
    target_type: 'api_key',
    target_id: data.id
  });

  return res.status(200).json({ success: true, key: data, raw_key: rawKey });
}

async function revokeApiKey(body, res, ctx) {
  const { key_id } = body;

  if (!key_id) {
    throw new SecurityError('key_id is required', 400);
  }

  const { data: key } = await supabase
    .from('api_keys')
    .select('id, user_id')
    .eq('id', key_id)
    .eq('user_id', ctx.userId)
    .maybeSingle();

  if (!key) {
    throw new SecurityError('Key not found', 404);
  }

  await supabase
    .from('api_keys')
    .update({ is_active: false, revoked_at: new Date().toISOString() })
    .eq('id', key_id);

  return res.status(200).json({ success: true });
}

async function getWebhooks(req, res, ctx) {
  const { data } = await supabase
    .from('webhook_endpoints')
    .select('id, url, events, is_active, last_delivery_at, last_delivery_status, created_at')
    .eq('user_id', ctx.userId)
    .order('created_at', { ascending: false });

  return res.status(200).json(data || []);
}

async function createWebhook(body, res, ctx) {
  const { url, events } = body;

  if (!url || !/^https:\/\//.test(url)) {
    throw new SecurityError('A valid https url is required', 400);
  }

  const secret = crypto.randomBytes(24).toString('hex');

  const { data } = await supabase
    .from('webhook_endpoints')
    .insert({
      user_id: ctx.userId,
      url,
      secret,
      events: Array.isArray(events) && events.length ? events : ['*'],
      is_active: true
    })
    .select('id, url, events, is_active, created_at')
    .single();

  return res.status(200).json({ success: true, webhook: data, secret });
}

async function updateWebhook(body, res, ctx) {
  const { webhook_id, url, events, is_active } = body;

  if (!webhook_id) {
    throw new SecurityError('webhook_id is required', 400);
  }

  const updates = {};
  if (url !== undefined) {
    if (!/^https:\/\//.test(url)) throw new SecurityError('url must be https', 400);
    updates.url = url;
  }
  if (events !== undefined) updates.events = events;
  if (is_active !== undefined) updates.is_active = !!is_active;

  const { data } = await supabase
    .from('webhook_endpoints')
    .update(updates)
    .eq('id', webhook_id)
    .eq('user_id', ctx.userId)
    .select('id, url, events, is_active')
    .single();

  if (!data) {
    throw new SecurityError('Webhook not found', 404);
  }

  return res.status(200).json({ success: true, webhook: data });
}

async function deleteWebhook(body, res, ctx) {
  const { webhook_id } = body;

  if (!webhook_id) {
    throw new SecurityError('webhook_id is required', 400);
  }

  await supabase
    .from('webhook_endpoints')
    .delete()
    .eq('id', webhook_id)
    .eq('user_id', ctx.userId);

  return res.status(200).json({ success: true });
}

async function getNotificationPreferences(req, res, ctx) {
  const { data } = await supabase
    .from('notification_preferences')
    .select('module, in_app, email, push')
    .eq('user_id', ctx.userId);

  return res.status(200).json(data || []);
}

async function updateNotificationPreferences(body, res, ctx) {
  const { module, in_app, email, push } = body;

  if (!module) {
    throw new SecurityError('module is required', 400);
  }

  const { data } = await supabase
    .from('notification_preferences')
    .upsert(
      {
        user_id: ctx.userId,
        module,
        in_app: in_app !== undefined ? !!in_app : undefined,
        email: email !== undefined ? !!email : undefined,
        push: push !== undefined ? !!push : undefined,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'user_id,module' }
    )
    .select('module, in_app, email, push')
    .single();

  return res.status(200).json({ success: true, preference: data });
}

async function saveParentGuardian(body, res, ctx) {
  const { guardian_name, guardian_email, guardian_relationship } = body;

  if (!guardian_name || !guardian_email) {
    throw new SecurityError('guardian_name and guardian_email are required', 400);
  }

  const { data: existing } = await supabase
    .from('parental_consents')
    .select('id')
    .eq('minor_user_id', ctx.userId)
    .maybeSingle();

  if (existing) {
    const { data } = await supabase
      .from('parental_consents')
      .update({ guardian_name, guardian_email, guardian_relationship })
      .eq('id', existing.id)
      .select()
      .single();
    return res.status(200).json({ success: true, consent: data });
  }

  const { data } = await supabase
    .from('parental_consents')
    .insert({
      minor_user_id: ctx.userId,
      guardian_name,
      guardian_email,
      guardian_relationship,
      consent_status: 'pending'
    })
    .select()
    .single();

  return res.status(200).json({ success: true, consent: data });
}

async function requestDataExport(res, ctx) {
  const { data: pending } = await supabase
    .from('user_export_requests')
    .select('id, status')
    .eq('user_id', ctx.userId)
    .eq('status', 'pending')
    .maybeSingle();

  if (pending) {
    return res.status(200).json({ success: true, request: pending, already_pending: true });
  }

  const { data } = await supabase
    .from('user_export_requests')
    .insert({ user_id: ctx.userId, status: 'pending' })
    .select()
    .single();

  await supabase.from('audit_log').insert({
    actor_id: ctx.userId,
    action: 'request_data_export',
    target_type: 'user',
    target_id: ctx.userId
  });

  return res.status(200).json({ success: true, request: data });
}

async function requestAccountDeletion(res, ctx) {
  const { data: existing } = await supabase
    .from('data_deletion_requests')
    .select('id, status')
    .eq('user_id', ctx.userId)
    .in('status', ['pending'])
    .maybeSingle();

  if (existing) {
    return res.status(200).json({ success: true, request: existing, already_pending: true });
  }

  const confirmationCode = crypto.randomBytes(6).toString('hex');

  const { data } = await supabase
    .from('data_deletion_requests')
    .insert({
      user_id: ctx.userId,
      status: 'pending',
      confirmation_code: confirmationCode
    })
    .select()
    .single();

  await supabase.from('audit_log').insert({
    actor_id: ctx.userId,
    action: 'request_account_deletion',
    target_type: 'user',
    target_id: ctx.userId
  });

  return res.status(200).json({ success: true, request: data });
}

async function getProfile(req, res, ctx) {
  const userId = ctx.userId;

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('display_name, full_name, email, track, class_name, role, is_active, created_at, bio')
    .eq('user_id', userId)
    .maybeSingle();

  if (!profile) {
    throw new SecurityError('Profile not found', 404);
  }

  return res.status(200).json(profile);
}

async function updateDisplayName(body, res, ctx) {
  const { display_name } = body;

  if (typeof display_name !== 'string' || display_name.trim().length < 2 || display_name.trim().length > 100) {
    throw new SecurityError('display_name must be between 2 and 100 characters', 400);
  }

  const { data } = await supabase
    .from('user_profiles')
    .update({ display_name: display_name.trim(), updated_at: new Date().toISOString() })
    .eq('user_id', ctx.userId)
    .select('display_name')
    .single();

  return res.status(200).json({ success: true, display_name: data.display_name });
}

async function requestLevelChange(body, res, ctx) {
  const { requested_track, requested_class, reason } = body;

  if (!requested_track || !requested_class || !reason) {
    throw new SecurityError('requested_track, requested_class and reason are required', 400);
  }

  const { data: existing } = await supabase
    .from('level_change_requests')
    .select('id, status')
    .eq('user_id', ctx.userId)
    .eq('status', 'pending')
    .maybeSingle();

  if (existing) {
    return res.status(200).json({ success: true, request: existing, already_pending: true });
  }

  const { data } = await supabase
    .from('level_change_requests')
    .insert({
      user_id: ctx.userId,
      requested_track,
      requested_class,
      reason,
      status: 'pending'
    })
    .select()
    .single();

  await supabase.from('audit_log').insert({
    actor_id: ctx.userId,
    action: 'request_level_change',
    target_type: 'user',
    target_id: ctx.userId,
    metadata: { requested_track, requested_class }
  });

  return res.status(200).json({ success: true, request: data });
}
