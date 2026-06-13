import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function setCorsHeaders(res, req) {
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'https://aliverbiopharm.com').split(',').map(o => o.trim());
  const requestOrigin = req.headers.origin || '';
  const corsOrigin = allowedOrigins.includes(requestOrigin) ? requestOrigin : allowedOrigins[0];
  res.setHeader('Access-Control-Allow-Origin', corsOrigin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-CSRF-Token, Cookie');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Cache-Control', 'no-store, must-revalidate');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
}

function parseCookies(req) {
  const cookieHeader = req.headers.cookie || '';
  return Object.fromEntries(cookieHeader.split(';').map(c => {
    const [k, ...v] = c.trim().split('=');
    return [k.trim(), decodeURIComponent(v.join('='))];
  }));
}

function hashToken(token) { return crypto.createHash('sha256').update(token).digest('hex'); }

async function validateSession(token) {
  if (!token || token.length < 20) return null;
  const hashedToken = hashToken(token);
  const { data, error } = await supabase.from('user_sessions').select('user_id, expires_at, is_active').eq('session_token_hash', hashedToken).eq('is_active', true).single();
  if (error || !data) return null;
  if (new Date(data.expires_at) < new Date()) {
    await supabase.from('user_sessions').update({ is_active: false }).eq('session_token_hash', hashedToken);
    return null;
  }
  return data;
}

async function isAdmin(userId) {
  if (!userId) return null;
  const { data } = await supabase.from('admin_master').select('admin_role, permissions, id').eq('admin_id', userId).eq('is_active', true).maybeSingle();
  return data;
}

export default async function handler(req, res) {
  setCorsHeaders(res, req);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { path } = req.query;
  const cookies = parseCookies(req);
  const token = cookies.session || '';
  let userId = null;
  let adminData = null;

  if (token) {
    const session = await validateSession(token);
    if (session) userId = session.user_id;
    if (userId) adminData = await isAdmin(userId);
  }

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
    switch (path) {
      case 'request_chat': return requestChat(req, res, userId);
      case 'send_chat_message': return sendChatMessage(req, res, userId);
      case 'delete_chat_message': return deleteChatMessage(req, res, userId);
      case 'update_user_presence': return updateUserPresence(req, res, userId);
      case 'admin_accept_chat': return adminAcceptChat(req, res, adminData);
      case 'admin_reject_chat': return adminRejectChat(req, res, adminData);
      case 'admin_update_presence': return adminUpdatePresence(req, res, adminData);
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
  const adminData = await isAdmin(userId);
  if (room.user_id !== userId && !adminData) return res.status(403).json({ error: 'Access denied' });
  const { data, error } = await supabase.from('chat_messages').select('id, sender_type, content, created_at, deleted_by_user').eq('room_id', room_id).eq('deleted_by_user', false).order('created_at', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json(data || []);
}

async function sendChatMessage(req, res, userId) {
  if (!userId) return res.status(401).json({ error: 'Authentication required' });
  const { room_id, message } = req.body;
  if (!room_id || !message?.trim()) return res.status(400).json({ error: 'room_id and message required' });
  const { data: room } = await supabase.from('chat_rooms').select('user_id, status').eq('id', room_id).maybeSingle();
  if (!room) return res.status(404).json({ error: 'Room not found' });
  const adminData = await isAdmin(userId);
  if (room.user_id !== userId && !adminData) return res.status(403).json({ error: 'Access denied' });
  const senderType = adminData ? 'admin' : 'user';
  const { data, error } = await supabase.from('chat_messages').insert({ room_id, sender_type: senderType, content: message.trim(), deleted_by_user: false, created_at: new Date().toISOString() }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  if (room.status === 'requested' && senderType === 'admin') {
    await supabase.from('chat_rooms').update({ status: 'active', assigned_admin: userId }).eq('id', room_id);
  }
  return res.status(200).json({ success: true, message: data });
}

async function deleteChatMessage(req, res, userId) {
  if (!userId) return res.status(401).json({ error: 'Authentication required' });
  const { message_id } = req.body;
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
    try {
      const { data: { user } } = await supabase.auth.admin.getUserById(room.user_id);
      rooms.push({ ...room, user_email: user?.email || 'Unknown' });
    } catch { rooms.push({ ...room, user_email: 'Unknown' }); }
  }
  return res.status(200).json(rooms);
}

async function adminAcceptChat(req, res, adminData) {
  if (!adminData) return res.status(403).json({ error: 'Admin required' });
  const { room_id } = req.body;
  if (!room_id) return res.status(400).json({ error: 'room_id required' });
  const { error } = await supabase.from('chat_rooms').update({ status: 'active', assigned_admin: adminData.id }).eq('id', room_id);
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ success: true });
}

async function adminRejectChat(req, res, adminData) {
  if (!adminData) return res.status(403).json({ error: 'Admin required' });
  const { room_id } = req.body;
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
    try {
      const { data: { user } } = await supabase.auth.admin.getUserById(room.user_id);
      rooms.push({ ...room, user_email: user?.email || 'Unknown' });
    } catch { rooms.push({ ...room, user_email: 'Unknown' }); }
  }
  return res.status(200).json(rooms);
}

async function adminUpdatePresence(req, res, adminData) {
  if (!adminData) return res.status(403).json({ error: 'Admin required' });
  const { is_online, is_busy } = req.body;
  const { error } = await supabase.from('admin_master').update({ is_online: !!is_online, is_busy: !!is_busy, updated_at: new Date().toISOString() }).eq('id', adminData.id);
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ success: true });
}
