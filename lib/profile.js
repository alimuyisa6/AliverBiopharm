/* lib/profile.js */
import { supabase } from './core.js';
import {
  parseAndValidateBody,
  requireAuth,
  requireSuperAdmin,
  SecurityError
} from './security-middleware.js';
import { createNotification } from './notifications.js';

const REQUEST_COOLDOWN_DAYS = 30;

async function resolveLevelId(levelIdentifier) {
  const { data: level } = await supabase
    .from('curriculum_levels')
    .select('id')
    .or(`id.eq.${levelIdentifier},display_name.eq.${levelIdentifier}`)
    .maybeSingle();

  if (!level) throw new SecurityError('Invalid curriculum level.', 400);

  return level.id;
}

async function resolveLevelRow(levelIdentifier) {
  if (!levelIdentifier) return null;

  const { data } = await supabase
    .from('curriculum_levels')
    .select('id, display_name')
    .or(`id.eq.${levelIdentifier},display_name.eq.${levelIdentifier}`)
    .maybeSingle();

  return data || null;
}

async function getValidGroupNames(levelId) {
  const { data } = await supabase
    .from('curriculum_groups')
    .select('name')
    .eq('level_id', levelId)
    .eq('is_active', true)
    .order('sequence_order');

  return (data || []).map((group) => group.name);
}

async function getGroupId(levelId, groupName) {
  const { data } = await supabase
    .from('curriculum_groups')
    .select('id')
    .eq('level_id', levelId)
    .eq('name', groupName)
    .maybeSingle();

  return data?.id || null;
}

async function getUserScope(userId) {
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('active_level_id, active_group_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (!profile?.active_level_id || !profile?.active_group_id) return null;

  const [{ data: level }, { data: group }] = await Promise.all([
    supabase.from('curriculum_levels').select('id, display_name').eq('id', profile.active_level_id).maybeSingle(),
    supabase.from('curriculum_groups').select('id, name, level_id').eq('id', profile.active_group_id).maybeSingle()
  ]);

  if (!level || !group || group.level_id !== level.id) return null;

  return {
    active_level_id: level.id,
    active_group_id: group.id,
    active_level_name: level.display_name,
    active_group_name: group.name,
    level: level.display_name,
    groupName: group.name,
    showAll: false,
    pending: false
  };
}

export async function handler(req, res, path, ctx) {
  if (req.method === 'GET') {
    switch (path) {
      case 'class_sequence':
        return getClassSequence(req, res);
      case 'pharmacy_programs':
        return getPharmacyPrograms(req, res);
      case 'get_profile':
        requireAuth(ctx);
        return getProfile(req, res, ctx);
      case 'level_change_status':
        requireAuth(ctx);
        return getLevelChangeStatus(req, res, ctx);
      case 'pending_level_changes':
        requireSuperAdmin(ctx);
        return getPendingLevelChanges(req, res);
      case 'teacher_status':
        requireAuth(ctx);
        return getTeacherStatus(req, res, ctx);
      default:
        throw new SecurityError('Invalid action', 400);
    }
  }

  if (req.method === 'POST') {
    const body = await parseAndValidateBody(req);

    switch (path) {
      case 'save_onboarding':
        requireAuth(ctx);
        return saveOnboarding(body, res, ctx);
      case 'update_class':
        requireAuth(ctx);
        return updateClass(body, res, ctx);
      case 'switch_class':
        requireAuth(ctx);
        return switchClass(body, res, ctx);
      case 'update_display_name':
        requireAuth(ctx);
        return updateDisplayName(body, res, ctx);
      case 'admin_update_profile':
        requireSuperAdmin(ctx);
        return adminUpdateProfile(body, res, ctx);
      case 'request_level_change':
        requireAuth(ctx);
        return requestLevelChange(body, res, ctx);
      case 'review_level_change':
        requireSuperAdmin(ctx);
        return reviewLevelChange(body, res, ctx);
      default:
        throw new SecurityError('Invalid action', 400);
    }
  }

  throw new SecurityError('Method not allowed', 405);
}

async function getClassSequence(req, res) {
  const { track } = req.query;

  if (!track) throw new SecurityError('A level is required.', 400);

  const levelId = await resolveLevelId(track);

  const { data } = await supabase
    .from('curriculum_groups')
    .select('class_name:name, sequence_order')
    .eq('level_id', levelId)
    .eq('is_active', true)
    .order('sequence_order');

  return res.status(200).json(data || []);
}

async function getPharmacyPrograms(req, res) {
  const { data: pharmacyLevel } = await supabase
    .from('curriculum_levels')
    .select('id')
    .eq('display_name', 'Pharmacy')
    .maybeSingle();

  if (!pharmacyLevel) throw new SecurityError('Pharmacy level not found.', 500);

  const { data } = await supabase
    .from('curriculum_groups')
    .select('id, program_name:name, description, icon, display_order:sequence_order')
    .eq('level_id', pharmacyLevel.id)
    .eq('is_active', true)
    .order('sequence_order');

  return res.status(200).json(data || []);
}

async function getProfile(req, res, ctx) {
  const [{ data: profile }, { data: admin }] = await Promise.all([
    supabase.from('user_profiles').select('*').eq('user_id', ctx.userId).maybeSingle(),
    supabase.from('admin_master').select('admin_role').eq('admin_id', ctx.userId).eq('is_active', true).maybeSingle()
  ]);

  if (!profile) return res.status(200).json(null);

  const scope = await getUserScope(ctx.userId);
  const validClassNames = scope?.active_level_id ? await getValidGroupNames(scope.active_level_id) : [];

  return res.status(200).json({
    ...profile,
    active_level_id: scope?.active_level_id ?? profile.active_level_id,
    active_group_id: scope?.active_group_id ?? profile.active_group_id,
    active_level_name: scope?.active_level_name ?? null,
    active_group_name: scope?.active_group_name ?? null,
    class_name: scope?.active_group_name ?? profile.class_name,
    track: scope?.active_level_name ?? profile.track,
    track_id: scope?.active_level_id ?? profile.active_level_id,
    is_super_admin: admin?.admin_role === 'super_admin',
    class_options: validClassNames
  });
}

async function getLevelChangeStatus(req, res, ctx) {
  const { data } = await supabase
    .from('level_change_requests')
    .select('*')
    .eq('user_id', ctx.userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return res.status(200).json(data || null);
}

async function getPendingLevelChanges(req, res) {
  const { data } = await supabase
    .from('level_change_requests')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  return res.status(200).json(data || []);
}

async function getTeacherStatus(req, res, ctx) {
  const { data } = await supabase
    .from('user_profiles')
    .select('role, is_approved_teacher, approved_track, class_name')
    .eq('user_id', ctx.userId)
    .maybeSingle();

  if (!data || data.role !== 'teacher') {
    return res.status(200).json({ is_teacher: false });
  }

  return res.status(200).json({
    is_teacher: true,
    is_approved: data.is_approved_teacher,
    approved_track: data.approved_track,
    class_name: data.class_name
  });
}

async function saveOnboarding(body, res, ctx) {
  const { role, track, class_name, display_name } = body;

  const { data: existing } = await supabase
    .from('user_profiles')
    .select('onboarding_completed')
    .eq('user_id', ctx.userId)
    .maybeSingle();

  if (existing?.onboarding_completed) {
    throw new SecurityError('Onboarding is already complete.', 400);
  }

  if (!role || !track || !class_name) {
    throw new SecurityError('Role, track and class name are required.', 400);
  }

  if (!['student', 'teacher'].includes(role)) {
    throw new SecurityError('Invalid role.', 400);
  }

  const levelId = await resolveLevelId(track);
  const validClassNames = await getValidGroupNames(levelId);

  if (!validClassNames.includes(class_name)) {
    throw new SecurityError('That class is not available for the selected level.', 400);
  }

  const groupId = await getGroupId(levelId, class_name);

  await supabase.from('user_profiles').upsert({
    user_id: ctx.userId,
    role,
    track: levelId,
    class_name,
    display_name: display_name || null,
    onboarding_completed: true,
    active_level_id: levelId,
    active_group_id: groupId,
    is_approved_teacher: false,
    updated_at: new Date().toISOString()
  }, { onConflict: 'user_id' });

  return res.status(200).json({ success: true });
}

async function updateClass(body, res, ctx) {
  const { class_name } = body;

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('onboarding_completed, active_level_id, track')
    .eq('user_id', ctx.userId)
    .maybeSingle();

  if (!profile?.onboarding_completed) {
    throw new SecurityError('Please complete onboarding before continuing.', 400);
  }

  const levelId = profile.active_level_id || profile.track;
  const validClassNames = await getValidGroupNames(levelId);

  if (!validClassNames.includes(class_name)) {
    throw new SecurityError('That class is not available for your level.', 400);
  }

  const groupId = await getGroupId(levelId, class_name);

  await supabase.from('user_profiles').update({
    class_name,
    active_group_id: groupId,
    updated_at: new Date().toISOString()
  }).eq('user_id', ctx.userId);

  return res.status(200).json({ success: true });
}

async function switchClass(body, res, ctx) {
  const { group_id } = body;

  if (!group_id) throw new SecurityError('A class or programme must be selected.', 400);

  const { data: group } = await supabase
    .from('curriculum_groups')
    .select('id, level_id, name, is_active')
    .eq('id', group_id)
    .maybeSingle();

  console.error('[SWITCH_CLASS_DEBUG]', JSON.stringify({
    user_id: ctx.userId,
    group_id,
    group_level_id: group?.level_id || null,
    group_name: group?.name || null,
    group_is_active: group?.is_active ?? null
  }));

  if (!group?.is_active) {
    throw new SecurityError('That class or programme is no longer available.', 404);
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, is_approved_teacher, approved_track, active_level_id, track')
    .eq('user_id', ctx.userId)
    .maybeSingle();

  console.error('[SWITCH_CLASS_DEBUG_PROFILE]', JSON.stringify({
    user_id: ctx.userId,
    role: profile?.role || null,
    active_level_id: profile?.active_level_id || null,
    track: profile?.track || null,
    is_approved_teacher: profile?.is_approved_teacher ?? null,
    approved_track: profile?.approved_track || null
  }));

  if (profile?.role === 'student') {
    const currentLevelId = profile.active_level_id || profile.track;

    console.error('[SWITCH_CLASS_DEBUG_COMPARE]', JSON.stringify({
      user_id: ctx.userId,
      currentLevelId: currentLevelId || null,
      groupLevelId: group.level_id || null,
      match: currentLevelId === group.level_id
    }));

    if (currentLevelId !== group.level_id) {
      throw new SecurityError('You cannot switch directly to a different level.', 403);
    }
  }

  if (profile?.role === 'teacher') {
    if (!profile.is_approved_teacher) {
      throw new SecurityError('Your teacher account is still pending approval.', 403);
    }

    if (profile.approved_track !== 'ALL' && profile.approved_track !== group.level_id) {
      throw new SecurityError('You are not approved to access this level.', 403);
    }
  }

  await supabase.from('user_profiles').update({
    active_level_id: group.level_id,
    active_group_id: group.id,
    track: group.level_id,
    class_name: group.name,
    updated_at: new Date().toISOString()
  }).eq('user_id', ctx.userId);

  const scope = await getUserScope(ctx.userId);

  if (!scope) throw new SecurityError('Failed to retrieve curriculum scope after switching.', 500);

  return res.status(200).json({
    success: true,
    level_id: scope.active_level_id,
    group_id: scope.active_group_id,
    level_name: scope.active_level_name,
    group_name: scope.active_group_name,
    class_name: scope.active_group_name,
    scope
  });
}

async function updateDisplayName(body, res, ctx) {
  const { display_name } = body;

  if (!display_name || typeof display_name !== 'string' || display_name.trim().length < 2) {
    throw new SecurityError('Display name must be at least 2 characters', 400);
  }

  const trimmed = display_name.trim();

  if (trimmed.length > 100) {
    throw new SecurityError('Display name must be 100 characters or less', 400);
  }

  await supabase
    .from('user_profiles')
    .update({
      display_name: trimmed,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', ctx.userId);

  return res.status(200).json({ success: true, display_name: trimmed });
}

async function adminUpdateProfile(body, res, ctx) {
  const { user_id, track, class_name } = body;

  if (!user_id || !track || !class_name) {
    throw new SecurityError('User, track and class name are required.', 400);
  }

  const levelId = await resolveLevelId(track);
  const groupId = await getGroupId(levelId, class_name);

  await supabase.from('user_profiles').update({
    track: levelId,
    class_name,
    active_level_id: levelId,
    active_group_id: groupId,
    updated_at: new Date().toISOString()
  }).eq('user_id', user_id);

  await supabase.from('user_sessions').update({ is_active: false }).eq('user_id', user_id).eq('is_active', true);

  await createNotification(user_id, 'level_change_approved', { track: levelId, class_name });

  return res.status(200).json({ success: true });
}

async function requestLevelChange(body, res, ctx) {
  const { requested_track, reason } = body;

  if (!requested_track || !reason) {
    throw new SecurityError('A level and a reason are required.', 400);
  }

  const requestedLevelId = await resolveLevelId(requested_track);

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('active_level_id, track, role')
    .eq('user_id', ctx.userId)
    .maybeSingle();

  if (!profile) throw new SecurityError('Please complete onboarding before requesting a level change.', 400);
  if (profile.role === 'teacher') throw new SecurityError('Teacher accounts do not require level change requests.', 400);

  const currentLevelId = profile.active_level_id || profile.track;

  if (currentLevelId === requestedLevelId) {
    throw new SecurityError('You are already on this level.', 400);
  }

  const { data: existing } = await supabase
    .from('level_change_requests')
    .select('id, status, created_at')
    .eq('user_id', ctx.userId)
    .order('created_at', { ascending: false })
    .limit(1);

  if (existing?.length) {
    if (existing[0].status === 'pending') {
      throw new SecurityError('You already have a level change request awaiting review.', 400);
    }

    const daysSince = (Date.now() - new Date(existing[0].created_at).getTime()) / 86400000;

    if (daysSince < REQUEST_COOLDOWN_DAYS) {
      const daysRemaining = Math.ceil(REQUEST_COOLDOWN_DAYS - daysSince);

      throw new SecurityError(`You can submit a new request in ${daysRemaining} day(s).`, 429);
    }
  }

  const defaultClassNames = await getValidGroupNames(requestedLevelId);

  if (!defaultClassNames.length) throw new SecurityError('This level is not currently available.', 400);

  await supabase.from('level_change_requests').insert({
    user_id: ctx.userId,
    requested_track: requestedLevelId,
    requested_level_id: requestedLevelId,
    requested_class: defaultClassNames[0],
    requested_group_id: null,
    reason: reason.trim().slice(0, 500),
    status: 'pending'
  });

  return res.status(200).json({ success: true });
}

async function reviewLevelChange(body, res, ctx) {
  const { request_id, action } = body;

  if (!request_id || !['approve', 'reject'].includes(action)) {
    throw new SecurityError('A request and a valid action are required.', 400);
  }

  const { data: request } = await supabase
    .from('level_change_requests')
    .select('*')
    .eq('id', request_id)
    .maybeSingle();

  if (!request || request.status !== 'pending') {
    throw new SecurityError('This request is no longer valid.', 400);
  }

  if (action === 'approve') {
    const groupId = request.requested_group_id || await getGroupId(request.requested_level_id, request.requested_class);

    await supabase.from('user_profiles').update({
      track: request.requested_level_id,
      class_name: request.requested_class,
      active_level_id: request.requested_level_id,
      active_group_id: groupId,
      updated_at: new Date().toISOString()
    }).eq('user_id', request.user_id);

    await createNotification(request.user_id, 'level_change_approved', {});
  }

  await supabase.from('level_change_requests').update({
    status: action === 'approve' ? 'approved' : 'rejected',
    admin_id: ctx.userId,
    resolved_at: new Date().toISOString()
  }).eq('id', request_id);

  return res.status(200).json({ success: true });
}
