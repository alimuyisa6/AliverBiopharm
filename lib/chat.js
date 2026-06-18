// /lib/chat.js
import { supabase, parseCookies, hashToken, validateSession, isAdmin } from './core.js';

async function parseBody(req) { const chunks = []; for await (const chunk of req) chunks.push(chunk); return JSON.parse(Buffer.concat(chunks).toString()); }

export async function handler(req, res, path, ctx) {
  const { userId, adminData, ip } = ctx;

  if (req.method === 'GET') {
    switch (path) {
      case 'get_chat_messages': return getChatMessages(req, res, userId);
      case 'check_admin_online': return checkAdminOnline(req, res);
      case 'admin_get_pending_requests': return adminGetPendingRequests(req, res, adminData);
      case 'admin_get_active_chats': return adminGetActiveChats(req, res, adminData);
      default: return res.status(400).json({ error: 'Invalid action' });
    }
  }
  if (req.method === 'POST') {
    const body = await parseBody(req);
    switch (path) {
      case 'request_chat': return requestChat(req, res, userId);
      case 'send_chat_message': return sendChatMessage(body, res, userId, adminData);
      case 'delete_chat_message': return deleteChatMessage(body, res, userId);
      case 'update_user_presence': return updateUserPresence(req, res, userId);
      case 'admin_accept_chat': return adminAcceptChat(body, res, adminData);
      case 'admin_reject_chat': return adminRejectChat(body, res, adminData);
      case 'admin_update_presence': return adminUpdatePresence(body, res, adminData);
      default: return res.status(400).json({ error: 'Invalid action' });
    }
  }
  return res.status(405).json({ error: 'Method not allowed' });
}

async function requestChat(req, res, userId) {
  if (!userId) return res.status(401).json({ error: 'Authentication required' });
  const { data: existing } = await supabase.from('chat_rooms').select('id, status').eq('user_id', userId).in('status', ['requested', 'active']).maybeSingle();
  if (existing) return res.status(200).json({ room_id: existing.id, status: existing.status });
  const { data, error } = await supabase.from('chat_rooms').insert({ user_id: userId, status: 'requested', requested_at: new Date().toISOString(), created_at: new Date().toISOString() }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ room_id: data.id, status: data.status });
}

async function getChatMessages(req, res, userId) {
  if (!userId) return res.status(401).json({ error: 'Authentication required' });
  const { room_id } = req.query;
  if (!room_id) return res.status(400).json({ error: 'room_id required' });
  const { data: room } = await supabase.from('chat_rooms').select('user_id, assigned_admin').eq('id', room_id).maybeSingle();
  if (!room) return res.status(404).json({ error: 'Room not found' });
  const adminData = await isAdmin(userId, req.headers['x-forwarded-for'] || 'unknown');
  if (room.user_id !== userId && !adminData) return res.status(403).json({ error: 'Access denied' });
  const { data, error } = await supabase.from('chat_messages').select('id, sender_type, content, created_at, deleted_by_user').eq('room_id', room_id).eq('deleted_by_user', false).order('created_at', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json(data || []);
}

async function sendChatMessage(body, res, userId, adminData) {
  if (!userId) return res.status(401).json({ error: 'Authentication required' });
  const { room_id, message } = body;
  if (!room_id || !message?.trim()) return res.status(400).json({ error: 'room_id and message required' });
  const { data: room } = await supabase.from('chat_rooms').select('user_id, status').eq('id', room_id).maybeSingle();
  if (!room) return res.status(404).json({ error: 'Room not found' });
  if (room.user_id !== userId && !adminData) return res.status(403).json({ error: 'Access denied' });
  const senderType = adminData ? 'admin' : 'user';
  const { data, error } = await supabase.from('chat_messages').insert({ room_id, sender_type: senderType, content: message.trim(), deleted_by_user: false, created_at: new Date().toISOString() }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  if (room.status === 'requested' && senderType === 'admin') {
    await supabase.from('chat_rooms').update({ status: 'active', assigned_admin: userId }).eq('id', room_id);
  }
  return res.status(200).json({ success: true, message: data });
}

async function deleteChatMessage(body, res, userId) {
  if (!userId) return res.status(401).json({ error: 'Authentication required' });
  const { message_id } = body;
  if (!message_id) return res.status(400).json({ error: 'message_id required' });
  const { data: msg } = await supabase.from('chat_messages').select('id, room_id, sender_type').eq('id', message_id).maybeSingle();
  if (!msg) return res.status(404).json({ error: 'Message not found' });
  const { data: room } = await supabase.from('chat_rooms').select('user_id').eq('id', msg.room_id).maybeSingle();
  if (!room || room.user_id !== userId) return res.status(403).json({ error: 'Access denied' });
  const { error } = await supabase.from('chat_messages').update({ deleted_by_user: true }).eq('id', message_id);
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ success: true });
}

async function updateUserPresence(req, res, userId) {
  if (!userId) return res.status(401).json({ error: 'Authentication required' });
  await supabase.from('user_presence').upsert({ user_id: userId, last_seen: new Date().toISOString() }, { onConflict: 'user_id' });
  return res.status(200).json({ success: true });
}

async function checkAdminOnline(req, res) {
  const { data } = await supabase.from('admin_master').select('is_online, is_busy').eq('is_active', true).eq('is_online', true).eq('is_busy', false).limit(1);
  return res.status(200).json({ online: (data && data.length > 0) });
}

async function adminGetPendingRequests(req, res, adminData) {
  if (!adminData) return res.status(403).json({ error: 'Admin required' });
  const { data, error } = await supabase.from('chat_rooms').select('id, user_id, status, requested_at').eq('status', 'requested').order('requested_at', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  const rooms = [];
  for (const room of (data || [])) {
    try { const { data: { user } } = await supabase.auth.admin.getUserById(room.user_id); rooms.push({ ...room, user_email: user?.email || 'Unknown' }); } catch { rooms.push({ ...room, user_email: 'Unknown' }); }
  }
  return res.status(200).json(rooms);
}

async function adminAcceptChat(body, res, adminData) {
  if (!adminData) return res.status(403).json({ error: 'Admin required' });
  const { room_id } = body;
  if (!room_id) return res.status(400).json({ error: 'room_id required' });
  const { error } = await supabase.from('chat_rooms').update({ status: 'active', assigned_admin: adminData.id }).eq('id', room_id);
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ success: true });
}

async function adminRejectChat(body, res, adminData) {
  if (!adminData) return res.status(403).json({ error: 'Admin required' });
  const { room_id } = body;
  if (!room_id) return res.status(400).json({ error: 'room_id required' });
  const { error } = await supabase.from('chat_rooms').update({ status: 'closed' }).eq('id', room_id);
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ success: true });
}

async function adminGetActiveChats(req, res, adminData) {
  if (!adminData) return res.status(403).json({ error: 'Admin required' });
  const { data, error } = await supabase.from('chat_rooms').select('id, user_id, status, created_at, requested_at').eq('status', 'active').order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  const rooms = [];
  for (const room of (data || [])) {
    try { const { data: { user } } = await supabase.auth.admin.getUserById(room.user_id); rooms.push({ ...room, user_email: user?.email || 'Unknown' }); } catch { rooms.push({ ...room, user_email: 'Unknown' }); }
  }
  return res.status(200).json(rooms);
}

async function adminUpdatePresence(body, res, adminData) {
  if (!adminData) return res.status(403).json({ error: 'Admin required' });
  const { is_online, is_busy } = body;
  const { error } = await supabase.from('admin_master').update({ is_online: !!is_online, is_busy: !!is_busy, updated_at: new Date().toISOString() }).eq('id', adminData.id);
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ success: true });
}
