 import { supabase } from './core.js';
import { parseAndValidateBody, SecurityError } from './security-middleware.js';

const STORAGE_BUCKET = 'past-papers';

export async function handler(req, res, path, ctx) {
  if (req.method === 'GET') {
    switch (path) {
      case 'get_papers': return getPapers(req, res);
      case 'get_paper': return getPaper(req, res);
      case 'get_filter_options': return getFilterOptions(req, res);
      case 'get_download_url': return getDownloadUrl(req, res, ctx);
      default: throw new SecurityError('Invalid action', 400);
    }
  }
  if (req.method === 'POST') {
    if (!ctx.adminData) throw new SecurityError('Admin required', 403);
    const body = await parseAndValidateBody(req);
    switch (path) {
      case 'add_paper': return addPaper(body, res);
      case 'add_papers_batch': return addPapersBatch(body, res);
      case 'delete_paper': return deletePaper(body, res);
      case 'track_download': return trackDownload(body, res, ctx);
      default: throw new SecurityError('Invalid action', 400);
    }
  }
  throw new SecurityError('Method not allowed', 405);
}

async function getPapers(req, res) {
  const { level, subject, year, exam_board, paper_type, topic, search, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  let query = supabase.from('past_papers').select('*', { count: 'exact' }).eq('is_active', true).order('year', { ascending: false }).order('title', { ascending: true }).range(offset, offset + parseInt(limit) - 1);
  if (level) query = query.eq('level', level);
  if (subject) query = query.eq('subject', subject);
  if (year) query = query.eq('year', parseInt(year));
  if (exam_board) query = query.eq('exam_board', exam_board);
  if (paper_type) query = query.eq('paper_type', paper_type);
  if (topic) query = query.eq('topic', topic);
  if (search) query = query.or(`title.ilike.%${search}%,subject.ilike.%${search}%,topic.ilike.%${search}%`);
  const { data, error, count } = await query;
  if (error) throw new SecurityError('Failed to fetch papers', 500);
  return res.status(200).json({ papers: data || [], total: count || 0, page: parseInt(page), limit: parseInt(limit), total_pages: Math.ceil((count || 0) / parseInt(limit)) });
}

async function getPaper(req, res) {
  const { id } = req.query;
  if (!id) throw new SecurityError('id required', 400);
  const { data, error } = await supabase.from('past_papers').select('*').eq('id', id).eq('is_active', true).single();
  if (error || !data) throw new SecurityError('Paper not found', 404);
  return res.status(200).json(data);
}

async function getFilterOptions(req, res) {
  const { data, error } = await supabase.from('past_papers').select('level, subject, year, exam_board, paper_type, topic').eq('is_active', true);
  if (error) throw new SecurityError('Failed to fetch filter options', 500);
  const unique = (arr, key) => [...new Set(arr.map(r => r[key]).filter(Boolean))].sort();
  return res.status(200).json({ levels: unique(data, 'level'), subjects: unique(data, 'subject'), years: [...new Set(data.map(r => r.year).filter(Boolean))].sort((a, b) => b - a), exam_boards: unique(data, 'exam_board'), paper_types: unique(data, 'paper_type'), topics: unique(data, 'topic') });
}

async function getDownloadUrl(req, res, ctx) {
  const { id } = req.query;
  if (!id) throw new SecurityError('id required', 400);
  const { data: paper, error } = await supabase.from('past_papers').select('id, title, file_path').eq('id', id).eq('is_active', true).single();
  if (error || !paper) throw new SecurityError('Paper not found', 404);
  const { data: signedUrl, error: urlError } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(paper.file_path, 60);
  if (urlError) throw new SecurityError('Failed to generate download link', 500);
  await supabase.from('past_papers').update({ download_count: supabase.rpc('increment', { x: 1 }) }).eq('id', id);
  await supabase.from('past_paper_downloads').insert({ paper_id: id, user_id: ctx.userId || null, downloaded_at: new Date().toISOString() });
  return res.status(200).json({ url: signedUrl.signedUrl, expires_in: 60 });
}

async function addPaper(body, res) {
  const { title, level, subject, year, exam_board, paper_type, topic, file_path } = body;
  if (!title || !level || !subject || !year || !file_path) throw new SecurityError('title, level, subject, year, and file_path are required', 400);
  const { data, error } = await supabase.from('past_papers').insert({ title, level, subject, year: parseInt(year), exam_board: exam_board || null, paper_type: paper_type || null, topic: topic || null, file_path, download_count: 0, is_active: true, created_at: new Date().toISOString() }).select().single();
  if (error) throw new SecurityError('Failed to add paper', 500);
  return res.status(200).json({ success: true, paper: data });
}

async function addPapersBatch(body, res) {
  const { papers } = body;
  if (!papers || !Array.isArray(papers) || papers.length === 0) throw new SecurityError('papers array required', 400);
  const invalid = papers.find(p => !p.title || !p.level || !p.subject || !p.year || !p.file_path);
  if (invalid) throw new SecurityError('Each paper requires title, level, subject, year, and file_path', 400);
  const rows = papers.map(p => ({ title: p.title, level: p.level, subject: p.subject, year: parseInt(p.year), exam_board: p.exam_board || null, paper_type: p.paper_type || null, topic: p.topic || null, file_path: p.file_path, download_count: 0, is_active: true, created_at: new Date().toISOString() }));
  const { error } = await supabase.from('past_papers').insert(rows);
  if (error) throw new SecurityError('Failed to add papers', 500);
  return res.status(200).json({ success: true, added: rows.length });
}

async function deletePaper(body, res) {
  const { id } = body;
  if (!id) throw new SecurityError('id required', 400);
  const { error } = await supabase.from('past_papers').update({ is_active: false }).eq('id', id);
  if (error) throw new SecurityError('Failed to delete paper', 500);
  return res.status(200).json({ success: true });
}

async function trackDownload(body, res, ctx) {
  const { id } = body;
  if (!id) throw new SecurityError('id required', 400);
  await supabase.from('past_paper_downloads').insert({ paper_id: id, user_id: ctx.userId || null, downloaded_at: new Date().toISOString() });
  return res.status(200).json({ success: true });
}

async function getPapers(req, res, userId) {
  const { level, subject, year, exam_board, paper_type, topic, search, class_name, page = 1, limit = 20 } = req.query;
  validateLevel(level);

  if (level) await checkPaperAccess(userId, level, class_name || null);

  const offset = (parseInt(page) - 1) * parseInt(limit);
  let query = supabase.from('past_papers').select('*', { count: 'exact' }).eq('is_active', true).order('year', { ascending: false }).order('title', { ascending: true }).range(offset, offset + parseInt(limit) - 1);
  if (level) query = query.eq('level', level);
  if (class_name) query = query.eq('class_name', class_name);
  if (subject) query = query.eq('subject', subject);
  if (year) query = query.eq('year', parseInt(year));
  if (exam_board) query = query.eq('exam_board', exam_board);
  if (paper_type) query = query.eq('paper_type', paper_type);
  if (topic) query = query.eq('topic', topic);
  if (search) query = query.or(`title.ilike.%${search}%,subject.ilike.%${search}%,topic.ilike.%${search}%`);

  const { data, error, count } = await query;
  if (error) throw new SecurityError('Failed to fetch papers', 500);

  let papers = data || [];
  if (userId) {
    const superAdmin = await isSuperAdmin(userId);
    if (!superAdmin) {
      const filtered = [];
      for (const p of papers) {
        if (!p.class_name) { filtered.push(p); continue; }
        const allowed = await enforceClassAccess(userId, p.level, p.class_name);
        if (allowed) filtered.push(p);
      }
      papers = filtered;
    }
  } else {
    papers = papers.filter(p => !p.class_name);
  }

  return res.status(200).json({ papers, total: count || 0, page: parseInt(page), limit: parseInt(limit), total_pages: Math.ceil((count || 0) / parseInt(limit)) });
}
