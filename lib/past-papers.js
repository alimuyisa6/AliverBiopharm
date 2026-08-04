 /* api/lib/past-papers.js — REPLACEMENT */
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
  const { unit_id, subject, year, exam_board, paper_type, search, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let query = supabase
    .from('past_papers')
    .select('*', { count: 'exact' })
    .eq('is_active', true)
    .order('year', { ascending: false })
    .order('title', { ascending: true })
    .range(offset, offset + parseInt(limit) - 1);

  if (unit_id) query = query.eq('unit_id', unit_id);
  if (subject) query = query.eq('subject', subject);
  if (year) query = query.eq('year', parseInt(year));
  if (exam_board) query = query.eq('exam_board', exam_board);
  if (paper_type) query = query.eq('paper_type', paper_type);
  if (search) {
    query = query.or(`title.ilike.%${search}%,subject.ilike.%${search}%`);
  }

  const { data, error, count } = await query;
  if (error) throw new SecurityError('Failed to fetch papers', 500);

  return res.status(200).json({
    papers: data || [],
    total: count || 0,
    page: parseInt(page),
    limit: parseInt(limit),
    total_pages: Math.ceil((count || 0) / parseInt(limit))
  });
}

async function getPaper(req, res) {
  const { id } = req.query;
  if (!id) throw new SecurityError('id required', 400);

  const { data, error } = await supabase
    .from('past_papers')
    .select('*')
    .eq('id', id)
    .eq('is_active', true)
    .single();

  if (error || !data) throw new SecurityError('Paper not found', 404);
  return res.status(200).json(data);
}

async function getFilterOptions(req, res) {
  const { data, error } = await supabase
    .from('past_papers')
    .select('id, subject, year, exam_board, paper_type, unit_id, curriculum_units!inner(id, name, group_id, curriculum_groups!inner(id, name, level_id, curriculum_levels!inner(id, display_name)))')
    .eq('is_active', true);

  if (error) throw new SecurityError('Failed to fetch filter options', 500);

  const levels = [];
  const subjects = new Set();
  const years = new Set();
  const examBoards = new Set();
  const paperTypes = new Set();
  const topics = [];

  for (const paper of data || []) {
    const unit = paper.curriculum_units;
    if (unit) {
      const group = unit.curriculum_groups;
      if (group) {
        const level = group.curriculum_levels;
        if (level && !levels.find(l => l.id === level.id)) {
          levels.push({ id: level.id, display_name: level.display_name });
        }
        if (group.name && !topics.find(t => t.group_name === group.name)) {
          topics.push({ group_name: group.name, unit_name: unit.name, unit_id: unit.id });
        }
      }
    }
    if (paper.subject) subjects.add(paper.subject);
    if (paper.year) years.add(paper.year);
    if (paper.exam_board) examBoards.add(paper.exam_board);
    if (paper.paper_type) paperTypes.add(paper.paper_type);
  }

  return res.status(200).json({
    levels: levels.sort((a, b) => a.display_name.localeCompare(b.display_name)),
    subjects: [...subjects].sort(),
    years: [...years].sort((a, b) => b - a),
    exam_boards: [...examBoards].sort(),
    paper_types: [...paperTypes].sort(),
    topics: topics.sort((a, b) => a.group_name.localeCompare(b.group_name))
  });
}

async function getDownloadUrl(req, res, ctx) {
  const { id } = req.query;
  if (!id) throw new SecurityError('id required', 400);

  const { data: paper, error } = await supabase
    .from('past_papers')
    .select('id, title, file_path, download_count')
    .eq('id', id)
    .eq('is_active', true)
    .single();

  if (error || !paper) throw new SecurityError('Paper not found', 404);

  const { data: signedUrl, error: urlError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(paper.file_path, 60);

  if (urlError) throw new SecurityError('Failed to generate download link', 500);

  await supabase
    .from('past_papers')
    .update({ download_count: (paper.download_count || 0) + 1 })
    .eq('id', id);

  await supabase.from('past_paper_downloads').insert({
    paper_id: id,
    user_id: ctx.userId || null,
    downloaded_at: new Date().toISOString()
  });

  return res.status(200).json({ url: signedUrl.signedUrl, expires_in: 60 });
}

async function addPaper(body, res) {
  const { title, unit_id, subject, year, exam_board, paper_type, file_path } = body;
  if (!title || !unit_id || !subject || !year || !file_path) {
    throw new SecurityError('title, unit_id, subject, year, and file_path are required', 400);
  }

  const { data, error } = await supabase
    .from('past_papers')
    .insert({
      title,
      unit_id,
      subject,
      year: parseInt(year),
      exam_board: exam_board || null,
      paper_type: paper_type || null,
      file_path,
      download_count: 0,
      is_active: true,
      created_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) throw new SecurityError('Failed to add paper', 500);
  return res.status(200).json({ success: true, paper: data });
}

async function addPapersBatch(body, res) {
  const { papers } = body;
  if (!papers || !Array.isArray(papers) || papers.length === 0) {
    throw new SecurityError('papers array required', 400);
  }

  const invalid = papers.find(
    p => !p.title || !p.unit_id || !p.subject || !p.year || !p.file_path
  );
  if (invalid) {
    throw new SecurityError('Each paper requires title, unit_id, subject, year, and file_path', 400);
  }

  const rows = papers.map(p => ({
    title: p.title,
    unit_id: p.unit_id,
    subject: p.subject,
    year: parseInt(p.year),
    exam_board: p.exam_board || null,
    paper_type: p.paper_type || null,
    file_path: p.file_path,
    download_count: 0,
    is_active: true,
    created_at: new Date().toISOString()
  }));

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

  await supabase.from('past_paper_downloads').insert({
    paper_id: id,
    user_id: ctx.userId || null,
    downloaded_at: new Date().toISOString()
  });
  return res.status(200).json({ success: true });
}
