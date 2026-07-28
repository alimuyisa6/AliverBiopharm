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
      case 'get_recent_views': requireAuth(ctx); return getRecentViews(req, res, ctx);
      case 'get_user_ratings': requireAuth(ctx); return getUserRatings(req, res, ctx);
      case 'get_user_streak': requireAuth(ctx); return getUserStreak(req, res, ctx);
      case 'get_user_achievements': requireAuth(ctx); return getUserAchievements(req, res, ctx);
      case 'get_user_favorites': requireAuth(ctx); return getUserFavorites(req, res, ctx);
      case 'dashboard': requireAuth(ctx); return getUserDashboard(req, res, ctx);
      case 'daily-challenge': requireAuth(ctx); return getDailyChallenge(req, res, ctx);
      case 'weak-areas': requireAuth(ctx); return getWeakAreas(req, res, ctx);
      case 'learning-paths': return getLearningPaths(req, res, ctx);
      case 'personal-records': requireAuth(ctx); return getPersonalRecords(req, res, ctx);
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
      case 'toggle_favorite': return toggleFavorite(body, res, ctx);
      case 'record_view': return recordView(body, res, ctx);
      case 'record_download': return recordDownload(body, res, ctx);
      case 'record_daily_visit': return recordDailyVisit(body, res, ctx);
      case 'submit_rating': return submitRating(body, res, ctx);
      case 'like_resource': return likeResource(body, res, ctx);
      case 'comment_resource': return commentResource(body, res, ctx);
      case 'submit_mood': return submitMood(body, res, ctx);
      case 'save_achievement': return saveAchievement(body, res, ctx);
      case 'save_quiz_state': return saveQuizState(body, res, ctx);
      case 'track_event': return trackEvent(body, res, ctx);
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

async function adminGetReactions(req, res) {
  const { content_type, content_id } = req.query;
  const { data } = await supabase.from('content_reactions').select('*').eq('content_type', content_type).eq('content_id', content_id).order('created_at', { ascending: false });
  const enriched = [];
  for (const r of data || []) {
    let email = 'Unknown';
    try { const { data: { user } } = await supabase.auth.admin.getUserById(r.user_id); email = user?.email || 'Unknown'; } catch {}
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
    try { const { data: { user } } = await supabase.auth.admin.getUserById(c.user_id); email = user?.email || 'Unknown'; } catch {}
    enriched.push({ ...c, user_email: email });
  }
  return res.status(200).json(enriched);
}

async function getPublicStats(req, res) {
  try {
    const [{ count: resCount }, { count: userCount }, { count: quizCount }] = await Promise.all([
      supabase.from('notes').select('id', { count: 'exact', head: true }),
      supabase.from('user_profiles').select('user_id', { count: 'exact', head: true }),
      supabase.from('user_quiz_activity').select('id', { count: 'exact', head: true })
    ]);
    return res.status(200).json({
      resources_count: resCount || 0,
      users_count: userCount || 0,
      downloads_count: 0,
      quiz_attempts: quizCount || 0
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
  return res.status(200).json([]);
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

async function getRecentViews(req, res, ctx) {
  const { data } = await supabase.from('user_interactions').select('resource_id, metadata, created_at').eq('user_id', ctx.userId).eq('interaction_type', 'view').order('created_at', { ascending: false }).limit(10);
  return res.status(200).json(data || []);
}

async function getUserRatings(req, res, ctx) {
  const { data } = await supabase.from('user_interactions').select('resource_id, value').eq('user_id', ctx.userId).eq('interaction_type', 'rating');
  const map = {};
  (data || []).forEach(r => { map[r.resource_id] = r.value; });
  return res.status(200).json(map);
}

async function getUserStreak(req, res, ctx) {
  const { data } = await supabase.from('user_daily_activity').select('activity_date').eq('user_id', ctx.userId).order('activity_date', { ascending: false });
  let streak = 0;
  const today = new Date().toISOString().slice(0, 10);
  const dateSet = new Set((data || []).map(d => d.activity_date));
  let check = today;
  if (!dateSet.has(check)) {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    if (!dateSet.has(yesterday)) return res.status(200).json({ count: 0 });
    check = yesterday;
  }
  while (dateSet.has(check)) {
    streak++;
    const d = new Date(check);
    d.setDate(d.getDate() - 1);
    check = d.toISOString().slice(0, 10);
  }
  return res.status(200).json({ count: streak });
}

async function getUserAchievements(req, res, ctx) {
  const { data } = await supabase.from('user_achievements').select('achievement_id, earned_at').eq('user_id', ctx.userId);
  return res.status(200).json(data || []);
}

async function getUserFavorites(req, res, ctx) {
  const { data } = await supabase.from('content_reactions').select('content_type, content_id').eq('user_id', ctx.userId).eq('reaction_type', 'bookmark');
  return res.status(200).json(data || []);
}

async function getUserDashboard(req, res, ctx) {
  const [xpData, streakRes] = await Promise.all([
    supabase.from('user_xp').select('total_xp, rank_title').eq('user_id', ctx.userId).maybeSingle(),
    supabase.from('user_daily_activity').select('activity_date').eq('user_id', ctx.userId).order('activity_date', { ascending: false })
  ]);
  let streak = 0;
  const today = new Date().toISOString().slice(0, 10);
  const dates = new Set((streakRes.data || []).map(d => d.activity_date));
  let check = today;
  if (!dates.has(check)) {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    if (!dates.has(yesterday)) check = null;
    else check = yesterday;
  }
  while (check && dates.has(check)) {
    streak++;
    const d = new Date(check);
    d.setDate(d.getDate() - 1);
    check = d.toISOString().slice(0, 10);
  }
  return res.status(200).json({
    xp: xpData?.total_xp || 0,
    streak,
    rank_title: xpData?.rank_title || 'Beginner',
    next_goal: { topic: 'Genetics', block: 1 }
  });
}

async function getDailyChallenge(req, res, ctx) {
  const today = new Date().toISOString().slice(0, 10);
  const { data: challenge } = await supabase.from('daily_challenges').select('*').eq('date', today).maybeSingle();
  return res.status(200).json({
    title: challenge?.title || 'No challenge today',
    completed: false,
    progress: 0,
    target: challenge?.requirement_target || 10,
    reward_xp: challenge?.reward_xp || 50
  });
}

async function getWeakAreas(req, res, ctx) {
  const { data } = await supabase.from('user_topic_stats').select('topic, xp').eq('user_id', ctx.userId).order('xp', { ascending: true }).limit(3);
  return res.status(200).json({ weak_topics: (data || []).map(t => t.topic) });
}

async function getLearningPaths(req, res, ctx) {
  const { level } = req.query;
  const { data } = await supabase.from('learning_paths').select('*').eq('level', level || 'O-Level').order('display_order');
  return res.status(200).json(data || []);
}

async function getPersonalRecords(req, res, ctx) {
  const { data } = await supabase.from('user_records').select('*').eq('user_id', ctx.userId).maybeSingle();
  return res.status(200).json(data || { highest_score: 0, fastest_completion: 0, perfect_blocks: 0 });
}

async function toggleReaction(body, res, ctx) {
  const { content_type, content_id, reaction_type } = body;
  if (!content_type || !content_id || !reaction_type) throw new SecurityError('content_type, content_id, reaction_type required', 400);
  validateContentType(content_type);
  if (!VALID_REACTION_TYPES.includes(reaction_type)) throw new SecurityError('Invalid reaction_type', 400);
  const { data: existing } = await supabase.from('content_reactions').select('id').eq('user_id', ctx.userId).eq('content_type', content_type).eq('content_id', content_id).eq('reaction_type', reaction_type).maybeSingle();
  if (existing) { await supabase.from('content_reactions').delete().eq('id', existing.id); }
  else { await supabase.from('content_reactions').insert({ user_id: ctx.userId, content_type, content_id, reaction_type }); }
  return res.status(200).json({ success: true, active: !existing });
}

async function submitHelpful(body, res, ctx) {
  const { content_type, content_id, is_helpful } = body;
  if (!content_type || !content_id || is_helpful === undefined) throw new SecurityError('content_type, content_id, is_helpful required', 400);
  validateContentType(content_type);
  const reactionType = is_helpful ? 'helpful_yes' : 'helpful_no';
  const oppositeType = is_helpful ? 'helpful_no' : 'helpful_yes';
  await supabase.from('content_reactions').delete().eq('user_id', ctx.userId).eq('content_type', content_type).eq('content_id', content_id).in('reaction_type', [reactionType, oppositeType]);
  await supabase.from('content_reactions').insert({ user_id: ctx.userId, content_type, content_id, reaction_type: reactionType });
  return res.status(200).json({ success: true });
}

async function addComment(body, res, ctx) {
  const { content_type, content_id, body: commentBody, parent_comment_id } = body;
  if (!content_type || !content_id || !commentBody?.trim()) throw new SecurityError('content_type, content_id, body required', 400);
  validateContentType(content_type);
  await supabase.from('content_comments').insert({ user_id: ctx.userId, content_type, content_id, parent_comment_id: parent_comment_id || null, body: commentBody.trim() });
  return res.status(200).json({ success: true });
}

async function editComment(body, res, ctx) { return res.status(200).json({ success: true }); }
async function deleteComment(body, res, ctx) {
  const { id } = body;
  await supabase.from('content_comments').delete().eq('id', id);
  return res.status(200).json({ success: true });
}
async function flagComment(body, res, ctx) { return res.status(200).json({ success: true }); }
async function pinComment(body, res, ctx) { return res.status(200).json({ success: true }); }
async function hideComment(body, res, ctx) { return res.status(200).json({ success: true }); }

async function toggleFavorite(body, res, ctx) {
  const { resource_id } = body;
  const { data: existing } = await supabase.from('content_reactions').select('id').eq('user_id', ctx.userId).eq('content_type', 'note').eq('content_id', resource_id).eq('reaction_type', 'bookmark').maybeSingle();
  if (existing) await supabase.from('content_reactions').delete().eq('id', existing.id);
  else await supabase.from('content_reactions').insert({ user_id: ctx.userId, content_type: 'note', content_id: resource_id, reaction_type: 'bookmark' });
  return res.status(200).json({ success: true });
}

async function recordView(body, res, ctx) {
  await supabase.from('user_interactions').insert({ user_id: ctx.userId, interaction_type: 'view', resource_id: body.resource_id, metadata: { content_type: body.content_type || 'note' } });
  return res.status(200).json({ success: true });
}

async function recordDownload(body, res, ctx) {
  await supabase.from('user_interactions').insert({ user_id: ctx.userId, interaction_type: 'download', resource_id: body.resource_id, metadata: { content_type: body.content_type || 'note' } });
  return res.status(200).json({ success: true });
}

async function recordDailyVisit(body, res, ctx) {
  const today = new Date().toISOString().slice(0, 10);
  await supabase.from('user_daily_activity').upsert({ user_id: ctx.userId, activity_date: today, count: 1 }, { onConflict: 'user_id,activity_date' });
  return res.status(200).json({ success: true });
}

async function submitRating(body, res, ctx) {
  const { resource_id, rating } = body;
  if (!resource_id || rating === undefined) throw new SecurityError('resource_id and rating required', 400);
  await supabase.from('user_interactions').insert({ user_id: ctx.userId, interaction_type: 'rating', resource_id, value: rating });
  return res.status(200).json({ success: true });
}

async function likeResource(body, res, ctx) { return res.status(200).json({ success: true }); }
async function commentResource(body, res, ctx) { return res.status(200).json({ success: true }); }
async function submitMood(body, res, ctx) { return res.status(200).json({ success: true }); }

async function saveAchievement(body, res, ctx) {
  const { achievement_id } = body;
  if (!achievement_id) throw new SecurityError('achievement_id required', 400);
  await supabase.from('user_achievements').upsert({ user_id: ctx.userId, achievement_id }, { onConflict: 'user_id,achievement_id' });
  return res.status(200).json({ success: true });
}

async function saveQuizState(body, res, ctx) {
  const { state } = body;
  if (!state) throw new SecurityError('state required', 400);
  await supabase.from('user_quiz_resume_state').upsert({ user_id: ctx.userId, state }, { onConflict: 'user_id' });
  return res.status(200).json({ success: true });
}

async function trackEvent(body, res, ctx) {
  const { event_name, event_data } = body;
  if (!event_name) throw new SecurityError('event_name required', 400);
  await supabase.from('user_analytics').insert({ user_id: ctx.userId, event_name, event_data: event_data || {} });
  return res.status(200).json({ success: true });
}
