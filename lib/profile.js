 import { supabase } from './core.js';
import { parseAndValidateBody, requireAuth, requireSuperAdmin, SecurityError } from './security-middleware.js';
import { createNotification } from './notifications.js';

const TRACK_RANK = { 'O-Level': 0, 'A-Level': 1, 'Pharmacy': 2 };
const REQUEST_COOLDOWN_DAYS = 30;

async function detectSuperAdmin(userId) {
  const { data } = await supabase
    .from('admin_master')
    .select('admin_role')
    .eq('admin_id', userId)
    .eq('is_active', true)
    .maybeSingle();
  return data?.admin_role === 'super_admin';
}

export async function handler(req, res, path, ctx) {
  if (req.method === 'GET' && (path === 'class_sequence' || path === 'pharmacy_programs')) {
    if (path === 'class_sequence') {
      const { track } = req.query;
      if (!track) throw new SecurityError('track required', 400);
      const { data, error } = await supabase
        .from('class_sequence')
        .select('class_name, sequence_order')
        .eq('track', track)
        .order('sequence_order', { ascending: true });
      if (error) throw new SecurityError('Failed to fetch class sequence', 500);
      return res.status(200).json(data || []);
    }
    if (path === 'pharmacy_programs') {
      const { data, error } = await supabase
        .from('pharmacy_programs')
        .select('id, program_name, description, icon, display_order')
        .eq('is_active', true)
        .order('display_order', { ascending: true });
      if (error) throw new SecurityError('Failed to fetch programs', 500);
      return res.status(200).json(data || []);
    }
  }

  requireAuth(ctx);

  if (req.method === 'GET' && path === 'get_profile') {
    const [{ data, error }, isSuperAdmin] = await Promise.all([
      supabase.from('user_profiles').select('*').eq('user_id', ctx.userId).maybeSingle(),
      detectSuperAdmin(ctx.userId)
    ]);
    if (error) throw new SecurityError('Failed to fetch profile', 500);
    const base = data || { role: 'student', track: null, class_name: null, onboarding_completed: false };
    return res.status(200).json({ ...base, is_super_admin: isSuperAdmin });
  }

  if (req.method === 'POST' && path === 'save_onboarding') {
    const body = await parseAndValidateBody(req);
    const { role, track, class_name, contribute_track, contribute_class_name, contribute_subjects } = body;

    if (!class_name) throw new SecurityError('class_name is required', 400);
    if (typeof class_name !== 'string' || class_name.length > 100) throw new SecurityError('Invalid class_name', 400);

    const { data: existing } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', ctx.userId)
      .maybeSingle();

    const isCompleted = existing?.onboarding_completed;

    if (isCompleted) {
      if (role && role !== existing.role) throw new SecurityError('Cannot change role after onboarding', 400);
      if (track && track !== existing.track) throw new SecurityError('Level (track) cannot be changed through this endpoint. Please submit a level change request.', 400);
    } else {
      if (!role || !track) throw new SecurityError('role and track are required for initial onboarding', 400);
      if (!['student', 'teacher'].includes(role)) throw new SecurityError('Invalid role', 400);
      if (!TRACK_RANK.hasOwnProperty(track)) throw new SecurityError('Invalid track', 400);
    }

    const effectiveRole = role || existing?.role;
    const effectiveTrack = track || existing?.track;

    if (!effectiveRole || !effectiveTrack) throw new SecurityError('Role and track must be set', 400);

    const { data: validClass } = await supabase
      .from('class_sequence')
      .select('sequence_order')
      .eq('track', effectiveTrack)
      .eq('class_name', class_name)
      .maybeSingle();
    if (!validClass) throw new SecurityError('Invalid track/class combination', 400);

    const payload = {
      role: effectiveRole,
      track: effectiveTrack,
      class_name,
      onboarding_completed: true,
      updated_at: new Date().toISOString()
    };

    if (effectiveRole === 'teacher') {
      const ct = contribute_track || existing?.contribute_track;
      if (ct && !TRACK_RANK.hasOwnProperty(ct)) throw new SecurityError('Invalid contribute_track', 400);
      payload.contribute_track = ct || effectiveTrack;
      payload.contribute_class_name = contribute_class_name || existing?.contribute_class_name || class_name;
      payload.contribute_subjects = Array.isArray(contribute_subjects) ? contribute_subjects.slice(0, 20) : (existing?.contribute_subjects || []);
    }

    if (existing) {
      const { data, error } = await supabase
        .from('user_profiles')
        .update(payload)
        .eq('user_id', ctx.userId)
        .select()
        .single();
      if (error) throw new SecurityError('Failed to update profile', 500);
      return res.status(200).json(data);
    }

    const { data, error } = await supabase
      .from('user_profiles')
      .insert({ ...payload, user_id: ctx.userId })
      .select()
      .single();
    if (error) throw new SecurityError('Failed to save profile', 500);
    return res.status(200).json(data);
  }

  if (req.method === 'POST' && path === 'admin_update_profile') {
    requireSuperAdmin(ctx);
    const body = await parseAndValidateBody(req);
    const { user_id, track, class_name } = body;
    if (!user_id || !track || !class_name) throw new SecurityError('user_id, track, and class_name are required', 400);
    if (!TRACK_RANK.hasOwnProperty(track)) throw new SecurityError('Invalid track', 400);

    const { data: validClass } = await supabase
      .from('class_sequence')
      .select('sequence_order')
      .eq('track', track)
      .eq('class_name', class_name)
      .maybeSingle();
    if (!validClass) throw new SecurityError('Invalid track/class combination', 400);

    const { error } = await supabase
      .from('user_profiles')
      .update({ track, class_name, updated_at: new Date().toISOString() })
      .eq('user_id', user_id);
    if (error) throw new SecurityError('Failed to update profile', 500);

    await createNotification(user_id, 'level_change_approved', { track, class_name });
    return res.status(200).json({ success: true });
  }

  if (req.method === 'POST' && path === 'request_level_change') {
    const body = await parseAndValidateBody(req);
    const { requested_track, requested_class, reason } = body;

    if (!requested_track || !requested_class) throw new SecurityError('requested_track and requested_class are required', 400);
    if (!TRACK_RANK.hasOwnProperty(requested_track)) throw new SecurityError('Invalid requested_track', 400);
    if (!reason || typeof reason !== 'string' || reason.trim().length < 10) {
      throw new SecurityError('A reason of at least 10 characters is required', 400);
    }

    const { data: validClass } = await supabase
      .from('class_sequence')
      .select('sequence_order')
      .eq('track', requested_track)
      .eq('class_name', requested_class)
      .maybeSingle();
    if (!validClass) throw new SecurityError('Invalid track/class combination', 400);

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', ctx.userId)
      .maybeSingle();
    if (!profile) throw new SecurityError('Complete onboarding first', 400);
    if (profile.role === 'teacher') throw new SecurityError('Teachers are not restricted by level and do not need level change requests', 400);

    const isSuperAdmin = await detectSuperAdmin(ctx.userId);
    if (isSuperAdmin) throw new SecurityError('Super admins should use admin_update_profile directly', 400);

    const { data: existing } = await supabase
      .from('level_change_requests')
      .select('id, status, created_at')
      .eq('user_id', ctx.userId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (existing && existing.length > 0) {
      const last = existing[0];
      if (last.status === 'pending') {
        throw new SecurityError('You already have a pending level change request', 400);
      }
      const daysSince = (Date.now() - new Date(last.created_at).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince < REQUEST_COOLDOWN_DAYS) {
        const daysLeft = Math.ceil(REQUEST_COOLDOWN_DAYS - daysSince);
        throw new SecurityError(`You can request a level change again in ${daysLeft} day${daysLeft > 1 ? 's' : ''}.`, 429);
      }
    }

    const { error } = await supabase
      .from('level_change_requests')
      .insert({
        user_id: ctx.userId,
        requested_track,
        requested_class,
        reason: reason.trim().slice(0, 500),
        status: 'pending',
        created_at: new Date().toISOString()
      });
    if (error) throw new SecurityError('Failed to submit request', 500);
    return res.status(200).json({ success: true });
  }

  if (req.method === 'GET' && path === 'level_change_status') {
    const { data, error } = await supabase
      .from('level_change_requests')
      .select('id, requested_track, requested_class, status, created_at, resolved_at')
      .eq('user_id', ctx.userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new SecurityError('Failed to fetch level change status', 500);
    return res.status(200).json(data || null);
  }

  if (req.method === 'GET' && path === 'pending_level_changes') {
    requireSuperAdmin(ctx);
    const { data, error } = await supabase
      .from('level_change_requests')
      .select('id, user_id, requested_track, requested_class, reason, created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });
    if (error) throw new SecurityError('Failed to fetch pending requests', 500);

    const enriched = [];
    for (const r of (data || [])) {
      try {
        const { data: { user } } = await supabase.auth.admin.getUserById(r.user_id);
        enriched.push({ ...r, user_email: user?.email || 'Unknown' });
      } catch {
        enriched.push({ ...r, user_email: 'Unknown' });
      }
    }
    return res.status(200).json(enriched);
  }

  if (req.method === 'POST' && path === 'review_level_change') {
    requireSuperAdmin(ctx);
    const body = await parseAndValidateBody(req);
    const { request_id, action } = body;
    if (!request_id || !['approve', 'reject'].includes(action)) throw new SecurityError('request_id and valid action are required', 400);

    const { data: reqRow, error: fetchError } = await supabase
      .from('level_change_requests')
      .select('id, user_id, requested_track, requested_class, status')
      .eq('id', request_id)
      .maybeSingle();
    if (fetchError || !reqRow) throw new SecurityError('Request not found', 404);
    if (reqRow.status !== 'pending') throw new SecurityError('Request has already been resolved', 409);

    const adminId = ctx.adminData?.admin_id || ctx.userId;

    if (action === 'approve') {
      const { error: profileError } = await supabase
        .from('user_profiles')
        .update({ track: reqRow.requested_track, class_name: reqRow.requested_class, updated_at: new Date().toISOString() })
        .eq('user_id', reqRow.user_id);
      if (profileError) throw new SecurityError('Failed to update user profile', 500);

      await createNotification(reqRow.user_id, 'level_change_approved', {
        track: reqRow.requested_track,
        class_name: reqRow.requested_class
      });
    } else {
      await createNotification(reqRow.user_id, 'level_change_rejected', {
        track: reqRow.requested_track,
        class_name: reqRow.requested_class
      });
    }

    const { error: updateError } = await supabase
      .from('level_change_requests')
      .update({ status: action === 'approve' ? 'approved' : 'rejected', admin_id: adminId, resolved_at: new Date().toISOString() })
      .eq('id', request_id);
    if (updateError) throw new SecurityError('Failed to resolve request', 500);
    return res.status(200).json({ success: true });
  }

  throw new SecurityError('Invalid path', 400);
}

export async function canAccessContent(userId, contentTrack, contentClassName) {
  if (!contentClassName) return { allowed: true, reason: 'unscoped_content' };

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, track, class_name')
    .eq('user_id', userId)
    .maybeSingle();

  if (!profile) return { allowed: false, reason: 'onboarding_required' };
  if (profile.role === 'teacher') return { allowed: true, reason: 'teacher' };

  const contentTrackRank = TRACK_RANK[contentTrack];
  const ownTrackRank = TRACK_RANK[profile.track];

  if (contentTrackRank < ownTrackRank) return { allowed: true, reason: 'recap_lower_track' };
  if (contentTrackRank > ownTrackRank) return { allowed: false, reason: 'higher_track_locked' };

  const [{ data: contentSeq }, { data: ownSeq }] = await Promise.all([
    supabase.from('class_sequence').select('sequence_order').eq('track', contentTrack).eq('class_name', contentClassName).maybeSingle(),
    supabase.from('class_sequence').select('sequence_order').eq('track', profile.track).eq('class_name', profile.class_name).maybeSingle()
  ]);

  if (!contentSeq || !ownSeq) return { allowed: true, reason: 'unmapped_class' };
  if (contentSeq.sequence_order <= ownSeq.sequence_order) return { allowed: true, reason: 'current_or_recap_class' };
  return { allowed: false, reason: 'class_not_yet_unlocked' };
}

export async function checkAndAdvanceClass(userId, track, className) {
  const { data: profile } = await supabase.from('user_profiles').select('role, track, class_name').eq('user_id', userId).maybeSingle();
  if (!profile || profile.role === 'teacher') return null;
  if (profile.track !== track || profile.class_name !== className) return null;

  const { data: topics } = await supabase
    .from('quiz_topics')
    .select('topic_name')
    .eq('level', track)
    .eq('class_name', className)
    .eq('is_active', true);

  if (!topics || topics.length === 0) return null;

  for (const t of topics) {
    const { count: questionCount } = await supabase
      .from('quiz_questions')
      .select('id', { count: 'exact', head: true })
      .eq('level', track)
      .eq('topic', t.topic_name);

    const totalBlocks = Math.ceil((questionCount || 0) / 10);
    if (totalBlocks === 0) continue;

    const { data: activity } = await supabase
      .from('user_quiz_activity')
      .select('block_number')
      .eq('user_id', userId)
      .eq('level', track)
      .eq('topic', t.topic_name)
      .eq('passed', true);

    const completedBlocks = new Set((activity || []).map(a => a.block_number));
    for (let i = 0; i < totalBlocks; i++) {
      if (!completedBlocks.has(i)) return null;
    }
  }

  const { data: sequence } = await supabase
    .from('class_sequence')
    .select('class_name, sequence_order')
    .eq('track', track)
    .order('sequence_order', { ascending: true });

  const currentIdx = (sequence || []).findIndex(c => c.class_name === className);
  if (currentIdx === -1 || currentIdx === sequence.length - 1) {
    return { trackCompleted: true, newTrack: track, newClassName: className };
  }

  const next = sequence[currentIdx + 1];
  await supabase
    .from('user_profiles')
    .update({ class_name: next.class_name, updated_at: new Date().toISOString() })
    .eq('user_id', userId);

  await createNotification(userId, 'class_advanced', { track, class_name: next.class_name });

  return { trackCompleted: false, newTrack: track, newClassName: next.class_name };
}
