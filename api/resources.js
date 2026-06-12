 import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

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

async function isAdmin(userId, ip) {
  if (!userId) return null;
  const { data } = await supabase.from('admin_master').select('admin_role').eq('admin_id', userId).eq('is_active', true).maybeSingle();
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
    adminData = await isAdmin(userId, req.headers['x-forwarded-for'] || 'unknown');
  }

  if (req.method === 'GET') {
    switch (path) {
      case 'get_resources': return getResources(req, res);
      case 'get_filter_options': return getFilterOptions(req, res);
      case 'get_pdfs_by_level': return getPdfsByLevel(req, res);
      case 'get_notes_structure': return getNotesStructure(req, res);
      case 'get_note_content': return getNoteContent(req, res);
      case 'get_note_preview': return getNotePreview(req, res);
      case 'get_note_reactions': return getNoteReactions(req, res);
      case 'get_reading_progress': return getReadingProgress(req, res, userId);
      case 'get_continue_reading': return getContinueReading(req, res, userId);
      default: return res.status(400).json({ error: 'Invalid action' });
    }
  }
  if (req.method === 'POST') {
    switch (path) {
      case 'submit_resource': return submitResource(req, res, userId);
      case 'approve': return approveResource(req, res, adminData);
      case 'track_pdf_preview': return trackPdfPreview(req, res, userId);
      case 'track_pdf_download': return trackPdfDownload(req, res, userId);
      case 'toggle_note_reaction': return toggleNoteReaction(req, res, userId);
      case 'save_reading_progress': return saveReadingProgress(req, res, userId);
      default: return res.status(400).json({ error: 'Invalid action' });
    }
  }
  res.status(405).json({ error: 'Method not allowed' });
}

async function getResources(req, res) {
  let query = supabase.from('biology_notes').select('id,title,description,author,level,category,tag,section_type,file_url,file_size,download_count,created_at').order('created_at', { ascending: false }).limit(100);
  const { level, category, tag } = req.query;
  if (level) query = query.eq('level', level);
  if (category) query = query.eq('category', category);
  if (tag) query = query.eq('tag', tag);
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json(data || []);
}

async function getFilterOptions(req, res) {
  const [l, c, t] = await Promise.all([
    supabase.from('biology_notes').select('level').limit(500),
    supabase.from('biology_notes').select('category').limit(500),
    supabase.from('biology_notes').select('tag').limit(500)
  ]);
  return res.status(200).json({
    levels: [...new Set((l.data||[]).map(x=>x.level).filter(Boolean))],
    categories: [...new Set((c.data||[]).map(x=>x.category).filter(Boolean))],
    tags: [...new Set((t.data||[]).map(x=>x.tag).filter(Boolean))]
  });
}

async function getPdfsByLevel(req, res) {
  const { level } = req.query;
  if (!level) return res.status(400).json({ error: 'Level required' });
  const { data, error } = await supabase.from('pdf_resources').select('id,title,author,level,topic,subtopic,file_url,file_size,download_count,preview_count').eq('level', level).eq('is_active', true).order('topic', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ pdfs: data || [] });
}

async function getNotesStructure(req, res) {
  const { data, error } = await supabase.from('notes_structure').select('*').order('level_order', { ascending: true }).order('topic_order', { ascending: true }).order('subtopic_order', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json(data || []);
}

async function getNoteContent(req, res) {
  const { subtopic_id } = req.query;
  if (!subtopic_id) return res.status(400).json({ error: 'subtopic_id required' });
  const { data, error } = await supabase.from('note_contents').select('*').eq('subtopic_id', subtopic_id).single();
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json(data);
}

async function getNotePreview(req, res) {
  const { subtopic_id } = req.query;
  if (!subtopic_id) return res.status(400).json({ error: 'subtopic_id required' });
  const { data, error } = await supabase.from('note_contents').select('content, title').eq('subtopic_id', subtopic_id).single();
  if (error) return res.status(500).json({ error: error.message });
  const plainText = data?.content?.replace(/<[^>]*>/g, '') || '';
  const preview = plainText.substring(0, 400) + (plainText.length > 400 ? '...' : '');
  return res.status(200).json({ subtopic_id, title: data?.title || '', preview, read_time: Math.ceil(plainText.split(/\s+/).length / 200) });
}

async function getNoteReactions(req, res) {
  const { note_id } = req.query;
  if (!note_id) return res.status(400).json({ error: 'note_id required' });
  const { data, error } = await supabase.from('note_reactions').select('reaction_type, user_id, created_at').eq('note_id', note_id);
  if (error) return res.status(500).json({ error: error.message });
  const counts = { like: 0, love: 0, helpful: 0 };
  (data || []).forEach(r => { if (counts[r.reaction_type] !== undefined) counts[r.reaction_type]++; });
  return res.status(200).json({ counts, total: (data || []).length });
}

async function getReadingProgress(req, res, userId) {
  if (!userId) return res.status(200).json(null);
  const { note_id } = req.query;
  const { data, error } = await supabase.from('user_interactions').select('value, metadata, created_at').eq('user_id', userId).eq('interaction_type', 'reading_progress').filter('metadata->>note_id', 'eq', note_id).maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json(data ? { scroll_percentage: data.value || 0, scroll_position: data.metadata?.scroll_position || 0, completed: data.metadata?.completed || false, last_accessed: data.created_at, time_spent: data.metadata?.time_spent || 0 } : null);
}

async function getContinueReading(req, res, userId) {
  if (!userId) return res.status(200).json([]);
  const limit = parseInt(req.query.limit) || 10;
  const { data, error } = await supabase.from('user_interactions').select('resource_id, value, metadata, created_at').eq('user_id', userId).eq('interaction_type', 'reading_progress').neq('value', 100).gt('value', 5).order('created_at', { ascending: false }).limit(limit);
  if (error) return res.status(500).json({ error: error.message });
  const notes = [];
  for (const item of (data || [])) {
    const { data: noteData } = await supabase.from('notes_structure').select('subtopic_name, topic, level').eq('subtopic_id', item.resource_id).maybeSingle();
    if (noteData) notes.push({ note_id: item.resource_id, title: noteData.subtopic_name, topic: noteData.topic, level: noteData.level, progress_percentage: item.value, last_accessed: item.created_at });
  }
  return res.status(200).json(notes);
}

async function submitResource(req, res, userId) {
  if (!userId) return res.status(401).json({ error: 'Authentication required' });
  const { payload } = req.body;
  const { error } = await supabase.from('resource_submissions').insert({ title: payload.title, description: payload.description, author: payload.author, level: payload.level, category: payload.category, tag: payload.tag, section_type: payload.section_type, file_url: payload.file_url, file_size: payload.file_size, status: 'pending' });
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ success: true });
}

async function approveResource(req, res, adminData) {
  if (!adminData) return res.status(403).json({ error: 'Admin required' });
  const { submissionId, action } = req.body;
  if (!submissionId) return res.status(400).json({ error: 'submissionId required' });
  if (action === 'delete') {
    await supabase.from('resource_submissions').delete().eq('id', submissionId);
  } else if (action === 'approve') {
    const { data: sub } = await supabase.from('resource_submissions').select('*').eq('id', submissionId).single();
    if (sub) {
      await supabase.from('biology_notes').insert({ title: sub.title, description: sub.description, author: sub.author, level: sub.level, category: sub.category, tag: sub.tag, section_type: sub.section_type, file_url: sub.file_url, file_size: sub.file_size });
      await supabase.from('resource_submissions').update({ status: 'approved' }).eq('id', submissionId);
    }
  } else {
    await supabase.from('resource_submissions').update({ status: 'rejected' }).eq('id', submissionId);
  }
  return res.status(200).json({ success: true });
}

async function trackPdfPreview(req, res, userId) {
  if (!userId) return res.status(401).json({ error: 'Authentication required' });
  const { pdf_id } = req.body;
  const { data: current } = await supabase.from('pdf_resources').select('preview_count').eq('id', pdf_id).single();
  if (current) await supabase.from('pdf_resources').update({ preview_count: (current.preview_count || 0) + 1 }).eq('id', pdf_id);
  await supabase.from('user_interactions').insert({ user_id: userId, interaction_type: 'view', resource_id: pdf_id, metadata: { pdf_id, action: 'preview' } });
  return res.status(200).json({ success: true });
}

async function trackPdfDownload(req, res, userId) {
  if (!userId) return res.status(401).json({ error: 'Authentication required' });
  const { pdf_id } = req.body;
  const { data: current } = await supabase.from('pdf_resources').select('download_count').eq('id', pdf_id).single();
  if (current) await supabase.from('pdf_resources').update({ download_count: (current.download_count || 0) + 1 }).eq('id', pdf_id);
  await supabase.from('user_interactions').insert({ user_id: userId, interaction_type: 'download', resource_id: pdf_id, metadata: { pdf_id, action: 'download' } });
  return res.status(200).json({ success: true });
}

async function toggleNoteReaction(req, res, userId) {
  if (!userId) return res.status(401).json({ error: 'Authentication required' });
  const { note_id, reaction_type } = req.body;
  const { data: existing } = await supabase.from('note_reactions').select('id, reaction_type').eq('user_id', userId).eq('note_id', note_id).maybeSingle();
  if (existing) {
    if (existing.reaction_type === reaction_type) {
      await supabase.from('note_reactions').delete().eq('id', existing.id);
    } else {
      await supabase.from('note_reactions').update({ reaction_type }).eq('id', existing.id);
    }
  } else {
    await supabase.from('note_reactions').insert({ user_id: userId, note_id, reaction_type });
  }
  const { count } = await supabase.from('note_reactions').select('id', { count: 'exact', head: true }).eq('note_id', note_id);
  return res.status(200).json({ success: true, count: count || 0 });
}

async function saveReadingProgress(req, res, userId) {
  if (!userId) return res.status(401).json({ error: 'Authentication required' });
  const { note_id, scroll_percentage, scroll_position, time_spent, completed } = req.body;
  const numericNoteId = parseInt(note_id, 10) || 0;
  const { data: existing } = await supabase.from('user_interactions').select('id, metadata, value').eq('user_id', userId).eq('interaction_type', 'reading_progress').filter('metadata->>note_id', 'eq', note_id).maybeSingle();
  if (existing) {
    const currentTimeSpent = (existing.metadata?.time_spent || 0) + (time_spent || 0);
    await supabase.from('user_interactions').update({ value: scroll_percentage, metadata: { note_id, scroll_position: scroll_position || existing.metadata?.scroll_position || 0, time_spent: currentTimeSpent, completed: completed || false, last_updated: new Date().toISOString() }, created_at: new Date().toISOString() }).eq('id', existing.id);
  } else {
    await supabase.from('user_interactions').insert({ user_id: userId, interaction_type: 'reading_progress', resource_id: numericNoteId, value: scroll_percentage, metadata: { note_id, scroll_position: scroll_position || 0, time_spent: time_spent || 0, completed: completed || false, started_at: new Date().toISOString() } });
  }
  return res.status(200).json({ success: true });
}
