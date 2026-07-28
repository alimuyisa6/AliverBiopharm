import { supabase } from './core.js';
import { parseAndValidateBody, requireAuth, requireAdmin, SecurityError } from './security-middleware.js';

const VALID_CONTENT_TYPES = [
  'note', 'quiz_batch', 'flashcard_deck', 'pdf_resource', 'past_paper',
  'glossary_term', 'classroom', 'lab_case', 'lab_pathway',
  'curriculum_unit', 'curriculum_group', 'weekly_challenge',
  'video', 'article', 'content_collection'
];
const VALID_REACTION_TYPES = ['like', 'love', 'helpful', 'bookmark', 'helpful_yes', 'helpful_no'];

export async function handler(req, res, path, ctx) {
  if (req.method === 'GET') {
    switch (path) {
      case 'reactions': return getReactions(req, res, ctx);
      case 'comments': return getComments(req, res, ctx);
      case 'summary': return getSummary(req, res);
      case 'my_bookmarks': requireAuth(ctx); return getMyBookmarks(req, res, ctx);
      case 'admin_reactions': requireAdmin(ctx); return adminGetReactions(req, res);
      case 'admin_comments': requireAdmin(ctx); return adminGetComments(req, res);
      default: throw new SecurityError('Invalid action', 400);
    }
  }

  if (req.method === 'POST') {
    requireAuth(ctx);
    const body = await parseAndValidateBody(req);
    switch (path) {
      case 'toggle_reaction': return toggleReaction(body, res, ctx);
      case 'submit_helpful': return submitHelpful(body, res, ctx);
      case 'add_comment': return addComment(body, res, ctx);
      case 'edit_comment': return editComment(body, res, ctx);
      case 'delete_comment': return deleteComment(body, res, ctx);
      case 'flag_comment': return flagComment(body, res, ctx);
      case 'pin_comment': requireAdmin(ctx); return pinComment(body, res, ctx);
      case 'hide_comment': requireAdmin(ctx); return hideComment(body, res, ctx);
      default: throw new SecurityError('Invalid action', 400);
    }
  }

  throw new SecurityError('Method not allowed', 405);
}

function validateContentType(t) {
  if (!VALID_CONTENT_TYPES.includes(t)) throw new SecurityError('Invalid content_type', 400);
}

async function getReactions(req, res, ctx) {
  const { content_type, content_id } = req.query;
  if (!content_type || !content_id) throw new SecurityError('content_type and content_id required', 400);
  validateContentType(content_type);

  const { data, error } = await supabase
    .from('content_reactions')
    .select('reaction_type, user_id')
    .eq('content_type', content_type)
    .eq('content_id', content_id);
  if (error) throw new SecurityError('Failed to fetch reactions', 500);

  const counts = {};
  let userReactions = [];
  for (const r of (data || [])) {
    counts[r.reaction_type] = (counts[r.reaction_type] || 0) + 1;
    if (ctx.authenticated && r.user_id === ctx.userId) userReactions.push(r.reaction_type);
  }

  return res.status(200).json({ counts, user_reactions: userReactions, total: (data || []).length });
}

async function getComments(req, res, ctx) {
  const { content_type, content_id, sort } = req.query;
  if (!content_type || !content_id) throw new SecurityError('content_type and content_id required', 400);
  validateContentType(content_type);

  let query = supabase
    .from('content_comments')
    .select('*')
    .eq('content_type', content_type)
    .eq('content_id', content_id)
    .eq('is_hidden', false);

  if (sort === 'newest') query = query.order('created_at', { ascending: false });
  else query = query.order('is_pinned', { ascending: false }).order('created_at', { ascending: false });

  const { data, error } = await query;
  if (error) throw new SecurityError('Failed to fetch comments', 500);

  const userIds = [...new Set((data || []).map(c => c.user_id))];
  const nameMap = {};
  for (const uid of userIds) {
    try {
      const { data: { user } } = await supabase.auth.admin.getUserById(uid);
      nameMap[uid] = user?.user_metadata?.full_name || 'User';
    } catch { nameMap[uid] = 'User'; }
  }

  const flat = (data || []).map(c => ({
    id: c.id,
    user_id: c.user_id,
    user_name: nameMap[c.user_id] || 'User',
    parent_comment_id: c.parent_comment_id,
    body: c.body,
    is_pinned: c.is_pinned,
    is_own: ctx.authenticated && c.user_id === ctx.userId,
    created_at: c.created_at,
    updated_at: c.updated_at
  }));

  const byParent = {};
  for (const c of flat) {
    const key = c.parent_comment_id || 'root';
    if (!byParent[key]) byParent[key] = [];
    byParent[key].push(c);
  }

  function buildTree(parentKey) {
    return (byParent[parentKey] || []).map(c => ({ ...c, replies: buildTree(c.id) }));
  }

  return res.status(200).json({ comments: buildTree('root'), total: flat.length });
}

async function getSummary(req, res) {
  const { content_type, content_id } = req.query;
  if (!content_type || !content_id) throw new SecurityError('content_type and content_id required', 400);
  validateContentType(content_type);

  const { data, error } = await supabase
    .from('content_engagement_summary')
    .select('*')
    .eq('content_type', content_type)
    .eq('content_id', content_id)
    .maybeSingle();
  if (error) throw new SecurityError('Failed to fetch summary', 500);

  return res.status(200).json(data || {
    like_count: 0, love_count: 0, helpful_count: 0, bookmark_count: 0,
    helpful_yes_count: 0, helpful_no_count: 0, comment_count: 0
  });
}

async function getMyBookmarks(req, res, ctx) {
  const { data } = await supabase
    .from('content_reactions')
    .select('content_type, content_id, created_at')
    .eq('user_id', ctx.userId)
    .eq('reaction_type', 'bookmark')
    .order('created_at', { ascending: false })
    .limit(50);

  const enriched = [];
  for (const b of data || []) {
    let title = 'Untitled';
    try {
      if (b.content_type === 'note') {
        const { data: note } = await supabase.from('notes').select('title, slug').eq('id', b.content_id).maybeSingle();
        if (note) { title = note.title; b.slug = note.slug; }
      } else if (b.content_type === 'flashcard_deck') {
        const { data: deck } = await supabase.from('flashcard_decks').select('title').eq('id', b.content_id).maybeSingle();
        if (deck) title = deck.title;
      }
    } catch {}
    enriched.push({ ...b, title });
  }
  return res.status(200).json(enriched);
}

async function adminGetReactions(req, res) {
  const { content_type, content_id } = req.query;
  const { data } = await supabase
    .from('content_reactions')
    .select('*')
    .eq('content_type', content_type)
    .eq('content_id', content_id)
    .order('created_at', { ascending: false });
  const enriched = [];
  for (const r of data || []) {
    let email = 'Unknown';
    try {
      const { data: { user } } = await supabase.auth.admin.getUserById(r.user_id);
      email = user?.email || 'Unknown';
    } catch {}
    enriched.push({ ...r, user_email: email });
  }
  return res.status(200).json(enriched);
}

async function adminGetComments(req, res) {
  const { flagged_only } = req.query;
  let query = supabase.from('content_comments').select('*').order('created_at', { ascending: false });
  if (flagged_only === 'true') query = query.eq('is_flagged', true);
  const { data } = await query;
  const enriched = [];
  for (const c of data || []) {
    let email = 'Unknown';
    try {
      const { data: { user } } = await supabase.auth.admin.getUserById(c.user_id);
      email = user?.email || 'Unknown';
    } catch {}
    enriched.push({ ...c, user_email: email });
  }
  return res.status(200).json(enriched);
}

async function toggleReaction(body, res, ctx) {
  const { content_type, content_id, reaction_type } = body;
  if (!content_type || !content_id || !reaction_type) throw new SecurityError('content_type, content_id, reaction_type required', 400);
  validateContentType(content_type);
  if (!VALID_REACTION_TYPES.includes(reaction_type)) throw new SecurityError('Invalid reaction_type', 400);

  const { data: existing } = await supabase
    .from('content_reactions')
    .select('id')
    .eq('user_id', ctx.userId)
    .eq('content_type', content_type)
    .eq('content_id', content_id)
    .eq('reaction_type', reaction_type)
    .maybeSingle();

  if (existing) {
    await supabase.from('content_reactions').delete().eq('id', existing.id);
  } else {
    await supabase.from('content_reactions').insert({ user_id: ctx.userId, content_type, content_id, reaction_type });
  }

  await refreshEngagementSummary(content_type, content_id);
  return res.status(200).json({ success: true, active: !existing });
}

async function submitHelpful(body, res, ctx) {
  const { content_type, content_id, is_helpful } = body;
  if (!content_type || !content_id || is_helpful === undefined) throw new SecurityError('content_type, content_id, is_helpful required', 400);
  validateContentType(content_type);
  const reactionType = is_helpful ? 'helpful_yes' : 'helpful_no';
  const oppositeType = is_helpful ? 'helpful_no' : 'helpful_yes';

  await supabase
    .from('content_reactions')
    .delete()
    .eq('user_id', ctx.userId)
    .eq('content_type', content_type)
    .eq('content_id', content_id)
    .in('reaction_type', [reactionType, oppositeType]);

  await supabase.from('content_reactions').insert({ user_id: ctx.userId, content_type, content_id, reaction_type: reactionType });
  await refreshEngagementSummary(content_type, content_id);
  return res.status(200).json({ success: true });
}

async function addComment(body, res, ctx) {
  const { content_type, content_id, body: commentBody, parent_comment_id } = body;
  if (!content_type || !content_id || !commentBody?.trim()) throw new SecurityError('content_type, content_id, body required', 400);
  validateContentType(content_type);

  const { data, error } = await supabase
    .from('content_comments')
    .insert({
      user_id: ctx.userId,
      content_type,
      content_id,
      parent_comment_id: parent_comment_id || null,
      body: commentBody.trim()
    })
    .select()
    .single();
  if (error) throw new SecurityError('Failed to add comment', 500);

  await refreshEngagementSummary(content_type, content_id);
  return res.status(200).json({ success: true, comment: data });
}

async function editComment(body, res, ctx) {
  const { id, body: newBody } = body;
  if (!id || !newBody?.trim()) throw new SecurityError('id and body required', 400);
  const { data: existing } = await supabase.from('content_comments').select('user_id, content_type, content_id').eq('id', id).maybeSingle();
  if (!existing) throw new SecurityError('Comment not found', 404);
  if (existing.user_id !== ctx.userId) throw new SecurityError('Access denied', 403);
  await supabase.from('content_comments').update({ body: newBody.trim(), updated_at: new Date().toISOString() }).eq('id', id);
  await refreshEngagementSummary(existing.content_type, existing.content_id);
  return res.status(200).json({ success: true });
}

async function deleteComment(body, res, ctx) {
  const { id } = body;
  if (!id) throw new SecurityError('id required', 400);
  const { data: existing } = await supabase.from('content_comments').select('user_id, content_type, content_id').eq('id', id).maybeSingle();
  if (!existing) throw new SecurityError('Comment not found', 404);
  if (existing.user_id !== ctx.userId && !ctx.adminData) throw new SecurityError('Access denied', 403);
  await supabase.from('content_comments').delete().eq('id', id);
  await refreshEngagementSummary(existing.content_type, existing.content_id);
  return res.status(200).json({ success: true });
}

async function flagComment(body, res, ctx) {
  const { id } = body;
  if (!id) throw new SecurityError('id required', 400);
  await supabase.from('content_comments').update({ is_flagged: true }).eq('id', id);
  return res.status(200).json({ success: true });
}

async function pinComment(body, res, ctx) {
  const { id, is_pinned } = body;
  if (!id || is_pinned === undefined) throw new SecurityError('id and is_pinned required', 400);
  await supabase.from('content_comments').update({ is_pinned }).eq('id', id);
  return res.status(200).json({ success: true });
}

async function hideComment(body, res, ctx) {
  const { id, is_hidden } = body;
  if (!id || is_hidden === undefined) throw new SecurityError('id and is_hidden required', 400);
  const { data: existing } = await supabase.from('content_comments').select('content_type, content_id').eq('id', id).maybeSingle();
  await supabase.from('content_comments').update({ is_hidden, is_flagged: false }).eq('id', id);
  if (existing) await refreshEngagementSummary(existing.content_type, existing.content_id);
  return res.status(200).json({ success: true });
}

async function refreshEngagementSummary(contentType, contentId) {
  const [{ data: reactions }, { count: commentCount }] = await Promise.all([
    supabase.from('content_reactions').select('reaction_type').eq('content_type', contentType).eq('content_id', contentId),
    supabase.from('content_comments').select('id', { count: 'exact', head: true }).eq('content_type', contentType).eq('content_id', contentId).eq('is_hidden', false)
  ]);
  const counts = {};
  for (const r of reactions || []) {
    counts[r.reaction_type] = (counts[r.reaction_type] || 0) + 1;
  }
  await supabase.from('content_engagement_summary').upsert({
    content_type: contentType,
    content_id: contentId,
    like_count: counts.like || 0,
    love_count: counts.love || 0,
    helpful_count: counts.helpful || 0,
    bookmark_count: counts.bookmark || 0,
    helpful_yes_count: counts.helpful_yes || 0,
    helpful_no_count: counts.helpful_no || 0,
    comment_count: commentCount || 0,
    updated_at: new Date().toISOString()
  }, { onConflict: 'content_type,content_id' });
}
