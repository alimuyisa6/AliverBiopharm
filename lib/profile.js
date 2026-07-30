import { supabase, getUserProfileName } from './core.js';
import { parseAndValidateBody, requireAuth, requireSuperAdmin, SecurityError } from './security-middleware.js';
import { createNotification } from './notifications.js';

const TRACK_RANK = { 'O-Level': 0, 'A-Level': 1, 'Pharmacy': 2 };
const REQUEST_COOLDOWN_DAYS = 30;

export async function handler(req, res, path, ctx) {
  if (req.method === 'GET' && (path === 'class_sequence' || path === 'pharmacy_programs')) {
    const { track } = req.query;
    if (path === 'class_sequence') {
      if (!track) throw new SecurityError('A track is required.', 400);
      const { data } = await supabase
        .from('curriculum_groups')
        .select('class_name:name, sequence_order')
        .eq('level_id', track)
        .eq('is_active', true)
        .order('sequence_order');
      return res.status(200).json(data || []);
    }
    if (path === 'pharmacy_programs') {
      const { data } = await supabase
        .from('curriculum_groups')
        .select('id, program_name:name, description, icon, display_order:sequence_order')
        .eq('level_id', 'Pharmacy')
        .eq('is_active', true)
        .order('sequence_order');
      return res.status(200).json(data || []);
    }
  }

  requireAuth(ctx);

  if (req.method === 'GET' && path === 'get_profile') {
    const [{ data }, isSuperAdmin] = await Promise.all([
      supabase.from('user_profiles').select('*').eq('user_id', ctx.userId).maybeSingle(),
      detectSuperAdmin(ctx.userId)
    ]);
    const profile = data || {};
    let classOptions = [];
    if (profile.track) {
      const { data: groups } = await supabase
        .from('curriculum_groups')
        .select('name')
        .eq('level_id', profile.track)
        .eq('is_active', true)
        .order('sequence_order');
      classOptions = (groups || []).map(g => g.name);
    }
    return res.status(200).json({ ...profile, is_super_admin: isSuperAdmin, class_options: classOptions });
  }

  if (req.method === 'POST' && path === 'save_onboarding') {
    const body = await parseAndValidateBody(req);
    const { role, track, class_name, contribute_track, contribute_class_name, contribute_subjects } = body;

    const { data: existing } = await supabase.from('user_profiles').select('*').eq('user_id', ctx.userId).maybeSingle();

    if (existing?.onboarding_completed) {
      throw new SecurityError('Onboarding is already complete. To change your class, use the class switcher in the header. To change your level, submit a level change request.', 400);
    }

    if (!role || !track || !class_name) throw new SecurityError('Role, track and class name are required.', 400);
    if (!['student', 'teacher'].includes(role)) throw new SecurityError('Invalid role.', 400);
    if (!TRACK_RANK.hasOwnProperty(track)) throw new SecurityError('Invalid track.', 400);

    const validClassNames = await getValidClassNames(track);
    if (!validClassNames.includes(class_name)) throw new SecurityError('That class isn\u2019t available for the selected track.', 400);

    const { data: group } = await supabase
      .from('curriculum_groups')
      .select('id')
      .eq('level_id', track)
      .eq('name', class_name)
      .maybeSingle();

    const payload = {
      role,
      track,
      class_name,
      onboarding_completed: true,
      active_level_id: track,
      active_group_id: group?.id || null,
      updated_at: new Date().toISOString()
    };
    if (role === 'teacher') {
      payload.contribute_track = contribute_track || track;
      payload.contribute_class_name = contribute_class_name || class_name;
      payload.contribute_subjects = Array.isArray(contribute_subjects) ? contribute_subjects.slice(0, 20) : [];
      payload.is_approved_teacher = false;
    }

    if (existing) {
      await supabase.from('user_profiles').update(payload).eq('user_id', ctx.userId);
    } else {
      await supabase.from('user_profiles').insert({ ...payload, user_id: ctx.userId });
    }
    return res.status(200).json({ success: true });
  }

  if (req.method === 'POST' && path === 'update_class') {
    const body = await parseAndValidateBody(req);
    const { class_name, contribute_class_name, contribute_subjects } = body;

    const { data: profile } = await supabase.from('user_profiles').select('*').eq('user_id', ctx.userId).maybeSingle();
    if (!profile || !profile.onboarding_completed) throw new SecurityError('Please complete onboarding before continuing.', 400);

    const updates = { updated_at: new Date().toISOString() };

    if (class_name !== undefined) {
      const validClassNames = await getValidClassNames(profile.track);
      if (!validClassNames.includes(class_name)) throw new SecurityError('That class isn\u2019t available for your level.', 400);
      const { data: group } = await supabase
        .from('curriculum_groups')
        .select('id')
        .eq('level_id', profile.track)
        .eq('name', class_name)
        .maybeSingle();
      updates.class_name = class_name;
      updates.active_group_id = group?.id || null;
    }

    if (profile.role === 'teacher') {
      if (contribute_class_name !== undefined) {
        const validNames = await getValidClassNames(profile.contribute_track || profile.track);
        if (!validNames.includes(contribute_class_name)) throw new SecurityError('That class isn\u2019t available for your contribute track.', 400);
        updates.contribute_class_name = contribute_class_name;
      }
      if (Array.isArray(contribute_subjects)) updates.contribute_subjects = contribute_subjects.slice(0, 20);
    }

    if (Object.keys(updates).length === 1) throw new SecurityError('No changes were provided.', 400);

    await supabase.from('user_profiles').update(updates).eq('user_id', ctx.userId);
    return res.status(200).json({ success: true });
  }

  if (req.method === 'POST' && path === 'switch_class') {
    const body = await parseAndValidateBody(req);
    const { group_id } = body;
    if (!group_id) throw new SecurityError('A class or programme must be selected.', 400);

    const { data: group } = await supabase
      .from('curriculum_groups')
      .select('id, level_id, name, is_active')
      .eq('id', group_id)
      .maybeSingle();
    if (!group || !group.is_active) throw new SecurityError('That class or programme is no longer available.', 404);

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role, track, is_approved_teacher, approved_track, onboarding_completed')
      .eq('user_id', ctx.userId)
      .maybeSingle();
    if (!profile || !profile.onboarding_completed) throw new SecurityError('Please complete onboarding before continuing.', 400);

    if (profile.role === 'student' && profile.track !== group.level_id) {
      throw new SecurityError('You can\u2019t switch directly to a different level. Please submit a level change request instead.', 403);
    }
    if (profile.role === 'teacher') {
      if (!profile.is_approved_teacher) throw new SecurityError('Your teacher account is still pending approval.', 403);
      if (profile.approved_track !== 'ALL' && profile.approved_track !== group.level_id) {
        throw new SecurityError('You\u2019re not approved to access this level.', 403);
      }
    }

    await supabase.from('user_profiles').update({
      active_level_id: group.level_id,
      active_group_id: group.id,
      track: group.level_id,
      class_name: group.name,
      updated_at: new Date().toISOString()
    }).eq('user_id', ctx.userId);

    await supabase.from('audit_log').insert({
      actor_id: ctx.userId,
      actor_role: profile.role,
      action: 'switch_class',
      target_type: 'curriculum_group',
      target_id: group.id,
      metadata: { level_id: group.level_id, class_name: group.name }
    });

    return res.status(200).json({ success: true, level_id: group.level_id, group_id: group.id, class_name: group.name });
  }

  if (req.method === 'POST' && path === 'admin_update_profile') {
    requireSuperAdmin(ctx);
    const { user_id, track, class_name } = await parseAndValidateBody(req);
    if (!user_id || !track || !class_name) throw new SecurityError('User, track and class name are required.', 400);
    const validClassNames = await getValidClassNames(track);
    if (!validClassNames.includes(class_name)) throw new SecurityError('That class isn\u2019t available for the selected track.', 400);

    const { data: group } = await supabase
      .from('curriculum_groups')
      .select('id')
      .eq('level_id', track)
      .eq('name', class_name)
      .maybeSingle();

    await supabase.from('user_profiles').update({
      track,
      class_name,
      active_level_id: track,
      active_group_id: group?.id || null,
      updated_at: new Date().toISOString()
    }).eq('user_id', user_id);
    await supabase.from('user_sessions').update({ is_active: false }).eq('user_id', user_id).eq('is_active', true);
    await createNotification(user_id, 'level_change_approved', { track, class_name });
    return res.status(200).json({ success: true });
  }

  if (req.method === 'POST' && path === 'request_level_change') {
    const body = await parseAndValidateBody(req);
    const { requested_track, reason } = body;
    if (!requested_track || !reason) throw new SecurityError('A level and a reason are required.', 400);
    if (!TRACK_RANK.hasOwnProperty(requested_track)) throw new SecurityError('Invalid track.', 400);

    const { data: profile } = await supabase.from('user_profiles').select('role, track').eq('user_id', ctx.userId).maybeSingle();
    if (!profile) throw new SecurityError('Please complete onboarding before requesting a level change.', 400);
    if (profile.role === 'teacher') throw new SecurityError('Teacher accounts don\u2019t require level change requests.', 400);
    if (profile.track === requested_track) throw new SecurityError('You\u2019re already on this level.', 400);

    const { data: existing } = await supabase
      .from('level_change_requests')
      .select('id, status, created_at')
      .eq('user_id', ctx.userId)
      .order('created_at', { ascending: false })
      .limit(1);
    if (existing?.length) {
      if (existing[0].status === 'pending') throw new SecurityError('You already have a level change request awaiting review.', 400);
      const daysSince = (Date.now() - new Date(existing[0].created_at).getTime()) / 86400000;
      if (daysSince < REQUEST_COOLDOWN_DAYS) {
        const daysRemaining = Math.ceil(REQUEST_COOLDOWN_DAYS - daysSince);
        throw new SecurityError(`You can submit a new level change request in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}.`, 429);
      }
    }

    const defaultClassNames = await getValidClassNames(requested_track);
    if (!defaultClassNames.length) throw new SecurityError('This level isn\u2019t currently available.', 400);

    await supabase.from('level_change_requests').insert({
      user_id: ctx.userId,
      requested_track,
      requested_class: defaultClassNames[0],
      reason: reason.trim().slice(0, 500),
      status: 'pending'
    });
    return res.status(200).json({ success: true });
  }

  if (req.method === 'GET' && path === 'level_change_status') {
    const { data } = await supabase.from('level_change_requests').select('*').eq('user_id', ctx.userId).order('created_at', { ascending: false }).limit(1).maybeSingle();
    return res.status(200).json(data || null);
  }

  if (req.method === 'GET' && path === 'pending_level_changes') {
    requireSuperAdmin(ctx);
    const { data } = await supabase.from('level_change_requests').select('*').eq('status', 'pending').order('created_at', { ascending: true });
    return res.status(200).json(data || []);
  }

  if (req.method === 'POST' && path === 'review_level_change') {
    requireSuperAdmin(ctx);
    const { request_id, action } = await parseAndValidateBody(req);
    if (!request_id || !['approve', 'reject'].includes(action)) throw new SecurityError('A request and a valid action are required.', 400);
    const { data: reqRow } = await supabase.from('level_change_requests').select('*').eq('id', request_id).maybeSingle();
    if (!reqRow || reqRow.status !== 'pending') throw new SecurityError('This request is no longer valid.', 400);
    if (action === 'approve') {
      const { data: group } = await supabase
        .from('curriculum_groups')
        .select('id')
        .eq('level_id', reqRow.requested_track)
        .eq('name', reqRow.requested_class)
        .maybeSingle();

      await supabase.from('user_profiles').update({
        track: reqRow.requested_track,
        class_name: reqRow.requested_class,
        active_level_id: reqRow.requested_track,
        active_group_id: group?.id || null,
        updated_at: new Date().toISOString()
      }).eq('user_id', reqRow.user_id);
      await createNotification(reqRow.user_id, 'level_change_approved', {});
    }
    await supabase.from('level_change_requests').update({
      status: action === 'approve' ? 'approved' : 'rejected',
      admin_id: ctx.userId,
      resolved_at: new Date().toISOString()
    }).eq('id', request_id);
    return res.status(200).json({ success: true });
  }

  if (req.method === 'GET' && path === 'teacher_status') {
    const { data } = await supabase.from('user_profiles').select('role, is_approved_teacher, approved_track, class_name').eq('user_id', ctx.userId).maybeSingle();
    if (!data || data.role !== 'teacher') return res.status(200).json({ is_teacher: false });
    return res.status(200).json({ is_teacher: true, is_approved: data.is_approved_teacher, approved_track: data.approved_track, class_name: data.class_name });
  }

  if (req.method === 'POST' && path === 'apply_as_teacher') {
    const body = await parseAndValidateBody(req);
    const { track, class_name, subjects, qualifications, experience } = body;
    if (!track || !class_name || !subjects?.length) throw new SecurityError('Track, class name and subjects are required.', 400);
    const validClassNames = await getValidClassNames(track);
    if (!validClassNames.includes(class_name)) throw new SecurityError('That class isn\u2019t available for the selected track.', 400);

    const { data: existing } = await supabase.from('tutor_applications').select('id').eq('user_id', ctx.userId).in('status', ['pending', 'scheduled', 'interviewed']).maybeSingle();
    if (existing) throw new SecurityError('You already have a teacher application under review.', 400);

    await supabase.from('user_profiles').update({
      role: 'teacher',
      track,
      class_name,
      is_approved_teacher: false,
      updated_at: new Date().toISOString()
    }).eq('user_id', ctx.userId);

    await supabase.from('tutor_applications').insert({
      user_id: ctx.userId,
      level: track,
      class_name,
      subjects,
      qualifications: qualifications || '',
      experience: experience || '',
      status: 'pending'
    });

    return res.status(200).json({ success: true, message: 'Your teacher application has been submitted.' });
  }

  if (req.method === 'POST' && path === 'approve_teacher') {
    requireSuperAdmin(ctx);
    const body = await parseAndValidateBody(req);
    const { user_id, approved_track, notes } = body;
    if (!user_id || !approved_track) throw new SecurityError('User and approved track are required.', 400);
    await supabase.from('user_profiles').update({
      is_approved_teacher: true,
      approved_track,
      approved_by: ctx.userId,
      approved_at: new Date().toISOString(),
      approval_notes: notes || null
    }).eq('user_id', user_id);
    await supabase.from('tutor_applications').update({ status: 'approved' }).eq('user_id', user_id).eq('status', 'pending');
    await createNotification(user_id, 'teacher_approved', { approved_track });
    return res.status(200).json({ success: true });
  }

  if (req.method === 'POST' && path === 'reject_teacher') {
    requireSuperAdmin(ctx);
    const body = await parseAndValidateBody(req);
    const { user_id, reason } = body;
    if (!user_id || !reason) throw new SecurityError('User and reason are required.', 400);
    await supabase.from('user_profiles').update({
      is_approved_teacher: false,
      approval_notes: reason
    }).eq('user_id', user_id);
    await supabase.from('tutor_applications').update({ status: 'rejected', rejection_reason: reason }).eq('user_id', user_id).eq('status', 'pending');
    await createNotification(user_id, 'teacher_rejected', { reason });
    return res.status(200).json({ success: true });
  }

  if (req.method === 'GET' && path === 'pending_teacher_applications') {
    requireSuperAdmin(ctx);
    const { data } = await supabase.from('tutor_applications').select('*').eq('status', 'pending').order('created_at', { ascending: true });
    return res.status(200).json(data || []);
  }

  throw new SecurityError('Invalid path', 400);
}

async function getValidClassNames(track) {
  const { data } = await supabase
    .from('curriculum_groups')
    .select('name')
    .eq('level_id', track)
    .eq('is_active', true)
    .order('sequence_order');
  return (data || []).map(g => g.name);
}

async function detectSuperAdmin(userId) {
  const { data } = await supabase
    .from('admin_master')
    .select('admin_role')
    .eq('admin_id', userId)
    .eq('is_active', true)
    .maybeSingle();
  return data?.admin_role === 'super_admin';
}
