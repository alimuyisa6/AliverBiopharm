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

const now = () => new Date().toISOString();

async function audit(ctx, action, targetType, targetId, metadata = {}) {
  try {
    await supabase.from('audit_log').insert({
      actor_id: ctx.userId || null,
      actor_role: ctx.adminData?.admin_role || null,
      action,
      target_type: targetType || null,
      target_id: targetId != null ? String(targetId) : null,
      metadata
    });
  } catch {}
}

async function notify(userId, type, payload = {}) {
  try {
    await createNotification(userId, type, payload);
  } catch {}
}

function validateDisplayName(value) {
  if (
    typeof value !== 'string' ||
    value.trim().length < 2 ||
    value.trim().length > 100 ||
    /[<>]/.test(value.trim())
  ) {
    throw new SecurityError('Invalid display name', 400);
  }

  return value.trim();
}

async function getLevelByName(track) {
  if (!track || typeof track !== 'string') return null;

  const { data, error } = await supabase
    .from('curriculum_levels')
    .select(`
      id,
      display_name,
      kind,
      group_label,
      unit_label,
      icon,
      color,
      display_order
    `)
    .eq('display_name', track)
    .maybeSingle();

  if (error) {
    throw new SecurityError('Unable to validate curriculum level', 500);
  }

  return data || null;
}

async function getGroupByName(levelId, className) {
  if (!levelId || !className) return null;

  const { data, error } = await supabase
    .from('curriculum_groups')
    .select(`
      id,
      level_id,
      name,
      description,
      icon,
      sequence_order,
      is_active
    `)
    .eq('level_id', levelId)
    .eq('name', className)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    throw new SecurityError('Unable to validate curriculum class', 500);
  }

  return data || null;
}

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

  let { data: profile, error } = await supabase
    .from('user_profiles')
    .select(`
      user_id,
      role,
      track,
      class_name,
      onboarding_completed,
      created_at,
      updated_at,
      contribute_track,
      contribute_class_name,
      contribute_subjects,
      is_approved_teacher,
      approved_by,
      approved_at,
      approval_notes,
      approved_track,
      profile_picture_url,
      profile_picture_updated_at,
      active_level_id,
      active_group_id,
      is_minor,
      account_status,
      display_name,
      show_on_leaderboard,
      name,
      email,
      full_name,
      bio,
      last_active_at,
      is_active,
      preferences,
      referral_code
    `)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new SecurityError('Unable to load profile', 500);
  }

  if (!profile) {
    throw new SecurityError(
      'Profile not found. Complete account setup before accessing your profile.',
      404
    );
  }

  const scope = await getUserCurriculumScope(userId);

  const [
    levelChangeResult,
    xpResult,
    platformResult
  ] = await Promise.all([
    supabase
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
      .maybeSingle(),

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
      .maybeSingle()
  ]);

  const { data: recentActivity } = await supabase
    .from('user_daily_activity')
    .select('activity_date, count')
    .eq('user_id', userId)
    .order('activity_date', { ascending: false })
    .limit(10);

  const levelChangeStatus = levelChangeResult.data
    ? {
        ...levelChangeResult.data,
        requested_level: levelChangeResult.data.requested_track,
        reviewed_at: levelChangeResult.data.resolved_at,
        reviewed_by: levelChangeResult.data.admin_id
      }
    : null;

  return res.status(200).json({
    ...profile,
    scope: scope || null,
    xp: xpResult.data || null,
    platform_stats: platformResult.data || null,
    level_change_status: levelChangeStatus,
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
        role,
        track,
        class_name,
        onboarding_completed,
        contribute_track,
        contribute_class_name,
        contribute_subjects,
        is_approved_teacher,
        approved_by,
        approved_at,
        approval_notes,
        approved_track,
        profile_picture_url,
        profile_picture_updated_at,
        active_level_id,
        active_group_id,
        is_minor,
        account_status,
        display_name,
        show_on_leaderboard,
        name,
        email,
        full_name,
        bio,
        preferences
      `)
      .eq('user_id', userId)
      .maybeSingle(),

    supabase
      .from('notification_preferences')
      .select(`
        module,
        in_app,
        email,
        push,
        updated_at
      `)
      .eq('user_id', userId)
      .order('module'),

    supabase
      .from('user_feature_settings')
      .select(`
        feature_key,
        is_enabled,
        custom_settings,
        updated_at
      `)
      .eq('user_id', userId)
      .order('feature_key'),

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

  if (profileResult.error) {
    throw new SecurityError('Unable to load profile settings', 500);
  }

  if (notificationResult.error) {
    throw new SecurityError(
      'Unable to load notification preferences',
      500
    );
  }

  if (featureResult.error) {
    throw new SecurityError(
      'Unable to load feature settings',
      500
    );
  }

  if (parentResult.error) {
    throw new SecurityError(
      'Unable to load parent or guardian information',
      500
    );
  }

  return res.status(200).json({
    profile: profileResult.data || null,
    notifications: notificationResult.data || [],
    feature_settings: featureResult.data || [],
    parent_guardian: parentResult.data || null
  });
}

async function saveOnboarding(body, res, ctx) {
  const userId = ctx.userId;
  const {
    track,
    class_name,
    role,
    completed
  } = body;

  if (
    typeof track !== 'string' ||
    !track.trim() ||
    typeof class_name !== 'string' ||
    !class_name.trim()
  ) {
    throw new SecurityError(
      'track and class_name are required',
      400
    );
  }

  const normalizedTrack = track.trim();
  const normalizedClass = class_name.trim();

  const level = await getLevelByName(normalizedTrack);

  if (!level) {
    throw new SecurityError('Invalid level selected', 400);
  }

  const group = await getGroupByName(
    level.id,
    normalizedClass
  );

  if (!group) {
    throw new SecurityError('Invalid class selected', 400);
  }

  const updates = {
    track: normalizedTrack,
    class_name: normalizedClass,
    active_level_id: level.id,
    active_group_id: group.id,
    onboarding_completed: completed !== false,
    updated_at: now()
  };

  if (typeof role === 'string' && role.trim()) {
    updates.role = role.trim();
  }

  const { data, error } = await supabase
    .from('user_profiles')
    .update(updates)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    throw new SecurityError(
      'Unable to save onboarding information',
      500
    );
  }

  await audit(
    ctx,
    'onboarding_completed',
    'user',
    userId,
    {
      track: normalizedTrack,
      class_name: normalizedClass,
      role: updates.role || null
    }
  );

  return res.status(200).json({
    success: true,
    profile: data
  });
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

  if (updates.full_name !== undefined) {
    if (
      typeof updates.full_name !== 'string' ||
      updates.full_name.trim().length < 2
    ) {
      throw new SecurityError(
        'Full name must contain at least 2 characters',
        400
      );
    }

    updates.full_name = updates.full_name.trim();
  }

  if (updates.display_name !== undefined) {
    updates.display_name = validateDisplayName(
      updates.display_name
    );
  }

  if (updates.name !== undefined) {
    if (
      typeof updates.name !== 'string' ||
      updates.name.trim().length > 200
    ) {
      throw new SecurityError('Invalid name', 400);
    }

    updates.name = updates.name.trim();
  }

  if (updates.email !== undefined) {
    if (
      typeof updates.email !== 'string' ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        updates.email.trim()
      )
    ) {
      throw new SecurityError('Invalid email address', 400);
    }

    updates.email = updates.email.trim().toLowerCase();
  }

  if (updates.profile_picture_url !== undefined) {
    if (
      updates.profile_picture_url !== null &&
      typeof updates.profile_picture_url !== 'string'
    ) {
      throw new SecurityError(
        'Invalid profile picture URL',
        400
      );
    }

    updates.profile_picture_updated_at = now();
  }

  if (updates.bio !== undefined && updates.bio !== null) {
    if (
      typeof updates.bio !== 'string' ||
      updates.bio.length > 1000
    ) {
      throw new SecurityError(
        'Bio must not exceed 1000 characters',
        400
      );
    }
  }

  if (
    updates.show_on_leaderboard !== undefined &&
    typeof updates.show_on_leaderboard !== 'boolean'
  ) {
    throw new SecurityError(
      'show_on_leaderboard must be boolean',
      400
    );
  }

  if (
    body.profile_data !== undefined &&
    (
      typeof body.profile_data !== 'object' ||
      Array.isArray(body.profile_data) ||
      body.profile_data === null
    )
  ) {
    throw new SecurityError(
      'profile_data must be an object',
      400
    );
  }

  if (body.profile_data) {
    const { data: current, error: currentError } =
      await supabase
        .from('user_profiles')
        .select('preferences')
        .eq('user_id', userId)
        .maybeSingle();

    if (currentError) {
      throw new SecurityError(
        'Unable to load profile preferences',
        500
      );
    }

    updates.preferences = {
      ...(current?.preferences || {}),
      ...body.profile_data
    };
  }

  if (Object.keys(updates).length === 0) {
    throw new SecurityError(
      'No profile changes supplied',
      400
    );
  }

  updates.updated_at = now();

  const { data, error } = await supabase
    .from('user_profiles')
    .update(updates)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    throw new SecurityError(
      'Unable to update profile',
      500
    );
  }

  await audit(
    ctx,
    'update_profile',
    'user',
    userId,
    {
      fields: Object.keys(updates).filter(
        field =>
          field !== 'updated_at' &&
          field !== 'preferences'
      ),
      preferences_updated: !!body.profile_data
    }
  );

  return res.status(200).json({
    success: true,
    profile: data
  });
}

async function savePreferences(body, res, ctx) {
  const userId = ctx.userId;

  if (
    !body.preferences ||
    typeof body.preferences !== 'object' ||
    Array.isArray(body.preferences)
  ) {
    throw new SecurityError(
      'preferences must be an object',
      400
    );
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

  const incoming = {};

  for (const key of Object.keys(body.preferences)) {
    if (allowedKeys.includes(key)) {
      incoming[key] = body.preferences[key];
    }
  }

  if (
    incoming.daily_goal_minutes !== undefined &&
    ![15, 30, 60, 90].includes(
      Number(incoming.daily_goal_minutes)
    )
  ) {
    throw new SecurityError(
      'Invalid daily goal',
      400
    );
  }

  if (
    incoming.quiz_difficulty !== undefined &&
    !['easy', 'medium', 'hard'].includes(
      incoming.quiz_difficulty
    )
  ) {
    throw new SecurityError(
      'Invalid quiz difficulty',
      400
    );
  }

  const { data: current, error: currentError } =
    await supabase
      .from('user_profiles')
      .select('preferences')
      .eq('user_id', userId)
      .maybeSingle();

  if (currentError) {
    throw new SecurityError(
      'Unable to load current preferences',
      500
    );
  }

  const preferences = {
    ...(current?.preferences || {}),
    ...incoming
  };

  const { data, error } = await supabase
    .from('user_profiles')
    .update({
      preferences,
      updated_at: now()
    })
    .eq('user_id', userId)
    .select('user_id, preferences, updated_at')
    .single();

  if (error) {
    throw new SecurityError(
      'Unable to save preferences',
      500
    );
  }

  await audit(
    ctx,
    'save_preferences',
    'user',
    userId,
    {
      fields: Object.keys(incoming)
    }
  );

  return res.status(200).json({
    success: true,
    preferences: data.preferences
  });
}

async function getNotificationPreferences(req, res, ctx) {
  const { data, error } = await supabase
    .from('notification_preferences')
    .select(`
      module,
      in_app,
      email,
      push,
      updated_at
    `)
    .eq('user_id', ctx.userId)
    .order('module');

  if (error) {
    throw new SecurityError(
      'Unable to load notification preferences',
      500
    );
  }

  return res.status(200).json(data || []);
}

async function saveNotifications(body, res, ctx) {
  const userId = ctx.userId;
  const preferences = body.preferences;

  if (!Array.isArray(preferences)) {
    throw new SecurityError(
      'preferences must be an array',
      400
    );
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
    if (
      !item ||
      typeof item !== 'object' ||
      !validModules.includes(item.module)
    ) {
      throw new SecurityError(
        'Invalid notification module',
        400
      );
    }

    return {
      user_id: userId,
      module: item.module,
      in_app: item.in_app !== false,
      email: item.email === true,
      push: item.push === true,
      updated_at: now()
    };
  });

  if (rows.length === 0) {
    return res.status(200).json({
      success: true,
      preferences: []
    });
  }

  const { data, error } = await supabase
    .from('notification_preferences')
    .upsert(rows, {
      onConflict: 'user_id,module'
    })
    .select(`
      module,
      in_app,
      email,
      push,
      updated_at
    `);

  if (error) {
    throw new SecurityError(
      'Unable to save notification preferences',
      500
    );
  }

  return res.status(200).json({
    success: true,
    preferences: data || []
  });
}

async function updateClass(body, res, ctx) {
  const userId = ctx.userId;
  const className =
    typeof body.class_name === 'string'
      ? body.class_name.trim()
      : '';

  if (!className) {
    throw new SecurityError(
      'class_name is required',
      400
    );
  }

  const { data: profile, error: profileError } =
    await supabase
      .from('user_profiles')
      .select('track, active_level_id')
      .eq('user_id', userId)
      .maybeSingle();

  if (profileError) {
    throw new SecurityError(
      'Unable to load profile',
      500
    );
  }

  if (!profile?.track) {
    throw new SecurityError(
      'User has no active track set',
      400
    );
  }

  const level =
    profile.active_level_id
      ? {
          id: profile.active_level_id
        }
      : await getLevelByName(profile.track);

  if (!level) {
    throw new SecurityError(
      'Invalid track',
      400
    );
  }

  const group = await getGroupByName(
    level.id,
    className
  );

  if (!group) {
    throw new SecurityError(
      'Invalid class name',
      400
    );
  }

  const { data, error } = await supabase
    .from('user_profiles')
    .update({
      class_name: className,
      active_level_id: level.id,
      active_group_id: group.id,
      updated_at: now()
    })
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    throw new SecurityError(
      'Unable to update class',
      500
    );
  }

  await audit(
    ctx,
    'update_class',
    'user',
    userId,
    {
      class_name: className,
      group_id: group.id
    }
  );

  return res.status(200).json({
    success: true,
    profile: data
  });
}

async function switchClass(body, res, ctx) {
  const userId = ctx.userId;
  const groupId = body.group_id;

  if (!groupId) {
    throw new SecurityError(
      'group_id is required',
      400
    );
  }

  const { data: group, error: groupError } =
    await supabase
      .from('curriculum_groups')
      .select(`
        id,
        name,
        level_id,
        is_active
      `)
      .eq('id', String(groupId))
      .eq('is_active', true)
      .maybeSingle();

  if (groupError) {
    throw new SecurityError(
      'Unable to load curriculum group',
      500
    );
  }

  if (!group) {
    throw new SecurityError(
      'Group not found or inactive',
      404
    );
  }

  const { data: level, error: levelError } =
    await supabase
      .from('curriculum_levels')
      .select(`
        id,
        display_name
      `)
      .eq('id', group.level_id)
      .maybeSingle();

  if (levelError || !level) {
    throw new SecurityError(
      'Curriculum level not found',
      404
    );
  }

  const { data, error } = await supabase
    .from('user_profiles')
    .update({
      active_group_id: group.id,
      active_level_id: level.id,
      class_name: group.name,
      track: level.display_name,
      updated_at: now()
    })
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    throw new SecurityError(
      'Unable to switch class',
      500
    );
  }

  await audit(
    ctx,
    'switch_class',
    'user',
    userId,
    {
      group_id: group.id,
      level_id: level.id,
      class_name: group.name,
      track: level.display_name
    }
  );

  return res.status(200).json({
    success: true,
    profile: data
  });
}

async function requestLevelChange(body, res, ctx) {
  const userId = ctx.userId;

  const requestedTrack =
    typeof body.requested_track === 'string'
      ? body.requested_track.trim()
      : typeof body.requested_level === 'string'
        ? body.requested_level.trim()
        : '';

  const requestedClass =
    typeof body.requested_class === 'string'
      ? body.requested_class.trim()
      : '';

  const reason =
    typeof body.reason === 'string'
      ? body.reason.trim()
      : '';

  if (!requestedTrack || !requestedClass) {
    throw new SecurityError(
      'requested_track and requested_class are required',
      400
    );
  }

  const level = await getLevelByName(
    requestedTrack
  );

  if (!level) {
    throw new SecurityError(
      'Invalid level requested',
      400
    );
  }

  const group = await getGroupByName(
    level.id,
    requestedClass
  );

  if (!group) {
    throw new SecurityError(
      'Invalid class for requested level',
      400
    );
  }

  const { data: existingRequest, error: existingError } =
    await supabase
      .from('level_change_requests')
      .select('id, status')
      .eq('user_id', userId)
      .in('status', ['pending', 'approved'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

  if (existingError) {
    throw new SecurityError(
      'Unable to check existing level change requests',
      500
    );
  }

  if (existingRequest) {
    throw new SecurityError(
      `You already have a ${existingRequest.status} request`,
      400
    );
  }

  const { data, error } = await supabase
    .from('level_change_requests')
    .insert({
      user_id: userId,
      requested_track: requestedTrack,
      requested_class: requestedClass,
      requested_level_id: level.id,
      requested_group_id: group.id,
      reason: reason || null,
      status: 'pending',
      created_at: now()
    })
    .select()
    .single();

  if (error) {
    throw new SecurityError(
      'Unable to create level change request',
      500
    );
  }

  await audit(
    ctx,
    'request_level_change',
    'user',
    userId,
    {
      requested_track: requestedTrack,
      requested_class: requestedClass,
      requested_level_id: level.id,
      requested_group_id: group.id
    }
  );

  await notify(
    userId,
    'level_change_requested',
    {
      requested_level: requestedTrack,
      requested_class: requestedClass
    }
  );

  return res.status(200).json({
    success: true,
    request: {
      ...data,
      requested_level: data.requested_track
    }
  });
}

async function reviewLevelChange(body, res, ctx) {
  const requestId = body.request_id;
  const action = body.action;

  if (
    !requestId ||
    !['approve', 'reject'].includes(action)
  ) {
    throw new SecurityError(
      'request_id and action (approve/reject) required',
      400
    );
  }

  const { data: request, error: requestError } =
    await supabase
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
      .eq('id', requestId)
      .eq('status', 'pending')
      .maybeSingle();

  if (requestError) {
    throw new SecurityError(
      'Unable to load level change request',
      500
    );
  }

  if (!request) {
    throw new SecurityError(
      'Request not found or already reviewed',
      404
    );
  }

  const level = await getLevelByName(
    request.requested_track
  );

  if (!level && action === 'approve') {
    throw new SecurityError(
      'Invalid level in request',
      400
    );
  }

  let requestedGroup = null;

  if (
    action === 'approve' &&
    request.requested_group_id
  ) {
    const { data } = await supabase
      .from('curriculum_groups')
      .select(`
        id,
        name,
        level_id,
        is_active
      `)
      .eq('id', request.requested_group_id)
      .eq('level_id', level.id)
      .eq('is_active', true)
      .maybeSingle();

    requestedGroup = data || null;
  }

  if (
    action === 'approve' &&
    !requestedGroup
  ) {
    const { data } = await supabase
      .from('curriculum_groups')
      .select(`
        id,
        name,
        level_id,
        is_active,
        sequence_order
      `)
      .eq('level_id', level.id)
      .eq('is_active', true)
      .order('sequence_order', {
        ascending: true
      })
      .limit(1)
      .maybeSingle();

    requestedGroup = data || null;
  }

  if (
    action === 'approve' &&
    !requestedGroup
  ) {
    throw new SecurityError(
      'No active class exists for the requested level',
      400
    );
  }

  const newStatus =
    action === 'approve'
      ? 'approved'
      : 'rejected';

  const { data: updatedRequest, error: updateError } =
    await supabase
      .from('level_change_requests')
      .update({
        status: newStatus,
        admin_id: ctx.userId,
        resolved_at: now()
      })
      .eq('id', requestId)
      .eq('status', 'pending')
      .select()
      .single();

  if (updateError || !updatedRequest) {
    throw new SecurityError(
      'Unable to update level change request',
      500
    );
  }

  if (action === 'approve') {
    const { error: profileError } =
      await supabase
        .from('user_profiles')
        .update({
          track: request.requested_track,
          active_level_id: level.id,
          active_group_id: requestedGroup.id,
          class_name: requestedGroup.name,
          updated_at: now()
        })
        .eq('user_id', request.user_id);

    if (profileError) {
      throw new SecurityError(
        'Unable to update user curriculum',
        500
      );
    }

    await notify(
      request.user_id,
      'level_change_approved',
      {
        new_level: request.requested_track,
        new_class: requestedGroup.name
      }
    );
  } else {
    await notify(
      request.user_id,
      'level_change_rejected',
      {
        requested_level: request.requested_track,
        requested_class: request.requested_class
      }
    );
  }

  await audit(
    ctx,
    `level_change_${action}`,
    'user',
    request.user_id,
    {
      request_id: requestId,
      requested_level: request.requested_track,
      requested_class: request.requested_class
    }
  );

  return res.status(200).json({
    success: true,
    status: newStatus
  });
}

async function adminUpdateProfile(body, res, ctx) {
  const userId = body.user_id;

  if (!userId) {
    throw new SecurityError(
      'user_id is required',
      400
    );
  }

  const updates = {
    updated_at: now()
  };

  let level = null;

  if (body.track !== undefined) {
    if (
      typeof body.track !== 'string' ||
      !body.track.trim()
    ) {
      throw new SecurityError(
        'Invalid track',
        400
      );
    }

    level = await getLevelByName(
      body.track.trim()
    );

    if (!level) {
      throw new SecurityError(
        'Invalid track',
        400
      );
    }

    updates.track = level.display_name;
    updates.active_level_id = level.id;
  }

  if (body.class_name !== undefined) {
    if (
      typeof body.class_name !== 'string' ||
      !body.class_name.trim()
    ) {
      throw new SecurityError(
        'Invalid class name',
        400
      );
    }

    const { data: profile, error: profileError } =
      await supabase
        .from('user_profiles')
        .select(`
          track,
          active_level_id
        `)
        .eq('user_id', userId)
        .maybeSingle();

    if (profileError) {
      throw new SecurityError(
        'Unable to load user profile',
        500
      );
    }

    const trackToUse =
      updates.track ||
      profile?.track;

    if (!trackToUse) {
      throw new SecurityError(
        'Cannot update class without track',
        400
      );
    }

    const levelToUse =
      level ||
      (
        profile?.active_level_id
          ? { id: profile.active_level_id }
          : await getLevelByName(trackToUse)
      );

    if (!levelToUse) {
      throw new SecurityError(
        'Invalid track',
        400
      );
    }

    const group = await getGroupByName(
      levelToUse.id,
      body.class_name.trim()
    );

    if (!group) {
      throw new SecurityError(
        'Invalid class name',
        400
      );
    }

    updates.class_name = group.name;
    updates.active_group_id = group.id;
  }

  if (
    Object.keys(updates).length === 1
  ) {
    throw new SecurityError(
      'No profile changes supplied',
      400
    );
  }

  const { data, error } = await supabase
    .from('user_profiles')
    .update(updates)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    throw new SecurityError(
      'Unable to update profile',
      500
    );
  }

  await audit(
    ctx,
    'admin_update_profile',
    'user',
    userId,
    {
      track: body.track || null,
      class_name: body.class_name || null
    }
  );

  await notify(
    userId,
    'profile_updated_by_admin',
    {
      fields: Object.keys(updates).filter(
        key => key !== 'updated_at'
      )
    }
  );

  return res.status(200).json({
    success: true,
    profile: data
  });
}

async function updateDisplayName(body, res, ctx) {
  const userId = ctx.userId;

  const displayName =
    validateDisplayName(body.display_name);

  const { data, error } = await supabase
    .from('user_profiles')
    .update({
      display_name: displayName,
      updated_at: now()
    })
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    throw new SecurityError(
      'Unable to update display name',
      500
    );
  }

  await audit(
    ctx,
    'update_display_name',
    'user',
    userId,
    {
      display_name: displayName
    }
  );

  return res.status(200).json({
    success: true,
    profile: data
  });
}

async function changePassword(body, res, ctx) {
  const {
    current_password,
    new_password,
    confirm_password
  } = body;

  if (
    !current_password ||
    !new_password ||
    !confirm_password
  ) {
    throw new SecurityError(
      'All password fields are required',
      400
    );
  }

  if (new_password !== confirm_password) {
    throw new SecurityError(
      'New passwords do not match',
      400
    );
  }

  if (
    typeof new_password !== 'string' ||
    new_password.length < 8
  ) {
    throw new SecurityError(
      'New password must be at least 8 characters',
      400
    );
  }

  const { data: authResult, error: authLookupError } =
    await supabase.auth.admin.getUserById(
      ctx.userId
    );

  if (
    authLookupError ||
    !authResult?.user?.email
  ) {
    throw new SecurityError(
      'Unable to verify account email',
      400
    );
  }

  const { error: verifyError } =
    await supabase.auth.signInWithPassword({
      email: authResult.user.email,
      password: current_password
    });

  if (verifyError) {
    throw new SecurityError(
      'Current password is incorrect',
      401
    );
  }

  const { error: updateError } =
    await supabase.auth.admin.updateUserById(
      ctx.userId,
      {
        password: new_password
      }
    );

  if (updateError) {
    throw new SecurityError(
      'Unable to update password',
      500
    );
  }

  const { error: sessionError } =
    await supabase
      .from('user_sessions')
      .update({
        is_active: false,
        terminated_reason: 'password_changed',
        terminated_at: now()
      })
      .eq('user_id', ctx.userId)
      .eq('is_active', true);

  if (sessionError) {
    throw new SecurityError(
      'Password changed but sessions could not be revoked',
      500
    );
  }

  await audit(
    ctx,
    'change_password',
    'user',
    ctx.userId,
    {}
  );

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
      .select(`
        total_xp,
        level,
        rank_title
      `)
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
      .select(`
        topic,
        xp,
        streak,
        last_activity_date,
        unit_id
      `)
      .eq('user_id', userId)
      .order('xp', { ascending: false }),

    supabase
      .from('quiz_attempts')
      .select(`
        percentage,
        status,
        passed,
        xp_earned,
        submitted_at,
        unit_id
      `)
      .eq('user_id', userId)
      .order('submitted_at', {
        ascending: false,
        nullsFirst: false
      })
      .limit(100),

    supabase
      .from('user_flashcard_sessions')
      .select(`
        id,
        deck_id,
        mode,
        is_complete,
        started_at,
        completed_at,
        cards_seen,
        cards_correct,
        cards_incorrect,
        current_index
      `)
      .eq('user_id', userId)
      .order('started_at', {
        ascending: false
      })
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

  if (quizResult.error) {
    throw new SecurityError(
      'Unable to load quiz statistics',
      500
    );
  }

  const quizAttempts =
    quizResult.data || [];

  const averageQuizScore =
    quizAttempts.length
      ? Math.round(
          quizAttempts.reduce(
            (sum, item) =>
              sum + Number(item.percentage || 0),
            0
          ) / quizAttempts.length
        )
      : 0;

  const passedQuizzes =
    quizAttempts.filter(
      item => item.passed === true
    ).length;

  const flashcards =
    (flashcardResult.data || []).map(session => {
      const seen = Array.isArray(session.cards_seen)
        ? session.cards_seen.length
        : 0;

      const correct =
        Array.isArray(session.cards_correct)
          ? session.cards_correct.length
          : 0;

      const incorrect =
        Array.isArray(session.cards_incorrect)
          ? session.cards_incorrect.length
          : 0;

      return {
        ...session,
        cards_seen_count: seen,
        cards_correct_count: correct,
        cards_incorrect_count: incorrect
      };
    });

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
    flashcards,
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
    .order('earned_at', {
      ascending: false
    });

  if (error) {
    throw new SecurityError(
      'Unable to load achievements',
      500
    );
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
    .order('issued_at', {
      ascending: false
    });

  if (error) {
    throw new SecurityError(
      'Unable to load certificates',
      500
    );
  }

  return res.status(200).json(data || []);
}

async function getStreak(req, res, ctx) {
  const userId = ctx.userId;

  const [
    statsResult,
    activityResult
  ] = await Promise.all([
    supabase
      .from('user_platform_stats')
      .select(`
        current_streak,
        longest_streak,
        last_activity_date
      `)
      .eq('user_id', userId)
      .maybeSingle(),

    supabase
      .from('user_daily_activity')
      .select(`
        activity_date,
        count
      `)
      .eq('user_id', userId)
      .order('activity_date', {
        ascending: false
      })
      .limit(28)
  ]);

  if (statsResult.error) {
    throw new SecurityError(
      'Unable to load streak statistics',
      500
    );
  }

  if (activityResult.error) {
    throw new SecurityError(
      'Unable to load daily activity',
      500
    );
  }

  return res.status(200).json({
    current_streak:
      statsResult.data?.current_streak || 0,
    longest_streak:
      statsResult.data?.longest_streak || 0,
    last_activity_date:
      statsResult.data?.last_activity_date || null,
    days: activityResult.data || []
  });
}

async function getPerformance(req, res, ctx) {
  const { data, error } = await supabase
    .from('quiz_mastery')
    .select(`
      id,
      unit_id,
      group_id,
      level_id,
      concept_id,
      concept_name,
      attempts,
      correct_attempts,
      accuracy,
      mastery_score,
      mastery_state,
      last_attempted_at,
      last_correct_at,
      last_incorrect_at,
      updated_at
    `)
    .eq('user_id', ctx.userId)
    .order('mastery_score', {
      ascending: false
    });

  if (error) {
    throw new SecurityError(
      'Unable to load performance data',
      500
    );
  }

  const concepts = data || [];

  return res.status(200).json({
    concepts,
    summary: {
      total_attempts: concepts.reduce(
        (sum, item) =>
          sum + Number(item.attempts || 0),
        0
      ),
      total_correct_attempts:
        concepts.reduce(
          (sum, item) =>
            sum +
            Number(
              item.correct_attempts || 0
            ),
          0
        ),
      average_accuracy:
        concepts.length
          ? Math.round(
              concepts.reduce(
                (sum, item) =>
                  sum +
                  Number(item.accuracy || 0),
                0
              ) / concepts.length
            )
          : 0,
      mastered:
        concepts.filter(
          item =>
            item.mastery_state === 'mastered'
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
    .order('created_at', {
      ascending: false
    })
    .limit(100);

  if (error) {
    throw new SecurityError(
      'Unable to load saved items',
      500
    );
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
    .order('created_at', {
      ascending: false
    });

  if (error) {
    throw new SecurityError(
      'Unable to load sessions',
      500
    );
  }

  return res.status(200).json(
    (data || []).map(session => ({
      id: session.id,
      ip_address: session.ip_address,
      user_agent: session.user_agent,
      expires_at: session.expires_at,
      is_active: session.is_active,
      created_at: session.created_at,
      fingerprint: session.fingerprint,
      mfa_verified: session.mfa_verified,
      passkey_verified: session.passkey_verified
    }))
  );
}

async function revokeSession(body, res, ctx) {
  const sessionId = body.session_id;

  if (!sessionId) {
    throw new SecurityError(
      'session_id is required',
      400
    );
  }

  const { data, error } = await supabase
    .from('user_sessions')
    .update({
      is_active: false,
      terminated_reason: 'revoked_by_user',
      terminated_at: now()
    })
    .eq('id', sessionId)
    .eq('user_id', ctx.userId)
    .eq('is_active', true)
    .select('id')
    .maybeSingle();

  if (error) {
    throw new SecurityError(
      'Unable to revoke session',
      500
    );
  }

  if (!data) {
    throw new SecurityError(
      'Session not found or already inactive',
      404
    );
  }

  await audit(
    ctx,
    'revoke_session',
    'session',
    sessionId,
    {}
  );

  return res.status(200).json({
    success: true
  });
}

async function getReferrals(req, res, ctx) {
  const userId = ctx.userId;

  const [
    profileResult,
    referralsResult
  ] = await Promise.all([
    supabase
      .from('user_profiles')
      .select('referral_code')
      .eq('user_id', userId)
      .maybeSingle(),

    supabase
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
      .order('created_at', {
        ascending: false
      })
  ]);

  if (profileResult.error) {
    throw new SecurityError(
      'Unable to load referral code',
      500
    );
  }

  if (referralsResult.error) {
    throw new SecurityError(
      'Unable to load referrals',
      500
    );
  }

  const referrals =
    referralsResult.data || [];

  return res.status(200).json({
    referral_code:
      profileResult.data?.referral_code ||
      null,
    referrals,
    joined_count: referrals.length,
    xp_earned: referrals.reduce(
      (sum, item) =>
        sum + Number(item.xp_awarded || 0),
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
    .order('created_at', {
      ascending: false
    });

  if (error) {
    throw new SecurityError(
      'Unable to load API keys',
      500
    );
  }

  return res.status(200).json(data || []);
}

async function createApiKey(body, res, ctx) {
  const name =
    typeof body.name === 'string'
      ? body.name.trim()
      : 'AliverBiopharm API Key';

  if (
    name.length < 2 ||
    name.length > 100
  ) {
    throw new SecurityError(
      'Invalid API key name',
      400
    );
  }

  const rawKey =
    `sk_live_${crypto.randomBytes(32).toString('hex')}`;

  const keyPrefix =
    rawKey.slice(0, 16);

  const keyHash =
    crypto
      .createHash('sha256')
      .update(rawKey)
      .digest('hex');

  const scopes =
    Array.isArray(body.scopes)
      ? body.scopes
          .filter(
            scope =>
              typeof scope === 'string' &&
              scope.length <= 100
          )
          .slice(0, 20)
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
    throw new SecurityError(
      'Unable to create API key',
      500
    );
  }

  return res.status(200).json({
    success: true,
    key: rawKey,
    api_key: data
  });
}

async function revokeApiKey(body, res, ctx) {
  if (!body.id) {
    throw new SecurityError(
      'API key id is required',
      400
    );
  }

  const { data, error } = await supabase
    .from('api_keys')
    .update({
      is_active: false,
      revoked_at: now()
    })
    .eq('id', body.id)
    .eq('user_id', ctx.userId)
    .eq('is_active', true)
    .select('id')
    .maybeSingle();

  if (error) {
    throw new SecurityError(
      'Unable to revoke API key',
      500
    );
  }

  if (!data) {
    throw new SecurityError(
      'API key not found or already revoked',
      404
    );
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
    .order('created_at', {
      ascending: false
    });

  if (error) {
    throw new SecurityError(
      'Unable to load webhooks',
      500
    );
  }

  return res.status(200).json(data || []);
}

function validateWebhookUrl(value) {
  if (
    typeof value !== 'string' ||
    !value.trim()
  ) {
    throw new SecurityError(
      'Webhook URL is required',
      400
    );
  }

  let parsed;

  try {
    parsed = new URL(value.trim());
  } catch {
    throw new SecurityError(
      'Invalid webhook URL',
      400
    );
  }

  if (
    !['https:', 'http:'].includes(
      parsed.protocol
    )
  ) {
    throw new SecurityError(
      'Invalid webhook protocol',
      400
    );
  }

  return parsed.toString();
}

async function createWebhook(body, res, ctx) {
  const url = validateWebhookUrl(
    body.url
  );

  const secret =
    crypto.randomBytes(32).toString('hex');

  const events =
    Array.isArray(body.events)
      ? body.events
          .filter(
            event =>
              typeof event === 'string' &&
              event.length <= 100
          )
          .slice(0, 50)
      : ['*'];

  const finalEvents =
    events.length ? events : ['*'];

  const { data, error } = await supabase
    .from('webhook_endpoints')
    .insert({
      user_id: ctx.userId,
      url,
      secret,
      events: finalEvents,
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
    throw new SecurityError(
      'Unable to create webhook',
      500
    );
  }

  return res.status(200).json({
    success: true,
    webhook: data,
    secret
  });
}

async function updateWebhook(body, res, ctx) {
  if (!body.id) {
    throw new SecurityError(
      'Webhook id is required',
      400
    );
  }

  const updates = {};

  if (body.url !== undefined) {
    updates.url =
      validateWebhookUrl(body.url);
  }

  if (body.events !== undefined) {
    if (!Array.isArray(body.events)) {
      throw new SecurityError(
        'events must be an array',
        400
      );
    }

    updates.events =
      body.events
        .filter(
          event =>
            typeof event === 'string' &&
            event.length <= 100
        )
        .slice(0, 50);

    if (updates.events.length === 0) {
      updates.events = ['*'];
    }
  }

  if (body.is_active !== undefined) {
    if (
      typeof body.is_active !== 'boolean'
    ) {
      throw new SecurityError(
        'is_active must be boolean',
        400
      );
    }

    updates.is_active =
      body.is_active;
  }

  if (
    Object.keys(updates).length === 0
  ) {
    throw new SecurityError(
      'No webhook changes supplied',
      400
    );
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
    throw new SecurityError(
      'Unable to update webhook',
      500
    );
  }

  return res.status(200).json({
    success: true,
    webhook: data
  });
}

async function deleteWebhook(body, res, ctx) {
  if (!body.id) {
    throw new SecurityError(
      'Webhook id is required',
      400
    );
  }

  const { data, error } = await supabase
    .from('webhook_endpoints')
    .delete()
    .eq('id', body.id)
    .eq('user_id', ctx.userId)
    .select('id')
    .maybeSingle();

  if (error) {
    throw new SecurityError(
      'Unable to delete webhook',
      500
    );
  }

  if (!data) {
    throw new SecurityError(
      'Webhook not found',
      404
    );
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
      payment_id,
      starts_at,
      expires_at,
      auto_renew,
      cancelled_at,
      created_at,
      updated_at,
      plan_id,
      subscription_plans(
        id,
        name,
        slug,
        description,
        price_amount,
        currency,
        duration_days,
        features,
        is_active,
        display_order
      )
    `)
    .eq('user_id', ctx.userId)
    .order('created_at', {
      ascending: false
    })
    .limit(10);

  if (error) {
    throw new SecurityError(
      'Unable to load billing information',
      500
    );
  }

  return res.status(200).json(data || []);
}

async function getParentGuardian(req, res, ctx) {
  const { data, error } = await supabase
    .from('parental_consents')
    .select(`
      id,
      minor_user_id,
      guardian_name,
      guardian_email,
      guardian_relationship,
      consent_status,
      created_at
    `)
    .eq('minor_user_id', ctx.userId)
    .order('created_at', {
      ascending: false
    })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new SecurityError(
      'Unable to load parent or guardian information',
      500
    );
  }

  return res.status(200).json(
    data || null
  );
}

async function saveParentGuardian(body, res, ctx) {
  const guardianName =
    typeof body.guardian_name === 'string'
      ? body.guardian_name.trim()
      : '';

  const guardianEmail =
    typeof body.guardian_email === 'string'
      ? body.guardian_email.trim().toLowerCase()
      : '';

  const guardianRelationship =
    typeof body.guardian_relationship === 'string'
      ? body.guardian_relationship.trim()
      : null;

  if (!guardianName || !guardianEmail) {
    throw new SecurityError(
      'Guardian name and email are required',
      400
    );
  }

  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      guardianEmail
    )
  ) {
    throw new SecurityError(
      'Invalid guardian email',
      400
    );
  }

  const { data: profile, error: profileError } =
    await supabase
      .from('user_profiles')
      .select('is_minor')
      .eq('user_id', ctx.userId)
      .maybeSingle();

  if (profileError) {
    throw new SecurityError(
      'Unable to verify account type',
      500
    );
  }

  if (!profile?.is_minor) {
    throw new SecurityError(
      'Parent or guardian controls are only available for minor accounts',
      403
    );
  }

  const { data: existing, error: existingError } =
    await supabase
      .from('parental_consents')
      .select('id')
      .eq('minor_user_id', ctx.userId)
      .order('created_at', {
        ascending: false
      })
      .limit(1)
      .maybeSingle();

  if (existingError) {
    throw new SecurityError(
      'Unable to load existing guardian information',
      500
    );
  }

  let data;
  let error;

  if (existing?.id) {
    const result =
      await supabase
        .from('parental_consents')
        .update({
          guardian_name: guardianName,
          guardian_email: guardianEmail,
          guardian_relationship:
            guardianRelationship
        })
        .eq('id', existing.id)
        .eq('minor_user_id', ctx.userId)
        .select()
        .single();

    data = result.data;
    error = result.error;
  } else {
    const result =
      await supabase
        .from('parental_consents')
        .insert({
          minor_user_id: ctx.userId,
          guardian_name: guardianName,
          guardian_email: guardianEmail,
          guardian_relationship:
            guardianRelationship,
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
  const { data: existing, error: existingError } =
    await supabase
      .from('user_export_requests')
      .select(`
        id,
        status,
        requested_at,
        completed_at,
        expires_at,
        download_url
      `)
      .eq('user_id', ctx.userId)
      .in('status', [
        'pending',
        'processing',
        'ready'
      ])
      .order('requested_at', {
        ascending: false
      })
      .limit(1)
      .maybeSingle();

  if (existingError) {
    throw new SecurityError(
      'Unable to check export requests',
      500
    );
  }

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
      requested_at: now()
    })
    .select()
    .single();

  if (error) {
    throw new SecurityError(
      'Unable to create export request',
      500
    );
  }

  await audit(
    ctx,
    'export_data',
    'user',
    ctx.userId,
    {}
  );

  return res.status(200).json({
    success: true,
    request: data
  });
}

async function requestAccountDeletion(
  body,
  res,
  ctx
) {
  const confirmationCode =
    body.confirmation_code != null
      ? String(body.confirmation_code)
      : '';

  if (
    !confirmationCode ||
    confirmationCode.length < 4
  ) {
    throw new SecurityError(
      'A valid confirmation code is required',
      400
    );
  }

  const {
    data: existing,
    error: existingError
  } = await supabase
    .from('data_deletion_requests')
    .select('id, status')
    .eq('user_id', ctx.userId)
    .in('status', [
      'pending',
      'processing'
    ])
    .order('requested_at', {
      ascending: false
    })
    .limit(1)
    .maybeSingle();

  if (existingError) {
    throw new SecurityError(
      'Unable to check account deletion requests',
      500
    );
  }

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
      confirmation_code: confirmationCode
    })
    .select()
    .single();

  if (error) {
    throw new SecurityError(
      'Unable to create account deletion request',
      500
    );
  }

  const { error: sensitiveError } =
    await supabase
      .from('sensitive_operations')
      .insert({
        user_id: ctx.userId,
        operation_type: 'delete_account',
        status: 'pending',
        confirmation_token: confirmationCode,
        expires_at: new Date(
          Date.now() + 15 * 60 * 1000
        ).toISOString(),
        metadata: {}
      });

  if (sensitiveError) {
    await supabase
      .from('data_deletion_requests')
      .delete()
      .eq('id', data.id)
      .eq('user_id', ctx.userId);

    throw new SecurityError(
      'Unable to create account deletion operation',
      500
    );
  }

  await audit(
    ctx,
    'request_account_deletion',
    'user',
    ctx.userId,
    {}
  );

  return res.status(200).json({
    success: true,
    request: data
  });
}

async function getRecentActivity(req, res, ctx) {
  const { data, error } = await supabase
    .from('user_daily_activity')
    .select(`
      activity_date,
      count
    `)
    .eq('user_id', ctx.userId)
    .order('activity_date', {
      ascending: false
    })
    .limit(50);

  if (error) {
    throw new SecurityError(
      'Unable to load recent activity',
      500
    );
  }

  return res.status(200).json(
    (data || []).map(item => ({
      action: 'daily_activity',
      target_type: 'user',
      target_id: ctx.userId,
      metadata: {
        count: item.count
      },
      activity_date: item.activity_date,
      created_at: item.activity_date
    }))
  );
}

async function getClassSequence(req, res, ctx) {
  const track =
    typeof req.query?.track === 'string'
      ? req.query.track.trim()
      : '';

  if (!track) {
    throw new SecurityError(
      'track is required',
      400
    );
  }

  const level =
    await getLevelByName(track);

  if (!level) {
    throw new SecurityError(
      'Invalid track',
      400
    );
  }

  const {
    data: groups,
    error: groupsError
  } = await supabase
    .from('curriculum_groups')
    .select(`
      id,
      level_id,
      name,
      description,
      icon,
      sequence_order,
      is_active
    `)
    .eq('level_id', level.id)
    .eq('is_active', true)
    .order('sequence_order', {
      ascending: true
    });

  if (groupsError) {
    throw new SecurityError(
      'Unable to load class sequence',
      500
    );
  }

  if (!groups?.length) {
    return res.status(200).json([]);
  }

  const {
    data: units,
    error: unitsError
  } = await supabase
    .from('curriculum_units')
    .select(`
      id,
      name,
      code,
      icon,
      display_order,
      is_hard_topic,
      is_premium,
      is_active,
      topic_image_url,
      group_id
    `)
    .in(
      'group_id',
      groups.map(group => group.id)
    )
    .eq('is_active', true)
    .order('display_order', {
      ascending: true
    });

  if (unitsError) {
    throw new SecurityError(
      'Unable to load curriculum units',
      500
    );
  }

  const groupsWithUnits =
    groups.map(group => ({
      ...group,
      units: (units || []).filter(
        unit =>
          unit.group_id === group.id
      )
    }));

  return res.status(200).json(
    groupsWithUnits
  );
}

async function getPharmacyPrograms(req, res, ctx) {
  const { data, error } = await supabase
    .from('curriculum_levels')
    .select(`
      id,
      display_name,
      kind,
      group_label,
      unit_label,
      icon,
      color,
      display_order
    `)
    .order('display_order', {
      ascending: true
    });

  if (error) {
    throw new SecurityError(
      'Unable to load curriculum programs',
      500
    );
  }

  return res.status(200).json(
    data || []
  );
}

async function getLevelChangeStatus(req, res, ctx) {
  const userId = ctx.userId;

  const {
    data,
    error
  } = await supabase
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
    .order('created_at', {
      ascending: false
    })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new SecurityError(
      'Unable to load level change status',
      500
    );
  }

  if (!data) {
    return res.status(200).json(null);
  }

  let reviewerName = null;

  if (data.admin_id) {
    const {
      data: reviewer
    } = await supabase
      .from('user_profiles')
      .select(`
        display_name,
        full_name
      `)
      .eq('user_id', data.admin_id)
      .maybeSingle();

    reviewerName =
      reviewer?.display_name ||
      reviewer?.full_name ||
      null;
  }

  return res.status(200).json({
    ...data,
    requested_level:
      data.requested_track,
    reviewed_at:
      data.resolved_at,
    reviewed_by:
      data.admin_id,
    reviewer_name:
      reviewerName
  });
}

async function getPendingLevelChanges(
  req,
  res,
  ctx
) {
  const {
    data,
    error
  } = await supabase
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
    .order('created_at', {
      ascending: true
    });

  if (error) {
    throw new SecurityError(
      'Unable to load pending level changes',
      500
    );
  }

  const formattedData =
    (data || []).map(item => ({
      id: item.id,
      user_id: item.user_id,
      requested_track:
        item.requested_track,
      requested_class:
        item.requested_class,
      requested_level_id:
        item.requested_level_id,
      requested_group_id:
        item.requested_group_id,
      requested_level:
        item.requested_track,
      reason: item.reason,
      status: item.status,
      created_at: item.created_at,
      resolved_at: item.resolved_at,
      reviewed_at: item.resolved_at,
      admin_id: item.admin_id,
      reviewed_by: item.admin_id,
      user: item.user_profiles
    }));

  return res.status(200).json(
    formattedData
  );
}
