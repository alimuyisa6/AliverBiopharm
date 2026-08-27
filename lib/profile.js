import { supabase } from './core.js';
import {
  parseAndValidateBody,
  requireSuperAdmin,
  requireAuth,
  SecurityError
} from './security-middleware.js';
import { getUserCurriculumScope } from './curriculum.js';
import { createNotification } from './notifications.js';
import crypto from 'crypto';

export async function handler(req, res, path, ctx) {
  if (req.method === 'GET') {
    requireAuth(ctx);

    switch (path) {
      case 'get_profile':
        return getProfile(req, res, ctx);
      case 'get_profile_settings':
        return getProfileSettings(req, res, ctx);
      case 'class_sequence':
        return getClassSequence(req, res, ctx);
      case 'pharmacy_programs':
        return getPharmacyPrograms(req, res, ctx);
      case 'level_change_status':
        return getLevelChangeStatus(req, res, ctx);
      case 'profile_stats':
        return getProfileStats(req, res, ctx);
      case 'notifications':
        return getNotificationPreferences(req, res, ctx);
      case 'saved_items':
        return getSavedItems(req, res, ctx);
      case 'achievements':
        return getAchievements(req, res, ctx);
      case 'certificates':
        return getCertificates(req, res, ctx);
      case 'devices':
        return getDevices(req, res, ctx);
      case 'referrals':
        return getReferrals(req, res, ctx);
      case 'api_keys':
        return getApiKeys(req, res, ctx);
      case 'webhooks':
        return getWebhooks(req, res, ctx);
      case 'billing':
        return getBilling(req, res, ctx);
      case 'parent_guardian':
        return getParentGuardian(req, res, ctx);
      case 'performance':
        return getPerformance(req, res, ctx);
      case 'streak':
        return getStreak(req, res, ctx);
      case 'recent_activity':
        return getRecentActivity(req, res, ctx);
      case 'pending_level_changes':
        requireSuperAdmin(ctx);
        return getPendingLevelChanges(req, res, ctx);
      default:
        throw new SecurityError('Invalid action', 400);
    }
  }

  if (req.method === 'POST') {
    requireAuth(ctx);

    const body = await parseAndValidateBody(req);

    switch (path) {
      case 'save_onboarding':
        return saveOnboarding(body, res, ctx);
      case 'update_class':
        return updateClass(body, res, ctx);
      case 'switch_class':
        return switchClass(body, res, ctx);
      case 'request_level_change':
        return requestLevelChange(body, res, ctx);
      case 'review_level_change':
        requireSuperAdmin(ctx);
        return reviewLevelChange(body, res, ctx);
      case 'admin_update_profile':
        requireSuperAdmin(ctx);
        return adminUpdateProfile(body, res, ctx);
      case 'update_display_name':
        return updateDisplayName(body, res, ctx);
      case 'update_profile':
        return updateProfile(body, res, ctx);
      case 'save_preferences':
        return savePreferences(body, res, ctx);
      case 'save_notifications':
        return saveNotifications(body, res, ctx);
      case 'change_password':
        return changePassword(body, res, ctx);
      case 'revoke_session':
        return revokeSession(body, res, ctx);
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
      case 'save_parent_guardian':
        return saveParentGuardian(body, res, ctx);
      case 'request_export':
        return requestExport(body, res, ctx);
      case 'request_account_deletion':
        return requestAccountDeletion(body, res, ctx);
      default:
        throw new SecurityError('Invalid action', 400);
    }
  }

  throw new SecurityError('Method not allowed', 405);
}

async function getProfile(req, res, ctx) {
  const userId = ctx.userId;

  let { data: profile } = await supabase
    .from('user_profiles')
    .select(`
      user_id,
      email,
      full_name,
      display_name,
      name,
      profile_picture_url,
      profile_picture_updated_at,
      bio,
      role,
      track,
      class_name,
      is_minor,
      is_approved_teacher,
      approved_track,
      active_level_id,
      active_group_id,
      onboarding_completed,
      created_at,
      updated_at,
      last_active_at,
      is_active,
      account_status,
      show_on_leaderboard,
      preferences,
      referral_code
    `)
    .eq('user_id', userId)
    .maybeSingle();

  if (!profile) {
    const { data: authUser } = await supabase.auth.admin.getUserById(userId);
    const email = authUser?.user?.email || null;
    const metadataName = authUser?.user?.user_metadata?.full_name || null;

    const { data: newProfile, error } = await supabase
      .from('user_profiles')
      .insert({
        user_id: userId,
        email,
        full_name: metadataName,
        display_name: metadataName,
        name: metadataName,
        track: null,
        class_name: null,
        role: 'student',
        is_approved_teacher: false,
        approved_track: null,
        active_level_id: null,
        active_group_id: null,
        onboarding_completed: false,
        is_active: true,
        account_status: 'active',
        preferences: {},
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      throw new SecurityError('Unable to create profile', 500);
    }

    profile = newProfile;
  }

  const scope = await getUserCurriculumScope(userId);

  const { data: levelChangeStatus } = await supabase
    .from('level_change_requests')
    .select(`
      id,
      status,
      requested_track,
      requested_class,
      requested_level_id,
      requested_group_id,
      reason,
      created_at,
      resolved_at,
      admin_id
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: recentActivity } = await supabase
    .from('user_activity')
    .select('action, target_type, target_id, created_at, metadata')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(10);

  const { data: xp } = await supabase
    .from('user_xp')
    .select('total_xp, level, rank_title')
    .eq('user_id', userId)
    .maybeSingle();

  const { data: platformStats } = await supabase
    .from('user_platform_stats')
    .select('total_xp, platform_level, current_streak, longest_streak, last_activity_date')
    .eq('user_id', userId)
    .maybeSingle();

  return res.status(200).json({
    ...profile,
    scope: scope || null,
    xp: xp || null,
    platform_stats: platformStats || null,
    level_change_status: levelChangeStatus
      ? {
          ...levelChangeStatus,
          requested_level: levelChangeStatus.requested_track,
          reviewed_at: levelChangeStatus.resolved_at,
          reviewed_by: levelChangeStatus.admin_id
        }
      : null,
    recent_activity: recentActivity || []
  });
}

async function getProfileSettings(req, res, ctx) {
  const userId = ctx.userId;

  const [
    profileResult,
    notificationResult,
    featureResult,
    parentResult
  ] = await Promise.all([
    supabase
      .from('user_profiles')
      .select(`
        user_id,
        email,
        full_name,
        display_name,
        name,
        profile_picture_url,
        profile_picture_updated_at,
        bio,
        role,
        track,
        class_name,
        is_minor,
        account_status,
        show_on_leaderboard,
        preferences
      `)
      .eq('user_id', userId)
      .maybeSingle(),

    supabase
      .from('notification_preferences')
      .select('module, in_app, email, push, updated_at')
      .eq('user_id', userId),

    supabase
      .from('user_feature_settings')
      .select('feature_key, is_enabled, custom_settings, updated_at')
      .eq('user_id', userId),

    supabase
      .from('parental_consents')
      .select(`
        id,
        guardian_name,
        guardian_email,
        guardian_relationship,
        consent_status,
        created_at
      `)
      .eq('minor_user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
  ]);

  return res.status(200).json({
    profile: profileResult.data || null,
    notifications: notificationResult.data || [],
    feature_settings: featureResult.data || [],
    parent_guardian: parentResult.data || null
  });
}

async function saveOnboarding(body, res, ctx) {
  const userId = ctx.userId;
  const { track, class_name, role, completed } = body;

  if (!track || !class_name) {
    throw new SecurityError('track and class_name are required', 400);
  }

  const { data: existingLevel } = await supabase
    .from('curriculum_levels')
    .select('id, display_name')
    .eq('display_name', track)
    .maybeSingle();

  if (!existingLevel) {
    throw new SecurityError('Invalid level selected', 400);
  }

  const { data: existingGroup } = await supabase
    .from('curriculum_groups')
    .select('id, name')
    .eq('level_id', existingLevel.id)
    .eq('name', class_name)
    .maybeSingle();

  if (!existingGroup) {
    throw new SecurityError('Invalid class selected', 400);
  }

  const updates = {
    track,
    class_name,
    active_level_id: existingLevel.id,
    active_group_id: existingGroup.id,
    onboarding_completed: completed !== false,
    updated_at: new Date().toISOString()
  };

  if (role) {
    updates.role = role;
  }

  const { data, error } = await supabase
    .from('user_profiles')
    .update(updates)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    throw new SecurityError('Unable to save onboarding information', 500);
  }

  await supabase.from('audit_log').insert({
    actor_id: userId,
    action: 'onboarding_completed',
    target_type: 'user',
    target_id: userId,
    metadata: { track, class_name, role }
  });

  await supabase.from('user_activity').insert({
    user_id: userId,
    action: 'onboarding_completed',
    target_type: 'user',
    target_id: userId,
    metadata: { track, class_name }
  });

  return res.status(200).json({ success: true, profile: data });
}

async function updateProfile(body, res, ctx) {
  const userId = ctx.userId;

  const allowed = [
    'full_name',
    'display_name',
    'name',
    'bio',
    'email',
    'profile_picture_url',
    'show_on_leaderboard'
  ];

  const updates = {};

  for (const field of allowed) {
    if (body[field] !== undefined) {
      updates[field] = body[field];
    }
  }

  if (body.profile_picture_url !== undefined) {
    updates.profile_picture_updated_at = new Date().toISOString();
  }

  if (body.profile_data && typeof body.profile_data === 'object') {
    const { data: current } = await supabase
      .from('user_profiles')
      .select('preferences')
      .eq('user_id', userId)
      .maybeSingle();

    updates.preferences = {
      ...(current?.preferences || {}),
      ...body.profile_data
    };
  }

  if (updates.full_name !== undefined) {
    if (typeof updates.full_name !== 'string' || updates.full_name.trim().length < 2) {
      throw new SecurityError('Full name must contain at least 2 characters', 400);
    }

    updates.full_name = updates.full_name.trim();
  }

  if (updates.display_name !== undefined) {
    if (
      typeof updates.display_name !== 'string' ||
      updates.display_name.trim().length < 2 ||
      updates.display_name.trim().length > 100 ||
      /[<>]/.test(updates.display_name.trim())
    ) {
      throw new SecurityError('Invalid display name', 400);
    }

    updates.display_name = updates.display_name.trim();
  }

  if (updates.bio !== undefined && updates.bio !== null) {
    if (typeof updates.bio !== 'string' || updates.bio.length > 1000) {
      throw new SecurityError('Bio must not exceed 1000 characters', 400);
    }
  }

  if (Object.keys(updates).length === 0) {
    throw new SecurityError('No profile changes supplied', 400);
  }

  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('user_profiles')
    .update(updates)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    throw new SecurityError('Unable to update profile', 500);
  }

  await supabase.from('user_activity').insert({
    user_id: userId,
    action: 'update_profile',
    target_type: 'user',
    target_id: userId,
    metadata: {
      fields: Object.keys(updates).filter(
        field => field !== 'updated_at' && field !== 'preferences'
      ),
      preferences_updated: !!body.profile_data
    }
  });

  return res.status(200).json({
    success: true,
    profile: data
  });
}

async function savePreferences(body, res, ctx) {
  const userId = ctx.userId;

  if (!body.preferences || typeof body.preferences !== 'object') {
    throw new SecurityError('preferences must be an object', 400);
  }

  const allowedKeys = [
    'date_of_birth',
    'gender',
    'location',
    'phone',
    'preferred_study_time',
    'daily_goal_minutes',
    'quiz_difficulty',
    'language',
    'timezone',
    'currency',
    'measurement_system',
    'weekly_progress_reports',
    'dark_mode_reading',
    'auto_next_lesson',
    'show_quiz_hints',
    'achievement_sounds',
    'large_text',
    'high_contrast',
    'reduce_motion',
    'screen_reader',
    'dyslexia_font',
    'theme_accent',
    'accessibility',
    'community',
    'privacy'
  ];

  const incoming = body.preferences;

  for (const key of Object.keys(incoming)) {
    if (!allowedKeys.includes(key)) {
      delete incoming[key];
    }
  }

  const { data: current } = await supabase
    .from('user_profiles')
    .select('preferences')
    .eq('user_id', userId)
    .maybeSingle();

  const preferences = {
    ...(current?.preferences || {}),
    ...incoming
  };

  if (
    preferences.daily_goal_minutes !== undefined &&
    (![15, 30, 60, 90].includes(Number(preferences.daily_goal_minutes)))
  ) {
    throw new SecurityError('Invalid daily goal', 400);
  }

  if (
    preferences.quiz_difficulty !== undefined &&
    !['easy', 'medium', 'hard'].includes(preferences.quiz_difficulty)
  ) {
    throw new SecurityError('Invalid quiz difficulty', 400);
  }

  const { data, error } = await supabase
    .from('user_profiles')
    .update({
      preferences,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', userId)
    .select('user_id, preferences, updated_at')
    .single();

  if (error) {
    throw new SecurityError('Unable to save preferences', 500);
  }

  await supabase.from('user_activity').insert({
    user_id: userId,
    action: 'save_preferences',
    target_type: 'user',
    target_id: userId,
    metadata: {
      fields: Object.keys(incoming)
    }
  });

  return res.status(200).json({
    success: true,
    preferences: data.preferences
  });
}

async function getNotificationPreferences(req, res, ctx) {
  const userId = ctx.userId;

  const { data, error } = await supabase
    .from('notification_preferences')
    .select('module, in_app, email, push, updated_at')
    .eq('user_id', userId)
    .order('module');

  if (error) {
    throw new SecurityError('Unable to load notification preferences', 500);
  }

  return res.status(200).json(data || []);
}

async function saveNotifications(body, res, ctx) {
  const userId = ctx.userId;
  const preferences = body.preferences;

  if (!Array.isArray(preferences)) {
    throw new SecurityError('preferences must be an array', 400);
  }

  const validModules = [
    'auth',
    'recall',
    'quiz',
    'resources',
    'pdfs',
    'notes',
    'flashcards',
    'glossary',
    'past_papers',
    'social',
    'community',
    'system',
    'payment',
    'chat',
    'newsletter'
  ];

  const rows = preferences.map(item => {
    if (!item.module || !validModules.includes(item.module)) {
      throw new SecurityError('Invalid notification module', 400);
    }

    return {
      user_id: userId,
      module: item.module,
      in_app: item.in_app !== false,
      email: item.email === true,
      push: item.push === true,
      updated_at: new Date().toISOString()
    };
  });

  const { data, error } = await supabase
    .from('notification_preferences')
    .upsert(rows, {
      onConflict: 'user_id,module'
    })
    .select('module, in_app, email, push, updated_at');

  if (error) {
    throw new SecurityError('Unable to save notification preferences', 500);
  }

  return res.status(200).json({
    success: true,
    preferences: data || []
  });
}

async function updateClass(body, res, ctx) {
  const userId = ctx.userId;
  const { class_name } = body;

  if (!class_name) {
    throw new SecurityError('class_name is required', 400);
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('track')
    .eq('user_id', userId)
    .maybeSingle();

  if (!profile || !profile.track) {
    throw new SecurityError('User has no active track set', 400);
  }

  const { data: level } = await supabase
    .from('curriculum_levels')
    .select('id')
    .eq('display_name', profile.track)
    .maybeSingle();

  if (!level) {
    throw new SecurityError('Invalid track', 400);
  }

  const { data: group } = await supabase
    .from('curriculum_groups')
    .select('id')
    .eq('level_id', level.id)
    .eq('name', class_name)
    .maybeSingle();

  if (!group) {
    throw new SecurityError('Invalid class name', 400);
  }

  const { data, error } = await supabase
    .from('user_profiles')
    .update({
      class_name,
      active_group_id: group.id,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    throw new SecurityError('Unable to update class', 500);
  }

  await supabase.from('user_activity').insert({
    user_id: userId,
    action: 'update_class',
    target_type: 'user',
    target_id: userId,
    metadata: { class_name }
  });

  return res.status(200).json({ success: true, profile: data });
}

async function switchClass(body, res, ctx) {
  const userId = ctx.userId;
  const { group_id } = body;

  if (!group_id) {
    throw new SecurityError('group_id is required', 400);
  }

  const { data: group } = await supabase
    .from('curriculum_groups')
    .select('id, name, level_id, curriculum_levels(display_name)')
    .eq('id', group_id)
    .eq('is_active', true)
    .maybeSingle();

  if (!group) {
    throw new SecurityError('Group not found or inactive', 404);
  }

  const { data, error } = await supabase
    .from('user_profiles')
    .update({
      active_group_id: group.id,
      active_level_id: group.level_id,
      class_name: group.name,
      track: group.curriculum_levels?.display_name || null,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    throw new SecurityError('Unable to switch class', 500);
  }

  await supabase.from('user_activity').insert({
    user_id: userId,
    action: 'switch_class',
    target_type: 'user',
    target_id: userId,
    metadata: { group_id, class_name: group.name }
  });

  return res.status(200).json({ success: true, profile: data });
}

async function requestLevelChange(body, res, ctx) {
  const userId = ctx.userId;
  const {
    requested_track,
    requested_level,
    requested_class,
    reason
  } = body;

  const requestedTrack = requested_track || requested_level;

  if (!requestedTrack || !reason) {
    throw new SecurityError('requested_track and reason are required', 400);
  }

  const { data: level } = await supabase
    .from('curriculum_levels')
    .select('id, display_name')
    .eq('display_name', requestedTrack)
    .maybeSingle();

  if (!level) {
    throw new SecurityError('Invalid level requested', 400);
  }

  const { data: existingRequest } = await supabase
    .from('level_change_requests')
    .select('id, status')
    .eq('user_id', userId)
    .in('status', ['pending', 'approved'])
    .maybeSingle();

  if (existingRequest) {
    throw new SecurityError(
      `You already have a ${existingRequest.status} request`,
      400
    );
  }

  let requestedGroupId = null;

  if (requested_class) {
    const { data: group } = await supabase
      .from('curriculum_groups')
      .select('id')
      .eq('level_id', level.id)
      .eq('name', requested_class)
      .eq('is_active', true)
      .maybeSingle();

    if (!group) {
      throw new SecurityError('Invalid class for requested level', 400);
    }

    requestedGroupId = group.id;
  }

  const { data, error } = await supabase
    .from('level_change_requests')
    .insert({
      user_id: userId,
      requested_track: requestedTrack,
      requested_class: requested_class || null,
      requested_level_id: level.id,
      requested_group_id: requestedGroupId,
      reason,
      status: 'pending',
      created_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) {
    throw new SecurityError('Unable to create level change request', 500);
  }

  await supabase.from('audit_log').insert({
    actor_id: userId,
    action: 'request_level_change',
    target_type: 'user',
    target_id: userId,
    metadata: {
      requested_track: requestedTrack,
      requested_class: requested_class || null,
      reason
    }
  });

  await supabase.from('user_activity').insert({
    user_id: userId,
    action: 'request_level_change',
    target_type: 'user',
    target_id: userId,
    metadata: { requested_track: requestedTrack }
  });

  await createNotification(userId, 'level_change_requested', {
    requested_level: requestedTrack
  });

  return res.status(200).json({
    success: true,
    request: {
      ...data,
      requested_level: data.requested_track
    }
  });
}

async function reviewLevelChange(body, res, ctx) {
  const { request_id, action } = body;

  if (!request_id || !action || !['approve', 'reject'].includes(action)) {
    throw new SecurityError(
      'request_id and action (approve/reject) required',
      400
    );
  }

  const { data: request } = await supabase
    .from('level_change_requests')
    .select(`
      *,
      user_profiles(
        user_id,
        track,
        class_name,
        email,
        full_name,
        display_name
      )
    `)
    .eq('id', request_id)
    .eq('status', 'pending')
    .maybeSingle();

  if (!request) {
    throw new SecurityError('Request not found or already reviewed', 404);
  }

  const requestedTrack = request.requested_track;

  const { data: level } = await supabase
    .from('curriculum_levels')
    .select('id')
    .eq('display_name', requestedTrack)
    .maybeSingle();

  if (!level && action === 'approve') {
    throw new SecurityError('Invalid level in request', 400);
  }

  const newStatus = action === 'approve' ? 'approved' : 'rejected';

  await supabase
    .from('level_change_requests')
    .update({
      status: newStatus,
      admin_id: ctx.userId,
      resolved_at: new Date().toISOString()
    })
    .eq('id', request_id);

  if (action === 'approve') {
    let defaultGroup = null;

    if (request.requested_group_id) {
      const { data: requestedGroup } = await supabase
        .from('curriculum_groups')
        .select('id, name')
        .eq('id', request.requested_group_id)
        .eq('level_id', level.id)
        .eq('is_active', true)
        .maybeSingle();

      defaultGroup = requestedGroup;
    }

    if (!defaultGroup) {
      const { data: firstGroup } = await supabase
        .from('curriculum_groups')
        .select('id, name')
        .eq('level_id', level.id)
        .eq('is_active', true)
        .order('sequence_order', { ascending: true })
        .limit(1)
        .maybeSingle();

      defaultGroup = firstGroup;
    }

    await supabase
      .from('user_profiles')
      .update({
        track: requestedTrack,
        active_level_id: level.id,
        active_group_id: defaultGroup?.id || null,
        class_name: defaultGroup?.name || request.requested_class || null,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', request.user_id);

    await createNotification(request.user_id, 'level_change_approved', {
      new_level: requestedTrack
    });
  } else {
    await createNotification(request.user_id, 'level_change_rejected', {
      requested_level: requestedTrack
    });
  }

  await supabase.from('audit_log').insert({
    actor_id: ctx.userId,
    actor_role: ctx.adminData?.admin_role,
    action: `level_change_${action}`,
    target_type: 'user',
    target_id: request.user_id,
    metadata: {
      request_id,
      requested_level: requestedTrack
    }
  });

  await supabase.from('user_activity').insert({
    user_id: request.user_id,
    action: `level_change_${action}`,
    target_type: 'user',
    target_id: request.user_id,
    metadata: {
      status: newStatus,
      requested_level: requestedTrack
    }
  });

  return res.status(200).json({
    success: true,
    status: newStatus
  });
}

async function adminUpdateProfile(body, res, ctx) {
  const { user_id, track, class_name } = body;

  if (!user_id) {
    throw new SecurityError('user_id is required', 400);
  }

  const updates = {
    updated_at: new Date().toISOString()
  };

  if (track) {
    const { data: level } = await supabase
      .from('curriculum_levels')
      .select('id')
      .eq('display_name', track)
      .maybeSingle();

    if (!level) {
      throw new SecurityError('Invalid track', 400);
    }

    updates.track = track;
    updates.active_level_id = level.id;
  }

  if (class_name) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('track')
      .eq('user_id', user_id)
      .maybeSingle();

    const trackToUse = track || profile?.track;

    if (!trackToUse) {
      throw new SecurityError('Cannot update class without track', 400);
    }

    const { data: level } = await supabase
      .from('curriculum_levels')
      .select('id')
      .eq('display_name', trackToUse)
      .maybeSingle();

    if (!level) {
      throw new SecurityError('Invalid track', 400);
    }

    const { data: group } = await supabase
      .from('curriculum_groups')
      .select('id')
      .eq('level_id', level.id)
      .eq('name', class_name)
      .maybeSingle();

    if (!group) {
      throw new SecurityError('Invalid class name', 400);
    }

    updates.class_name = class_name;
    updates.active_group_id = group.id;
  }

  const { data, error } = await supabase
    .from('user_profiles')
    .update(updates)
    .eq('user_id', user_id)
    .select()
    .single();

  if (error) {
    throw new SecurityError('Unable to update profile', 500);
  }

  await supabase.from('audit_log').insert({
    actor_id: ctx.userId,
    actor_role: ctx.adminData?.admin_role,
    action: 'admin_update_profile',
    target_type: 'user',
    target_id: user_id,
    metadata: { track, class_name }
  });

  await createNotification(user_id, 'profile_updated_by_admin', {
    fields: Object.keys(updates).filter(k => k !== 'updated_at')
  });

  return res.status(200).json({
    success: true,
    profile: data
  });
}

async function updateDisplayName(body, res, ctx) {
  const userId = ctx.userId;
  const { display_name } = body;

  if (!display_name || display_name.trim().length < 2) {
    throw new SecurityError(
      'display_name must be at least 2 characters',
      400
    );
  }

  if (display_name.trim().length > 100) {
    throw new SecurityError(
      'display_name must not exceed 100 characters',
      400
    );
  }

  if (/[<>]/.test(display_name.trim())) {
    throw new SecurityError(
      'display_name contains invalid characters',
      400
    );
  }

  const { data, error } = await supabase
    .from('user_profiles')
    .update({
      display_name: display_name.trim(),
      updated_at: new Date().toISOString()
    })
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    throw new SecurityError('Unable to update display name', 500);
  }

  await supabase.from('user_activity').insert({
    user_id: userId,
    action: 'update_display_name',
    target_type: 'user',
    target_id: userId,
    metadata: {
      display_name: display_name.trim()
    }
  });

  return res.status(200).json({
    success: true,
    profile: data
  });
}

async function changePassword(body, res, ctx) {
  const { current_password, new_password, confirm_password } = body;

  if (!current_password || !new_password || !confirm_password) {
    throw new SecurityError('All password fields are required', 400);
  }

  if (new_password !== confirm_password) {
    throw new SecurityError('New passwords do not match', 400);
  }

  if (new_password.length < 8) {
    throw new SecurityError(
      'New password must be at least 8 characters',
      400
    );
  }

  const { data: authUser } = await supabase.auth.admin.getUserById(ctx.userId);

  if (!authUser?.user?.email) {
    throw new SecurityError('Unable to verify account email', 400);
  }

  const { error: verifyError } =
    await supabase.auth.signInWithPassword({
      email: authUser.user.email,
      password: current_password
    });

  if (verifyError) {
    throw new SecurityError('Current password is incorrect', 401);
  }

  const { error } =
    await supabase.auth.admin.updateUserById(ctx.userId, {
      password: new_password
    });

  if (error) {
    throw new SecurityError('Unable to update password', 500);
  }

  await supabase
    .from('user_sessions')
    .update({
      is_active: false,
      terminated_reason: 'password_changed',
      terminated_at: new Date().toISOString()
    })
    .eq('user_id', ctx.userId)
    .neq('is_active', false);

  await supabase.from('audit_log').insert({
    actor_id: ctx.userId,
    action: 'change_password',
    target_type: 'user',
    target_id: ctx.userId,
    metadata: {}
  });

  return res.status(200).json({
    success: true
  });
}

async function getProfileStats(req, res, ctx) {
  const userId = ctx.userId;

  const [
    xpResult,
    platformResult,
    topicResult,
    quizResult,
    flashcardResult,
    readingResult
  ] = await Promise.all([
    supabase
      .from('user_xp')
      .select('total_xp, level, rank_title')
      .eq('user_id', userId)
      .maybeSingle(),

    supabase
      .from('user_platform_stats')
      .select(`
        total_xp,
        platform_level,
        current_streak,
        longest_streak,
        last_activity_date
      `)
      .eq('user_id', userId)
      .maybeSingle(),

    supabase
      .from('user_topic_stats')
      .select('topic, xp, streak, last_activity_date, unit_id')
      .eq('user_id', userId)
      .order('xp', { ascending: false }),

    supabase
      .from('quiz_attempts')
      .select('percentage, status, passed, xp_earned, submitted_at, unit_id')
      .eq('user_id', userId)
      .order('submitted_at', { ascending: false })
      .limit(100),

    supabase
      .from('user_flashcard_sessions')
      .select('id, deck_id, is_complete, started_at, completed_at, cards_seen, cards_correct')
      .eq('user_id', userId)
      .order('started_at', { ascending: false })
      .limit(100),

    supabase
      .from('note_reading_stats')
      .select(`
        current_streak,
        longest_streak,
        notes_read_count,
        last_read_date
      `)
      .eq('user_id', userId)
      .maybeSingle()
  ]);

  const quizAttempts = quizResult.data || [];

  const averageQuizScore = quizAttempts.length
    ? Math.round(
        quizAttempts.reduce(
          (sum, item) => sum + Number(item.percentage || 0),
          0
        ) / quizAttempts.length
      )
    : 0;

  const passedQuizzes = quizAttempts.filter(item => item.passed).length;

  return res.status(200).json({
    xp: xpResult.data || null,
    platform: platformResult.data || null,
    topics: topicResult.data || [],
    quiz: {
      attempts: quizAttempts.length,
      passed: passedQuizzes,
      average_score: averageQuizScore,
      recent: quizAttempts.slice(0, 10)
    },
    flashcards: flashcardResult.data || [],
    reading: readingResult.data || null
  });
}

async function getAchievements(req, res, ctx) {
  const { data, error } = await supabase
    .from('user_achievements')
    .select(`
      id,
      earned_at,
      achievement_id,
      achievements(
        id,
        name,
        icon,
        description,
        requirement_type,
        requirement_value
      )
    `)
    .eq('user_id', ctx.userId)
    .order('earned_at', { ascending: false });

  if (error) {
    throw new SecurityError('Unable to load achievements', 500);
  }

  return res.status(200).json(data || []);
}

async function getCertificates(req, res, ctx) {
  const { data, error } = await supabase
    .from('certificates')
    .select(`
      id,
      title,
      unit_id,
      score,
      issued_at,
      certificate_url,
      verification_code
    `)
    .eq('user_id', ctx.userId)
    .order('issued_at', { ascending: false });

  if (error) {
    throw new SecurityError('Unable to load certificates', 500);
  }

  return res.status(200).json(data || []);
}

async function getStreak(req, res, ctx) {
  const userId = ctx.userId;

  const { data: stats } = await supabase
    .from('user_platform_stats')
    .select(`
      current_streak,
      longest_streak,
      last_activity_date
    `)
    .eq('user_id', userId)
    .maybeSingle();

  const { data: activity } = await supabase
    .from('user_daily_activity')
    .select('activity_date, count')
    .eq('user_id', userId)
    .order('activity_date', { ascending: false })
    .limit(28);

  return res.status(200).json({
    current_streak: stats?.current_streak || 0,
    longest_streak: stats?.longest_streak || 0,
    last_activity_date: stats?.last_activity_date || null,
    days: activity || []
  });
}

async function getPerformance(req, res, ctx) {
  const userId = ctx.userId;

  const { data: stats, error } = await supabase
    .from('quiz_mastery')
    .select(`
      unit_id,
      group_id,
      level_id,
      concept_name,
      attempts,
      correct_attempts,
      accuracy,
      mastery_score,
      mastery_state,
      last_attempted_at
    `)
    .eq('user_id', userId)
    .order('mastery_score', { ascending: false });

  if (error) {
    throw new SecurityError('Unable to load performance data', 500);
  }

  const byConcept = stats || [];

  return res.status(200).json({
    concepts: byConcept,
    summary: {
      total_attempts: byConcept.reduce(
        (sum, item) => sum + Number(item.attempts || 0),
        0
      ),
      average_accuracy: byConcept.length
        ? Math.round(
            byConcept.reduce(
              (sum, item) => sum + Number(item.accuracy || 0),
              0
            ) / byConcept.length
          )
        : 0,
      mastered: byConcept.filter(
        item => item.mastery_state === 'mastered'
      ).length
    }
  });
}

async function getSavedItems(req, res, ctx) {
  const { data, error } = await supabase
    .from('content_reactions')
    .select(`
      id,
      content_type,
      content_id,
      reaction_type,
      folder_id,
      created_at
    `)
    .eq('user_id', ctx.userId)
    .eq('reaction_type', 'bookmark')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    throw new SecurityError('Unable to load saved items', 500);
  }

  return res.status(200).json(data || []);
}

async function getDevices(req, res, ctx) {
  const { data, error } = await supabase
    .from('user_sessions')
    .select(`
      id,
      ip_address,
      user_agent,
      expires_at,
      is_active,
      created_at,
      fingerprint,
      mfa_verified,
      passkey_verified
    `)
    .eq('user_id', ctx.userId)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) {
    throw new SecurityError('Unable to load sessions', 500);
  }

  const sessions = (data || []).map(session => ({
    id: session.id,
    ip_address: session.ip_address,
    user_agent: session.user_agent,
    expires_at: session.expires_at,
    is_active: session.is_active,
    created_at: session.created_at,
    mfa_verified: session.mfa_verified,
    passkey_verified: session.passkey_verified
  }));

  return res.status(200).json(sessions);
}

async function revokeSession(body, res, ctx) {
  const { session_id } = body;

  if (!session_id) {
    throw new SecurityError('session_id is required', 400);
  }

  const { error } = await supabase
    .from('user_sessions')
    .update({
      is_active: false,
      terminated_reason: 'revoked_by_user',
      terminated_at: new Date().toISOString()
    })
    .eq('id', session_id)
    .eq('user_id', ctx.userId);

  if (error) {
    throw new SecurityError('Unable to revoke session', 500);
  }

  await supabase.from('audit_log').insert({
    actor_id: ctx.userId,
    action: 'revoke_session',
    target_type: 'session',
    target_id: String(session_id),
    metadata: {}
  });

  return res.status(200).json({
    success: true
  });
}

async function getReferrals(req, res, ctx) {
  const userId = ctx.userId;

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('referral_code')
    .eq('user_id', userId)
    .maybeSingle();

  const { data: referrals, error } = await supabase
    .from('user_referrals')
    .select(`
      id,
      referred_user_id,
      referral_code,
      status,
      xp_awarded,
      created_at,
      rewarded_at
    `)
    .eq('referrer_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new SecurityError('Unable to load referrals', 500);
  }

  return res.status(200).json({
    referral_code: profile?.referral_code || null,
    referrals: referrals || [],
    joined_count: (referrals || []).length,
    xp_earned: (referrals || []).reduce(
      (sum, item) => sum + Number(item.xp_awarded || 0),
      0
    )
  });
}

async function getApiKeys(req, res, ctx) {
  const { data, error } = await supabase
    .from('api_keys')
    .select(`
      id,
      name,
      key_prefix,
      scopes,
      last_used_at,
      created_at,
      revoked_at,
      is_active
    `)
    .eq('user_id', ctx.userId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new SecurityError('Unable to load API keys', 500);
  }

  return res.status(200).json(data || []);
}

async function createApiKey(body, res, ctx) {
  const name = typeof body.name === 'string'
    ? body.name.trim()
    : 'AliverBiopharm API Key';

  if (name.length < 2 || name.length > 100) {
    throw new SecurityError('Invalid API key name', 400);
  }

  const rawKey =
    `sk_live_${crypto.randomBytes(32).toString('hex')}`;

  const keyPrefix = rawKey.slice(0, 16);

  const keyHash = crypto
    .createHash('sha256')
    .update(rawKey)
    .digest('hex');

  const scopes = Array.isArray(body.scopes)
    ? body.scopes.slice(0, 20)
    : [];

  const { data, error } = await supabase
    .from('api_keys')
    .insert({
      user_id: ctx.userId,
      name,
      key_hash: keyHash,
      key_prefix: keyPrefix,
      scopes,
      is_active: true
    })
    .select(`
      id,
      name,
      key_prefix,
      scopes,
      created_at,
      is_active
    `)
    .single();

  if (error) {
    throw new SecurityError('Unable to create API key', 500);
  }

  return res.status(200).json({
    success: true,
    key: rawKey,
    api_key: data
  });
}

async function revokeApiKey(body, res, ctx) {
  if (!body.id) {
    throw new SecurityError('API key id is required', 400);
  }

  const { error } = await supabase
    .from('api_keys')
    .update({
      is_active: false,
      revoked_at: new Date().toISOString()
    })
    .eq('id', body.id)
    .eq('user_id', ctx.userId);

  if (error) {
    throw new SecurityError('Unable to revoke API key', 500);
  }

  return res.status(200).json({
    success: true
  });
}

async function getWebhooks(req, res, ctx) {
  const { data, error } = await supabase
    .from('webhook_endpoints')
    .select(`
      id,
      url,
      events,
      is_active,
      last_delivery_status,
      last_delivery_at,
      created_at
    `)
    .eq('user_id', ctx.userId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new SecurityError('Unable to load webhooks', 500);
  }

  return res.status(200).json(data || []);
}

async function createWebhook(body, res, ctx) {
  const url = typeof body.url === 'string'
    ? body.url.trim()
    : '';

  if (!url) {
    throw new SecurityError('Webhook URL is required', 400);
  }

  let parsedUrl;

  try {
    parsedUrl = new URL(url);
  } catch {
    throw new SecurityError('Invalid webhook URL', 400);
  }

  if (!['https:', 'http:'].includes(parsedUrl.protocol)) {
    throw new SecurityError('Invalid webhook protocol', 400);
  }

  const secret = crypto.randomBytes(32).toString('hex');

  const events = Array.isArray(body.events)
    ? body.events.slice(0, 50)
    : ['*'];

  const { data, error } = await supabase
    .from('webhook_endpoints')
    .insert({
      user_id: ctx.userId,
      url,
      secret,
      events,
      is_active: true
    })
    .select(`
      id,
      url,
      events,
      is_active,
      created_at
    `)
    .single();

  if (error) {
    throw new SecurityError('Unable to create webhook', 500);
  }

  return res.status(200).json({
    success: true,
    webhook: data,
    secret
  });
}

async function updateWebhook(body, res, ctx) {
  if (!body.id) {
    throw new SecurityError('Webhook id is required', 400);
  }

  const updates = {};

  if (body.url !== undefined) {
    try {
      const parsedUrl = new URL(body.url);

      if (!['https:', 'http:'].includes(parsedUrl.protocol)) {
        throw new Error();
      }

      updates.url = parsedUrl.toString();
    } catch {
      throw new SecurityError('Invalid webhook URL', 400);
    }
  }

  if (body.events !== undefined) {
    if (!Array.isArray(body.events)) {
      throw new SecurityError('events must be an array', 400);
    }

    updates.events = body.events.slice(0, 50);
  }

  if (body.is_active !== undefined) {
    updates.is_active = body.is_active === true;
  }

  if (Object.keys(updates).length === 0) {
    throw new SecurityError('No webhook changes supplied', 400);
  }

  const { data, error } = await supabase
    .from('webhook_endpoints')
    .update(updates)
    .eq('id', body.id)
    .eq('user_id', ctx.userId)
    .select(`
      id,
      url,
      events,
      is_active,
      last_delivery_status,
      last_delivery_at,
      created_at
    `)
    .single();

  if (error) {
    throw new SecurityError('Unable to update webhook', 500);
  }

  return res.status(200).json({
    success: true,
    webhook: data
  });
}

async function deleteWebhook(body, res, ctx) {
  if (!body.id) {
    throw new SecurityError('Webhook id is required', 400);
  }

  const { error } = await supabase
    .from('webhook_endpoints')
    .delete()
    .eq('id', body.id)
    .eq('user_id', ctx.userId);

  if (error) {
    throw new SecurityError('Unable to delete webhook', 500);
  }

  return res.status(200).json({
    success: true
  });
}

async function getBilling(req, res, ctx) {
  const { data, error } = await supabase
    .from('user_subscriptions')
    .select(`
      id,
      status,
      starts_at,
      expires_at,
      auto_renew,
      cancelled_at,
      created_at,
      plan_id,
      subscription_plans(
        id,
        name,
        slug,
        description,
        price_amount,
        currency,
        duration_days,
        features
      )
    `)
    .eq('user_id', ctx.userId)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    throw new SecurityError('Unable to load billing information', 500);
  }

  return res.status(200).json(data || []);
}

async function getParentGuardian(req, res, ctx) {
  const { data, error } = await supabase
    .from('parental_consents')
    .select(`
      id,
      guardian_name,
      guardian_email,
      guardian_relationship,
      consent_status,
      created_at
    `)
    .eq('minor_user_id', ctx.userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new SecurityError(
      'Unable to load parent or guardian information',
      500
    );
  }

  return res.status(200).json(data || null);
}

async function saveParentGuardian(body, res, ctx) {
  const {
    guardian_name,
    guardian_email,
    guardian_relationship
  } = body;

  if (!guardian_name || !guardian_email) {
    throw new SecurityError(
      'Guardian name and email are required',
      400
    );
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('is_minor')
    .eq('user_id', ctx.userId)
    .maybeSingle();

  if (!profile?.is_minor) {
    throw new SecurityError(
      'Parent or guardian controls are only available for minor accounts',
      403
    );
  }

  const { data: existing } = await supabase
    .from('parental_consents')
    .select('id')
    .eq('minor_user_id', ctx.userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let data;
  let error;

  if (existing?.id) {
    const result = await supabase
      .from('parental_consents')
      .update({
        guardian_name: guardian_name.trim(),
        guardian_email: guardian_email.trim().toLowerCase(),
        guardian_relationship: guardian_relationship || null
      })
      .eq('id', existing.id)
      .eq('minor_user_id', ctx.userId)
      .select()
      .single();

    data = result.data;
    error = result.error;
  } else {
    const result = await supabase
      .from('parental_consents')
      .insert({
        minor_user_id: ctx.userId,
        guardian_name: guardian_name.trim(),
        guardian_email: guardian_email.trim().toLowerCase(),
        guardian_relationship: guardian_relationship || null,
        consent_status: 'pending'
      })
      .select()
      .single();

    data = result.data;
    error = result.error;
  }

  if (error) {
    throw new SecurityError(
      'Unable to save parent or guardian information',
      500
    );
  }

  return res.status(200).json({
    success: true,
    parent_guardian: data
  });
}

async function requestExport(body, res, ctx) {
  const { data: existing } = await supabase
    .from('user_export_requests')
    .select('id, status, requested_at, expires_at, download_url')
    .eq('user_id', ctx.userId)
    .in('status', ['pending', 'processing', 'ready'])
    .order('requested_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    return res.status(200).json({
      success: true,
      request: existing
    });
  }

  const { data, error } = await supabase
    .from('user_export_requests')
    .insert({
      user_id: ctx.userId,
      status: 'pending',
      requested_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) {
    throw new SecurityError(
      'Unable to create export request',
      500
    );
  }

  await supabase.from('audit_log').insert({
    actor_id: ctx.userId,
    action: 'export_data',
    target_type: 'user',
    target_id: ctx.userId,
    metadata: {}
  });

  return res.status(200).json({
    success: true,
    request: data
  });
}

async function requestAccountDeletion(body, res, ctx) {
  const { confirmation_code } = body;

  if (!confirmation_code || String(confirmation_code).length < 4) {
    throw new SecurityError(
      'A valid confirmation code is required',
      400
    );
  }

  const { data: existing } = await supabase
    .from('data_deletion_requests')
    .select('id, status')
    .eq('user_id', ctx.userId)
    .in('status', ['pending', 'processing'])
    .maybeSingle();

  if (existing) {
    throw new SecurityError(
      'An account deletion request is already active',
      400
    );
  }

  const { data, error } = await supabase
    .from('data_deletion_requests')
    .insert({
      user_id: ctx.userId,
      status: 'pending',
      confirmation_code: String(confirmation_code)
    })
    .select()
    .single();

  if (error) {
    throw new SecurityError(
      'Unable to create account deletion request',
      500
    );
  }

  await supabase.from('sensitive_operations').insert({
    user_id: ctx.userId,
    operation_type: 'delete_account',
    status: 'pending',
    confirmation_token: String(confirmation_code),
    expires_at: new Date(
      Date.now() + 15 * 60 * 1000
    ).toISOString(),
    metadata: {}
  });

  await supabase.from('audit_log').insert({
    actor_id: ctx.userId,
    action: 'request_account_deletion',
    target_type: 'user',
    target_id: ctx.userId,
    metadata: {}
  });

  return res.status(200).json({
    success: true,
    request: data
  });
}

async function getRecentActivity(req, res, ctx) {
  const { data, error } = await supabase
    .from('user_activity')
    .select(`
      action,
      target_type,
      target_id,
      metadata,
      created_at
    `)
    .eq('user_id', ctx.userId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    throw new SecurityError(
      'Unable to load recent activity',
      500
    );
  }

  return res.status(200).json(data || []);
}

async function getClassSequence(req, res, ctx) {
  const { track } = req.query;

  if (!track) {
    throw new SecurityError('track is required', 400);
  }

  const { data: level } = await supabase
    .from('curriculum_levels')
    .select('id')
    .eq('display_name', track)
    .maybeSingle();

  if (!level) {
    throw new SecurityError('Invalid track', 400);
  }

  const { data: groups } = await supabase
    .from('curriculum_groups')
    .select('id, name, description, icon, sequence_order')
    .eq('level_id', level.id)
    .eq('is_active', true)
    .order('sequence_order', { ascending: true });

  if (!groups || groups.length === 0) {
    return res.status(200).json([]);
  }

  const { data: units } = await supabase
    .from('curriculum_units')
    .select(
      'id, name, code, icon, display_order, is_premium, group_id'
    )
    .in(
      'group_id',
      groups.map(g => g.id)
    )
    .eq('is_active', true)
    .order('display_order', { ascending: true });

  const groupsWithUnits = groups.map(group => ({
    ...group,
    units: (units || []).filter(
      unit => unit.group_id === group.id
    )
  }));

  return res.status(200).json(groupsWithUnits);
}

async function getPharmacyPrograms(req, res, ctx) {
  const { data } = await supabase
    .from('curriculum_levels')
    .select(`
      id,
      display_name,
      group_label,
      unit_label,
      description,
      kind,
      icon,
      display_order
    `)
    .eq('is_active', true)
    .order('display_order', { ascending: true });

  return res.status(200).json(data || []);
}

async function getLevelChangeStatus(req, res, ctx) {
  const userId = ctx.userId;

  const { data } = await supabase
    .from('level_change_requests')
    .select(`
      id,
      status,
      requested_track,
      requested_class,
      requested_level_id,
      requested_group_id,
      reason,
      created_at,
      resolved_at,
      admin_id
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) {
    return res.status(200).json(null);
  }

  let reviewerName = null;

  if (data.admin_id) {
    const { data: reviewer } = await supabase
      .from('user_profiles')
      .select('display_name, full_name')
      .eq('user_id', data.admin_id)
      .maybeSingle();

    reviewerName =
      reviewer?.display_name ||
      reviewer?.full_name ||
      null;
  }

  return res.status(200).json({
    ...data,
    requested_level: data.requested_track,
    reviewed_at: data.resolved_at,
    reviewed_by: data.admin_id,
    reviewer_name: reviewerName
  });
}

async function getPendingLevelChanges(req, res, ctx) {
  const { data } = await supabase
    .from('level_change_requests')
    .select(`
      id,
      user_id,
      requested_track,
      requested_class,
      requested_level_id,
      requested_group_id,
      reason,
      status,
      created_at,
      resolved_at,
      admin_id,
      user_profiles!inner(
        user_id,
        email,
        full_name,
        display_name,
        track,
        class_name,
        profile_picture_url
      )
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  const formattedData = (data || []).map(item => ({
    id: item.id,
    user_id: item.user_id,
    requested_track: item.requested_track,
    requested_class: item.requested_class,
    requested_level_id: item.requested_level_id,
    requested_group_id: item.requested_group_id,
    requested_level: item.requested_track,
    reason: item.reason,
    status: item.status,
    created_at: item.created_at,
    resolved_at: item.resolved_at,
    reviewed_at: item.resolved_at,
    admin_id: item.admin_id,
    reviewed_by: item.admin_id,
    user: item.user_profiles
  }));

  return res.status(200).json(formattedData);
}
