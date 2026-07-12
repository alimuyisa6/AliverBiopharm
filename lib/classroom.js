 import { supabase } from './core.js';
import { parseAndValidateBody, requireAuth, requireAdmin, SecurityError } from './security-middleware.js';
import { createNotification } from './notifications.js';

const LEVEL_STRUCTURE = {
  'O-Level': { classes: ['Form 1', 'Form 2', 'Form 3', 'Form 4'], icon: 'fa-seedling' },
  'A-Level': { classes: ['Form 5', 'Form 6'], icon: 'fa-layer-group' },
};

export async function handler(req, res, path, ctx) {
  if (req.method === 'GET') {
    switch (path) {
      case 'levels': return getLevels(req, res);
      case 'topics': return getTopics(req, res);
      case 'list': return listClassrooms(req, res);
      case 'live_feed': return getLiveFeed(req, res);
      case 'room': return getRoom(req, res);
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
  const { data: programs, error } = await supabase
    .from('pharmacy_programs')
    .select('id, program_name, description, icon, display_order')
    .eq('is_active', true)
    .order('display_order', { ascending: true });
  if (error) throw new SecurityError('Failed to fetch programs', 500);

  const levels = Object.entries(LEVEL_STRUCTURE).map(([key, data]) => ({
    key,
    classes: data.classes,
    icon: data.icon,
  }));

  levels.push({
    key: 'Pharmacy',
    classes: (programs || []).map(p => ({ id: p.id, name: p.program_name, description: p.description, icon: p.icon })),
    icon: 'fa-mortar-pestle',
  });

  return res.status(200).json(levels);
}

async function getTopics(req, res) {
  const { level, class_name } = req.query;
  if (!level) throw new SecurityError('level required', 400);

  if (level === 'Pharmacy') {
    if (!class_name) throw new SecurityError('class_name required for Pharmacy', 400);
    const { data, error } = await supabase
      .from('pharmacy_course_units')
      .select('id, unit_name, unit_code, is_hard_topic')
      .eq('program_id', class_name)
      .eq('is_active', true)
      .order('display_order', { ascending: true });
    if (error) throw new SecurityError('Failed to fetch course units', 500);
    return res.status(200).json((data || []).map(t => ({
      id: t.id, topic_name: t.unit_name, unit_code: t.unit_code, is_hard_topic: t.is_hard_topic,
    })));
  }

  const { data, error } = await supabase
    .from('quiz_topics')
    .select('id, topic_name, icon, is_hard_topic')
    .eq('level', level)
    .eq('is_active', true)
    .order('display_order', { ascending: true });
  if (error) throw new SecurityError('Failed to fetch topics', 500);
  return res.status(200).json((data || []).map(t => ({
    id: t.topic_name, topic_name: t.topic_name, icon: t.icon, is_hard_topic: t.is_hard_topic,
  })));
}

function deriveStatus(room) {
  const now = new Date();
  if (room.status === 'ended' || room.status === 'offline') {
    return { status: room.status, started_at: room.started_at };
  }
  if (room.room_type === 'free') {
    return { status: 'open_floor', started_at: room.started_at || room.created_at };
  }
  if (!room.scheduled_at) {
    return { status: 'live', started_at: room.started_at || room.created_at };
  }
  const scheduled = new Date(room.scheduled_at);
  if (scheduled > now) return { status: 'upcoming', started_at: null };
  return { status: 'live', started_at: room.started_at || room.scheduled_at };
}

async function reconcileRoom(room) {
  const derived = deriveStatus(room);
  if (derived.status !== room.status || (derived.started_at && !room.started_at)) {
    await supabase
      .from('classrooms')
      .update({ status: derived.status, started_at: derived.started_at })
      .eq('id', room.id);
    room.status = derived.status;
    room.started_at = derived.started_at;
  }
  return room;
}

function withDuration(room) {
  const out = { ...room };
  if (room.status === 'live' || room.status === 'open_floor') {
    if (room.started_at) {
      out.live_duration_seconds = Math.max(0, Math.floor((Date.now() - new Date(room.started_at).getTime()) / 1000));
    }
  } else if (room.status === 'upcoming' && room.scheduled_at) {
    out.starts_in_seconds = Math.max(0, Math.floor((new Date(room.scheduled_at).getTime() - Date.now()) / 1000));
  }
  return out;
}

async function getTutorDisplayName(tutorId) {
  if (!tutorId) return null;
  const { data } = await supabase
    .from('tutor_applications')
    .select('display_name')
    .eq('user_id', tutorId)
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.display_name || null;
}

async function attachTutorNames(rooms) {
  const tutorCache = {};
  const out = [];
  for (const room of rooms) {
    const roomData = { ...room };
    if (room.tutor_id) {
      if (!tutorCache[room.tutor_id]) {
        tutorCache[room.tutor_id] = await getTutorDisplayName(room.tutor_id);
      }
      roomData.tutor_name = tutorCache[room.tutor_id] || null;
    }
    out.push(roomData);
  }
  return out;
}

async function listClassrooms(req, res) {
  const { level, class_name, topic_id } = req.query;
  if (!level || !class_name) throw new SecurityError('level and class_name required', 400);

  let query = supabase
    .from('classrooms')
    .select('*')
    .eq('level', level)
    .eq('class_name', class_name)
    .not('status', 'in', '("ended","offline")')
    .order('created_at', { ascending: false });

  if (topic_id) query = query.eq('topic_id', topic_id);

  const { data, error } = await query;
  if (error) throw new SecurityError('Failed to fetch classrooms', 500);

  const filtered = [];
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
    filtered.push(room);
  }

  const reconciled = [];
  for (const room of filtered) reconciled.push(await reconcileRoom(room));

  const withNames = await attachTutorNames(reconciled);
  return res.status(200).json(withNames.map(withDuration));
}

async function getLiveFeed(req, res) {
  const { data, error } = await supabase
    .from('classrooms')
    .select('*')
    .in('status', ['live', 'open_floor', 'upcoming'])
    .order('created_at', { ascending: false })
    .limit(12);
  if (error) throw new SecurityError('Failed to fetch live feed', 500);

  const filtered = [];
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
    filtered.push(room);
  }

  const reconciled = [];
  for (const room of filtered) reconciled.push(await reconcileRoom(room));

  const withNames = await attachTutorNames(reconciled);
  return res.status(200).json(withNames.map(withDuration));
}

async function getRoom(req, res) {
  const { room_id } = req.query;
  if (!room_id) throw new SecurityError('room_id required', 400);

  const { data, error } = await supabase
    .from('classrooms')
    .select('*')
    .eq('id', room_id)
    .maybeSingle();
  if (error || !data) throw new SecurityError('Room not found', 404);

  if (data.tutor_id) {
    const { data: app } = await supabase
      .from('tutor_applications')
      .select('status')
      .eq('user_id', data.tutor_id)
      .eq('status', 'approved')
      .maybeSingle();
    if (!app) throw new SecurityError('Room no longer available', 404);
  }

  const reconciled = await reconcileRoom(data);
  const [withName] = await attachTutorNames([reconciled]);
  return res.status(200).json(withDuration(withName));
}

async function getMessages(req, res) {
  const { room_id } = req.query;
  if (!room_id) throw new SecurityError('room_id required', 400);

  const { data, error } = await supabase
    .from('classroom_messages')
    .select('*')
    .eq('room_id', room_id)
    .order('created_at', { ascending: true })
    .limit(100);
  if (error) throw new SecurityError('Failed to fetch messages', 500);

  const messages = [];
  for (const msg of (data || [])) {
    const msgData = { ...msg };
    try {
      const { data: { user: msgUser } } = await supabase.auth.admin.getUserById(msg.user_id);
      msgData.sender_name = msgUser?.email?.split('@')[0] || 'User';
    } catch {
      msgData.sender_name = 'User';
    }
    messages.push(msgData);
  }

  return res.status(200).json(messages);
}

async function getParticipants(req, res) {
  const { room_id } = req.query;
  if (!room_id) throw new SecurityError('room_id required', 400);

  const { data, error } = await supabase
    .from('classroom_participants')
    .select('*')
    .eq('room_id', room_id)
    .is('left_at', null);
  if (error) throw new SecurityError('Failed to fetch participants', 500);

  const participants = [];
  for (const p of (data || [])) {
    const pData = { ...p };
    try {
      const { data: { user: partUser } } = await supabase.auth.admin.getUserById(p.user_id);
      pData.user_name = partUser?.email?.split('@')[0] || 'User';
    } catch {
      pData.user_name = 'User';
    }
    participants.push(pData);
  }

  return res.status(200).json(participants);
}

async function getTutorStatus(req, res, ctx) {
  const { data } = await supabase
    .from('tutor_applications')
    .select('*')
    .eq('user_id', ctx.userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return res.status(200).json({ application: data || null });
}

async function getTutorRooms(req, res, ctx) {
  const { data, error } = await supabase
    .from('classrooms')
    .select('*')
    .eq('tutor_id', ctx.userId)
    .not('status', 'in', '("ended","offline")')
    .order('created_at', { ascending: false });

  if (error) throw new SecurityError('Failed to fetch rooms', 500);
  return res.status(200).json({ rooms: data || [] });
}

async function getOnboardingStatus(req, res, ctx) {
  const { data, error } = await supabase
    .from('classroom_onboarding')
    .select('*')
    .eq('user_id', ctx.userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new SecurityError('Failed to fetch onboarding status', 500);

  return res.status(200).json({ onboarding: data || null });
}

async function saveOnboarding(body, res, ctx) {
  const { level, class_name, topic } = body;
  if (!level || !class_name) throw new SecurityError('level and class_name required', 400);

  const { data, error } = await supabase
    .from('classroom_onboarding')
    .insert({
      user_id: ctx.userId,
      level,
      class_name,
      selected_topic: topic?.topic_name || topic?.unit_name || topic?.name || null,
      has_completed_onboarding: true,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw new SecurityError('Failed to save onboarding', 500);

  return res.status(200).json({ success: true, onboarding: data });
}

async function isApprovedTutor(userId, level) {
  const { data } = await supabase
    .from('tutor_applications')
    .select('id, status')
    .eq('user_id', userId)
    .eq('level', level)
    .eq('status', 'approved')
    .maybeSingle();
  return !!data;
}

async function isRejectedTutor(userId) {
  const { data } = await supabase
    .from('tutor_applications')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'rejected')
    .maybeSingle();
  return !!data;
}

async function createRoom(body, res, ctx) {
  const { title, level, class_name, topic_id, topic_name, room_type, scheduled_at } = body;
  if (!title || !level || !class_name || !topic_id || !topic_name || !room_type) {
    throw new SecurityError('title, level, class_name, topic_id, topic_name, and room_type required', 400);
  }
  if (!['free', 'hard_topic', 'premium'].includes(room_type)) throw new SecurityError('Invalid room_type', 400);

  if (await isRejectedTutor(ctx.userId)) {
    throw new SecurityError('Your tutor application was rejected. You cannot create rooms.', 403);
  }

  const authorized = !!ctx.adminData || await isApprovedTutor(ctx.userId, level);
  if (!authorized) throw new SecurityError('Only approved tutors and admins can create rooms', 403);

  if ((room_type === 'hard_topic' || room_type === 'premium') && !scheduled_at) {
    throw new SecurityError('scheduled_at required for hard_topic and premium rooms', 400);
  }

  const status = room_type === 'free' ? 'open_floor' : (new Date(scheduled_at) > new Date() ? 'upcoming' : 'live');
  const startedAt = status === 'live' || status === 'open_floor' ? new Date().toISOString() : null;

  const { data, error } = await supabase
    .from('classrooms')
    .insert({
      title, level, class_name, topic_id, topic_name, room_type,
      tutor_id: ctx.userId, status, scheduled_at: scheduled_at || null,
      started_at: startedAt, participant_count: 0,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw new SecurityError('Failed to create room', 500);

  await supabase
    .from('classroom_participants')
    .insert({ room_id: data.id, user_id: ctx.userId, role: ctx.adminData ? 'admin' : 'tutor', is_muted: false, joined_at: new Date().toISOString() });

  return res.status(200).json(data);
}

async function joinClassroom(body, res, ctx) {
  const { room_id } = body;
  if (!room_id) throw new SecurityError('room_id required', 400);

  const { data: room } = await supabase
    .from('classrooms')
    .select('id, status, participant_count, max_participants')
    .eq('id', room_id)
    .maybeSingle();
  if (!room) throw new SecurityError('Room not found', 404);
  if (room.status === 'ended' || room.status === 'offline') throw new SecurityError('Room is not active', 400);
  if (room.participant_count >= room.max_participants) throw new SecurityError('Room is full', 400);

  const { data: existing } = await supabase
    .from('classroom_participants')
    .select('id, left_at')
    .eq('room_id', room_id)
    .eq('user_id', ctx.userId)
    .maybeSingle();

  if (existing && !existing.left_at) {
    return res.status(200).json({ success: true, already_joined: true });
  }

  if (existing && existing.left_at) {
    await supabase
      .from('classroom_participants')
      .update({ left_at: null, is_muted: true, hand_raised: false, joined_at: new Date().toISOString() })
      .eq('id', existing.id);
  } else {
    await supabase
      .from('classroom_participants')
      .insert({ room_id, user_id: ctx.userId, role: 'learner', is_muted: true, hand_raised: false, joined_at: new Date().toISOString() });
  }

  await supabase
    .from('classrooms')
    .update({ participant_count: room.participant_count + 1 })
    .eq('id', room_id);

  await supabase
    .from('classroom_messages')
    .insert({ room_id, user_id: ctx.userId, content: 'joined the classroom', message_type: 'system', created_at: new Date().toISOString() });

  return res.status(200).json({ success: true });
}

async function leaveClassroom(body, res, ctx) {
  const { room_id } = body;
  if (!room_id) throw new SecurityError('room_id required', 400);

  await supabase
    .from('classroom_participants')
    .update({ left_at: new Date().toISOString(), hand_raised: false })
    .eq('room_id', room_id)
    .eq('user_id', ctx.userId)
    .is('left_at', null);

  const { data: room } = await supabase
    .from('classrooms')
    .select('participant_count')
    .eq('id', room_id)
    .maybeSingle();

  if (room) {
    await supabase
      .from('classrooms')
      .update({ participant_count: Math.max(0, (room.participant_count || 1) - 1) })
      .eq('id', room_id);
  }

  await supabase
    .from('classroom_messages')
    .insert({ room_id, user_id: ctx.userId, content: 'left the classroom', message_type: 'system', created_at: new Date().toISOString() });

  return res.status(200).json({ success: true });
}

async function sendMessage(body, res, ctx) {
  const { room_id, message } = body;
  if (!room_id || !message?.trim()) throw new SecurityError('room_id and message required', 400);

  const { data: participant } = await supabase
    .from('classroom_participants')
    .select('id, is_muted')
    .eq('room_id', room_id)
    .eq('user_id', ctx.userId)
    .is('left_at', null)
    .maybeSingle();
  if (!participant) throw new SecurityError('You must join the room first', 403);
  if (participant.is_muted) throw new SecurityError('You are muted in this room', 403);

  const { data, error } = await supabase
    .from('classroom_messages')
    .insert({ room_id, user_id: ctx.userId, content: message.trim(), message_type: 'chat', created_at: new Date().toISOString() })
    .select()
    .single();
  if (error) throw new SecurityError('Failed to send message', 500);

  return res.status(200).json({ success: true, message: data });
}

async function raiseHand(body, res, ctx) {
  const { room_id, raise } = body;
  if (!room_id) throw new SecurityError('room_id required', 400);

  const { error } = await supabase
    .from('classroom_participants')
    .update({ hand_raised: !!raise, hand_raised_at: raise ? new Date().toISOString() : null })
    .eq('room_id', room_id)
    .eq('user_id', ctx.userId)
    .is('left_at', null);
  if (error) throw new SecurityError('Failed to update hand status', 500);

  if (raise) {
    await supabase
      .from('classroom_messages')
      .insert({ room_id, user_id: ctx.userId, content: 'raised their hand', message_type: 'system', created_at: new Date().toISOString() });
  }

  return res.status(200).json({ success: true });
}

async function toggleMute(body, res, ctx) {
  const { room_id, target_user_id, mute } = body;
  if (!room_id || !target_user_id) throw new SecurityError('room_id and target_user_id required', 400);

  const { data: actor } = await supabase
    .from('classroom_participants')
    .select('role')
    .eq('room_id', room_id)
    .eq('user_id', ctx.userId)
    .is('left_at', null)
    .maybeSingle();
  if (!actor || (actor.role !== 'tutor' && actor.role !== 'admin')) throw new SecurityError('Only tutors and admins can mute', 403);

  await supabase
    .from('classroom_participants')
    .update({ is_muted: !!mute })
    .eq('room_id', room_id)
    .eq('user_id', target_user_id);

  return res.status(200).json({ success: true });
}

async function endRoom(body, res, ctx) {
  const { room_id } = body;
  if (!room_id) throw new SecurityError('room_id required', 400);

  const { data: room } = await supabase
    .from('classrooms')
    .select('tutor_id')
    .eq('id', room_id)
    .maybeSingle();
  if (!room) throw new SecurityError('Room not found', 404);

  const isAdmin = !!ctx.adminData;
  if (room.tutor_id !== ctx.userId && !isAdmin) throw new SecurityError('Only the tutor or admin can end the room', 403);

  await supabase
    .from('classrooms')
    .update({ status: 'ended', ended_at: new Date().toISOString() })
    .eq('id', room_id);

  await supabase
    .from('classroom_participants')
    .update({ left_at: new Date().toISOString(), hand_raised: false })
    .eq('room_id', room_id)
    .is('left_at', null);

  await supabase
    .from('classroom_messages')
    .insert({ room_id, user_id: ctx.userId, content: 'The session has ended', message_type: 'system', created_at: new Date().toISOString() });

  const { data: participants } = await supabase
    .from('classroom_participants')
    .select('user_id')
    .eq('room_id', room_id);

  if (participants) {
    for (const p of participants) await createNotification(p.user_id, 'classroom_ended', { room_id });
  }

  return res.status(200).json({ success: true });
}

async function shareResource(body, res, ctx) {
  const { room_id, file_url, file_name, file_size } = body;
  if (!room_id || !file_url || !file_name) throw new SecurityError('room_id, file_url, and file_name required', 400);

  const { data: participant } = await supabase
    .from('classroom_participants')
    .select('role')
    .eq('room_id', room_id)
    .eq('user_id', ctx.userId)
    .is('left_at', null)
    .maybeSingle();
  if (!participant || (participant.role !== 'tutor' && participant.role !== 'admin')) throw new SecurityError('Only tutors can share resources', 403);

  const { data, error } = await supabase
    .from('classroom_messages')
    .insert({ room_id, user_id: ctx.userId, content: `Shared: ${file_name}`, message_type: 'resource', file_url, file_name, file_size, created_at: new Date().toISOString() })
    .select()
    .single();
  if (error) throw new SecurityError('Failed to share resource', 500);

  return res.status(200).json({ success: true, message: data });
}

async function applyAsTutor(body, res, ctx) {
  const { level, class_name, subjects, qualifications, experience } = body;
  if (!level || !class_name || !subjects?.length) throw new SecurityError('level, class_name, and subjects required', 400);

  if (await isRejectedTutor(ctx.userId)) {
    throw new SecurityError('Your previous application was rejected. You cannot reapply.', 403);
  }

  const { data: existing } = await supabase
    .from('tutor_applications')
    .select('id, status')
    .eq('user_id', ctx.userId)
    .in('status', ['pending', 'scheduled', 'interviewed'])
    .maybeSingle();
  if (existing) throw new SecurityError('You already have a pending application', 400);

  const { error } = await supabase
    .from('tutor_applications')
    .insert({ user_id: ctx.userId, level, class_name, subjects, qualifications: qualifications || '', experience: experience || '', status: 'pending', created_at: new Date().toISOString() });
  if (error) throw new SecurityError('Failed to submit application', 500);

  const { data: admins } = await supabase
    .from('admin_master')
    .select('admin_id')
    .eq('is_active', true)
    .eq('is_locked', false);

  if (admins) {
    for (const admin of admins) await createNotification(admin.admin_id, 'new_tutor_application', { applicant_id: ctx.userId });
  }

  return res.status(200).json({ success: true });
}

async function reviewTutorApplication(body, res, ctx) {
  if (!ctx.adminData) throw new SecurityError('Admin only', 403);
  const { application_id, action, rejection_reason, interview_scheduled_at, hourly_rate, display_name } = body;
  if (!application_id || !action) throw new SecurityError('application_id and action required', 400);
  if (!['schedule', 'mark_interviewed', 'approve', 'reject'].includes(action)) throw new SecurityError('Invalid action', 400);

  const updates = { admin_id: ctx.userId };

  if (action === 'schedule') {
    if (!interview_scheduled_at) throw new SecurityError('interview_scheduled_at required', 400);
    updates.status = 'scheduled';
    updates.interview_scheduled_at = interview_scheduled_at;
  } else if (action === 'mark_interviewed') {
    updates.status = 'interviewed';
  } else if (action === 'approve') {
    if (!display_name) throw new SecurityError('display_name required for approval', 400);
    updates.status = 'approved';
    updates.display_name = display_name;
    if (hourly_rate) updates.hourly_rate = hourly_rate;
  } else if (action === 'reject') {
    updates.status = 'rejected';
    updates.rejection_reason = rejection_reason || 'Not specified';
  }

  const { data, error } = await supabase
    .from('tutor_applications')
    .update(updates)
    .eq('id', application_id)
    .select()
    .single();
  if (error || !data) throw new SecurityError('Failed to update application', 500);

  if (action === 'reject') {
    await supabase
      .from('classrooms')
      .update({ status: 'ended', ended_at: new Date().toISOString() })
      .eq('tutor_id', data.user_id)
      .not('status', 'in', '("ended","offline")');
  }

  await createNotification(data.user_id, 'tutor_application_update', { status: data.status });
  return res.status(200).json({ success: true, application: data });
}

async function fileComplaint(body, res, ctx) {
  const { room_id, complaint_type, description } = body;
  if (!complaint_type || !description) throw new SecurityError('complaint_type and description required', 400);

  const { error } = await supabase
    .from('classroom_complaints')
    .insert({ user_id: ctx.userId, room_id: room_id || null, complaint_type, description, status: 'pending', created_at: new Date().toISOString() });
  if (error) throw new SecurityError('Failed to file complaint', 500);

  return res.status(200).json({ success: true });
}

async function adminListRooms(req, res, ctx) {
  const { status, level } = req.query;
  let query = supabase.from('classrooms').select('*').order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);
  if (level) query = query.eq('level', level);

  const { data, error } = await query;
  if (error) throw new SecurityError('Failed to fetch rooms', 500);

  const reconciled = [];
  for (const room of (data || [])) reconciled.push(await reconcileRoom(room));

  const withNames = await attachTutorNames(reconciled);
  return res.status(200).json(withNames.map(withDuration));
}

async function adminListApplications(req, res, ctx) {
  const { status } = req.query;
  let query = supabase.from('tutor_applications').select('*').order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) throw new SecurityError('Failed to fetch applications', 500);

  const applications = [];
  for (const app of (data || [])) {
    const appData = { ...app };
    try {
      const { data: { user } } = await supabase.auth.admin.getUserById(app.user_id);
      appData.applicant_email = user?.email || 'Unknown';
    } catch {
      appData.applicant_email = 'Unknown';
    }
    applications.push(appData);
  }

  return res.status(200).json(applications);
}

async function adminListComplaints(req, res, ctx) {
  const { status } = req.query;
  let query = supabase.from('classroom_complaints').select('*').order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) throw new SecurityError('Failed to fetch complaints', 500);

  const complaints = [];
  for (const c of (data || [])) {
    const cData = { ...c };
    try {
      const { data: { user } } = await supabase.auth.admin.getUserById(c.user_id);
      cData.complainant_email = user?.email || 'Unknown';
    } catch {
      cData.complainant_email = 'Unknown';
    }
    complaints.push(cData);
  }

  return res.status(200).json(complaints);
}

async function adminResolveComplaint(body, res, ctx) {
  const { complaint_id, status, resolution } = body;
  if (!complaint_id || !status) throw new SecurityError('complaint_id and status required', 400);
  if (!['reviewing', 'resolved', 'dismissed'].includes(status)) throw new SecurityError('Invalid status', 400);

  const updates = { status, admin_id: ctx.userId };
  if (status === 'resolved' || status === 'dismissed') {
    updates.resolution = resolution || '';
    updates.resolved_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from('classroom_complaints')
    .update(updates)
    .eq('id', complaint_id)
    .select()
    .single();
  if (error || !data) throw new SecurityError('Failed to update complaint', 500);

  return res.status(200).json({ success: true, complaint: data });
}
