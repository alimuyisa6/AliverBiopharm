/* lib/past-papers.js */
import { supabase } from './core.js';
import {
  parseAndValidateBody,
  requireAuth,
  requireAdmin,
  SecurityError,
} from './security-middleware.js';
import { getUserCurriculumScope } from './curriculum.js';

const STORAGE_BUCKET = 'past-papers';

export async function handler(req, res, path, ctx) {
  if (req.method === 'GET') {
    requireAuth(ctx);
    return handleGet(path, req, res, ctx);
  }
  if (req.method === 'POST') {
    if (path === 'track_download') {
      requireAuth(ctx);
      const body = await parseAndValidateBody(req);
      return trackDownload(body, res, ctx);
    }
    if (path === 'toggle_bookmark' || path === 'track_view') {
      requireAuth(ctx);
      const body = await parseAndValidateBody(req);
      return handlePost(path, body, req, res, ctx);
    }
    requireAdmin(ctx);
    const body = await parseAndValidateBody(req);
    return handlePost(path, body, req, res, ctx);
  }
  throw new SecurityError('Method not allowed', 405);
}

async function handleGet(path, req, res, ctx) {
  switch (path) {
    case 'get_papers':         return getPapers(req, res, ctx);
    case 'get_paper':          return getPaper(req, res, ctx);
    case 'get_filter_options': return getFilterOptions(req, res, ctx);
    case 'get_download_url':   return getDownloadUrl(req, res, ctx);
    case 'get_user_stats':     return getUserPaperStats(req, res, ctx);
    case 'get_bookmarked':     return getBookmarkedPapers(req, res, ctx);
    case 'get_download_history': return getDownloadHistory(req, res, ctx);
    default: throw new SecurityError('Invalid action', 400);
  }
}

async function handlePost(path, body, req, res, ctx) {
  switch (path) {
    case 'add_paper':         return addPaper(body, res);
    case 'add_papers_batch':  return addPapersBatch(body, res);
    case 'delete_paper':      return deletePaper(body, res);
    case 'toggle_bookmark':   return toggleBookmark(body, res, ctx);
    case 'track_view':        return trackView(body, res, ctx);
    case 'track_download':    return trackDownload(body, res, ctx);
    default: throw new SecurityError('Invalid action', 400);
  }
}

async function getActiveUnitIds(ctx) {
  if (ctx.adminData) return null;
  const scope = await getUserCurriculumScope(ctx.userId);
  if (!scope || !scope.active_group_id) return [];
  const { data: units } = await supabase
    .from('curriculum_units')
    .select('id')
    .eq('group_id', scope.active_group_id)
    .eq('is_active', true);
  return (units || []).map(u => u.id);
}

async function getPapers(req, res, ctx) {
  const allowedUnitIds = await getActiveUnitIds(ctx);
  if (allowedUnitIds !== null && allowedUnitIds.length === 0) {
    return res.status(200).json({ papers: [], total: 0, page: 1, limit: 20, total_pages: 0 });
  }

  const { unit_id, subject, year, exam_board, paper_type, search, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let query = supabase
    .from('past_papers')
    .select('*', { count: 'exact' })
    .eq('is_active', true)
    .order('year', { ascending: false })
    .order('title', { ascending: true })
    .range(offset, offset + parseInt(limit) - 1);

  if (unit_id) {
    if (allowedUnitIds !== null && !allowedUnitIds.includes(unit_id)) {
      return res.status(200).json({ papers: [], total: 0, page: parseInt(page), limit: parseInt(limit), total_pages: 0 });
    }
    query = query.eq('unit_id', unit_id);
  } else if (allowedUnitIds !== null) {
    query = query.in('unit_id', allowedUnitIds);
  }

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
    total_pages: Math.ceil((count || 0) / parseInt(limit)),
  });
}

async function getPaper(req, res, ctx) {
  const { id } = req.query;
  if (!id) throw new SecurityError('id required', 400);

  const { data, error } = await supabase
    .from('past_papers')
    .select('*')
    .eq('id', id)
    .eq('is_active', true)
    .single();

  if (error || !data) throw new SecurityError('Paper not found', 404);

  const allowedUnitIds = await getActiveUnitIds(ctx);
  if (allowedUnitIds !== null && !allowedUnitIds.includes(data.unit_id)) {
    throw new SecurityError('Paper not available in your curriculum', 403);
  }

  return res.status(200).json(data);
}

async function getFilterOptions(req, res, ctx) {
  const allowedUnitIds = await getActiveUnitIds(ctx);
  if (allowedUnitIds !== null && allowedUnitIds.length === 0) {
    return res.status(200).json({ levels: [], subjects: [], years: [], exam_boards: [], paper_types: [], topics: [] });
  }

  let query = supabase
    .from('past_papers')
    .select('id, subject, year, exam_board, paper_type, unit_id, curriculum_units!inner(id, name, group_id, curriculum_groups!inner(id, name, level_id, curriculum_levels!inner(id, display_name)))')
    .eq('is_active', true);

  if (allowedUnitIds !== null) {
    query = query.in('unit_id', allowedUnitIds);
  }

  const { data, error } = await query;
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
        if (group.name && !topics.find(t => t.unit_id === unit.id)) {
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
    topics: topics.sort((a, b) => a.group_name.localeCompare(b.group_name)),
  });
}

async function getDownloadUrl(req, res, ctx) {
  const { id } = req.query;
  if (!id) throw new SecurityError('id required', 400);

  const { data: paper, error } = await supabase
    .from('past_papers')
    .select('id, title, file_path, download_count, unit_id')
    .eq('id', id)
    .eq('is_active', true)
    .single();

  if (error || !paper) throw new SecurityError('Paper not found', 404);

  const allowedUnitIds = await getActiveUnitIds(ctx);
  if (allowedUnitIds !== null && !allowedUnitIds.includes(paper.unit_id)) {
    throw new SecurityError('Paper not available in your curriculum', 403);
  }

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
    user_id: ctx.userId,
    downloaded_at: new Date().toISOString(),
  });

  const { data: existingInteraction } = await supabase
    .from('user_paper_interactions')
    .select('id')
    .eq('user_id', ctx.userId)
    .eq('paper_id', id)
    .maybeSingle();

  if (existingInteraction) {
    await supabase
      .from('user_paper_interactions')
      .update({
        downloaded: true,
        last_downloaded_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', existingInteraction.id);
  } else {
    await supabase
      .from('user_paper_interactions')
      .insert({
        user_id: ctx.userId,
        paper_id: id,
        downloaded: true,
        last_downloaded_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
  }

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
      created_at: new Date().toISOString(),
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
    created_at: new Date().toISOString(),
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
    user_id: ctx.userId,
    downloaded_at: new Date().toISOString(),
  });

  const { data: existingInteraction } = await supabase
    .from('user_paper_interactions')
    .select('id')
    .eq('user_id', ctx.userId)
    .eq('paper_id', id)
    .maybeSingle();

  if (existingInteraction) {
    await supabase
      .from('user_paper_interactions')
      .update({
        downloaded: true,
        last_downloaded_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', existingInteraction.id);
  } else {
    await supabase
      .from('user_paper_interactions')
      .insert({
        user_id: ctx.userId,
        paper_id: id,
        downloaded: true,
        last_downloaded_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
  }

  return res.status(200).json({ success: true });
}

async function getUserPaperStats(req, res, ctx) {
  const { paper_id } = req.query;

  if (!paper_id) throw new SecurityError('paper_id required', 400);

  const { data, error } = await supabase
    .from('user_paper_interactions')
    .select('bookmarked, downloaded, viewed, last_viewed_at, last_downloaded_at')
    .eq('user_id', ctx.userId)
    .eq('paper_id', paper_id)
    .maybeSingle();

  if (error) throw new SecurityError('Failed to fetch paper stats', 500);

  return res.status(200).json(data || {
    bookmarked: false,
    downloaded: false,
    viewed: false,
    last_viewed_at: null,
    last_downloaded_at: null
  });
}

async function toggleBookmark(body, res, ctx) {
  const { paper_id } = body;

  if (!paper_id) throw new SecurityError('paper_id required', 400);

  const { data: existing } = await supabase
    .from('user_paper_interactions')
    .select('id, bookmarked')
    .eq('user_id', ctx.userId)
    .eq('paper_id', paper_id)
    .maybeSingle();

  if (existing) {
    const newBookmarked = !existing.bookmarked;

    await supabase
      .from('user_paper_interactions')
      .update({
        bookmarked: newBookmarked,
        updated_at: new Date().toISOString()
      })
      .eq('id', existing.id);

    return res.status(200).json({ bookmarked: newBookmarked });
  }

  await supabase
    .from('user_paper_interactions')
    .insert({
      user_id: ctx.userId,
      paper_id,
      bookmarked: true,
      updated_at: new Date().toISOString()
    });

  return res.status(200).json({ bookmarked: true });
}

async function getBookmarkedPapers(req, res, ctx) {
  const { page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const { data, error, count } = await supabase
    .from('user_paper_interactions')
    .select('paper_id, past_papers(*)', { count: 'exact' })
    .eq('user_id', ctx.userId)
    .eq('bookmarked', true)
    .eq('past_papers.is_active', true)
    .order('updated_at', { ascending: false })
    .range(offset, offset + parseInt(limit) - 1);

  if (error) throw new SecurityError('Failed to fetch bookmarked papers', 500);

  const papers = (data || []).map((item) => item.past_papers).filter(Boolean);

  return res.status(200).json({
    papers,
    total: count || 0,
    page: parseInt(page),
    limit: parseInt(limit),
    total_pages: Math.ceil((count || 0) / parseInt(limit))
  });
}

async function trackView(body, res, ctx) {
  const { paper_id } = body;

  if (!paper_id) throw new SecurityError('paper_id required', 400);

  const { data: existing } = await supabase
    .from('user_paper_interactions')
    .select('id')
    .eq('user_id', ctx.userId)
    .eq('paper_id', paper_id)
    .maybeSingle();

  if (existing) {
    await supabase
      .from('user_paper_interactions')
      .update({
        viewed: true,
        last_viewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', existing.id);
  } else {
    await supabase
      .from('user_paper_interactions')
      .insert({
        user_id: ctx.userId,
        paper_id,
        viewed: true,
        last_viewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
  }

  return res.status(200).json({ success: true });
}

async function getDownloadHistory(req, res, ctx) {
  const { page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const { data, error, count } = await supabase
    .from('past_paper_downloads')
    .select('paper_id, downloaded_at, past_papers(*)', { count: 'exact' })
    .eq('user_id', ctx.userId)
    .eq('past_papers.is_active', true)
    .order('downloaded_at', { ascending: false })
    .range(offset, offset + parseInt(limit) - 1);

  if (error) throw new SecurityError('Failed to fetch download history', 500);

  const papers = (data || []).map((item) => ({
    ...item.past_papers,
    downloaded_at: item.downloaded_at
  })).filter((paper) => paper.id);

  return res.status(200).json({
    papers,
    total: count || 0,
    page: parseInt(page),
    limit: parseInt(limit),
    total_pages: Math.ceil((count || 0) / parseInt(limit))
  });
}
