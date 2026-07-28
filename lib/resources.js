 import { supabase } from './core.js';
import { parseAndValidateBody, requireAuth, SecurityError } from './security-middleware.js';
import { getUnitAccessInfo, resolveBreadcrumb, resolveUnitTitle } from './curriculum.js';
import { checkContentAccess, checkDownloadAccess } from './premium.js';

export async function handler(req, res, path, ctx) {
  if (req.method === 'GET') {
    switch (path) {
      case 'get_resources': return listResources(req, res, ctx);
      case 'get_filter_options': return getFilterOptions(req, res);
      case 'get_pdfs_by_level': return getPdfsByLevel(req, res, ctx);
      case 'get_notes_structure': return getNotesList(req, res, ctx);
      case 'get_note_content': return getNoteDetail(req, res, ctx);
      case 'get_note_preview': return getNotePreview(req, res, ctx);
      case 'get_note_reactions': return getNoteReactions(req, res);
      case 'get_reading_progress': requireAuth(ctx); return getReadingProgress(req, res, ctx);
      case 'get_continue_reading': requireAuth(ctx); return getContinueReading(req, res, ctx);
      case 'get_all_ratings': return getAllRatings(req, res);
      default: throw new SecurityError('Invalid action', 400);
    }
  }
  if (req.method === 'POST') {
    const body = await parseAndValidateBody(req);
    switch (path) {
      case 'submit_resource': requireAuth(ctx); return submitResource(body, res, ctx);
      case 'approve': return approveResource(body, res, ctx);
      case 'track_pdf_preview': requireAuth(ctx); return trackPdfPreview(body, res, ctx);
      case 'track_pdf_download': requireAuth(ctx); return trackPdfDownload(body, res, ctx);
      case 'toggle_note_reaction': requireAuth(ctx); return toggleNoteReaction(body, res, ctx);
      case 'save_reading_progress': requireAuth(ctx); return saveReadingProgress(body, res, ctx);
      default: throw new SecurityError('Invalid action', 400);
    }
  }
  throw new SecurityError('Method not allowed', 405);
}

async function listResources(req, res, ctx) {
  const { unit_id, category } = req.query;
  let query = supabase
    .from('notes')
    .select('id, slug, title, content_preview, author, file_url, category, tag, section_type, read_time, word_count, is_premium, display_order, unit_id')
    .eq('is_active', true)
    .order('display_order', { ascending: true });
  if (unit_id) query = query.eq('unit_id', unit_id);
  if (category) query = query.eq('category', category);
  const { data, error } = await query;
  if (error) throw new SecurityError('Failed to fetch resources', 500);
  return res.status(200).json(data || []);
}

async function getFilterOptions(req, res) {
  const [{ data: cats }, { data: tags }] = await Promise.all([
    supabase.from('notes').select('category').limit(500),
    supabase.from('notes').select('tag').limit(500)
  ]);
  return res.status(200).json({
    categories: [...new Set((cats || []).map(r => r.category).filter(Boolean))],
    tags: [...new Set((tags || []).map(r => r.tag).filter(Boolean))]
  });
}

async function getPdfsByLevel(req, res, ctx) {
  const { unit_id } = req.query;
  if (!unit_id) throw new SecurityError('unit_id required', 400);
  const { data, error } = await supabase
    .from('pdf_resources')
    .select('id, title, author, file_url, file_size, preview_count, download_count')
    .eq('unit_id', unit_id)
    .eq('is_active', true)
    .order('title', { ascending: true });
  if (error) throw new SecurityError('Failed to fetch PDFs', 500);
  return res.status(200).json({ pdfs: data || [] });
}

async function getNotesList(req, res, ctx) {
  const { unit_id } = req.query;
  if (!unit_id) throw new SecurityError('unit_id required', 400);
  const { data, error } = await supabase
    .from('notes')
    .select('id, slug, title, content_preview, display_order, unit_id')
    .eq('unit_id', unit_id)
    .eq('is_active', true)
    .order('display_order', { ascending: true });
  if (error) throw new SecurityError('Failed to fetch notes structure', 500);
  return res.status(200).json(data || []);
}

async function getNoteDetail(req, res, ctx) {
  const { id, slug } = req.query;
  if (!id && !slug) throw new SecurityError('id or slug required', 400);
  let query = supabase.from('notes').select('*').eq('is_active', true);
  query = id ? query.eq('id', id) : query.eq('slug', slug);
  const { data: note, error } = await query.maybeSingle();
  if (error) throw new SecurityError('Failed to fetch note', 500);
  if (!note) throw new SecurityError('Note not found', 404);

  const unitInfo = await getUnitAccessInfo(note.unit_id);
  const email = ctx.authenticated ? (await supabase.auth.admin.getUserById(ctx.userId)).data?.user?.email : null;
  const access = await checkContentAccess(email, ctx.userId, 'note', note.id, note.is_premium || unitInfo?.is_premium);
  if (!access.allowed) {
    return res.status(200).json({ locked: true, reason: access.reason, title: note.title, id: note.id });
  }
  const breadcrumb = await resolveBreadcrumb(note.unit_id);
  const titleInfo = await resolveUnitTitle(note.unit_id);
  return res.status(200).json({ ...note, breadcrumb, unit_title: titleInfo });
}

async function getNotePreview(req, res, ctx) {
  const { id } = req.query;
  if (!id) throw new SecurityError('id required', 400);
  const { data: note } = await supabase.from('notes').select('content_preview, read_time, title').eq('id', id).maybeSingle();
  if (!note) throw new SecurityError('Note not found', 404);
  return res.status(200).json({ ...note });
}

async function getNoteReactions(req, res) {
  const { note_id } = req.query;
  if (!note_id) throw new SecurityError('note_id required', 400);
  const { data } = await supabase
    .from('content_reactions')
    .select('reaction_type, user_id, created_at')
    .eq('content_type', 'note')
    .eq('content_id', note_id);
  const counts = {};
  (data || []).forEach(r => { counts[r.reaction_type] = (counts[r.reaction_type] || 0) + 1; });
  return res.status(200).json({ counts, total: (data || []).length });
}

async function getReadingProgress(req, res, ctx) {
  const { note_id } = req.query;
  if (!note_id) throw new SecurityError('note_id required', 400);
  const { data } = await supabase
    .from('reading_progress')
    .select('*')
    .eq('user_id', ctx.userId)
    .eq('note_id', note_id)
    .maybeSingle();
  return res.status(200).json(data || null);
}

async function getContinueReading(req, res, ctx) {
  const limit = parseInt(req.query.limit) || 10;
  const { data } = await supabase
    .from('reading_progress')
    .select('*')
    .eq('user_id', ctx.userId)
    .neq('completed', true)
    .gt('scroll_percentage', 5)
    .order('last_accessed', { ascending: false })
    .limit(limit);
  const notes = [];
  for (const prog of (data || [])) {
    const { data: note } = await supabase
      .from('notes')
      .select('id, slug, title, content_preview, unit_id, curriculum_units(name)')
      .eq('id', prog.note_id)
      .maybeSingle();
    if (note) {
      notes.push({
        note_id: note.id,
        slug: note.slug,
        title: note.title,
        topic: note.curriculum_units?.name,
        progress_percentage: prog.scroll_percentage,
        last_accessed: prog.last_accessed
      });
    }
  }
  return res.status(200).json(notes);
}

async function getAllRatings(req, res) {
  const { data } = await supabase
    .from('content_ratings')
    .select('content_id, rating')
    .eq('content_type', 'note');
  const ratingsMap = {};
  (data || []).forEach(r => {
    if (!ratingsMap[r.content_id]) ratingsMap[r.content_id] = { total: 0, count: 0 };
    ratingsMap[r.content_id].total += r.rating;
    ratingsMap[r.content_id].count++;
  });
  const result = {};
  Object.entries(ratingsMap).forEach(([id, d]) => {
    result[id] = { avg: Math.round((d.total / d.count) * 10) / 10, count: d.count };
  });
  return res.status(200).json(result);
}

async function submitResource(body, res, ctx) {
  const { payload } = body;
  if (!payload) throw new SecurityError('payload required', 400);
  const { error } = await supabase.from('resource_submissions').insert({
    title: payload.title,
    description: payload.description,
    author: payload.author,
    level: payload.level,
    category: payload.category,
    tag: payload.tag,
    section_type: payload.section_type,
    file_url: payload.file_url,
    file_size: payload.file_size,
    class_name: payload.class_name,
    unit_id: payload.unit_id || null,
    submitted_by: ctx.userId,
    status: 'pending'
  });
  if (error) throw new SecurityError('Failed to submit resource', 500);
  return res.status(200).json({ success: true });
}

async function approveResource(body, res, ctx) {
  if (!ctx.adminData) throw new SecurityError('Admin required', 403);
  const { submissionId, action, unit_id } = body;
  if (!submissionId) throw new SecurityError('submissionId required', 400);
  if (action === 'delete') {
    await supabase.from('resource_submissions').delete().eq('id', submissionId);
  } else if (action === 'approve') {
    const { data: sub } = await supabase.from('resource_submissions').select('*').eq('id', submissionId).single();
    if (sub) {
      const resolvedUnitId = unit_id || sub.unit_id;
      if (!resolvedUnitId) throw new SecurityError('unit_id required to approve this submission', 400);
      await supabase.from('notes').insert({
        title: sub.title,
        content_preview: sub.description,
        author: sub.author,
        unit_id: resolvedUnitId,
        file_url: sub.file_url,
        file_size: sub.file_size,
        category: sub.category,
        tag: sub.tag,
        section_type: sub.section_type,
        is_active: true,
        created_by: ctx.userId
      });
      await supabase.from('resource_submissions').update({ status: 'approved' }).eq('id', submissionId);
    }
  } else {
    await supabase.from('resource_submissions').update({ status: 'rejected' }).eq('id', submissionId);
  }
  return res.status(200).json({ success: true });
}

async function trackPdfPreview(body, res, ctx) {
  const { pdf_id } = body;
  if (!pdf_id) throw new SecurityError('pdf_id required', 400);
  const { data: pdf } = await supabase.from('pdf_resources').select('preview_count').eq('id', pdf_id).maybeSingle();
  if (pdf) {
    await supabase.from('pdf_resources').update({ preview_count: (pdf.preview_count || 0) + 1 }).eq('id', pdf_id);
  }
  return res.status(200).json({ success: true });
}

async function trackPdfDownload(body, res, ctx) {
  const { pdf_id } = body;
  if (!pdf_id) throw new SecurityError('pdf_id required', 400);
  const { data: pdf } = await supabase.from('pdf_resources').select('download_count').eq('id', pdf_id).maybeSingle();
  if (pdf) {
    await supabase.from('pdf_resources').update({ download_count: (pdf.download_count || 0) + 1 }).eq('id', pdf_id);
  }
  return res.status(200).json({ success: true });
}

async function toggleNoteReaction(body, res, ctx) {
  const { note_id, reaction_type } = body;
  const { data: existing } = await supabase
    .from('content_reactions')
    .select('id, reaction_type')
    .eq('user_id', ctx.userId)
    .eq('content_type', 'note')
    .eq('content_id', note_id)
    .maybeSingle();
  if (existing) {
    if (existing.reaction_type === reaction_type) {
      await supabase.from('content_reactions').delete().eq('id', existing.id);
    } else {
      await supabase.from('content_reactions').update({ reaction_type }).eq('id', existing.id);
    }
  } else {
    await supabase.from('content_reactions').insert({ user_id: ctx.userId, content_type: 'note', content_id: note_id, reaction_type });
  }
  const { count } = await supabase.from('content_reactions').select('id', { count: 'exact', head: true }).eq('content_type', 'note').eq('content_id', note_id);
  return res.status(200).json({ success: true, count: count || 0 });
}

async function saveReadingProgress(body, res, ctx) {
  const { note_id, scroll_percentage, scroll_position, time_spent, completed } = body;
  if (!note_id) throw new SecurityError('note_id required', 400);
  await supabase.from('reading_progress').upsert({
    user_id: ctx.userId,
    note_id,
    scroll_percentage: scroll_percentage || 0,
    scroll_position: scroll_position || 0,
    time_spent_seconds: time_spent || 0,
    completed: completed || false,
    last_accessed: new Date().toISOString()
  }, { onConflict: 'user_id,note_id' });
  if (completed) {
    const today = new Date().toISOString().slice(0, 10);
    const { data: stats } = await supabase.from('note_reading_stats').select('*').eq('user_id', ctx.userId).maybeSingle();
    if (!stats) {
      await supabase.from('note_reading_stats').insert({ user_id: ctx.userId, current_streak: 1, longest_streak: 1, notes_read_count: 1, last_read_date: today });
    } else {
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      const newStreak = stats.last_read_date === yesterday ? stats.current_streak + 1 : 1;
      await supabase.from('note_reading_stats').update({ current_streak: newStreak, longest_streak: Math.max(newStreak, stats.longest_streak), notes_read_count: stats.notes_read_count + 1, last_read_date: today, updated_at: new Date().toISOString() }).eq('user_id', ctx.userId);
    }
  }
  return res.status(200).json({ success: true });
}
