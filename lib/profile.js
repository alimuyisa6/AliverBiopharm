import { supabase, getUserProfileName } from './core.js';
import { parseAndValidateBody, requireAuth, requireSuperAdmin, SecurityError } from './security-middleware.js';
import { createNotification } from './notifications.js';

const TRACK_RANK = { 'O-Level': 0, 'A-Level': 1, 'Pharmacy': 2 };
const REQUEST_COOLDOWN_DAYS = 30;

export async function handler(req, res, path, ctx) {
  // Public read endpoints for class sequences and pharmacy programs (now from curriculum_groups)
  if (req.method === 'GET' && (path === 'class_sequence' || path === 'pharmacy_programs')) {
    const { track } = req.query;
    if (path === 'class_sequence') {
      if (!track) throw new SecurityError('track required', 400);
      const { data } = await supabase
        .from('curriculum_groups')
        .select('name as class_name, sequence_order')
        .eq('level_id', track)
        .eq('is_active', true)
        .order('sequence_order');
      return res.status(200).json(data || []);
    }
    if (path === 'pharmacy_programs') {
      const { data } = await supabase
        .from('curriculum_groups')
        .select('id, name as program_name, description, icon, sequence_order as display_order')
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
    if (!class_name) throw new SecurityError('class_name required', 400);

    const { data: existing } = await supabase.from('user_profiles').select('*').eq('user_id', ctx.userId).maybeSingle();

    if (existing?.onboarding_completed) {
      if (role && role !== existing.role) throw new SecurityError('Cannot change role after onboarding', 400);
      if (track && track !== existing.track) throw new SecurityError('Level cannot be changed here. Submit a level change request.', 400);
    } else {
      if (!role || !track) throw new SecurityError('role and track required', 400);
      if (!['student', 'teacher'].includes(role)) throw new SecurityError('Invalid role', 400);
      if (!TRACK_RANK.hasOwnProperty(track)) throw new SecurityError('Invalid track', 400);
    }

    const effectiveRole = role || existing?.role;
    const effectiveTrack = track || existing?.track;
    const validClassNames = await getValidClassNames(effectiveTrack);
    if (!validClassNames.includes(class_name)) throw new SecurityError('Invalid track/class combination', 400);

    // Find the group id for the class_name
    const { data: group } = await supabase
      .from('curriculum_groups')
      .select('id')
      .eq('level_id', effectiveTrack)
      .eq('name', class_name)
      .maybeSingle();

    const payload = {
      role: effectiveRole,
      track: effectiveTrack,
      class_name,
      onboarding_completed: true,
      active_level_id: effectiveTrack,
      active_group_id: group?.id || null,
      updated_at: new Date().toISOString()
    };
    if (effectiveRole === 'teacher') {
      payload.contribute_track = contribute_track || existing?.contribute_track || effectiveTrack;
      payload.contribute_class_name = contribute_class_name || existing?.contribute_class_name || class_name;
      payload.contribute_subjects = Array.isArray(contribute_subjects) ? contribute_subjects.slice(0, 20) : (existing?.contribute_subjects || []);
      payload.is_approved_teacher = false;
    }

    if (existing) {
      await supabase.from('user_profiles').update(payload).eq('user_id', ctx.userId);
    } else {
      await supabase.from('user_profiles').insert({ ...payload, user_id: ctx.userId });
    }
    return res.status(200).json({ success: true });
  }

  if (req.method === 'POST' && path === 'admin_update_profile') {
    requireSuperAdmin(ctx);
    const { user_id, track, class_name } = await parseAndValidateBody(req);
    if (!user_id || !track || !class_name) throw new SecurityError('user_id, track, class_name required', 400);
    const validClassNames = await getValidClassNames(track);
    if (!validClassNames.includes(class_name)) throw new SecurityError('Invalid class for track', 400);

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
    const { requested_track, requested_class, reason } = body;
    if (!requested_track || !requested_class || !reason) throw new SecurityError('requested_track, requested_class, reason required', 400);
    const validClassNames = await getValidClassNames(requested_track);
    if (!validClassNames.includes(requested_class)) throw new SecurityError('Invalid class for track', 400);
    const { data: profile } = await supabase.from('user_profiles').select('role').eq('user_id', ctx.userId).maybeSingle();
    if (!profile) throw new SecurityError('Complete onboarding first', 400);
    if (profile.role === 'teacher') throw new SecurityError('Teachers do not need level change requests', 400);

    const { data: existing } = await supabase
      .from('level_change_requests')
      .select('id, status, created_at')
      .eq('user_id', ctx.userId)
      .order('created_at', { ascending: false })
      .limit(1);
    if (existing?.length) {
      if (existing[0].status === 'pending') throw new SecurityError('You already have a pending request', 400);
      const daysSince = (Date.now() - new Date(existing[0].created_at).getTime()) / 86400000;
      if (daysSince < REQUEST_COOLDOWN_DAYS) throw new SecurityError(`Wait ${Math.ceil(REQUEST_COOLDOWN_DAYS - daysSince)} days`, 429);
    }
    await supabase.from('level_change_requests').insert({
      user_id: ctx.userId,
      requested_track,
      requested_class,
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
    if (!request_id || !['approve', 'reject'].includes(action)) throw new SecurityError('request_id and valid action required', 400);
    const { data: reqRow } = await supabase.from('level_change_requests').select('*').eq('id', request_id).maybeSingle();
    if (!reqRow || reqRow.status !== 'pending') throw new SecurityError('Invalid request', 400);
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
    if (!track || !class_name || !subjects?.length) throw new SecurityError('track, class_name, subjects required', 400);
    const validClassNames = await getValidClassNames(track);
    if (!validClassNames.includes(class_name)) throw new SecurityError('Invalid track/class combination', 400);

    const { data: existing } = await supabase.from('tutor_applications').select('id').eq('user_id', ctx.userId).in('status', ['pending', 'scheduled', 'interviewed']).maybeSingle();
    if (existing) throw new SecurityError('You already have a pending application', 400);

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

    return res.status(200).json({ success: true, message: 'Teacher application submitted' });
  }

  if (req.method === 'POST' && path === 'approve_teacher') {
    requireSuperAdmin(ctx);
    const body = await parseAndValidateBody(req);
    const { user_id, approved_track, notes } = body;
    if (!user_id || !approved_track) throw new SecurityError('user_id and approved_track required', 400);
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
    if (!user_id || !reason) throw new SecurityError('user_id and reason required', 400);
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
