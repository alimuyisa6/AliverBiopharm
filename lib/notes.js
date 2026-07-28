import { supabase } from './core.js';
import { parseAndValidateBody, requireAuth, requireAdmin, SecurityError } from './security-middleware.js';
import { resolveBreadcrumb, resolveUnitTitle, getUnitAccessInfo, getUserCurriculumScope } from './curriculum.js';
import { checkContentAccess, checkDownloadAccess, recordAbuseProbe } from './premium.js';
import { createNotification } from './notifications.js';

export async function handler(req, res, path, ctx) {
  if (req.method === 'GET') {
    switch (path) {
      case 'list': return listNotes(req, res, ctx);
      case 'detail': return getNoteDetail(req, res, ctx);
      case 'related': return getRelatedNotes(req, res);
      case 'toc': return getToc(req, res);
      case 'reading_progress': requireAuth(ctx); return getReadingProgress(req, res, ctx);
      case 'continue_reading': requireAuth(ctx); return getContinueReading(req, res, ctx);
      case 'download_url': requireAuth(ctx); return getDownloadUrl(req, res, ctx);
      default: throw new SecurityError('Invalid action', 400);
    }
  }

  if (req.method === 'POST') {
    const body = await parseAndValidateBody(req);
    switch (path) {
      case 'save_progress': requireAuth(ctx); return saveReadingProgress(body, res, ctx);
      case 'create': requireAdmin(ctx); return createNote(body, res, ctx);
      case 'update': requireAdmin(ctx); return updateNote(body, res, ctx);
      case 'delete': requireAdmin(ctx); return deleteNote(body, res, ctx);
      case 'link': requireAdmin(ctx); return linkNotes(body, res, ctx);
      case 'unlink': requireAdmin(ctx); return unlinkNotes(body, res);
      case 'regenerate_toc': requireAdmin(ctx); return regenerateToc(body, res);
      default: throw new SecurityError('Invalid action', 400);
    }
  }

  throw new SecurityError('Method not allowed', 405);
}

function generateToc(html) {
  if (!html) return [];
  const headingRegex = /<h([2-3])[^>]*>(.*?)<\/h\1>/gi;
  const toc = [];
  let match, index = 0;
  while ((match = headingRegex.exec(html)) !== null) {
    const level = parseInt(match[1], 10);
    const text = match[2].replace(/<[^>]*>/g, '').trim();
    if (!text) continue;
    const anchor = `section-${index}-${text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`;
    toc.push({ level, text, anchor });
    index++;
  }
  return toc;
}

function injectAnchors(html) {
  if (!html) return html;
  let index = 0;
  return html.replace(/<h([2-3])([^>]*)>(.*?)<\/h\1>/gi, (full, level, attrs, inner) => {
    const text = inner.replace(/<[^>]*>/g, '').trim();
    const anchor = `section-${index}-${text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`;
    index++;
    return `<h${level}${attrs} id="${anchor}">${inner}</h${level}>`;
  });
}

async function autoLinkGlossaryTerms(html, levelId) {
  if (!html) return html;
  const { data: terms } = await supabase
    .from('glossary_terms')
    .select('term, slug')
    .contains('levels', [levelId]);
  if (!terms || !terms.length) return html;
  const sorted = [...terms].sort((a, b) => b.term.length - a.term.length);
  let result = html;
  for (const t of sorted) {
    const escaped = t.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b(${escaped})\\b(?![^<]*>)`, 'i');
    result = result.replace(regex, `<a class="glossary-inline-link" href="/glossary/${t.slug}">$1</a>`);
  }
  return result;
}

async function listNotes(req, res, ctx) {
  const { unit_id, group_id, category } = req.query;
  let query = supabase
    .from('notes')
    .select('id, slug, title, content_preview, author, file_url, category, tag, section_type, read_time, word_count, is_premium, display_order, unit_id')
    .eq('is_active', true)
    .order('display_order', { ascending: true });

  if (unit_id) query = query.eq('unit_id', unit_id);
  if (category) query = query.eq('category', category);

  if (group_id) {
    const { data: units } = await supabase.from('curriculum_units').select('id').eq('group_id', group_id);
    const unitIds = (units || []).map(u => u.id);
    if (!unitIds.length) return res.status(200).json([]);
    query = query.in('unit_id', unitIds);
  }

  const { data, error } = await query;
  if (error) throw new SecurityError('Failed to fetch notes', 500);
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
    if (access.reason === 'premium_locked') await recordAbuseProbe(ctx.userId, 'premium_probe_note');
    return res.status(200).json({ locked: true, reason: access.reason, title: note.title, id: note.id });
  }

  const breadcrumb = await resolveBreadcrumb(note.unit_id);
  const titleInfo = await resolveUnitTitle(note.unit_id);

  return res.status(200).json({
    ...note,
    content: injectAnchors(note.content),
    breadcrumb,
    unit_title: titleInfo
  });
}

async function getRelatedNotes(req, res) {
  const { note_id } = req.query;
  if (!note_id) throw new SecurityError('note_id required', 400);

  const { data: explicit } = await supabase
    .from('note_links')
    .select('link_type, target_note_id, notes!note_links_target_note_id_fkey(id, slug, title, content_preview, read_time)')
    .eq('source_note_id', note_id);

  const explicitIds = new Set((explicit || []).map(l => l.target_note_id));
  const explicitResults = (explicit || []).map(l => ({ ...l.notes, link_type: l.link_type }));

  if (explicitResults.length >= 3) {
    return res.status(200).json(explicitResults.slice(0, 5));
  }

  const { data: source } = await supabase.from('notes').select('unit_id').eq('id', note_id).maybeSingle();
  if (!source) return res.status(200).json(explicitResults);

  const { data: sameUnit } = await supabase
    .from('notes')
    .select('id, slug, title, content_preview, read_time')
    .eq('unit_id', source.unit_id)
    .eq('is_active', true)
    .neq('id', note_id)
    .order('display_order')
    .limit(5);

  const additional = (sameUnit || [])
    .filter(n => !explicitIds.has(n.id))
    .map(n => ({ ...n, link_type: 'related' }));

  return res.status(200).json([...explicitResults, ...additional].slice(0, 5));
}

async function getToc(req, res) {
  const { note_id } = req.query;
  if (!note_id) throw new SecurityError('note_id required', 400);
  const { data } = await supabase.from('notes').select('toc').eq('id', note_id).maybeSingle();
  return res.status(200).json(data?.toc || []);
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
  if (error) throw new SecurityError('Failed to fetch reading progress', 500);

  return res.status(200).json(data ? {
    scroll_percentage: data.scroll_percentage || 0,
    scroll_position: data.scroll_position || 0,
    completed: data.completed || false,
    time_spent: data.time_spent_seconds || 0,
    last_accessed: data.last_accessed
  } : null);
}

async function getContinueReading(req, res, ctx) {
  const limit = parseInt(req.query.limit) || 10;
  const scope = await getUserCurriculumScope(ctx.userId);

  const { data } = await supabase
    .from('reading_progress')
    .select('*')
    .eq('user_id', ctx.userId)
    .neq('completed', true)
    .gt('scroll_percentage', 5)
    .order('last_accessed', { ascending: false })
    .limit(limit * 2);

  const results = [];
  for (const prog of data || []) {
    const { data: note } = await supabase
      .from('notes')
      .select('id, slug, title, unit_id, curriculum_units(name, group_id, curriculum_groups(name, level_id))')
      .eq('id', prog.note_id)
      .maybeSingle();
    if (!note) continue;

    const noteLevel = note.curriculum_units?.curriculum_groups?.level_id;
    const noteGroup = note.curriculum_units?.curriculum_groups?.name;
    if (scope && !scope.showAll && scope.level && noteLevel !== scope.level) continue;
    if (scope && !scope.showAll && scope.groupName && noteGroup !== scope.groupName) continue;

    results.push({
      note_id: note.id,
      slug: note.slug,
      title: note.title,
      topic: note.curriculum_units?.name,
      progress_percentage: prog.scroll_percentage,
      last_accessed: prog.last_accessed
    });
    if (results.length >= limit) break;
  }

  return res.status(200).json(results);
}

async function saveReadingProgress(body, res, ctx) {
  const { note_id, scroll_percentage, scroll_position, time_spent, completed } = body;
  if (!note_id) throw new SecurityError('note_id required', 400);

  await supabase.from('reading_progress').upsert({
    user_id: ctx.userId,
    note_id,
    scroll_percentage: scroll_percentage || 0,
    scroll_position: scroll_position || 0,
    time_spent_seconds: (time_spent || 0),
    completed: completed || false,
    last_accessed: new Date().toISOString()
  }, { onConflict: 'user_id,note_id' });

  if (completed) {
    await updateReadingStreak(ctx.userId);
  }

  return res.status(200).json({ success: true });
}

async function updateReadingStreak(userId) {
  const today = new Date().toISOString().slice(0, 10);
  const { data: stats } = await supabase.from('note_reading_stats').select('*').eq('user_id', userId).maybeSingle();

  if (!stats) {
    await supabase.from('note_reading_stats').insert({
      user_id: userId, current_streak: 1, longest_streak: 1, notes_read_count: 1, last_read_date: today
    });
    return;
  }

  if (stats.last_read_date === today) return;

  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const newStreak = stats.last_read_date === yesterday ? stats.current_streak + 1 : 1;

  await supabase.from('note_reading_stats').update({
    current_streak: newStreak,
    longest_streak: Math.max(newStreak, stats.longest_streak),
    notes_read_count: stats.notes_read_count + 1,
    last_read_date: today,
    updated_at: new Date().toISOString()
  }).eq('user_id', userId);
}

async function getDownloadUrl(req, res, ctx) {
  const { id } = req.query;
  if (!id) throw new SecurityError('id required', 400);

  const { data: note } = await supabase.from('notes').select('id, file_url, is_premium, unit_id').eq('id', id).maybeSingle();
  if (!note || !note.file_url) throw new SecurityError('Note has no downloadable file', 404);

  const unitInfo = await getUnitAccessInfo(note.unit_id);
  const { data: { user } } = await supabase.auth.admin.getUserById(ctx.userId);
  const email = user?.email || null;

  const access = await checkDownloadAccess(email, ctx.userId, 'note', note.id, note.is_premium || unitInfo?.is_premium);
  if (!access.allowed) throw new SecurityError(access.reason === 'premium_locked' ? 'Premium required' : 'Access denied', 403);

  await supabase.from('notes').update({ download_count: supabase.raw('download_count + 1') }).eq('id', id);
  await createNotification(ctx.userId, 'note_downloaded', {});

  return res.status(200).json({ url: note.file_url });
}

async function createNote(body, res, ctx) {
  const { unit_id, slug, title, content, file_url, author, category, tag, section_type, is_premium } = body;
  if (!unit_id || !slug || !title) throw new SecurityError('unit_id, slug, title required', 400);
  if (!content && !file_url) throw new SecurityError('content or file_url required', 400);

  const toc = generateToc(content);
  const plainText = (content || '').replace(/<[^>]*>/g, '');
  const wordCount = plainText.split(/\s+/).filter(Boolean).length;
  const readTime = wordCount > 0 ? `${Math.max(1, Math.ceil(wordCount / 200))} min read` : null;

  const { data, error } = await supabase
    .from('notes')
    .insert({
      unit_id, slug, title, content: content || null, file_url: file_url || null,
      author: author || null, category: category || null, tag: tag || null, section_type: section_type || null,
      content_preview: plainText.slice(0, 400),
      toc, toc_generated_at: new Date().toISOString(),
      word_count: wordCount, read_time: readTime,
      is_premium: !!is_premium,
      created_by: ctx.userId
    })
    .select()
    .single();
  if (error) throw new SecurityError('Failed to create note', 500);

  // Insert content reference for internal linking
  await supabase.from('content_references').upsert({
    content_type: 'note',
    content_id: data.id.toString(),
    slug: data.slug,
    path: `/notes/${data.slug}`,
    title: data.title
  }).catch(() => {});

  return res.status(200).json({ success: true, note: data });
}

async function updateNote(body, res, ctx) {
  const { id, title, content, file_url, author, category, tag, section_type, is_premium, is_active, display_order } = body;
  if (!id) throw new SecurityError('id required', 400);

  const updates = { updated_at: new Date().toISOString() };
  if (title !== undefined) updates.title = title;
  if (file_url !== undefined) updates.file_url = file_url;
  if (author !== undefined) updates.author = author;
  if (category !== undefined) updates.category = category;
  if (tag !== undefined) updates.tag = tag;
  if (section_type !== undefined) updates.section_type = section_type;
  if (is_premium !== undefined) updates.is_premium = is_premium;
  if (is_active !== undefined) updates.is_active = is_active;
  if (display_order !== undefined) updates.display_order = display_order;

  if (content !== undefined) {
    updates.content = content;
    updates.toc = generateToc(content);
    updates.toc_generated_at = new Date().toISOString();
    const plainText = (content || '').replace(/<[^>]*>/g, '');
    updates.content_preview = plainText.slice(0, 400);
    updates.word_count = plainText.split(/\s+/).filter(Boolean).length;
    updates.read_time = updates.word_count > 0 ? `${Math.max(1, Math.ceil(updates.word_count / 200))} min read` : null;
  }

  const { error } = await supabase.from('notes').update(updates).eq('id', id);
  if (error) throw new SecurityError('Failed to update note', 500);

  // Update content reference title if changed
  if (title) {
    await supabase.from('content_references').update({ title }).eq('content_type', 'note').eq('content_id', id.toString());
  }

  return res.status(200).json({ success: true });
}

async function deleteNote(body, res, ctx) {
  const { id } = body;
  if (!id) throw new SecurityError('id required', 400);
  const { error } = await supabase.from('notes').delete().eq('id', id);
  if (error) throw new SecurityError('Failed to delete note', 500);
  return res.status(200).json({ success: true });
}

async function linkNotes(body, res, ctx) {
  const { source_note_id, target_note_id, link_type } = body;
  if (!source_note_id || !target_note_id || !link_type) throw new SecurityError('source_note_id, target_note_id, link_type required', 400);
  if (!['related', 'prerequisite', 'next_in_sequence'].includes(link_type)) throw new SecurityError('Invalid link_type', 400);

  const { error } = await supabase.from('note_links').insert({ source_note_id, target_note_id, link_type });
  if (error) throw new SecurityError('Failed to link notes', 500);

  return res.status(200).json({ success: true });
}

async function unlinkNotes(body, res) {
  const { id } = body;
  if (!id) throw new SecurityError('id required', 400);
  const { error } = await supabase.from('note_links').delete().eq('id', id);
  if (error) throw new SecurityError('Failed to unlink notes', 500);
  return res.status(200).json({ success: true });
}

async function regenerateToc(body, res) {
  const { id } = body;
  if (!id) throw new SecurityError('id required', 400);

  const { data: note } = await supabase.from('notes').select('content').eq('id', id).maybeSingle();
  if (!note) throw new SecurityError('Note not found', 404);

  const toc = generateToc(note.content);
  await supabase.from('notes').update({ toc, toc_generated_at: new Date().toISOString() }).eq('id', id);

  return res.status(200).json({ success: true, toc });
}
