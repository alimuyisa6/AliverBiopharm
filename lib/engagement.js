import { supabase } from './core.js';
import { parseAndValidateBody, requireAuth, requireAdmin, SecurityError } from './security-middleware.js';
import { createNotification } from './notifications.js';

const VALID_CONTENT_TYPES = ['note', 'quiz_topic', 'recall_topic', 'pdf', 'flashcard_deck', 'past_paper', 'classroom_unit'];
const VALID_REACTION_TYPES = ['like', 'love', 'helpful', 'bookmark', 'helpful_yes', 'helpful_no'];

export async function handler(req, res, path, ctx) {
  if (req.method === 'GET') {
    switch (path) {
      case 'reactions': return getReactions(req, res, ctx);
      case 'comments': return getComments(req, res, ctx);
      case 'summary': return getSummary(req, res);
      case 'admin_reactions': requireAdmin(ctx); return adminGetReactions(req, res);
      case 'admin_comments': requireAdmin(ctx); return adminGetComments(req, res);
      case 'my_comments': requireAuth(ctx); return getMyComments(req, res, ctx);
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
    } catch {
      nameMap[uid] = 'User';
    }
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
    content_type, content_id,
    like_count: 0, love_count: 0, helpful_count: 0, bookmark_count: 0,
    helpful_yes_count: 0, helpful_no_count: 0, comment_count: 0,
    avg_time_spent_seconds: 0, completion_rate: 0
  });
}

async function adminGetReactions(req, res) {
  const { content_type, content_id } = req.query;
  if (!content_type || !content_id) throw new SecurityError('content_type and content_id required', 400);

  const { data, error } = await supabase
    .from('content_reactions')
    .select('id, user_id, reaction_type, created_at')
    .eq('content_type', content_type)
    .eq('content_id', content_id)
    .order('created_at', { ascending: false });
  if (error) throw new SecurityError('Failed to fetch reactions', 500);

  const enriched = [];
  for (const r of (data || [])) {
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
  let query = supabase.from('content_comments').select('*').order('created_at', { ascending: false }).limit(200);
  if (flagged_only === 'true') query = query.eq('is_flagged', true);

  const { data, error } = await query;
  if (error) throw new SecurityError('Failed to fetch comments', 500);

  const enriched = [];
  for (const c of (data || [])) {
    let email = 'Unknown';
    try {
      const { data: { user } } = await supabase.auth.admin.getUserById(c.user_id);
      email = user?.email || 'Unknown';
    } catch {}
    enriched.push({ ...c, user_email: email });
  }

  return res.status(200).json(enriched);
}

async function getMyComments(req, res, ctx) {
  const { data, error } = await supabase
    .from('content_comments')
    .select('*')
    .eq('user_id', ctx.userId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw new SecurityError('Failed to fetch your comments', 500);
  return res.status(200).json(data || []);
}

async function refreshSummary(contentType, contentId) {
  const [{ data: reactions }, { count: commentCount }] = await Promise.all([
    supabase.from('content_reactions').select('reaction_type').eq('content_type', contentType).eq('content_id', contentId),
    supabase.from('content_comments').select('id', { count: 'exact', head: true }).eq('content_type', contentType).eq('content_id', contentId).eq('is_hidden', false)
  ]);

  const counts = { like: 0, love: 0, helpful: 0, bookmark: 0, helpful_yes: 0, helpful_no: 0 };
  for (const r of (reactions || [])) {
    if (counts[r.reaction_type] !== undefined) counts[r.reaction_type]++;
  }

  await supabase.from('content_engagement_summary').upsert({
    content_type: contentType,
    content_id: contentId,
    like_count: counts.like,
    love_count: counts.love,
    helpful_count: counts.helpful,
    bookmark_count: counts.bookmark,
    helpful_yes_count: counts.helpful_yes,
    helpful_no_count: counts.helpful_no,
    comment_count: commentCount || 0,
    updated_at: new Date().toISOString()
  }, { onConflict: 'content_type,content_id' });
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

  let active;
  if (existing) {
    await supabase.from('content_reactions').delete().eq('id', existing.id);
    active = false;
  } else {
    await supabase.from('content_reactions').insert({ user_id: ctx.userId, content_type, content_id, reaction_type });
    active = true;
  }

  await refreshSummary(content_type, content_id);
  return res.status(200).json({ success: true, active });
}

async function submitHelpful(body, res, ctx) {
  const { content_type, content_id, is_helpful } = body;
  if (!content_type || !content_id || is_helpful === undefined) {
    throw new SecurityError('content_type, content_id, is_helpful required', 400);
  }
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

  await refreshSummary(content_type, content_id);
  return res.status(200).json({ success: true });
}

function extractMentions(body) {
  const matches = body.match(/@([a-zA-Z0-9_.]+)/g) || [];
  return matches.map(m => m.substring(1));
}

async function addComment(body, res, ctx) {
  const { content_type, content_id, body: commentBody, parent_comment_id } = body;
  if (!content_type || !content_id || !commentBody?.trim()) {
    throw new SecurityError('content_type, content_id, body required', 400);
  }
  validateContentType(content_type);
  if (commentBody.length > 2000) throw new SecurityError('Comment too long', 400);

  if (parent_comment_id) {
    const { data: parent } = await supabase.from('content_comments').select('id').eq('id', parent_comment_id).maybeSingle();
    if (!parent) throw new SecurityError('Parent comment not found', 404);
  }

  const { data, error } = await supabase
    .from('content_comments')
    .insert({
      user_id: ctx.userId,
      content_type, content_id,
      parent_comment_id: parent_comment_id || null,
      body: commentBody.trim()
    })
    .select()
    .single();
  if (error) throw new SecurityError('Failed to add comment', 500);

  await refreshSummary(content_type, content_id);

  if (parent_comment_id) {
    const { data: parentComment } = await supabase.from('content_comments').select('user_id').eq('id', parent_comment_id).maybeSingle();
    if (parentComment && parentComment.user_id !== ctx.userId) {
      await createNotification(parentComment.user_id, 'comment_reply', { content_type });
    }
  }

  return res.status(200).json({ success: true, comment: data });
}

async function editComment(body, res, ctx) {
  const { id, body: newBody } = body;
  if (!id || !newBody?.trim()) throw new SecurityError('id and body required', 400);
  if (newBody.length > 2000) throw new SecurityError('Comment too long', 400);

  const { data: existing } = await supabase.from('content_comments').select('user_id').eq('id', id).maybeSingle();
  if (!existing) throw new SecurityError('Comment not found', 404);
  if (existing.user_id !== ctx.userId) throw new SecurityError('Access denied', 403);

  const { error } = await supabase
    .from('content_comments')
    .update({ body: newBody.trim(), updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new SecurityError('Failed to edit comment', 500);

  return res.status(200).json({ success: true });
}

async function deleteComment(body, res, ctx) {
  const { id } = body;
  if (!id) throw new SecurityError('id required', 400);

  const { data: existing } = await supabase.from('content_comments').select('user_id, content_type, content_id').eq('id', id).maybeSingle();
  if (!existing) throw new SecurityError('Comment not found', 404);
  if (existing.user_id !== ctx.userId && !ctx.adminData) throw new SecurityError('Access denied', 403);

  const { error } = await supabase.from('content_comments').delete().eq('id', id);
  if (error) throw new SecurityError('Failed to delete comment', 500);

  await refreshSummary(existing.content_type, existing.content_id);
  return res.status(200).json({ success: true });
}

async function flagComment(body, res, ctx) {
  const { id } = body;
  if (!id) throw new SecurityError('id required', 400);

  const { error } = await supabase.from('content_comments').update({ is_flagged: true }).eq('id', id);
  if (error) throw new SecurityError('Failed to flag comment', 500);

  return res.status(200).json({ success: true });
}

async function pinComment(body, res, ctx) {
  const { id, is_pinned } = body;
  if (!id || is_pinned === undefined) throw new SecurityError('id and is_pinned required', 400);

  const { error } = await supabase.from('content_comments').update({ is_pinned }).eq('id', id);
  if (error) throw new SecurityError('Failed to update pin status', 500);

  await supabase.from('audit_log').insert({
    actor_id: ctx.userId,
    actor_role: ctx.adminData?.admin_role,
    action: is_pinned ? 'pin_comment' : 'unpin_comment',
    target_type: 'content_comment',
    target_id: id,
    metadata: {}
  });

  return res.status(200).json({ success: true });
}

async function hideComment(body, res, ctx) {
  const { id, is_hidden } = body;
  if (!id || is_hidden === undefined) throw new SecurityError('id and is_hidden required', 400);

  const { data: existing } = await supabase.from('content_comments').select('content_type, content_id').eq('id', id).maybeSingle();

  const { error } = await supabase.from('content_comments').update({ is_hidden, is_flagged: false }).eq('id', id);
  if (error) throw new SecurityError('Failed to update comment visibility', 500);

  if (existing) await refreshSummary(existing.content_type, existing.content_id);

  await supabase.from('audit_log').insert({
    actor_id: ctx.userId,
    actor_role: ctx.adminData?.admin_role,
    action: is_hidden ? 'hide_comment' : 'unhide_comment',
    target_type: 'content_comment',
    target_id: id,
    metadata: {}
  });

  return res.status(200).json({ success: true });
}
