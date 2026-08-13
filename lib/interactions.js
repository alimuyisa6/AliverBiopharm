/* lib/interactions.js */
import { supabase, getPlatformStats, getPlatformLeaderboard, recordPlatformActivity, computeRankTitle, computeXpProgress, computeRecallLevel } from './core.js';
import {
  parseAndValidateBody,
  requireAuth,
  requireAdmin,
  SecurityError
} from './security-middleware.js';
import { createNotification } from './notifications.js';
import { getUserCurriculumScope } from './curriculum.js';

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
    case 'reactions':
      return getReactions(req, res, ctx);
    case 'comments':
      return getComments(req, res, ctx);
    case 'summary':
      return getSummary(req, res, ctx);
    case 'my_bookmarks':
      requireAuth(ctx);
      return getMyBookmarks(req, res, ctx);
    case 'get_public_stats':
      return getPublicStats(req, res);
    case 'platform-stats':
      return getGlobalPlatformStats(req, res);
    case 'leaderboard':
      return getLeaderboard(req, res, ctx);
    case 'get_user_streak':
      requireAuth(ctx);
      return getUserStreak(req, res, ctx);
    case 'get_user_achievements':
      requireAuth(ctx);
      return getUserAchievements(req, res, ctx);
    case 'dashboard':
      requireAuth(ctx);
      return getUserDashboard(req, res, ctx);
    case 'daily-challenge':
      requireAuth(ctx);
      return getDailyChallenge(req, res, ctx);
    case 'weak-areas':
      requireAuth(ctx);
      return getWeakAreas(req, res, ctx);
    case 'learning-paths':
      return getLearningPaths(req, res, ctx);
    case 'personal-records':
      requireAuth(ctx);
      return getPersonalRecords(req, res, ctx);
    case 'continue-reading':
      requireAuth(ctx);
      return getContinueReading(req, res, ctx);
    default:
      throw new SecurityError('Invalid action', 400);
  }
}

async function handlePost(path, body, req, res, ctx) {
  switch (path) {
    case 'toggle_reaction':
      return toggleReaction(body, res, ctx);
    case 'submit_helpful':
      return submitHelpful(body, res, ctx);
    case 'add_comment':
      return addComment(body, res, ctx);
    case 'edit_comment':
      return editComment(body, res, ctx);
    case 'delete_comment':
      return deleteComment(body, res, ctx);
    case 'flag_comment':
      return flagComment(body, res, ctx);
    case 'pin_comment':
      requireAdmin(ctx);
      return pinComment(body, res, ctx);
    case 'hide_comment':
      requireAdmin(ctx);
      return hideComment(body, res, ctx);
    case 'toggle_favorite':
      return toggleFavorite(body, res, ctx);
    case 'record_view':
      return recordView(body, res, ctx);
    case 'record_download':
      return recordDownload(body, res, ctx);
    case 'record_daily_visit':
      return recordDailyVisit(body, res, ctx);
    case 'submit_rating':
      return submitRating(body, res, ctx);
    case 'track_event':
      return trackEvent(body, res, ctx);
    default:
      throw new SecurityError('Invalid action', 400);
  }
}

async function getPublicStats(req, res) {
  const [{ count: resourcesCount }, { count: usersCount }, { count: quizAttempts }] = await Promise.all([
    supabase.from('notes').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('user_profiles').select('user_id', { count: 'exact', head: true }),
    supabase.from('user_quiz_activity').select('id', { count: 'exact', head: true })
  ]);

  return res.status(200).json({
    resources_count: resourcesCount || 0,
    users_count: usersCount || 0,
    downloads_count: 0,
    quiz_attempts: quizAttempts || 0
  });
}

async function getGlobalPlatformStats(req, res) {
  const { data } = await supabase
    .from('platform_stats')
    .select('*')
    .eq('id', 1)
    .maybeSingle();

  return res.status(200).json(data || {
    total_questions: 0,
    total_topics: 0,
    total_learners: 0,
    average_pass_rate: 0
  });
}

async function getLeaderboard(req, res, ctx) {
  const scope = ctx.authenticated ? await getUserCurriculumScope(ctx.userId) : null;
  const { limit } = req.query;
  const entries = await getPlatformLeaderboard(scope?.active_level_id || null, limit || 20);

  return res.status(200).json(entries);
}

async function getUserStreak(req, res, ctx) {
  const platform = await getPlatformStats(ctx.userId);

  return res.status(200).json({
    count: platform.current_streak || 0
  });
}

async function getUserAchievements(req, res, ctx) {
  const { data } = await supabase
    .from('user_achievements')
    .select('achievement_id, earned_at')
    .eq('user_id', ctx.userId);

  return res.status(200).json(data || []);
}

async function getUserDashboard(req, res, ctx) {
  const dashboardModule = await import('./dashboard.js');

  return dashboardModule.handler(req, res, 'summary', ctx);
}

async function getDailyChallenge(req, res, ctx) {
  const scope = await getUserCurriculumScope(ctx.userId);
  const groupId = scope?.active_group_id;

  if (!groupId) {
    return res.status(200).json({
      title: null,
      completed: false,
      progress: 0,
      target: 0,
      reward_xp: 0
    });
  }

  const today = new Date().toISOString().slice(0, 10);

  const { data: challenge } = await supabase
    .from('daily_challenges')
    .select('*')
    .eq('group_id', groupId)
    .eq('date', today)
    .maybeSingle();

  if (!challenge) {
    return res.status(200).json({
      title: null,
      completed: false,
      progress: 0,
      target: 0,
      reward_xp: 0
    });
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
    target: challenge.requirement_target || 0,
    reward_xp: challenge.reward_xp || 0
  });
}

async function getWeakAreas(req, res, ctx) {
  const scope = await getUserCurriculumScope(ctx.userId);
  const groupId = scope?.active_group_id;

  if (!groupId) {
    return res.status(200).json({
      weak_topics: [],
      recommended_block: null
    });
  }

  const { data: units } = await supabase
    .from('curriculum_units')
    .select('id')
    .eq('group_id', groupId)
    .eq('is_active', true);

  const unitIds = (units || []).map((unit) => unit.id);

  if (!unitIds.length) {
    return res.status(200).json({
      weak_topics: [],
      recommended_block: null
    });
  }

  const { data } = await supabase
    .from('user_weak_concepts_v2')
    .select('concept, incorrect_attempts, unit_id')
    .eq('user_id', ctx.userId)
    .in('unit_id', unitIds)
    .eq('resolved', false)
    .order('incorrect_attempts', { ascending: false })
    .limit(5);

  const weakTopics = (data || []).map((item) => item.concept);
  const recommendedBlock = data?.[0] ? {
    topic: data[0].concept,
    block: 1
  } : null;

  return res.status(200).json({
    weak_topics: weakTopics,
    recommended_block: recommendedBlock
  });
}

async function getLearningPaths(req, res, ctx) {
  const scope = ctx.authenticated ? await getUserCurriculumScope(ctx.userId) : null;
  const levelId = scope?.active_level_id || null;

  if (!levelId) {
    return res.status(200).json([]);
  }

  const { data } = await supabase
    .from('learning_paths')
    .select('*')
    .eq('level_id', levelId)
    .order('display_order');

  return res.status(200).json(data || []);
}

async function getPersonalRecords(req, res, ctx) {
  const { data } = await supabase
    .from('user_records')
    .select('*')
    .eq('user_id', ctx.userId)
    .maybeSingle();

  return res.status(200).json(data || {
    highest_score: 0,
    fastest_completion: 0,
    perfect_blocks: 0
  });
}

async function getContinueReading(req, res, ctx) {
  const limit = Math.min(parseInt(req.query.limit, 10) || 5, 20);

  const scope = await getUserCurriculumScope(ctx.userId);
  const groupId = scope?.active_group_id;

  if (!groupId) return res.status(200).json([]);

  const { data: units } = await supabase
    .from('curriculum_units')
    .select('id')
    .eq('group_id', groupId)
    .eq('is_active', true);

  const unitIds = (units || []).map((unit) => unit.id);

  if (!unitIds.length) return res.status(200).json([]);

  const { data } = await supabase
    .from('reading_progress')
    .select('note_id, scroll_percentage, last_accessed')
    .eq('user_id', ctx.userId)
    .neq('completed', true)
    .gt('scroll_percentage', 5)
    .order('last_accessed', { ascending: false })
    .limit(limit * 2);

  const results = [];

  for (const progress of data || []) {
    const { data: note } = await supabase
      .from('notes')
      .select('id, slug, title, unit_id')
      .eq('id', progress.note_id)
      .maybeSingle();

    if (!note || !unitIds.includes(note.unit_id)) continue;

    results.push({
      note_id: note.id,
      slug: note.slug,
      title: note.title,
      progress_percentage: progress.scroll_percentage,
      last_accessed: progress.last_accessed
    });

    if (results.length >= limit) break;
  }

  return res.status(200).json(results);
}

async function getReactions(req, res, ctx) {
  const { content_type, content_id } = req.query;

  if (!content_type || !content_id) {
    throw new SecurityError('content_type and content_id required', 400);
  }

  const { data } = await supabase
    .from('content_reactions')
    .select('reaction_type, user_id')
    .eq('content_type', content_type)
    .eq('content_id', content_id);

  const counts = {};
  const userReactions = [];

  for (const reaction of data || []) {
    counts[reaction.reaction_type] = (counts[reaction.reaction_type] || 0) + 1;

    if (ctx.authenticated && reaction.user_id === ctx.userId) {
      userReactions.push(reaction.reaction_type);
    }
  }

  return res.status(200).json({
    counts,
    user_reactions: userReactions,
    total: (data || []).length
  });
}

async function getComments(req, res, ctx) {
  const { content_type, content_id } = req.query;

  if (!content_type || !content_id) {
    throw new SecurityError('content_type and content_id required', 400);
  }

  const { data } = await supabase
    .from('content_comments')
    .select('*')
    .eq('content_type', content_type)
    .eq('content_id', content_id)
    .eq('is_hidden', false)
    .order('created_at', { ascending: false });

  return res.status(200).json({
    comments: data || [],
    total: (data || []).length
  });
}

async function getSummary(req, res, ctx) {
  return getReactions(req, res, ctx);
}

async function getMyBookmarks(req, res, ctx) {
  const { data } = await supabase
    .from('content_reactions')
    .select('content_type, content_id, created_at')
    .eq('user_id', ctx.userId)
    .eq('reaction_type', 'bookmark')
    .order('created_at', { ascending: false })
    .limit(50);

  return res.status(200).json(data || []);
}

async function toggleReaction(body, res, ctx) {
  const { content_type, content_id, reaction_type } = body;

  if (!content_type || !content_id || !reaction_type) {
    throw new SecurityError('content_type, content_id, reaction_type required', 400);
  }

  const allowedReactions = ['like', 'love', 'helpful', 'bookmark', 'helpful_yes', 'helpful_no'];

  if (!allowedReactions.includes(reaction_type)) {
    throw new SecurityError('Invalid reaction_type', 400);
  }

  const { data: existing } = await supabase
    .from('content_reactions')
    .select('id')
    .eq('user_id', ctx.userId)
    .eq('content_type', content_type)
    .eq('content_id', content_id)
    .eq('reaction_type', reaction_type)
    .maybeSingle();

  let active = false;

  if (existing) {
    await supabase
      .from('content_reactions')
      .delete()
      .eq('id', existing.id);
  } else {
    await supabase
      .from('content_reactions')
      .insert({
        user_id: ctx.userId,
        content_type,
        content_id,
        reaction_type
      });

    active = true;
  }

  return res.status(200).json({ success: true, active });
}

async function submitHelpful(body, res, ctx) {
  const { content_type, content_id, is_helpful } = body;

  if (!content_type || !content_id || is_helpful === undefined) {
    throw new SecurityError('content_type, content_id, is_helpful required', 400);
  }

  const reactionType = is_helpful ? 'helpful_yes' : 'helpful_no';
  const oppositeType = is_helpful ? 'helpful_no' : 'helpful_yes';

  await supabase
    .from('content_reactions')
    .delete()
    .eq('user_id', ctx.userId)
    .eq('content_type', content_type)
    .eq('content_id', content_id)
    .in('reaction_type', [reactionType, oppositeType]);

  await supabase
    .from('content_reactions')
    .insert({
      user_id: ctx.userId,
      content_type,
      content_id,
      reaction_type: reactionType
    });

  return res.status(200).json({ success: true });
}

async function addComment(body, res, ctx) {
  const { content_type, content_id, body: commentBody, parent_comment_id } = body;

  if (!content_type || !content_id || !commentBody?.trim()) {
    throw new SecurityError('content_type, content_id, body required', 400);
  }

  if (commentBody.length > 2000) {
    throw new SecurityError('Comment too long', 400);
  }

  const { data } = await supabase
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

  return res.status(200).json({ success: true, comment: data });
}

async function editComment(body, res, ctx) {
  const { id, body: newBody } = body;

  if (!id || !newBody?.trim()) {
    throw new SecurityError('id and body required', 400);
  }

  const { data: existing } = await supabase
    .from('content_comments')
    .select('user_id')
    .eq('id', id)
    .maybeSingle();

  if (!existing || existing.user_id !== ctx.userId) {
    throw new SecurityError('Access denied', 403);
  }

  await supabase
    .from('content_comments')
    .update({ body: newBody.trim(), updated_at: new Date().toISOString() })
    .eq('id', id);

  return res.status(200).json({ success: true });
}

async function deleteComment(body, res, ctx) {
  const { id } = body;

  if (!id) throw new SecurityError('id required', 400);

  const { data: existing } = await supabase
    .from('content_comments')
    .select('user_id')
    .eq('id', id)
    .maybeSingle();

  if (!existing) throw new SecurityError('Comment not found', 404);

  if (existing.user_id !== ctx.userId && !ctx.adminData) {
    throw new SecurityError('Access denied', 403);
  }

  await supabase
    .from('content_comments')
    .delete()
    .eq('id', id);

  return res.status(200).json({ success: true });
}

async function flagComment(body, res, ctx) {
  const { id } = body;

  if (!id) throw new SecurityError('id required', 400);

  await supabase
    .from('content_comments')
    .update({ is_flagged: true })
    .eq('id', id);

  return res.status(200).json({ success: true });
}

async function pinComment(body, res, ctx) {
  const { id, is_pinned } = body;

  if (!id || is_pinned === undefined) {
    throw new SecurityError('id and is_pinned required', 400);
  }

  await supabase
    .from('content_comments')
    .update({ is_pinned: !!is_pinned })
    .eq('id', id);

  return res.status(200).json({ success: true });
}

async function hideComment(body, res, ctx) {
  const { id, is_hidden } = body;

  if (!id || is_hidden === undefined) {
    throw new SecurityError('id and is_hidden required', 400);
  }

  await supabase
    .from('content_comments')
    .update({ is_hidden: !!is_hidden, is_flagged: false })
    .eq('id', id);

  return res.status(200).json({ success: true });
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

  if (existing) {
    await supabase
      .from('content_reactions')
      .delete()
      .eq('id', existing.id);
  } else {
    await supabase
      .from('content_reactions')
      .insert({
        user_id: ctx.userId,
        content_type: 'note',
        content_id: resource_id,
        reaction_type: 'bookmark'
      });
  }

  return res.status(200).json({ success: true });
}

async function recordView(body, res, ctx) {
  const { resource_id, content_type = 'note' } = body;

  await supabase.from('user_interactions').insert({
    user_id: ctx.userId,
    interaction_type: 'view',
    resource_id,
    metadata: { content_type }
  });

  return res.status(200).json({ success: true });
}

async function recordDownload(body, res, ctx) {
  const { resource_id, content_type = 'note' } = body;

  await supabase.from('user_interactions').insert({
    user_id: ctx.userId,
    interaction_type: 'download',
    resource_id,
    metadata: { content_type }
  });

  return res.status(200).json({ success: true });
}

async function recordDailyVisit(body, res, ctx) {
  await recordPlatformActivity(ctx.userId);

  return res.status(200).json({ success: true });
}

async function submitRating(body, res, ctx) {
  const { resource_id, rating } = body;

  if (!resource_id || rating === undefined) {
    throw new SecurityError('resource_id and rating required', 400);
  }

  await supabase.from('user_interactions').insert({
    user_id: ctx.userId,
    interaction_type: 'rating',
    resource_id,
    value: rating
  });

  return res.status(200).json({ success: true });
}

async function trackEvent(body, res, ctx) {
  const { event_name, event_data } = body;

  if (!event_name) throw new SecurityError('event_name required', 400);

  await supabase.from('user_analytics').insert({
    user_id: ctx.userId,
    event_name,
    event_data: event_data || {}
  });

  return res.status(200).json({ success: true });
}
