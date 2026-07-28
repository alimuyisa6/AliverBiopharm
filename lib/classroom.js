 import { supabase, getUserProfileName } from './core.js';
import { parseAndValidateBody, requireAuth, requireAdmin, SecurityError } from './security-middleware.js';
import { createNotification } from './notifications.js';
import { getUserCurriculumScope } from './curriculum.js';

export async function handler(req, res, path, ctx) {
  if (req.method === 'GET') {
    switch (path) {
      case 'levels': return getLevels(req, res);
      case 'topics': return getTopics(req, res);
      case 'list': return listClassrooms(req, res, ctx);
      case 'live_feed': return getLiveFeed(req, res, ctx);
      case 'room': return getRoom(req, res, ctx);
      case 'messages': return getMessages(req, res);
      case 'participants': return getParticipants(req, res);
      case 'tutor_status': requireAuth(ctx); return getTutorStatus(req, res, ctx);
      case 'tutor_rooms': requireAuth(ctx); return getTutorRooms(req, res, ctx);
      case 'onboarding_status': requireAuth(ctx); return getOnboardingStatus(req, res, ctx);
      case 'admin_list_rooms': requireAdmin(ctx); return adminListRooms(req, res, ctx);
      case 'admin_list_applications': requireAdmin(ctx); return adminListApplications(req, res, ctx);
      case 'admin_list_complaints': requireAdmin(ctx); return adminListComplaints(req, res, ctx);
      default: throw new SecurityError('Invalid action', 400);
    }
  }

  if (req.method === 'POST') {
    requireAuth(ctx);
    const body = await parseAndValidateBody(req);
    switch (path) {
      case 'create': return createRoom(body, res, ctx);
      case 'join': return joinClassroom(body, res, ctx);
      case 'leave': return leaveClassroom(body, res, ctx);
      case 'send_message': return sendMessage(body, res, ctx);
      case 'raise_hand': return raiseHand(body, res, ctx);
      case 'tutor_apply': return applyAsTutor(body, res, ctx);
      case 'tutor_review': return reviewTutorApplication(body, res, ctx);
      case 'toggle_mute': return toggleMute(body, res, ctx);
      case 'end_room': return endRoom(body, res, ctx);
      case 'share_resource': return shareResource(body, res, ctx);
      case 'file_complaint': return fileComplaint(body, res, ctx);
      case 'save_onboarding': return saveOnboarding(body, res, ctx);
      case 'admin_resolve_complaint': requireAdmin(ctx); return adminResolveComplaint(body, res, ctx);
      default: throw new SecurityError('Invalid action', 400);
    }
  }

  throw new SecurityError('Method not allowed', 405);
}

async function getLevels(req, res) {
  const { data: levels } = await supabase
    .from('curriculum_levels')
    .select('id, display_name, kind, group_label, unit_label, icon, color')
    .order('display_order');
  const result = [];
  for (const level of (levels || [])) {
    const { data: groups } = await supabase
      .from('curriculum_groups')
      .select('id, name, description, icon')
      .eq('level_id', level.id)
      .eq('is_active', true)
      .order('sequence_order');
    result.push({
      key: level.id,
      display_name: level.display_name,
      icon: level.icon,
      classes: (groups || []).map(g => ({ id: g.id, name: g.name, description: g.description, icon: g.icon }))
    });
  }
  return res.status(200).json(result);
}

async function getTopics(req, res) {
  const { group_id, level } = req.query;
  if (!group_id && !level) throw new SecurityError('group_id or level required', 400);
  let groupIds = [];
  if (group_id) {
    groupIds = [group_id];
  } else {
    const { data: groups } = await supabase.from('curriculum_groups').select('id').eq('level_id', level).eq('is_active', true);
    groupIds = (groups || []).map(g => g.id);
    if (!groupIds.length) return res.status(200).json([]);
  }
  const { data } = await supabase
    .from('curriculum_units')
    .select('id, name, code, icon, is_hard_topic, display_order')
    .in('group_id', groupIds)
    .eq('is_active', true)
    .order('display_order');
  return res.status(200).json((data || []).map(u => ({
    id: u.id,
    topic_name: u.name,
    unit_code: u.code,
    icon: u.icon,
    is_hard_topic: u.is_hard_topic
  })));
}

async function listClassrooms(req, res, ctx) {
  const { unit_id, group_id } = req.query;
  if (!unit_id && !group_id) throw new SecurityError('unit_id or group_id required', 400);

  let unitIds = [];
  if (group_id) {
    const { data: units } = await supabase.from('curriculum_units').select('id').eq('group_id', group_id).eq('is_active', true);
    unitIds = (units || []).map(u => u.id);
    if (!unitIds.length) return res.status(200).json([]);
  } else if (unit_id) {
    unitIds = [unit_id];
  }

  const { data, error } = await supabase
    .from('classrooms')
    .select('*')
    .in('unit_id', unitIds)
    .not('status', 'in', '("ended","offline")')
    .order('created_at', { ascending: false });

  if (error) throw new SecurityError('Failed to fetch classrooms', 500);

  const reconciled = [];
  for (const room of (data || [])) {
    if (room.tutor_id) {
      const { data: app } = await supabase
        .from('tutor_applications')
        .select('status')
        .eq('user_id', room.tutor_id)
        .eq('status', 'approved')
        .maybeSingle();
      if (!app) continue;
    }
    const derived = deriveStatus(room);
    if (derived.status !== room.status) {
      await supabase.from('classrooms').update(derived).eq('id', room.id);
      room.status = derived.status;
      room.started_at = derived.started_at;
    }
    reconciled.push(withDuration(room));
  }

  const tutorIds = [...new Set(reconciled.map(r => r.tutor_id).filter(Boolean))];
  const tutorNames = {};
  for (const tid of tutorIds) {
    const { data: app } = await supabase
      .from('tutor_applications')
      .select('display_name')
      .eq('user_id', tid)
      .eq('status', 'approved')
      .maybeSingle();
    tutorNames[tid] = app?.display_name || null;
  }

  return res.status(200).json(reconciled.map(r => ({ ...r, tutor_name: tutorNames[r.tutor_id] || null })));
}

function deriveStatus(room) {
  const now = new Date();
  if (room.status === 'ended' || room.status === 'offline') return { status: room.status, started_at: room.started_at };
  if (room.room_type === 'free') return { status: 'open_floor', started_at: room.started_at || room.created_at };
  if (!room.scheduled_at) return { status: 'live', started_at: room.started_at || room.created_at };
  const scheduled = new Date(room.scheduled_at);
  return scheduled > now ? { status: 'upcoming', started_at: null } : { status: 'live', started_at: room.started_at || room.scheduled_at };
}

function withDuration(room) {
  if (room.status === 'live' || room.status === 'open_floor') {
    if (room.started_at) room.live_duration_seconds = Math.max(0, Math.floor((Date.now() - new Date(room.started_at).getTime()) / 1000));
  } else if (room.status === 'upcoming' && room.scheduled_at) {
    room.starts_in_seconds = Math.max(0, Math.floor((new Date(room.scheduled_at).getTime() - Date.now()) / 1000));
  }
  return room;
}

async function getLiveFeed(req, res, ctx) {
  let unitIds = [];
  if (ctx.authenticated) {
    const scope = await getUserCurriculumScope(ctx.userId);
    if (scope && scope.level) {
      const { data: groups } = await supabase.from('curriculum_groups').select('id').eq('level_id', scope.level);
      const groupIds = (groups || []).map(g => g.id);
      if (groupIds.length) {
        const { data: units } = await supabase.from('curriculum_units').select('id').in('group_id', groupIds);
        unitIds = (units || []).map(u => u.id);
      }
    }
  }
  let query = supabase.from('classrooms').select('*').in('status', ['live', 'open_floor', 'upcoming']).order('created_at', { ascending: false }).limit(12);
  if (unitIds.length) query = query.in('unit_id', unitIds);
  const { data } = await query;
  if (!data) return res.status(200).json([]);
  const reconciled = [];
  for (const room of data) {
    const derived = deriveStatus(room);
    if (derived.status !== room.status) {
      await supabase.from('classrooms').update(derived).eq('id', room.id);
      room.status = derived.status;
      room.started_at = derived.started_at;
    }
    reconciled.push(withDuration(room));
  }
  return res.status(200).json(reconciled);
}

async function getRoom(req, res, ctx) {
  const { room_id } = req.query;
  if (!room_id) throw new SecurityError('room_id required', 400);
  const { data: room } = await supabase.from('classrooms').select('*').eq('id', room_id).maybeSingle();
  if (!room) throw new SecurityError('Room not found', 404);
  const derived = deriveStatus(room);
  if (derived.status !== room.status) {
    await supabase.from('classrooms').update(derived).eq('id', room.id);
    room.status = derived.status;
    room.started_at = derived.started_at;
  }
  return res.status(200).json(withDuration(room));
}

async function getMessages(req, res) {
  const { room_id } = req.query;
  if (!room_id) throw new SecurityError('room_id required', 400);
  const { data } = await supabase.from('classroom_messages').select('*').eq('room_id', room_id).order('created_at', { ascending: true }).limit(100);
  const userIds = [...new Set((data || []).map(m => m.user_id))];
  const nameMap = {};
  for (const uid of userIds) {
    try { const { data: { user } } = await supabase.auth.admin.getUserById(uid); nameMap[uid] = user?.user_metadata?.full_name || 'User'; }
    catch { nameMap[uid] = 'User'; }
  }
  return res.status(200).json((data || []).map(m => ({ ...m, sender_name: nameMap[m.user_id] || 'User' })));
}

async function getParticipants(req, res) {
  const { room_id } = req.query;
  if (!room_id) throw new SecurityError('room_id required', 400);
  const { data } = await supabase.from('classroom_participants').select('*').eq('room_id', room_id).is('left_at', null);
  return res.status(200).json(data || []);
}

async function getTutorStatus(req, res, ctx) {
  const { data } = await supabase.from('tutor_applications').select('*').eq('user_id', ctx.userId).order('created_at', { ascending: false }).limit(1).maybeSingle();
  return res.status(200).json({ application: data || null });
}

async function getTutorRooms(req, res, ctx) {
  const { data } = await supabase.from('classrooms').select('*').eq('tutor_id', ctx.userId).not('status', 'in', '("ended","offline")').order('created_at', { ascending: false });
  return res.status(200).json({ rooms: data || [] });
}

async function getOnboardingStatus(req, res, ctx) {
  const { data } = await supabase.from('classroom_onboarding').select('*').eq('user_id', ctx.userId).order('created_at', { ascending: false }).limit(1).maybeSingle();
  return res.status(200).json({ onboarding: data || null });
}

async function saveOnboarding(body, res, ctx) {
  const { level, class_name, topic } = body;
  if (!level || !class_name) throw new SecurityError('level and class_name required', 400);
  const { data: group } = await supabase.from('curriculum_groups').select('id').eq('level_id', level).eq('name', class_name).maybeSingle();
  if (!group) throw new SecurityError('Invalid class/programme', 400);
  await supabase.from('user_profiles').update({
    track: level,
    class_name,
    onboarding_completed: true,
    active_level_id: level,
    active_group_id: group.id,
    updated_at: new Date().toISOString()
  }).eq('user_id', ctx.userId);
  await supabase.from('classroom_onboarding').insert({ user_id: ctx.userId, level, class_name, selected_topic: topic || null, has_completed_onboarding: true });
  return res.status(200).json({ success: true });
}

async function createRoom(body, res, ctx) {
  const { title, unit_id, room_type, scheduled_at } = body;
  if (!title || !unit_id || !room_type) throw new SecurityError('title, unit_id, room_type required', 400);
  if (!['free', 'hard_topic', 'premium'].includes(room_type)) throw new SecurityError('Invalid room_type', 400);

  const { data: profile } = await supabase.from('user_profiles').select('is_approved_teacher, approved_track').eq('user_id', ctx.userId).maybeSingle();
  if (!profile?.is_approved_teacher && !ctx.adminData) throw new SecurityError('Only approved tutors and admins can create rooms', 403);

  const status = room_type === 'free' ? 'open_floor' : (new Date(scheduled_at) > new Date() ? 'upcoming' : 'live');
  const startedAt = status === 'live' || status === 'open_floor' ? new Date().toISOString() : null;

  const { data, error } = await supabase.from('classrooms').insert({
    title, unit_id, room_type, tutor_id: ctx.userId, status,
    scheduled_at: scheduled_at || null, started_at: startedAt,
    participant_count: 0, created_at: new Date().toISOString()
  }).select().single();
  if (error) throw new SecurityError('Failed to create room', 500);
  await supabase.from('classroom_participants').insert({ room_id: data.id, user_id: ctx.userId, role: 'tutor', is_muted: false });
  return res.status(200).json(data);
}

async function joinClassroom(body, res, ctx) {
  const { room_id } = body;
  if (!room_id) throw new SecurityError('room_id required', 400);
  const { data: room } = await supabase.from('classrooms').select('id, status, participant_count, max_participants').eq('id', room_id).maybeSingle();
  if (!room) throw new SecurityError('Room not found', 404);
  if (room.status === 'ended' || room.status === 'offline') throw new SecurityError('Room not active', 400);
  if (room.participant_count >= room.max_participants) throw new SecurityError('Room full', 400);

  const { data: existing } = await supabase.from('classroom_participants').select('id, left_at').eq('room_id', room_id).eq('user_id', ctx.userId).maybeSingle();
  if (existing && !existing.left_at) return res.status(200).json({ success: true, already_joined: true });
  if (existing) {
    await supabase.from('classroom_participants').update({ left_at: null, is_muted: true, hand_raised: false }).eq('id', existing.id);
  } else {
    await supabase.from('classroom_participants').insert({ room_id, user_id: ctx.userId, role: 'learner', is_muted: true });
  }
  await supabase.from('classrooms').update({ participant_count: room.participant_count + 1 }).eq('id', room_id);
  await supabase.from('classroom_messages').insert({ room_id, user_id: ctx.userId, content: 'joined the classroom', message_type: 'system' });
  return res.status(200).json({ success: true });
}

async function leaveClassroom(body, res, ctx) {
  const { room_id } = body;
  if (!room_id) throw new SecurityError('room_id required', 400);
  await supabase.from('classroom_participants').update({ left_at: new Date().toISOString(), hand_raised: false }).eq('room_id', room_id).eq('user_id', ctx.userId).is('left_at', null);
  const { data: room } = await supabase.from('classrooms').select('participant_count').eq('id', room_id).maybeSingle();
  if (room) await supabase.from('classrooms').update({ participant_count: Math.max(0, (room.participant_count || 1) - 1) }).eq('id', room_id);
  await supabase.from('classroom_messages').insert({ room_id, user_id: ctx.userId, content: 'left the classroom', message_type: 'system' });
  return res.status(200).json({ success: true });
}

async function sendMessage(body, res, ctx) {
  const { room_id, message } = body;
  if (!room_id || !message?.trim()) throw new SecurityError('room_id and message required', 400);
  const { data: participant } = await supabase.from('classroom_participants').select('is_muted').eq('room_id', room_id).eq('user_id', ctx.userId).is('left_at', null).maybeSingle();
  if (!participant) throw new SecurityError('You must join the room first', 403);
  if (participant.is_muted) throw new SecurityError('You are muted', 403);
  await supabase.from('classroom_messages').insert({ room_id, user_id: ctx.userId, content: message.trim(), message_type: 'chat' });
  return res.status(200).json({ success: true });
}

async function raiseHand(body, res, ctx) {
  const { room_id, raise } = body;
  if (!room_id) throw new SecurityError('room_id required', 400);
  await supabase.from('classroom_participants').update({ hand_raised: !!raise, hand_raised_at: raise ? new Date().toISOString() : null }).eq('room_id', room_id).eq('user_id', ctx.userId).is('left_at', null);
  return res.status(200).json({ success: true });
}

async function toggleMute(body, res, ctx) {
  const { room_id, target_user_id, mute } = body;
  if (!room_id || !target_user_id) throw new SecurityError('room_id and target_user_id required', 400);
  const { data: actor } = await supabase.from('classroom_participants').select('role').eq('room_id', room_id).eq('user_id', ctx.userId).is('left_at', null).maybeSingle();
  if (!actor || (actor.role !== 'tutor' && actor.role !== 'admin')) throw new SecurityError('Only tutors/admins can mute', 403);
  await supabase.from('classroom_participants').update({ is_muted: !!mute }).eq('room_id', room_id).eq('user_id', target_user_id);
  return res.status(200).json({ success: true });
}

async function endRoom(body, res, ctx) {
  const { room_id } = body;
  if (!room_id) throw new SecurityError('room_id required', 400);
  const { data: room } = await supabase.from('classrooms').select('tutor_id').eq('id', room_id).maybeSingle();
  if (!room) throw new SecurityError('Room not found', 404);
  if (room.tutor_id !== ctx.userId && !ctx.adminData) throw new SecurityError('Only the tutor or admin can end the room', 403);
  await supabase.from('classrooms').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', room_id);
  await supabase.from('classroom_participants').update({ left_at: new Date().toISOString(), hand_raised: false }).eq('room_id', room_id).is('left_at', null);
  await supabase.from('classroom_messages').insert({ room_id, user_id: ctx.userId, content: 'The session has ended', message_type: 'system' });
  return res.status(200).json({ success: true });
}

async function shareResource(body, res, ctx) {
  const { room_id, file_url, file_name, file_size } = body;
  if (!room_id || !file_url || !file_name) throw new SecurityError('room_id, file_url, file_name required', 400);
  const { data: participant } = await supabase.from('classroom_participants').select('role').eq('room_id', room_id).eq('user_id', ctx.userId).is('left_at', null).maybeSingle();
  if (!participant || (participant.role !== 'tutor' && participant.role !== 'admin')) throw new SecurityError('Only tutors can share', 403);
  await supabase.from('classroom_messages').insert({ room_id, user_id: ctx.userId, content: `Shared: ${file_name}`, message_type: 'resource', file_url, file_name, file_size });
  return res.status(200).json({ success: true });
}

async function fileComplaint(body, res, ctx) {
  const { room_id, complaint_type, description } = body;
  if (!complaint_type || !description) throw new SecurityError('complaint_type and description required', 400);
  await supabase.from('classroom_complaints').insert({ user_id: ctx.userId, room_id: room_id || null, complaint_type, description, status: 'pending' });
  return res.status(200).json({ success: true });
}

async function applyAsTutor(body, res, ctx) {
  const { level, class_name, subjects, qualifications, experience } = body;
  if (!level || !class_name || !subjects?.length) throw new SecurityError('level, class_name, subjects required', 400);
  const { data: existing } = await supabase.from('tutor_applications').select('id').eq('user_id', ctx.userId).in('status', ['pending', 'scheduled', 'interviewed']).maybeSingle();
  if (existing) throw new SecurityError('You already have a pending application', 400);
  await supabase.from('user_profiles').update({ role: 'teacher', track: level, class_name, is_approved_teacher: false }).eq('user_id', ctx.userId);
  await supabase.from('tutor_applications').insert({ user_id: ctx.userId, level, class_name, subjects, qualifications, experience, status: 'pending' });
  return res.status(200).json({ success: true });
}

async function reviewTutorApplication(body, res, ctx) {
  if (!ctx.adminData) throw new SecurityError('Admin only', 403);
  const { application_id, action, ...extra } = body;
  if (!application_id || !action) throw new SecurityError('application_id and action required', 400);
  const { data: app } = await supabase.from('tutor_applications').select('user_id, level').eq('id', application_id).maybeSingle();
  if (!app) throw new SecurityError('Application not found', 404);
  if (action === 'approve') {
    await supabase.from('tutor_applications').update({ status: 'approved', is_approved: true, approved_by: ctx.userId, approved_at: new Date().toISOString(), display_name: extra.display_name, hourly_rate: extra.hourly_rate }).eq('id', application_id);
    await supabase.from('user_profiles').update({ is_approved_teacher: true, approved_track: extra.approved_track || app.level, approved_by: ctx.userId, approved_at: new Date().toISOString() }).eq('user_id', app.user_id);
  } else if (action === 'reject') {
    await supabase.from('tutor_applications').update({ status: 'rejected', is_approved: false, rejection_reason: extra.rejection_reason }).eq('id', application_id);
    await supabase.from('user_profiles').update({ is_approved_teacher: false, approval_notes: extra.rejection_reason || 'Rejected' }).eq('user_id', app.user_id);
  } else {
    const updates = { admin_id: ctx.userId };
    if (action === 'schedule') updates.status = 'scheduled', updates.interview_scheduled_at = extra.interview_scheduled_at;
    else if (action === 'mark_interviewed') updates.status = 'interviewed';
    await supabase.from('tutor_applications').update(updates).eq('id', application_id);
  }
  await createNotification(app.user_id, 'tutor_application_update', { status: action });
  return res.status(200).json({ success: true });
}

async function adminListRooms(req, res, ctx) {
  const { status } = req.query;
  let query = supabase.from('classrooms').select('*').order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);
  const { data } = await query;
  return res.status(200).json(data || []);
}

async function adminListApplications(req, res, ctx) {
  const { status } = req.query;
  let query = supabase.from('tutor_applications').select('*').order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);
  const { data } = await query;
  return res.status(200).json(data || []);
}

async function adminListComplaints(req, res, ctx) {
  const { status } = req.query;
  let query = supabase.from('classroom_complaints').select('*').order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);
  const { data } = await query;
  return res.status(200).json(data || []);
}

async function adminResolveComplaint(body, res, ctx) {
  const { complaint_id, status, resolution } = body;
  if (!complaint_id || !status) throw new SecurityError('complaint_id and status required', 400);
  await supabase.from('classroom_complaints').update({ status, resolution, admin_id: ctx.userId, resolved_at: new Date().toISOString() }).eq('id', complaint_id);
  return res.status(200).json({ success: true });
}
