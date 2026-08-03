import { supabase } from './core.js';
import { parseAndValidateBody, requireAuth, requireAdmin, isFullyAuthorizedAdmin, SecurityError } from './security-middleware.js';
import { createNotification } from './notifications.js';

export async function handler(req, res, path, ctx) {
  if (req.method === 'GET') {
    switch (path) {
      case 'get_chat_messages': requireAuth(ctx); return getChatMessages(req, res, ctx);
      case 'check_admin_online': return checkAdminOnline(req, res);
      case 'admin_get_pending_requests': requireAdmin(ctx); return adminGetPendingRequests(req, res, ctx);
      case 'admin_get_active_chats': requireAdmin(ctx); return adminGetActiveChats(req, res, ctx);
      default: throw new SecurityError('Invalid action', 400);
    }
  }
  if (req.method === 'POST') {
    const body = await parseAndValidateBody(req);
    switch (path) {
      case 'request_chat': requireAuth(ctx); return requestChat(body, res, ctx);
      case 'send_chat_message': requireAuth(ctx); return sendChatMessage(body, res, ctx);
      case 'delete_chat_message': requireAuth(ctx); return deleteChatMessage(body, res, ctx);
      case 'update_user_presence': requireAuth(ctx); return updateUserPresence(req, res, ctx);
      case 'admin_accept_chat': requireAdmin(ctx); return adminAcceptChat(body, res, ctx);
      case 'admin_reject_chat': requireAdmin(ctx); return adminRejectChat(body, res, ctx);
      case 'admin_update_presence': requireAdmin(ctx); return adminUpdatePresence(body, res, ctx);
      default: throw new SecurityError('Invalid action', 400);
    }
  }
  throw new SecurityError('Method not allowed', 405);
}

async function requestChat(body, res, ctx) {
  const { data: existing } = await supabase.from('chat_rooms').select('id, status').eq('user_id', ctx.userId).in('status', ['requested', 'active']).maybeSingle();
  if (existing) return res.status(200).json({ room_id: existing.id, status: existing.status });
  const { data, error } = await supabase.from('chat_rooms').insert({ user_id: ctx.userId, status: 'requested', requested_at: new Date().toISOString(), created_at: new Date().toISOString() }).select().single();
  if (error) throw new SecurityError('Failed to request chat', 500);
  return res.status(200).json({ room_id: data.id, status: data.status });
}

async function getChatMessages(req, res, ctx) {
  const { room_id } = req.query;
  if (!room_id) throw new SecurityError('room_id required', 400);
  const { data: room } = await supabase.from('chat_rooms').select('user_id, assigned_admin').eq('id', room_id).maybeSingle();
  if (!room) throw new SecurityError('Room not found', 404);
  if (room.user_id !== ctx.userId && !isFullyAuthorizedAdmin(ctx)) throw new SecurityError('Access denied', 403);
  const { data, error } = await supabase.from('chat_messages').select('id, sender_type, content, created_at, deleted_by_user').eq('room_id', room_id).eq('deleted_by_user', false).order('created_at', { ascending: true });
  if (error) throw new SecurityError('Failed to fetch messages', 500);
  return res.status(200).json(data || []);
}

async function sendChatMessage(body, res, ctx) {
  const { room_id, message } = body;
  if (!room_id || !message?.trim()) throw new SecurityError('room_id and message required', 400);
  const { data: room } = await supabase.from('chat_rooms').select('user_id, status').eq('id', room_id).maybeSingle();
  if (!room) throw new SecurityError('Room not found', 404);
  const senderIsAdmin = isFullyAuthorizedAdmin(ctx);
  if (room.user_id !== ctx.userId && !senderIsAdmin) throw new SecurityError('Access denied', 403);
  const senderType = senderIsAdmin ? 'admin' : 'user';
  const { data, error } = await supabase.from('chat_messages').insert({ room_id, sender_type: senderType, content: message.trim(), deleted_by_user: false, created_at: new Date().toISOString() }).select().single();
  if (error) throw new SecurityError('Failed to send message', 500);
  if (room.status === 'requested' && senderType === 'admin') {
    await supabase.from('chat_rooms').update({ status: 'active', assigned_admin: ctx.userId }).eq('id', room_id);
  }
  if (senderType === 'admin') {
    await createNotification(room.user_id, 'chat_message_received', {});
  }
  return res.status(200).json({ success: true, message: data });
}

async function deleteChatMessage(body, res, ctx) {
  const { message_id } = body;
  if (!message_id) throw new SecurityError('message_id required', 400);
  const { data: msg } = await supabase.from('chat_messages').select('id, room_id, sender_type').eq('id', message_id).maybeSingle();
  if (!msg) throw new SecurityError('Message not found', 404);
  const { data: room } = await supabase.from('chat_rooms').select('user_id').eq('id', msg.room_id).maybeSingle();
  if (!room || room.user_id !== ctx.userId) throw new SecurityError('Access denied', 403);
  const { error } = await supabase.from('chat_messages').update({ deleted_by_user: true }).eq('id', message_id);
  if (error) throw new SecurityError('Failed to delete message', 500);
  return res.status(200).json({ success: true });
}

async function updateUserPresence(req, res, ctx) {
  await supabase.from('user_presence').upsert({ user_id: ctx.userId, last_seen: new Date().toISOString() }, { onConflict: 'user_id' });
  return res.status(200).json({ success: true });
}

async function checkAdminOnline(req, res) {
  const { data } = await supabase.from('admin_master').select('is_online, is_busy').eq('is_active', true).eq('is_online', true).eq('is_busy', false).limit(1);
  return res.status(200).json({ online: (data && data.length > 0) });
}

async function adminGetPendingRequests(req, res, ctx) {
  const { data, error } = await supabase.from('chat_rooms').select('id, user_id, status, requested_at').eq('status', 'requested').order('requested_at', { ascending: true });
  if (error) throw new SecurityError('Failed to fetch pending requests', 500);
  const rooms = [];
  for (const room of (data || [])) {
    try { const { data: { user } } = await supabase.auth.admin.getUserById(room.user_id); rooms.push({ ...room, user_email: user?.email || 'Unknown' }); } catch { rooms.push({ ...room, user_email: 'Unknown' }); }
  }
  return res.status(200).json(rooms);
}

async function adminAcceptChat(body, res, ctx) {
  const { room_id } = body;
  if (!room_id) throw new SecurityError('room_id required', 400);
  const { data: room, error } = await supabase.from('chat_rooms').update({ status: 'active', assigned_admin: ctx.adminData.id }).eq('id', room_id).select('user_id').single();
  if (error) throw new SecurityError('Failed to accept chat', 500);
  await createNotification(room.user_id, 'chat_request_accepted', {});
  return res.status(200).json({ success: true });
}

async function adminRejectChat(body, res, ctx) {
  const { room_id } = body;
  if (!room_id) throw new SecurityError('room_id required', 400);
  const { error } = await supabase.from('chat_rooms').update({ status: 'closed' }).eq('id', room_id);
  if (error) throw new SecurityError('Failed to reject chat', 500);
  return res.status(200).json({ success: true });
}

async function adminGetActiveChats(req, res, ctx) {
  const { data, error } = await supabase.from('chat_rooms').select('id, user_id, status, created_at, requested_at').eq('status', 'active').order('created_at', { ascending: false });
  if (error) throw new SecurityError('Failed to fetch active chats', 500);
  const rooms = [];
  for (const room of (data || [])) {
    try { const { data: { user } } = await supabase.auth.admin.getUserById(room.user_id); rooms.push({ ...room, user_email: user?.email || 'Unknown' }); } catch { rooms.push({ ...room, user_email: 'Unknown' }); }
  }
  return res.status(200).json(rooms);
}

async function adminUpdatePresence(body, res, ctx) {
  const { is_online, is_busy } = body;
  const { error } = await supabase.from('admin_master').update({ is_online: !!is_online, is_busy: !!is_busy, updated_at: new Date().toISOString() }).eq('id', ctx.adminData.id);
  if (error) throw new SecurityError('Failed to update presence', 500);
  return res.status(200).json({ success: true });
}
