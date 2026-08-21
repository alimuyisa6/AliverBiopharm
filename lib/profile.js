 // lib/profile.js
import { supabase } from './core.js';
import {
  parseAndValidateBody,
  requireSuperAdmin,
  requireAuthenticated,
  SecurityError
} from './security-middleware.js';
import { getUserCurriculumScope } from './curriculum.js';
import { createNotification } from './notifications.js';

export async function handler(req, res, path, ctx) {
  if (req.method === 'GET') {
    requireAuthenticated(ctx);

    switch (path) {
      case 'get_profile':
        return getProfile(req, res, ctx);
      case 'class_sequence':
        return getClassSequence(req, res, ctx);
      case 'pharmacy_programs':
        return getPharmacyPrograms(req, res, ctx);
      case 'level_change_status':
        return getLevelChangeStatus(req, res, ctx);
      case 'pending_level_changes':
        requireSuperAdmin(ctx);
        return getPendingLevelChanges(req, res, ctx);
      default:
        throw new SecurityError('Invalid action', 400);
    }
  }

  if (req.method === 'POST') {
    requireAuthenticated(ctx);

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
      profile_picture_url,
      bio,
      role,
      track,
      class_name,
      is_approved_teacher,
      approved_track,
      active_level_id,
      active_group_id,
      onboarding_completed,
      created_at,
      updated_at,
      last_active_at,
      is_active,
      preferences
    `)
    .eq('user_id', userId)
    .maybeSingle();

  if (!profile) {
    const { data: authUser } = await supabase.auth.admin.getUserById(userId);
    const email = authUser?.user?.email || null;

    const { data: newProfile } = await supabase
      .from('user_profiles')
      .insert({
        user_id: userId,
        email: email,
        full_name: authUser?.user?.user_metadata?.full_name || null,
        display_name: authUser?.user?.user_metadata?.full_name || null,
        track: null,
        class_name: null,
        role: 'student',
        is_approved_teacher: false,
        approved_track: null,
        active_level_id: null,
        active_group_id: null,
        onboarding_completed: false,
        is_active: true,
        preferences: {},
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    profile = newProfile;
  }

  const scope = await getUserCurriculumScope(userId);

  const { data: levelChangeStatus } = await supabase
    .from('level_change_requests')
    .select('id, status, requested_level, reason, created_at, reviewed_at, reviewed_by')
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

  return res.status(200).json({
    ...profile,
    scope: scope || null,
    level_change_status: levelChangeStatus || null,
    recent_activity: recentActivity || []
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

  const { data } = await supabase
    .from('user_profiles')
    .update(updates)
    .eq('user_id', userId)
    .select()
    .single();

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

  const { data } = await supabase
    .from('user_profiles')
    .update({
      class_name,
      active_group_id: group.id,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', userId)
    .select()
    .single();

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

  const { data } = await supabase
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
  const { requested_track, reason } = body;

  if (!requested_track || !reason) {
    throw new SecurityError('requested_track and reason are required', 400);
  }

  const { data: level } = await supabase
    .from('curriculum_levels')
    .select('id, display_name')
    .eq('display_name', requested_track)
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
    throw new SecurityError(`You already have a ${existingRequest.status} request`, 400);
  }

  const { data } = await supabase
    .from('level_change_requests')
    .insert({
      user_id: userId,
      requested_level: requested_track,
      reason,
      status: 'pending',
      created_at: new Date().toISOString()
    })
    .select()
    .single();

  await supabase.from('audit_log').insert({
    actor_id: userId,
    action: 'request_level_change',
    target_type: 'user',
    target_id: userId,
    metadata: { requested_track, reason }
  });

  await supabase.from('user_activity').insert({
    user_id: userId,
    action: 'request_level_change',
    target_type: 'user',
    target_id: userId,
    metadata: { requested_track }
  });

  await createNotification(userId, 'level_change_requested', {
    requested_level: requested_track
  });

  return res.status(200).json({ success: true, request: data });
}

async function reviewLevelChange(body, res, ctx) {
  const { request_id, action } = body;

  if (!request_id || !action || !['approve', 'reject'].includes(action)) {
    throw new SecurityError('request_id and action (approve/reject) required', 400);
  }

  const { data: request } = await supabase
    .from('level_change_requests')
    .select('*, user_profiles(user_id, track, class_name, email, full_name, display_name)')
    .eq('id', request_id)
    .eq('status', 'pending')
    .maybeSingle();

  if (!request) {
    throw new SecurityError('Request not found or already reviewed', 404);
  }

  const { data: level } = await supabase
    .from('curriculum_levels')
    .select('id')
    .eq('display_name', request.requested_level)
    .maybeSingle();

  if (!level && action === 'approve') {
    throw new SecurityError('Invalid level in request', 400);
  }

  const newStatus = action === 'approve' ? 'approved' : 'rejected';

  await supabase
    .from('level_change_requests')
    .update({
      status: newStatus,
      reviewed_by: ctx.userId,
      reviewed_at: new Date().toISOString()
    })
    .eq('id', request_id);

  if (action === 'approve') {
    const { data: defaultGroup } = await supabase
      .from('curriculum_groups')
      .select('id, name')
      .eq('level_id', level.id)
      .order('sequence_order', { ascending: true })
      .limit(1)
      .maybeSingle();

    await supabase
      .from('user_profiles')
      .update({
        track: request.requested_level,
        active_level_id: level.id,
        active_group_id: defaultGroup?.id || null,
        class_name: defaultGroup?.name || null,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', request.user_id);

    await createNotification(request.user_id, 'level_change_approved', {
      new_level: request.requested_level
    });
  } else {
    await createNotification(request.user_id, 'level_change_rejected', {
      requested_level: request.requested_level
    });
  }

  await supabase.from('audit_log').insert({
    actor_id: ctx.userId,
    actor_role: ctx.adminData?.admin_role,
    action: `level_change_${action}`,
    target_type: 'user',
    target_id: request.user_id,
    metadata: { request_id, requested_level: request.requested_level }
  });

  await supabase.from('user_activity').insert({
    user_id: request.user_id,
    action: `level_change_${action}`,
    target_type: 'user',
    target_id: request.user_id,
    metadata: { status: newStatus, requested_level: request.requested_level }
  });

  return res.status(200).json({ success: true, status: newStatus });
}

async function adminUpdateProfile(body, res, ctx) {
  const { user_id, track, class_name } = body;

  if (!user_id) {
    throw new SecurityError('user_id is required', 400);
  }

  const updates = { updated_at: new Date().toISOString() };

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

  const { data } = await supabase
    .from('user_profiles')
    .update(updates)
    .eq('user_id', user_id)
    .select()
    .single();

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

  return res.status(200).json({ success: true, profile: data });
}

async function updateDisplayName(body, res, ctx) {
  const userId = ctx.userId;
  const { display_name } = body;

  if (!display_name || display_name.trim().length < 2) {
    throw new SecurityError('display_name must be at least 2 characters', 400);
  }

  if (display_name.trim().length > 100) {
    throw new SecurityError('display_name must not exceed 100 characters', 400);
  }

  if (/[<>]/.test(display_name.trim())) {
    throw new SecurityError('display_name contains invalid characters', 400);
  }

  const { data } = await supabase
    .from('user_profiles')
    .update({
      display_name: display_name.trim(),
      updated_at: new Date().toISOString()
    })
    .eq('user_id', userId)
    .select()
    .single();

  await supabase.from('user_activity').insert({
    user_id: userId,
    action: 'update_display_name',
    target_type: 'user',
    target_id: userId,
    metadata: { display_name: display_name.trim() }
  });

  return res.status(200).json({ success: true, profile: data });
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
    .select('id, name, code, icon, display_order, is_premium, group_id')
    .in('group_id', groups.map(g => g.id))
    .eq('is_active', true)
    .order('display_order', { ascending: true });

  const groupsWithUnits = groups.map(group => ({
    ...group,
    units: (units || []).filter(unit => unit.group_id === group.id)
  }));

  return res.status(200).json(groupsWithUnits);
}

async function getPharmacyPrograms(req, res, ctx) {
  const { data } = await supabase
    .from('curriculum_levels')
    .select('id, display_name, group_label, unit_label, description, kind, icon, display_order')
    .eq('is_active', true)
    .order('display_order', { ascending: true });

  return res.status(200).json(data || []);
}

async function getLevelChangeStatus(req, res, ctx) {
  const userId = ctx.userId;

  const { data } = await supabase
    .from('level_change_requests')
    .select('id, status, requested_level, reason, created_at, reviewed_at, reviewed_by')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) {
    return res.status(200).json(null);
  }

  if (data.reviewed_by) {
    const { data: reviewer } = await supabase
      .from('user_profiles')
      .select('display_name, full_name')
      .eq('user_id', data.reviewed_by)
      .maybeSingle();

    return res.status(200).json({
      ...data,
      reviewer_name: reviewer?.display_name || reviewer?.full_name || null
    });
  }

  return res.status(200).json(data);
}

async function getPendingLevelChanges(req, res, ctx) {
  const { data } = await supabase
    .from('level_change_requests')
    .select(`
      id,
      user_id,
      requested_level,
      reason,
      status,
      created_at,
      reviewed_at,
      reviewed_by,
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
    requested_level: item.requested_level,
    reason: item.reason,
    status: item.status,
    created_at: item.created_at,
    reviewed_at: item.reviewed_at,
    reviewed_by: item.reviewed_by,
    user: item.user_profiles
  }));

  return res.status(200).json(formattedData);
}
