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
      case 'get_public_stats': return getPublicStats(req, res);
      case 'platform-stats': return getPlatformStats(req, res);
      case 'leaderboard': return getLeaderboard(req, res);
      case 'get_resource_interactions': return getResourceInteractions(req, res);
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

// ── Existing reaction / comment handlers (unchanged) ──────────────

function validateContentType(t) {
  if (!VALID_CONTENT_TYPES.includes(t)) throw new SecurityError('Invalid content_type', 400);
}

async function getReactions(req, res, ctx) {
  const { content_type, content_id } = req.query;
  if (!content_type || !content_id) throw new SecurityError('content_type and content_id required', 400);
  validateContentType(content_type);
  const { data } = await supabase.from('content_reactions').select('reaction_type, user_id').eq('content_type', content_type).eq('content_id', content_id);
  const counts = {};
  let userReactions = [];
  for (const r of data || []) {
    counts[r.reaction_type] = (counts[r.reaction_type] || 0) + 1;
    if (ctx.authenticated && r.user_id === ctx.userId) userReactions.push(r.reaction_type);
  }
  return res.status(200).json({ counts, user_reactions: userReactions, total: (data || []).length });
}

async function getComments(req, res, ctx) {
  const { content_type, content_id, sort } = req.query;
  if (!content_type || !content_id) throw new SecurityError('content_type and content_id required', 400);
  validateContentType(content_type);
  let query = supabase.from('content_comments').select('*').eq('content_type', content_type).eq('content_id', content_id).eq('is_hidden', false);
  query = sort === 'newest' ? query.order('created_at', { ascending: false }) : query.order('is_pinned', { ascending: false }).order('created_at', { ascending: false });
  const { data } = await query;
  const userIds = [...new Set((data || []).map(c => c.user_id))];
  const nameMap = {};
  for (const uid of userIds) {
    try {
      const { data: { user } } = await supabase.auth.admin.getUserById(uid);
      nameMap[uid] = user?.user_metadata?.full_name || 'User';
    } catch { nameMap[uid] = 'User'; }
  }
  const flat = (data || []).map(c => ({
    id: c.id, user_id: c.user_id, user_name: nameMap[c.user_id] || 'User',
    parent_comment_id: c.parent_comment_id, body: c.body, is_pinned: c.is_pinned,
    is_own: ctx.authenticated && c.user_id === ctx.userId,
    created_at: c.created_at, updated_at: c.updated_at
  }));
  const byParent = {};
  for (const c of flat) {
    const key = c.parent_comment_id || 'root';
    (byParent[key] = byParent[key] || []).push(c);
  }
  function buildTree(parentKey) { return (byParent[parentKey] || []).map(c => ({ ...c, replies: buildTree(c.id) })); }
  return res.status(200).json({ comments: buildTree('root'), total: flat.length });
}

async function getSummary(req, res) {
  const { content_type, content_id } = req.query;
  if (!content_type || !content_id) throw new SecurityError('content_type and content_id required', 400);
  validateContentType(content_type);
  const { data } = await supabase.from('content_engagement_summary').select('*').eq('content_type', content_type).eq('content_id', content_id).maybeSingle();
  return res.status(200).json(data || { like_count: 0, love_count: 0, helpful_count: 0, bookmark_count: 0, helpful_yes_count: 0, helpful_no_count: 0, comment_count: 0 });
}

async function getMyBookmarks(req, res, ctx) {
  const { data } = await supabase.from('content_reactions').select('content_type, content_id, created_at').eq('user_id', ctx.userId).eq('reaction_type', 'bookmark').order('created_at', { ascending: false }).limit(50);
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

// ── Public stats ──────────────────────────────────────────────────

async function getPublicStats(req, res) {
  try {
    const [resCount, userCount, quizCount] = await Promise.all([
      supabase.from('notes').select('id', { count: 'exact', head: true }),
      supabase.from('user_profiles').select('id', { count: 'exact', head: true }),
      supabase.from('user_quiz_activity').select('id', { count: 'exact', head: true })
    ]);
    return res.status(200).json({
      resources_count: resCount.count || 0,
      users_count: userCount.count || 0,
      downloads_count: 0,   // you can count from content_views if needed
      quiz_attempts: quizCount.count || 0
    });
  } catch {
    return res.status(200).json({ resources_count: 0, users_count: 0, downloads_count: 0, quiz_attempts: 0 });
  }
}

async function getPlatformStats(req, res) {
  const { data } = await supabase.from('platform_stats').select('*').eq('id', 1).maybeSingle();
  return res.status(200).json(data || { total_questions: 0, total_topics: 0, total_learners: 0, average_pass_rate: 0 });
}

async function getLeaderboard(req, res) {
  const { level, limit = 20 } = req.query;
  const { data } = await supabase.rpc('get_leaderboard', { p_level: level, p_limit: parseInt(limit) }).catch(() => []);
  return res.status(200).json(data || []);
}

async function getResourceInteractions(req, res) {
  const { resource_id } = req.query;
  const { count: likeCount } = await supabase.from('content_reactions').select('id', { count: 'exact', head: true }).eq('content_type', 'note').eq('content_id', resource_id).eq('reaction_type', 'like');
  const { data: comments } = await supabase.from('content_comments').select('body, user_id, created_at').eq('content_type', 'note').eq('content_id', resource_id).eq('is_hidden', false).order('created_at', { ascending: false });
  const commentList = [];
  if (comments) {
    for (const c of comments) {
      let name = 'User';
      try { const { data: { user } } = await supabase.auth.admin.getUserById(c.user_id); name = user?.user_metadata?.full_name || 'User'; } catch {}
      commentList.push({ comment: c.body, user_name: name, created_at: c.created_at });
    }
  }
  return res.status(200).json({ like_count: likeCount || 0, comments: commentList });
}

// ── Reaction / comment write handlers (unchanged) ─────────────────

async function toggleReaction(body, res, ctx) {
  const { content_type, content_id, reaction_type } = body;
  if (!content_type || !content_id || !reaction_type) throw new SecurityError('content_type, content_id, reaction_type required', 400);
  validateContentType(content_type);
  if (!VALID_REACTION_TYPES.includes(reaction_type)) throw new SecurityError('Invalid reaction_type', 400);
  const { data: existing } = await supabase.from('content_reactions').select('id').eq('user_id', ctx.userId).eq('content_type', content_type).eq('content_id', content_id).eq('reaction_type', reaction_type).maybeSingle();
  if (existing) { await supabase.from('content_reactions').delete().eq('id', existing.id); }
  else { await supabase.from('content_reactions').insert({ user_id: ctx.userId, content_type, content_id, reaction_type }); }
  await refreshEngagementSummary(content_type, content_id);
  return res.status(200).json({ success: true, active: !existing });
}

async function submitHelpful(body, res, ctx) { /* … same as before … */ }

async function addComment(body, res, ctx) { /* … same as before … */ }
async function editComment(body, res, ctx) { /* … same as before … */ }
async function deleteComment(body, res, ctx) { /* … same as before … */ }
async function flagComment(body, res, ctx) { /* … same as before … */ }
async function pinComment(body, res, ctx) { /* … same as before … */ }
async function hideComment(body, res, ctx) { /* … same as before … */ }

async function refreshEngagementSummary(contentType, contentId) {
  const [{ data: reactions }, { count: commentCount }] = await Promise.all([
    supabase.from('content_reactions').select('reaction_type').eq('content_type', contentType).eq('content_id', contentId),
    supabase.from('content_comments').select('id', { count: 'exact', head: true }).eq('content_type', contentType).eq('content_id', contentId).eq('is_hidden', false)
  ]);
  const counts = {};
  for (const r of reactions || []) { counts[r.reaction_type] = (counts[r.reaction_type] || 0) + 1; }
  await supabase.from('content_engagement_summary').upsert({
    content_type: contentType, content_id: contentId,
    like_count: counts.like || 0, love_count: counts.love || 0, helpful_count: counts.helpful || 0,
    bookmark_count: counts.bookmark || 0, helpful_yes_count: counts.helpful_yes || 0,
    helpful_no_count: counts.helpful_no || 0, comment_count: commentCount || 0,
    updated_at: new Date().toISOString()
  }, { onConflict: 'content_type,content_id' });
}
