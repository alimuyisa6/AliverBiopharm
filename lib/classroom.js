import { supabase } from './core.js';
import {
  parseAndValidateBody,
  requireAuth,
  requireAdmin,
  isFullyAuthorizedAdmin,
  SecurityError
} from './security-middleware.js';
import { createNotification } from './notifications.js';
import { getUserCurriculumScope } from './curriculum.js';
import { isMinorSafetyBlocked, areMutuallyUnblocked } from './trust-safety.js';

export async function handler(req, res, path, ctx) {
  if (req.method === 'GET') {
    return handleGet(path, req, res, ctx);
  }

  if (req.method === 'POST') {
    requireAuth(ctx);

    const body = await parseAndValidateBody(req);
    return handlePost(path, body, req, res, ctx);
  }

  throw new SecurityError('Method not allowed', 405);
}

async function handleGet(path, req, res, ctx) {
  switch (path) {
    case 'levels':
      return getLevels(req, res);
    case 'topics':
      return getTopics(req, res);
    case 'list':
      return listClassrooms(req, res, ctx);
    case 'live_feed':
      return getLiveFeed(req, res, ctx);
    case 'room':
      return getRoom(req, res, ctx);
    case 'messages':
      return getMessages(req, res);
    case 'participants':
      return getParticipants(req, res);
    case 'tutor_status':
      requireAuth(ctx);
      return getTutorStatus(req, res, ctx);
    case 'tutor_rooms':
      requireAuth(ctx);
      return getTutorRooms(req, res, ctx);
    case 'admin_list_rooms':
      requireAdmin(ctx);
      return adminListRooms(req, res);
    case 'admin_list_applications':
      requireAdmin(ctx);
      return adminListApplications(req, res);
    case 'admin_list_complaints':
      requireAdmin(ctx);
      return adminListComplaints(req, res);
    default:
      throw new SecurityError('Invalid action', 400);
  }
}

async function handlePost(path, body, req, res, ctx) {
  switch (path) {
    case 'create':
      return createRoom(body, res, ctx);
    case 'join':
      return joinClassroom(body, res, ctx);
    case 'leave':
      return leaveClassroom(body, res, ctx);
    case 'send_message':
      return sendMessage(body, res, ctx);
    case 'raise_hand':
      return raiseHand(body, res, ctx);
    case 'tutor_apply':
      return applyAsTutor(body, res, ctx);
    case 'tutor_review':
      requireAdmin(ctx);
      return reviewTutorApplication(body, res, ctx);
    case 'toggle_mute':
      return toggleMute(body, res, ctx);
    case 'end_room':
      return endRoom(body, res, ctx);
    case 'share_resource':
      return shareResource(body, res, ctx);
    case 'file_complaint':
      return fileComplaint(body, res, ctx);
    case 'admin_resolve_complaint':
      requireAdmin(ctx);
      return adminResolveComplaint(body, res, ctx);
    default:
      throw new SecurityError('Invalid action', 400);
  }
}

async function fetchUserNames(userIds) {
  if (!userIds.length) return {};

  const results = await Promise.all(
    userIds.map(async (userId) => {
      try {
        const { data } = await supabase.auth.admin.getUserById(userId);

        return {
          userId,
          name: data?.user?.user_metadata?.full_name || 'User'
        };
      } catch {
        return { userId, name: 'User' };
      }
    })
  );

  const map = {};

  for (const result of results) {
    map[result.userId] = result.name;
  }

  return map;
}

async function fetchTutorAvatars(userIds) {
  if (!userIds.length) return {};

  const { data: tutors } = await supabase
    .from('tutor_profiles')
    .select('user_id, avatar_url')
    .in('user_id', userIds);

  const tutorMap = {};
  for (const tutor of tutors || []) {
    tutorMap[tutor.user_id] = tutor.avatar_url || null;
  }

  const missing = userIds.filter(id => !tutorMap[id]);
  const avatarMap = { ...tutorMap };

  if (missing.length) {
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('user_id, profile_picture_url')
      .in('user_id', missing);

    for (const profile of profiles || []) {
      avatarMap[profile.user_id] = profile.profile_picture_url || null;
    }
  }

  return avatarMap;
}

async function enrichRoomsWithTopicAndClass(rooms) {
  const unitIds = [...new Set(rooms.map((room) => room.unit_id).filter(Boolean))];

  if (!unitIds.length) return rooms;

  const { data: units } = await supabase
    .from('curriculum_units')
    .select('id, name, group_id, topic_image_url')
    .in('id', unitIds);

  const unitMap = {};

  for (const unit of units || []) {
    unitMap[unit.id] = unit;
  }

  const groupIds = [...new Set((units || []).map((unit) => unit.group_id).filter(Boolean))];

  let groupMap = {};

  if (groupIds.length) {
    const { data: groups } = await supabase
      .from('curriculum_groups')
      .select('id, name')
      .in('id', groupIds);

    for (const group of groups || []) {
      groupMap[group.id] = group.name;
    }
  }

  return rooms.map((room) => {
    const unit = unitMap[room.unit_id];

    return {
      ...room,
      topic_name: unit?.name || null,
      class_name: unit ? groupMap[unit.group_id] || null : null,
      image_url: unit?.topic_image_url || null
    };
  });
}

function deriveStatus(room) {
  const now = new Date();

  if (room.status === 'ended' || room.status === 'offline') {
    return {
      status: room.status,
      started_at: room.started_at
    };
  }

  if (room.room_type === 'free') {
    return {
      status: 'open_floor',
      started_at: room.started_at || room.created_at
    };
  }

  if (!room.scheduled_at) {
    return {
      status: 'live',
      started_at: room.started_at || room.created_at
    };
  }

  const scheduled = new Date(room.scheduled_at);

  return scheduled > now
    ? { status: 'upcoming', started_at: null }
    : { status: 'live', started_at: room.started_at || room.scheduled_at };
}

function withDuration(room) {
  const enriched = { ...room };

  if (enriched.status === 'live' || enriched.status === 'open_floor') {
    if (enriched.started_at) {
      enriched.live_duration_seconds = Math.max(
        0,
        Math.floor((Date.now() - new Date(enriched.started_at).getTime()) / 1000)
      );
    }
  } else if (enriched.status === 'upcoming' && enriched.scheduled_at) {
    enriched.starts_in_seconds = Math.max(
      0,
      Math.floor((new Date(enriched.scheduled_at).getTime() - Date.now()) / 1000)
    );
  }

  return enriched;
}

async function getLevels(req, res) {
  const { data: levels } = await supabase
    .from('curriculum_levels')
    .select('id, display_name, kind, group_label, unit_label, icon, color')
    .order('display_order');

  const result = await Promise.all(
    (levels || []).map(async (level) => {
      const { data: groups } = await supabase
        .from('curriculum_groups')
        .select('id, name, description, icon')
        .eq('level_id', level.id)
        .eq('is_active', true)
        .order('sequence_order');

      return {
        key: level.id,
        display_name: level.display_name,
        icon: level.icon,
        classes: (groups || []).map((group) => ({
          id: group.id,
          name: group.name,
          description: group.description,
          icon: group.icon
        }))
      };
    })
  );

  return res.status(200).json(result);
}

async function getTopics(req, res) {
  const { group_id, level } = req.query;

  if (!group_id && !level) {
    throw new SecurityError('group_id or level required', 400);
  }

  let groupIds = [];

  if (group_id) {
    groupIds = [group_id];
  } else {
    const { data: groups } = await supabase
      .from('curriculum_groups')
      .select('id')
      .eq('level_id', level)
      .eq('is_active', true);

    groupIds = (groups || []).map((group) => group.id);

    if (!groupIds.length) return res.status(200).json([]);
  }

  const { data } = await supabase
    .from('curriculum_units')
    .select('id, name, code, icon, is_hard_topic, display_order')
    .in('group_id', groupIds)
    .eq('is_active', true)
    .order('display_order');

  return res.status(200).json(
    (data || []).map((unit) => ({
      id: unit.id,
      topic_name: unit.name,
      unit_code: unit.code,
      icon: unit.icon,
      is_hard_topic: unit.is_hard_topic
    }))
  );
}

async function listClassrooms(req, res, ctx) {
  const { unit_id, group_id } = req.query;

  if (!unit_id && !group_id) {
    throw new SecurityError('unit_id or group_id required', 400);
  }

  let unitIds = [];

  if (group_id) {
    const { data: units } = await supabase
      .from('curriculum_units')
      .select('id')
      .eq('group_id', group_id)
      .eq('is_active', true);

    unitIds = (units || []).map((unit) => unit.id);

    if (!unitIds.length) return res.status(200).json([]);
  } else if (unit_id) {
    unitIds = [unit_id];
  }

  const { data } = await supabase
    .from('classrooms')
    .select('*')
    .in('unit_id', unitIds)
    .not('status', 'in', '("ended","offline")')
    .order('created_at', { ascending: false });

  const reconciled = [];

  for (const room of data || []) {
    if (room.tutor_id) {
      const { data: application } = await supabase
        .from('tutor_applications')
        .select('status')
        .eq('user_id', room.tutor_id)
        .eq('status', 'approved')
        .maybeSingle();

      if (!application) continue;
    }

    const derived = deriveStatus(room);

    if (derived.status !== room.status) {
      await supabase.from('classrooms').update(derived).eq('id', room.id);
      room.status = derived.status;
      room.started_at = derived.started_at;
    }

    reconciled.push(withDuration(room));
  }

  const tutorIds = [...new Set(reconciled.map((room) => room.tutor_id).filter(Boolean))];
  const tutorNames = {};

  if (tutorIds.length) {
    const { data: applications } = await supabase
      .from('tutor_applications')
      .select('user_id, display_name')
      .in('user_id', tutorIds)
      .eq('status', 'approved');

    for (const application of applications || []) {
      tutorNames[application.user_id] = application.display_name || null;
    }
  }

  const enriched = await enrichRoomsWithTopicAndClass(reconciled);

  const avatarMap = await fetchTutorAvatars(tutorIds);

  return res.status(200).json(
    enriched.map((room) => ({
      ...room,
      tutor_name: tutorNames[room.tutor_id] || null,
      tutor_avatar_url: avatarMap[room.tutor_id] || null
    }))
  );
}

async function getLiveFeed(req, res, ctx) {
  let unitIds = [];

  if (ctx.authenticated) {
    const scope = await getUserCurriculumScope(ctx.userId);

    if (scope?.level) {
      const { data: groups } = await supabase
        .from('curriculum_groups')
        .select('id')
        .eq('level_id', scope.level);

      const groupIds = (groups || []).map((group) => group.id);

      if (groupIds.length) {
        const { data: units } = await supabase
          .from('curriculum_units')
          .select('id')
          .in('group_id', groupIds);

        unitIds = (units || []).map((unit) => unit.id);
      }
    }
  }

  let query = supabase
    .from('classrooms')
    .select('*')
    .in('status', ['live', 'open_floor', 'upcoming'])
    .order('created_at', { ascending: false })
    .limit(12);

  if (unitIds.length) {
    query = query.in('unit_id', unitIds);
  }

  const { data } = await query;

  const reconciled = [];

  for (const room of data || []) {
    const derived = deriveStatus(room);

    if (derived.status !== room.status) {
      await supabase.from('classrooms').update(derived).eq('id', room.id);
      room.status = derived.status;
      room.started_at = derived.started_at;
    }

    reconciled.push(withDuration(room));
  }

  const enriched = await enrichRoomsWithTopicAndClass(reconciled);

  const tutorIds = [...new Set(enriched.map((room) => room.tutor_id).filter(Boolean))];
  const avatarMap = await fetchTutorAvatars(tutorIds);

  return res.status(200).json(
    enriched.map((room) => ({
      ...room,
      tutor_avatar_url: avatarMap[room.tutor_id] || null
    }))
  );
}

async function getRoom(req, res, ctx) {
  const { room_id } = req.query;

  if (!room_id) throw new SecurityError('room_id required', 400);

  const { data: room } = await supabase
    .from('classrooms')
    .select('*')
    .eq('id', room_id)
    .maybeSingle();

  if (!room) throw new SecurityError('Room not found', 404);

  const derived = deriveStatus(room);

  if (derived.status !== room.status) {
    await supabase.from('classrooms').update(derived).eq('id', room.id);
    room.status = derived.status;
    room.started_at = derived.started_at;
  }

  const [enriched] = await enrichRoomsWithTopicAndClass([withDuration(room)]);

  let tutor_avatar_url = null;
  if (enriched.tutor_id) {
    const avatarMap = await fetchTutorAvatars([enriched.tutor_id]);
    tutor_avatar_url = avatarMap[enriched.tutor_id] || null;
  }

  return res.status(200).json({
    ...enriched,
    tutor_avatar_url
  });
}

async function getMessages(req, res) {
  const { room_id } = req.query;

  if (!room_id) throw new SecurityError('room_id required', 400);

  const { data } = await supabase
    .from('classroom_messages')
    .select('*')
    .eq('room_id', room_id)
    .order('created_at', { ascending: true })
    .limit(100);

  const userIds = [...new Set((data || []).map((message) => message.user_id))];
  const nameMap = await fetchUserNames(userIds);

  return res.status(200).json(
    (data || []).map((message) => ({
      ...message,
      sender_name: nameMap[message.user_id] || 'User'
    }))
  );
}

async function getParticipants(req, res) {
  const { room_id } = req.query;

  if (!room_id) throw new SecurityError('room_id required', 400);

  const { data } = await supabase
    .from('classroom_participants')
    .select('*')
    .eq('room_id', room_id)
    .is('left_at', null);

  return res.status(200).json(data || []);
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
  const { data } = await supabase
    .from('classrooms')
    .select('*')
    .eq('tutor_id', ctx.userId)
    .not('status', 'in', '("ended","offline")')
    .order('created_at', { ascending: false });

  const enriched = await enrichRoomsWithTopicAndClass(data || []);

  return res.status(200).json({ rooms: enriched });
}

async function createRoom(body, res, ctx) {
  const { title, unit_id, room_type, scheduled_at } = body;

  if (!title || !unit_id || !room_type) {
    throw new SecurityError('title, unit_id, room_type required', 400);
  }

  if (!['free', 'hard_topic', 'premium'].includes(room_type)) {
    throw new SecurityError('Invalid room_type', 400);
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('is_approved_teacher, approved_track')
    .eq('user_id', ctx.userId)
    .maybeSingle();

  if (!profile?.is_approved_teacher && !isFullyAuthorizedAdmin(ctx)) {
    throw new SecurityError('Only approved tutors and admins can create rooms', 403);
  }

  const status = room_type === 'free'
    ? 'open_floor'
    : new Date(scheduled_at) > new Date()
      ? 'upcoming'
      : 'live';

  const startedAt = status === 'live' || status === 'open_floor'
    ? new Date().toISOString()
    : null;

  const { data, error } = await supabase
    .from('classrooms')
    .insert({
      title,
      unit_id,
      room_type,
      tutor_id: ctx.userId,
      status,
      scheduled_at: scheduled_at || null,
      started_at: startedAt,
      participant_count: 0,
      created_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) throw new SecurityError('Failed to create room', 500);

  await supabase.from('classroom_participants').insert({
    room_id: data.id,
    user_id: ctx.userId,
    role: 'tutor',
    is_muted: false
  });

  const [enriched] = await enrichRoomsWithTopicAndClass([data]);

  return res.status(200).json(enriched);
}

async function joinClassroom(body, res, ctx) {
  const { room_id } = body;

  if (!room_id) throw new SecurityError('room_id required', 400);

  if (await isMinorSafetyBlocked(ctx.userId)) {
    throw new SecurityError('Parental consent is required before joining a live classroom', 403);
  }

  const { data: room } = await supabase
    .from('classrooms')
    .select('id, tutor_id, status, participant_count, max_participants')
    .eq('id', room_id)
    .maybeSingle();

  if (!room) throw new SecurityError('Room not found', 404);
  if (room.status === 'ended' || room.status === 'offline') throw new SecurityError('Room not active', 400);
  if (room.participant_count >= room.max_participants) throw new SecurityError('Room full', 400);

  if (room.tutor_id && room.tutor_id !== ctx.userId) {
    const clear = await areMutuallyUnblocked(ctx.userId, room.tutor_id);

    if (!clear) throw new SecurityError('You cannot join this classroom', 403);
  }

  const { data: existing } = await supabase
    .from('classroom_participants')
    .select('id, left_at')
    .eq('room_id', room_id)
    .eq('user_id', ctx.userId)
    .maybeSingle();

  if (existing && !existing.left_at) {
    return res.status(200).json({ success: true, already_joined: true });
  }

  if (existing) {
    await supabase
      .from('classroom_participants')
      .update({
        left_at: null,
        is_muted: true,
        hand_raised: false
      })
      .eq('id', existing.id);
  } else {
    await supabase.from('classroom_participants').insert({
      room_id,
      user_id: ctx.userId,
      role: 'learner',
      is_muted: true
    });
  }

  await supabase
    .from('classrooms')
    .update({ participant_count: room.participant_count + 1 })
    .eq('id', room_id);

  await supabase.from('classroom_messages').insert({
    room_id,
    user_id: ctx.userId,
    content: 'joined the classroom',
    message_type: 'system'
  });

  return res.status(200).json({ success: true });
}

async function leaveClassroom(body, res, ctx) {
  const { room_id } = body;

  if (!room_id) throw new SecurityError('room_id required', 400);

  await supabase
    .from('classroom_participants')
    .update({
      left_at: new Date().toISOString(),
      hand_raised: false
    })
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
      .update({
        participant_count: Math.max(0, (room.participant_count || 1) - 1)
      })
      .eq('id', room_id);
  }

  await supabase.from('classroom_messages').insert({
    room_id,
    user_id: ctx.userId,
    content: 'left the classroom',
    message_type: 'system'
  });

  return res.status(200).json({ success: true });
}

const MAX_MESSAGE_LENGTH = 2000;

async function sendMessage(body, res, ctx) {
  const { room_id, message } = body;

  if (!room_id || !message?.trim()) {
    throw new SecurityError('room_id and message required', 400);
  }

  const trimmed = message.trim();

  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    throw new SecurityError(`Message too long (max ${MAX_MESSAGE_LENGTH} characters)`, 400);
  }

  const { data: participant } = await supabase
    .from('classroom_participants')
    .select('is_muted')
    .eq('room_id', room_id)
    .eq('user_id', ctx.userId)
    .is('left_at', null)
    .maybeSingle();

  if (!participant) throw new SecurityError('You must join the room first', 403);
  if (participant.is_muted) throw new SecurityError('You are muted', 403);

  await supabase.from('classroom_messages').insert({
    room_id,
    user_id: ctx.userId,
    content: trimmed,
    message_type: 'chat'
  });

  return res.status(200).json({ success: true });
}

async function raiseHand(body, res, ctx) {
  const { room_id, raise } = body;

  if (!room_id) throw new SecurityError('room_id required', 400);

  await supabase
    .from('classroom_participants')
    .update({
      hand_raised: !!raise,
      hand_raised_at: raise ? new Date().toISOString() : null
    })
    .eq('room_id', room_id)
    .eq('user_id', ctx.userId)
    .is('left_at', null);

  return res.status(200).json({ success: true });
}

async function toggleMute(body, res, ctx) {
  const { room_id, target_user_id, mute } = body;

  if (!room_id || !target_user_id) {
    throw new SecurityError('room_id and target_user_id required', 400);
  }

  const { data: actor } = await supabase
    .from('classroom_participants')
    .select('role')
    .eq('room_id', room_id)
    .eq('user_id', ctx.userId)
    .is('left_at', null)
    .maybeSingle();

  if (!actor || (actor.role !== 'tutor' && actor.role !== 'admin')) {
    throw new SecurityError('Only tutors/admins can mute', 403);
  }

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
  if (room.tutor_id !== ctx.userId && !isFullyAuthorizedAdmin(ctx)) {
    throw new SecurityError('Only the tutor or admin can end the room', 403);
  }

  await supabase
    .from('classrooms')
    .update({
      status: 'ended',
      ended_at: new Date().toISOString()
    })
    .eq('id', room_id);

  await supabase
    .from('classroom_participants')
    .update({
      left_at: new Date().toISOString(),
      hand_raised: false
    })
    .eq('room_id', room_id)
    .is('left_at', null);

  await supabase.from('classroom_messages').insert({
    room_id,
    user_id: ctx.userId,
    content: 'The session has ended',
    message_type: 'system'
  });

  return res.status(200).json({ success: true });
}

async function shareResource(body, res, ctx) {
  const { room_id, file_id } = body;

  if (!room_id || !file_id) {
    throw new SecurityError('room_id and file_id required', 400);
  }

  const { data: participant } = await supabase
    .from('classroom_participants')
    .select('role')
    .eq('room_id', room_id)
    .eq('user_id', ctx.userId)
    .is('left_at', null)
    .maybeSingle();

  if (!participant || (participant.role !== 'tutor' && participant.role !== 'admin')) {
    throw new SecurityError('Only tutors can share', 403);
  }

  const { data: file } = await supabase
    .from('user_files')
    .select('id, file_url, file_name, file_size')
    .eq('id', file_id)
    .eq('user_id', ctx.userId)
    .eq('is_active', true)
    .maybeSingle();

  if (!file) throw new SecurityError('File not found', 404);

  await supabase.from('classroom_messages').insert({
    room_id,
    user_id: ctx.userId,
    content: `Shared: ${file.file_name}`,
    message_type: 'resource',
    file_url: file.file_url,
    file_name: file.file_name,
    file_size: file.file_size
  });

  return res.status(200).json({ success: true });
}

async function fileComplaint(body, res, ctx) {
  const { room_id, complaint_type, description } = body;

  if (!complaint_type || !description) {
    throw new SecurityError('complaint_type and description required', 400);
  }

  await supabase.from('classroom_complaints').insert({
    user_id: ctx.userId,
    room_id: room_id || null,
    complaint_type,
    description,
    status: 'pending'
  });

  return res.status(200).json({ success: true });
}

async function applyAsTutor(body, res, ctx) {
  const { level, class_name, subjects, qualifications, experience } = body;

  if (!level || !class_name || !subjects?.length) {
    throw new SecurityError('level, class_name, and subjects required', 400);
  }

  const { data: curriculumLevel } = await supabase
    .from('curriculum_levels')
    .select('id, display_name')
    .eq('display_name', level)
    .maybeSingle();

  if (!curriculumLevel) throw new SecurityError('Invalid curriculum level', 400);

  const { data: group } = await supabase
    .from('curriculum_groups')
    .select('id, name')
    .eq('level_id', curriculumLevel.id)
    .eq('name', class_name)
    .eq('is_active', true)
    .maybeSingle();

  if (!group) throw new SecurityError('Invalid class/programme for the selected level', 400);

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('track')
    .eq('user_id', ctx.userId)
    .maybeSingle();

  if (profile?.track && profile.track !== curriculumLevel.display_name) {
    throw new SecurityError('Submitted level does not match your account level', 400);
  }

  const { data: existing } = await supabase
    .from('tutor_applications')
    .select('id')
    .eq('user_id', ctx.userId)
    .in('status', ['pending', 'scheduled', 'interviewed'])
    .maybeSingle();

  if (existing) throw new SecurityError('You already have a pending application', 400);

  await supabase.from('user_profiles').upsert({
    user_id: ctx.userId,
    role: 'teacher',
    track: curriculumLevel.display_name,
    class_name: group.name,
    is_approved_teacher: false,
    updated_at: new Date().toISOString()
  }, { onConflict: 'user_id' });

  await supabase.from('tutor_applications').insert({
    user_id: ctx.userId,
    level: curriculumLevel.display_name,
    class_name: group.name,
    subjects,
    qualifications,
    experience,
    status: 'pending'
  });

  return res.status(200).json({ success: true });
}

async function reviewTutorApplication(body, res, ctx) {
  const { application_id, action, ...extra } = body;

  if (!application_id || !action) {
    throw new SecurityError('application_id and action required', 400);
  }

  const { data: application } = await supabase
    .from('tutor_applications')
    .select('user_id, level')
    .eq('id', application_id)
    .maybeSingle();

  if (!application) throw new SecurityError('Application not found', 404);

  if (action === 'approve') {
    await supabase
      .from('tutor_applications')
      .update({
        status: 'approved',
        is_approved: true,
        approved_by: ctx.userId,
        approved_at: new Date().toISOString(),
        display_name: extra.display_name,
        hourly_rate: extra.hourly_rate
      })
      .eq('id', application_id);

    await supabase
      .from('user_profiles')
      .update({
        is_approved_teacher: true,
        approved_track: extra.approved_track || application.level,
        approved_by: ctx.userId,
        approved_at: new Date().toISOString()
      })
      .eq('user_id', application.user_id);
  } else if (action === 'reject') {
    await supabase
      .from('tutor_applications')
      .update({
        status: 'rejected',
        is_approved: false,
        rejection_reason: extra.rejection_reason
      })
      .eq('id', application_id);

    await supabase
      .from('user_profiles')
      .update({
        is_approved_teacher: false,
        approval_notes: extra.rejection_reason || 'Rejected'
      })
      .eq('user_id', application.user_id);
  } else {
    const updates = {
      admin_id: ctx.userId
    };

    if (action === 'schedule') {
      updates.status = 'scheduled';
      updates.interview_scheduled_at = extra.interview_scheduled_at;
    } else if (action === 'mark_interviewed') {
      updates.status = 'interviewed';
    }

    await supabase
      .from('tutor_applications')
      .update(updates)
      .eq('id', application_id);
  }

  await createNotification(application.user_id, 'tutor_application_update', {
    status: action
  });

  return res.status(200).json({ success: true });
}

async function adminListRooms(req, res) {
  const { status } = req.query;

  let query = supabase
    .from('classrooms')
    .select('*')
    .order('created_at', { ascending: false });

  if (status) query = query.eq('status', status);

  const { data } = await query;

  return res.status(200).json(await enrichRoomsWithTopicAndClass(data || []));
}

async function adminListApplications(req, res) {
  const { status } = req.query;

  let query = supabase
    .from('tutor_applications')
    .select('*')
    .order('created_at', { ascending: false });

  if (status) query = query.eq('status', status);

  const { data } = await query;

  return res.status(200).json(data || []);
}

async function adminListComplaints(req, res) {
  const { status } = req.query;

  let query = supabase
    .from('classroom_complaints')
    .select('*')
    .order('created_at', { ascending: false });

  if (status) query = query.eq('status', status);

  const { data } = await query;

  return res.status(200).json(data || []);
}

async function adminResolveComplaint(body, res, ctx) {
  const { complaint_id, status, resolution } = body;

  if (!complaint_id || !status) {
    throw new SecurityError('complaint_id and status required', 400);
  }

  await supabase
    .from('classroom_complaints')
    .update({
      status,
      resolution,
      admin_id: ctx.userId,
      resolved_at: new Date().toISOString()
    })
    .eq('id', complaint_id);

  return res.status(200).json({ success: true });
}
