 import { supabase } from './core.js';
import {
  parseAndValidateBody,
  requireAuth,
  requireAdmin,
  SecurityError,
} from './security-middleware.js';
import { createNotification } from './notifications.js';
import { getUserCurriculumScope } from './curriculum.js';

const CONTENT_TYPE_TABLE_MAP = {
  note:              { table: 'notes',               unitColumn: 'unit_id' },
  quiz_batch:        { table: 'quiz_batches',        unitColumn: 'unit_id' },
  flashcard_deck:    { table: 'flashcard_decks',     unitColumn: 'unit_id' },
  pdf_resource:      { table: 'pdf_resources',       unitColumn: 'unit_id' },
  past_paper:        { table: 'past_papers',         unitColumn: 'unit_id' },
  classroom:         { table: 'classrooms',          unitColumn: 'unit_id' },
  weekly_challenge:  { table: 'weekly_challenges',   unitColumn: 'unit_id' },
  content_collection:{ table: 'content_collections', unitColumn: 'unit_id' },
  video:             { table: 'videos',              unitColumn: 'unit_id' },
  article:           { table: 'articles',            unitColumn: 'unit_id' },
  curriculum_unit:   { table: 'curriculum_units',    unitColumn: 'id' },
  curriculum_group:  { table: 'curriculum_groups',   unitColumn: null },
  glossary_term:     { table: 'glossary_terms',      unitColumn: null },
  lab_case:          { table: 'lab_cases',           unitColumn: null },
  lab_pathway:       { table: 'lab_pathways',        unitColumn: null },
};

const VALID_CONTENT_TYPES = Object.keys(CONTENT_TYPE_TABLE_MAP);
const VALID_REACTION_TYPES = [
  'like', 'love', 'helpful', 'bookmark', 'helpful_yes', 'helpful_no',
];

export async function handler(req, res, path, ctx) {
  if (req.method === 'GET') {
    return handleGet(path, req, res, ctx);
  }
  if (req.method === 'POST') {
    requireAuth(ctx);
    const body = await parseAndValidateBody(req);
    return handlePost(path, body, req, res, ctx);
  }
  throw new SecurityError('Method not allowed', 405);
}

async function handleGet(path, req, res, ctx) {
  switch (path) {
    case 'reactions':                 return getReactions(req, res, ctx);
    case 'comments':                  return getComments(req, res, ctx);
    case 'summary':                   return getSummary(req, res, ctx);
    case 'admin_reactions':           requireAdmin(ctx); return adminGetReactions(req, res);
    case 'admin_comments':            requireAdmin(ctx); return adminGetComments(req, res);
    case 'my_comments':               requireAuth(ctx); return getMyComments(req, res, ctx);
    case 'my_bookmarks':             requireAuth(ctx); return getMyBookmarks(req, res, ctx);
    case 'get_public_stats':          return getPublicStats(req, res);
    case 'platform-stats':            return getPlatformStats(req, res);
    case 'leaderboard':               return getLeaderboard(req, res, ctx);
    case 'get_resource_interactions': return getResourceInteractions(req, res);
    case 'get_recent_views':          requireAuth(ctx); return getRecentViews(req, res, ctx);
    case 'get_user_ratings':          requireAuth(ctx); return getUserRatings(req, res, ctx);
    case 'get_user_streak':           requireAuth(ctx); return getUserStreak(req, res, ctx);
    case 'get_user_achievements':     requireAuth(ctx); return getUserAchievements(req, res, ctx);
    case 'get_user_favorites':        requireAuth(ctx); return getUserFavorites(req, res, ctx);
    case 'dashboard':                 requireAuth(ctx); return getUserDashboard(req, res, ctx);
    case 'daily-challenge':           requireAuth(ctx); return getDailyChallenge(req, res, ctx);
    case 'weak-areas':                requireAuth(ctx); return getWeakAreas(req, res, ctx);
    case 'learning-paths':            return getLearningPaths(req, res, ctx);
    case 'personal-records':          requireAuth(ctx); return getPersonalRecords(req, res, ctx);
    case 'get_quiz_state':            requireAuth(ctx); return getQuizState(req, res, ctx);
    default: throw new SecurityError('Invalid action', 400);
  }
}

async function handlePost(path, body, req, res, ctx) {
  switch (path) {
    case 'toggle_reaction':       return toggleReaction(body, res, ctx);
    case 'submit_helpful':        return submitHelpful(body, res, ctx);
    case 'add_comment':           return addComment(body, res, ctx);
    case 'edit_comment':          return editComment(body, res, ctx);
    case 'delete_comment':        return deleteComment(body, res, ctx);
    case 'flag_comment':          return flagComment(body, res, ctx);
    case 'pin_comment':           requireAdmin(ctx); return pinComment(body, res, ctx);
    case 'hide_comment':          requireAdmin(ctx); return hideComment(body, res, ctx);
    case 'toggle_favorite':       return toggleFavorite(body, res, ctx);
    case 'record_view':           return recordView(body, res, ctx);
    case 'record_download':       return recordDownload(body, res, ctx);
    case 'record_daily_visit':    return recordDailyVisit(body, res, ctx);
    case 'submit_rating':         return submitRating(body, res, ctx);
    case 'like_resource':         return res.status(200).json({ success: true });
    case 'comment_resource':      return res.status(200).json({ success: true });
    case 'submit_mood':           return res.status(200).json({ success: true });
    case 'save_achievement':      return saveAchievement(body, res, ctx);
    case 'save_quiz_state':       return saveQuizState(body, res, ctx);
    case 'track_event':           return trackEvent(body, res, ctx);
    case 'clear_quiz_state':      return clearQuizState(body, res, ctx);
    default: throw new SecurityError('Invalid action', 400);
  }
}

async function getUnitIdForContent(contentType, contentId) {
  const mapping = CONTENT_TYPE_TABLE_MAP[contentType];
  if (!mapping || mapping.unitColumn === null) return null;

  const { data, error } = await supabase
    .from(mapping.table)
    .select(mapping.unitColumn)
    .eq('id', contentId)
    .maybeSingle();

  if (error || !data) return null;
  return data[mapping.unitColumn];
}

async function ensureContentWithinScope(ctx, contentType, contentId) {
  if (!ctx.authenticated || ctx.adminData) return;
  const mapping = CONTENT_TYPE_TABLE_MAP[contentType];
  if (!mapping || mapping.unitColumn === null) return;

  const unitId = await getUnitIdForContent(contentType, contentId);
  if (!unitId) return;

  const scope = await getUserCurriculumScope(ctx.userId);
  if (!scope || !scope.active_group_id) {
    throw new SecurityError('Your curriculum context is not set.', 403);
  }

  const { data: allowedUnits } = await supabase
    .from('curriculum_units')
    .select('id')
    .eq('group_id', scope.active_group_id)
    .eq('is_active', true);

  const allowedIds = new Set((allowedUnits || []).map(u => u.id));
  if (!allowedIds.has(unitId)) {
    throw new SecurityError('Content not available in your curriculum.', 403);
  }
}

async function refreshSummary(contentType, contentId) {
  const [{ data: reactions }, { count: commentCount }] = await Promise.all([
    supabase.from('content_reactions').select('reaction_type').eq('content_type', contentType).eq('content_id', contentId),
    supabase.from('content_comments').select('id', { count: 'exact', head: true }).eq('content_type', contentType).eq('content_id', contentId).eq('is_hidden', false),
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
    updated_at: new Date().toISOString(),
  }, { onConflict: 'content_type,content_id' });
}

// ---------- social reactions ----------

async function getReactions(req, res, ctx) {
  const { content_type, content_id } = req.query;
  if (!content_type || !content_id) throw new SecurityError('content_type and content_id required', 400);
  if (!VALID_CONTENT_TYPES.includes(content_type)) throw new SecurityError('Invalid content_type', 400);
  await ensureContentWithinScope(ctx, content_type, content_id);

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
  if (!VALID_CONTENT_TYPES.includes(content_type)) throw new SecurityError('Invalid content_type', 400);
  await ensureContentWithinScope(ctx, content_type, content_id);

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
    updated_at: c.updated_at,
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

async function getSummary(req, res, ctx) {
  const { content_type, content_id } = req.query;
  if (!content_type || !content_id) throw new SecurityError('content_type and content_id required', 400);
  if (!VALID_CONTENT_TYPES.includes(content_type)) throw new SecurityError('Invalid content_type', 400);
  await ensureContentWithinScope(ctx, content_type, content_id);

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
    avg_time_spent_seconds: 0, completion_rate: 0,
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

async function getMyBookmarks(req, res, ctx) {
  const { data } = await supabase
    .from('content_reactions')
    .select('content_type, content_id, created_at')
    .eq('user_id', ctx.userId)
    .eq('reaction_type', 'bookmark')
    .order('created_at', { ascending: false })
    .limit(50);

  const enriched = [];
  for (const b of (data || [])) {
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

async function toggleReaction(body, res, ctx) {
  const { content_type, content_id, reaction_type } = body;
  if (!content_type || !content_id || !reaction_type) throw new SecurityError('content_type, content_id, reaction_type required', 400);
  if (!VALID_CONTENT_TYPES.includes(content_type)) throw new SecurityError('Invalid content_type', 400);
  if (!VALID_REACTION_TYPES.includes(reaction_type)) throw new SecurityError('Invalid reaction_type', 400);
  await ensureContentWithinScope(ctx, content_type, content_id);

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
  if (!VALID_CONTENT_TYPES.includes(content_type)) throw new SecurityError('Invalid content_type', 400);
  await ensureContentWithinScope(ctx, content_type, content_id);

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

async function addComment(body, res, ctx) {
  const { content_type, content_id, body: commentBody, parent_comment_id } = body;
  if (!content_type || !content_id || !commentBody?.trim()) {
    throw new SecurityError('content_type, content_id, body required', 400);
  }
  if (!VALID_CONTENT_TYPES.includes(content_type)) throw new SecurityError('Invalid content_type', 400);
  if (commentBody.length > 2000) throw new SecurityError('Comment too long', 400);
  await ensureContentWithinScope(ctx, content_type, content_id);

  if (parent_comment_id) {
    const { data: parent } = await supabase.from('content_comments').select('id').eq('id', parent_comment_id).maybeSingle();
    if (!parent) throw new SecurityError('Parent comment not found', 404);
  }

  const { data, error } = await supabase
    .from('content_comments')
    .insert({
      user_id: ctx.userId,
      content_type,
      content_id,
      parent_comment_id: parent_comment_id || null,
      body: commentBody.trim(),
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
    metadata: {},
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
    metadata: {},
  });

  return res.status(200).json({ success: true });
}

// ---------- other user interactions ----------

async function getPublicStats(req, res) {
  try {
    const [{ count: resCount }, { count: userCount }, { count: quizCount }] = await Promise.all([
      supabase.from('notes').select('id', { count: 'exact', head: true }),
      supabase.from('user_profiles').select('user_id', { count: 'exact', head: true }),
      supabase.from('user_quiz_activity').select('id', { count: 'exact', head: true }),
    ]);
    return res.status(200).json({
      resources_count: resCount || 0,
      users_count: userCount || 0,
      downloads_count: 0,
      quiz_attempts: quizCount || 0,
    });
  } catch {
    return res.status(200).json({ resources_count: 0, users_count: 0, downloads_count: 0, quiz_attempts: 0 });
  }
}

async function getPlatformStats(req, res) {
  const { data } = await supabase.from('platform_stats').select('*').eq('id', 1).maybeSingle();
  return res.status(200).json(data || { total_questions: 0, total_topics: 0, total_learners: 0, average_pass_rate: 0 });
}

async function getLeaderboard(req, res, ctx) {
  const scope = await getUserCurriculumScope(ctx.userId);
  const groupId = scope?.active_group_id;
  if (!groupId) return res.status(200).json([]);

  const { data: units } = await supabase
    .from('curriculum_units')
    .select('id')
    .eq('group_id', groupId)
    .eq('is_active', true);
  const unitIds = (units || []).map(u => u.id);
  if (!unitIds.length) return res.status(200).json([]);

  const { data: profiles } = await supabase
    .from('user_xp')
    .select('user_id, total_xp')
    .order('total_xp', { ascending: false })
    .limit(20);

  return res.status(200).json(profiles || []);
}

async function getResourceInteractions(req, res) {
  const { resource_id, content_type = 'note' } = req.query;
  if (!resource_id) throw new SecurityError('resource_id required', 400);

  const { count: likeCount } = await supabase
    .from('content_reactions')
    .select('id', { count: 'exact', head: true })
    .eq('content_type', content_type)
    .eq('content_id', resource_id)
    .eq('reaction_type', 'like');

  const { data: comments } = await supabase
    .from('content_comments')
    .select('body, user_id, created_at')
    .eq('content_type', content_type)
    .eq('content_id', resource_id)
    .eq('is_hidden', false)
    .order('created_at', { ascending: false });

  const commentList = [];
  if (comments) {
    for (const c of comments) {
      let name = 'User';
      try {
        const { data: { user } } = await supabase.auth.admin.getUserById(c.user_id);
        name = user?.user_metadata?.full_name || 'User';
      } catch {}
      commentList.push({ comment: c.body, user_name: name, created_at: c.created_at });
    }
  }

  return res.status(200).json({ like_count: likeCount || 0, comments: commentList });
}

async function getRecentViews(req, res, ctx) {
  const { data } = await supabase
    .from('user_interactions')
    .select('resource_id, metadata, created_at')
    .eq('user_id', ctx.userId)
    .eq('interaction_type', 'view')
    .order('created_at', { ascending: false })
    .limit(10);
  return res.status(200).json(data || []);
}

async function getUserRatings(req, res, ctx) {
  const { data } = await supabase
    .from('user_interactions')
    .select('resource_id, value')
    .eq('user_id', ctx.userId)
    .eq('interaction_type', 'rating');
  const map = {};
  (data || []).forEach(r => { map[r.resource_id] = r.value; });
  return res.status(200).json(map);
}

async function getUserStreak(req, res, ctx) {
  const { data } = await supabase
    .from('user_daily_activity')
    .select('activity_date')
    .eq('user_id', ctx.userId)
    .order('activity_date', { ascending: false });

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
  const { data } = await supabase
    .from('content_reactions')
    .select('content_type, content_id')
    .eq('user_id', ctx.userId)
    .eq('reaction_type', 'bookmark');
  return res.status(200).json(data || []);
}

async function getUserDashboard(req, res, ctx) {
  const scope = await getUserCurriculumScope(ctx.userId);

  const [xpData, streakRes] = await Promise.all([
    supabase.from('user_xp').select('total_xp, rank_title').eq('user_id', ctx.userId).maybeSingle(),
    supabase.from('user_daily_activity').select('activity_date').eq('user_id', ctx.userId).order('activity_date', { ascending: false }),
  ]);

  let streak = 0;
  const today = new Date().toISOString().slice(0, 10);
  const dates = new Set((streakRes.data || []).map(d => d.activity_date));
  let check = today;
  if (!dates.has(check)) {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    check = dates.has(yesterday) ? yesterday : null;
  }
  while (check && dates.has(check)) {
    streak++;
    const d = new Date(check);
    d.setDate(d.getDate() - 1);
    check = d.toISOString().slice(0, 10);
  }

  const response = {
    xp: xpData?.data?.total_xp || 0,
    streak,
    rank_title: xpData?.data?.rank_title || 'Beginner',
  };

  return res.status(200).json(response);
}

async function getDailyChallenge(req, res, ctx) {
  const scope = await getUserCurriculumScope(ctx.userId);
  const groupId = scope?.active_group_id;
  if (!groupId) return res.status(200).json({ challenge: null, message: 'No active curriculum context.' });

  const today = new Date().toISOString().slice(0, 10);

  const { data: challenge } = await supabase
    .from('daily_challenges')
    .select('*')
    .eq('group_id', groupId)
    .eq('date', today)
    .maybeSingle();

  if (!challenge) {
    return res.status(200).json({ title: 'No challenge today', completed: false, progress: 0, target: 0, reward_xp: 0 });
  }

  const { data: progress } = await supabase
    .from('user_challenge_progress')
    .select('progress, completed')
    .eq('user_id', ctx.userId)
    .eq('challenge_id', challenge.id)
    .maybeSingle();

  return res.status(200).json({
    title: challenge.title,
    completed: progress?.completed || false,
    progress: progress?.progress || 0,
    target: challenge.requirement_target || 10,
    reward_xp: challenge.reward_xp || 50,
  });
}

async function getWeakAreas(req, res, ctx) {
  const { data } = await supabase
    .from('user_topic_stats')
    .select('topic, xp')
    .eq('user_id', ctx.userId)
    .order('xp', { ascending: true })
    .limit(3);
  return res.status(200).json({ weak_topics: (data || []).map(t => t.topic) });
}

async function getLearningPaths(req, res, ctx) {
  const scope = await getUserCurriculumScope(ctx.userId);
  const levelId = scope?.active_level_id || (await getDefaultLevelId());

  const { data } = await supabase
    .from('learning_paths')
    .select('*')
    .eq('level_id', levelId)
    .order('display_order');
  return res.status(200).json(data || []);
}

async function getDefaultLevelId() {
  const { data: firstLevel } = await supabase
    .from('curriculum_levels')
    .select('id')
    .order('display_order', { ascending: true })
    .limit(1)
    .maybeSingle();
  return firstLevel?.id || null;
}

async function getPersonalRecords(req, res, ctx) {
  const { data } = await supabase.from('user_records').select('*').eq('user_id', ctx.userId).maybeSingle();
  return res.status(200).json(data || { highest_score: 0, fastest_completion: 0, perfect_blocks: 0 });
}

async function getQuizState(req, res, ctx) {
  const { data, error } = await supabase
    .from('user_quiz_resume_state')
    .select('state')
    .eq('user_id', ctx.userId)
    .maybeSingle();
  if (error) throw new SecurityError('Failed to fetch quiz state', 500);
  return res.status(200).json({ state: data?.state || null });
}

async function toggleFavorite(body, res, ctx) {
  const { resource_id } = body;
  if (!resource_id) throw new SecurityError('resource_id required', 400);

  const { data: existing } = await supabase
    .from('content_reactions')
    .select('id')
    .eq('user_id', ctx.userId)
    .eq('content_type', 'note')
    .eq('content_id', resource_id)
    .eq('reaction_type', 'bookmark')
    .maybeSingle();

  if (existing) await supabase.from('content_reactions').delete().eq('id', existing.id);
  else await supabase.from('content_reactions').insert({ user_id: ctx.userId, content_type: 'note', content_id: resource_id, reaction_type: 'bookmark' });

  return res.status(200).json({ success: true });
}

async function recordView(body, res, ctx) {
  const { resource_id, content_type = 'note' } = body;
  await supabase.from('user_interactions').insert({
    user_id: ctx.userId,
    interaction_type: 'view',
    resource_id,
    metadata: { content_type },
  });
  return res.status(200).json({ success: true });
}

async function recordDownload(body, res, ctx) {
  const { resource_id, content_type = 'note' } = body;
  await supabase.from('user_interactions').insert({
    user_id: ctx.userId,
    interaction_type: 'download',
    resource_id,
    metadata: { content_type },
  });
  return res.status(200).json({ success: true });
}

async function recordDailyVisit(body, res, ctx) {
  const today = new Date().toISOString().slice(0, 10);
  await supabase.from('user_daily_activity').upsert(
    { user_id: ctx.userId, activity_date: today, count: 1 },
    { onConflict: 'user_id,activity_date' }
  );
  return res.status(200).json({ success: true });
}

async function submitRating(body, res, ctx) {
  const { resource_id, rating } = body;
  if (!resource_id || rating === undefined) throw new SecurityError('resource_id and rating required', 400);
  await supabase.from('user_interactions').insert({ user_id: ctx.userId, interaction_type: 'rating', resource_id, value: rating });
  return res.status(200).json({ success: true });
}

async function saveAchievement(body, res, ctx) {
  const { achievement_id } = body;
  if (!achievement_id) throw new SecurityError('achievement_id required', 400);
  await supabase.from('user_achievements').upsert(
    { user_id: ctx.userId, achievement_id },
    { onConflict: 'user_id,achievement_id' }
  );
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

async function clearQuizState(body, res, ctx) {
  const { error } = await supabase.from('user_quiz_resume_state').delete().eq('user_id', ctx.userId);
  if (error) throw new SecurityError('Failed to clear quiz state', 500);
  return res.status(200).json({ success: true });
}
