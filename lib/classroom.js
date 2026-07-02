// backend/classroom.js
import { supabase } from './core.js';
import { parseAndValidateBody, requireAuth, SecurityError } from './security-middleware.js';
import { createNotification } from './notifications.js';

export async function handler(req, res, path, ctx) {
  if (req.method === 'GET') {
    switch (path) {
      case 'topics': return getTopics(req, res);
      case 'list': return listClassrooms(req, res);
      case 'room': return getRoom(req, res);
      case 'messages': return getMessages(req, res);
      case 'participants': return getParticipants(req, res);
      case 'tutor_status': requireAuth(ctx); return getTutorStatus(req, res, ctx);
      default: throw new SecurityError('Invalid action', 400);
    }
  }

  if (req.method === 'POST') {
    requireAuth(ctx);
    const body = await parseAndValidateBody(req);
    switch (path) {
      case 'join': return joinClassroom(body, res, ctx);
      case 'leave': return leaveClassroom(body, res, ctx);
      case 'send_message': return sendMessage(body, res, ctx);
      case 'raise_hand': return raiseHand(body, res, ctx);
      case 'tutor_apply': return applyAsTutor(body, res, ctx);
      case 'toggle_mute': return toggleMute(body, res, ctx);
      case 'end_room': return endRoom(body, res, ctx);
      case 'share_resource': return shareResource(body, res, ctx);
      case 'file_complaint': return fileComplaint(body, res, ctx);
      default: throw new SecurityError('Invalid action', 400);
    }
  }

  throw new SecurityError('Method not allowed', 405);
}

async function getTopics(req, res) {
  const { level, class_name } = req.query;
  if (!level) throw new SecurityError('level required', 400);

  if (level === 'Pharmacy') {
    if (!class_name) throw new SecurityError('class_name required for Pharmacy', 400);
    const { data, error } = await supabase
      .from('pharmacy_course_units')
      .select('*')
      .eq('program_id', class_name)
      .eq('is_active', true)
      .order('display_order', { ascending: true });
    if (error) throw new SecurityError('Failed to fetch course units', 500);
    return res.status(200).json(data || []);
  }

  const { data, error } = await supabase
    .from('quiz_topics')
    .select('topic_name, icon, question_count')
    .eq('level', level)
    .eq('is_active', true)
    .order('display_order', { ascending: true });
  if (error) throw new SecurityError('Failed to fetch topics', 500);
  const topics = (data || []).map(t => ({ id: t.topic_name, topic_name: t.topic_name, name: t.topic_name, icon: t.icon }));
  return res.status(200).json(topics);
}

async function listClassrooms(req, res) {
  const { level, class_name, topic_id } = req.query;
  if (!level || !class_name) throw new SecurityError('level and class_name required', 400);

  let query = supabase
    .from('classrooms')
    .select('*')
    .eq('level', level)
    .eq('class_name', class_name)
    .in('status', ['live', 'upcoming', 'open_floor'])
    .order('created_at', { ascending: false });

  if (topic_id) query = query.eq('topic_id', topic_id);

  const { data, error } = await query;
  if (error) throw new SecurityError('Failed to fetch classrooms', 500);

  const rooms = [];
  for (const room of (data || [])) {
    const roomData = { ...room };
    if (room.tutor_id) {
      try {
        const { data: { user: tutorUser } } = await supabase.auth.admin.getUserById(room.tutor_id);
        roomData.tutor_name = tutorUser?.email?.split('@')[0] || 'Tutor';
      } catch {
        roomData.tutor_name = 'Tutor';
      }
    }
    rooms.push(roomData);
  }

  return res.status(200).json(rooms);
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

  return res.status(200).json(data);
}

async function getMessages(req, res) {
  const { room_id } = req.query;
  if (!room_id) throw new SecurityError('room_id required', 400);

  const { data, error } = await supabase
    .from('classroom_messages')
    .select('*')
    .eq('room_id', room_id)
    .order('created_at', { ascending: true })
    .limit(200);
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
      .insert({
        room_id,
        user_id: ctx.userId,
        role: 'learner',
        is_muted: true,
        hand_raised: false,
        joined_at: new Date().toISOString(),
      });
  }

  await supabase
    .from('classrooms')
    .update({ participant_count: room.participant_count + 1 })
    .eq('id', room_id);

  await supabase
    .from('classroom_messages')
    .insert({
      room_id,
      user_id: ctx.userId,
      content: 'joined the classroom',
      message_type: 'system',
      created_at: new Date().toISOString(),
    });

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
    .insert({
      room_id,
      user_id: ctx.userId,
      content: 'left the classroom',
      message_type: 'system',
      created_at: new Date().toISOString(),
    });

  return res.status(200).json({ success: true });
}

async function sendMessage(body, res, ctx) {
  const { room_id, message } = body;
  if (!room_id || !message?.trim()) throw new SecurityError('room_id and message required', 400);

  const { data: participant } = await supabase
    .from('classroom_participants')
    .select('id')
    .eq('room_id', room_id)
    .eq('user_id', ctx.userId)
    .is('left_at', null)
    .maybeSingle();
  if (!participant) throw new SecurityError('You must join the room first', 403);

  const { data, error } = await supabase
    .from('classroom_messages')
    .insert({
      room_id,
      user_id: ctx.userId,
      content: message.trim(),
      message_type: 'chat',
      created_at: new Date().toISOString(),
    })
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
    .update({
      hand_raised: !!raise,
      hand_raised_at: raise ? new Date().toISOString() : null,
    })
    .eq('room_id', room_id)
    .eq('user_id', ctx.userId)
    .is('left_at', null);
  if (error) throw new SecurityError('Failed to update hand status', 500);

  if (raise) {
    await supabase
      .from('classroom_messages')
      .insert({
        room_id,
        user_id: ctx.userId,
        content: 'raised their hand',
        message_type: 'system',
        created_at: new Date().toISOString(),
      });
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
    .update({ is_muted: !!mute, hand_raised: mute ? false : undefined })
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
    .insert({
      room_id,
      user_id: ctx.userId,
      content: 'The session has ended',
      message_type: 'system',
      created_at: new Date().toISOString(),
    });

  const { data: participants } = await supabase
    .from('classroom_participants')
    .select('user_id')
    .eq('room_id', room_id);

  if (participants) {
    for (const p of participants) {
      await createNotification(p.user_id, 'classroom_ended', { room_id });
    }
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
    .insert({
      room_id,
      user_id: ctx.userId,
      content: `Shared: ${file_name}`,
      message_type: 'resource',
      file_url,
      file_name,
      file_size,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw new SecurityError('Failed to share resource', 500);

  return res.status(200).json({ success: true, message: data });
}

async function applyAsTutor(body, res, ctx) {
  const { level, class_name, subjects, qualifications, experience } = body;
  if (!level || !class_name || !subjects?.length) throw new SecurityError('level, class_name, and subjects required', 400);

  const { data: existing } = await supabase
    .from('tutor_applications')
    .select('id, status')
    .eq('user_id', ctx.userId)
    .in('status', ['pending', 'scheduled', 'interviewed'])
    .maybeSingle();
  if (existing) throw new SecurityError('You already have a pending application', 400);

  const { error } = await supabase
    .from('tutor_applications')
    .insert({
      user_id: ctx.userId,
      level,
      class_name,
      subjects,
      qualifications: qualifications || '',
      experience: experience || '',
      status: 'pending',
      created_at: new Date().toISOString(),
    });
  if (error) throw new SecurityError('Failed to submit application', 500);

  const { data: admins } = await supabase
    .from('admin_master')
    .select('admin_id')
    .eq('is_active', true)
    .eq('is_locked', false);

  if (admins) {
    for (const admin of admins) {
      await createNotification(admin.admin_id, 'new_tutor_application', { applicant_id: ctx.userId });
    }
  }

  return res.status(200).json({ success: true });
}

async function fileComplaint(body, res, ctx) {
  const { room_id, complaint_type, description } = body;
  if (!complaint_type || !description) throw new SecurityError('complaint_type and description required', 400);

  const { error } = await supabase
    .from('classroom_complaints')
    .insert({
      user_id: ctx.userId,
      room_id: room_id || null,
      complaint_type,
      description,
      status: 'pending',
      created_at: new Date().toISOString(),
    });
  if (error) throw new SecurityError('Failed to file complaint', 500);

  return res.status(200).json({ success: true });
}
