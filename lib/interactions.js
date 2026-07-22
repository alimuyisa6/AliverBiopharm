 import { supabase, getUserProfileName, canAccessLevel, isAdmin } from './core.js';
import { parseAndValidateBody, requireAuth, SecurityError } from './security-middleware.js';

const CACHE_TTL = { STATS: 30000, DASHBOARD: 30000 };
const cache = new Map();
function getCached(key) { const entry = cache.get(key); if (entry && Date.now() < entry.expires) return entry.value; cache.delete(key); return null; }
function setCached(key, value, ttl) { cache.set(key, { value, expires: Date.now() + ttl }); }

export async function handler(req, res, path, ctx) {
  const publicPaths = ['get_public_stats', 'platform-stats', 'get_resource_interactions'];
  const isPublic = publicPaths.includes(path) && req.method === 'GET';

  if (!isPublic && !ctx.authenticated) {
    throw new SecurityError('Authentication required', 401);
  }

  if (req.method === 'POST') {
    const body = await parseAndValidateBody(req);
    switch (path) {
      case 'toggle_favorite': return toggleFavorite(body, res, ctx);
      case 'record_view': return recordView(body, res, ctx);
      case 'record_download': return recordDownload(body, res, ctx);
      case 'record_daily_visit': return recordDailyVisit(req, res, ctx);
      case 'submit_rating': return submitRating(body, res, ctx);
      case 'like_resource': return likeResource(body, res, ctx);
      case 'comment_resource': return commentResource(body, res, ctx);
      case 'submit_mood': return submitMood(body, res, ctx);
      case 'save_achievement': return saveAchievement(body, res, ctx);
      case 'update_user_presence': return updateUserPresence(req, res, ctx);
      case 'save_quiz_state': return saveQuizState(body, res, ctx);
      case 'track_event': return trackEvent(body, res, ctx);
      default: throw new SecurityError('Invalid action', 400);
    }
  }

  if (req.method === 'GET') {
    switch (path) {
      case 'get_resource_interactions': return getResourceInteractions(req, res);
      case 'get_user_favorites': return getUserFavorites(req, res, ctx);
      case 'get_recent_views': return getRecentViews(req, res, ctx);
      case 'get_user_ratings': return getUserRatings(req, res, ctx);
      case 'get_user_achievements': return getUserAchievements(req, res, ctx);
      case 'get_user_streak': return getUserStreak(req, res, ctx);
      case 'get_public_stats': return getPublicStats(req, res);
      case 'get_quiz_state': return getQuizState(req, res, ctx);
      case 'platform-stats': return res.status(200).json(await getPlatformStats());
      case 'dashboard': return res.status(200).json(await getUserDashboard(ctx.userId));
      case 'daily-challenge': return res.status(200).json(await getDailyChallenge(ctx.userId));
      case 'weak-areas': return res.status(200).json(await getWeakAreas(ctx.userId));
      case 'learning-paths': {
        const { level } = req.query;
        if (!level) throw new SecurityError('Level required', 400);
        // Check if user can access this level
        if (ctx.userId) {
          const canAccess = await canAccessLevel(ctx.userId, level);
          const adminData = await isAdmin(ctx.userId, 'unknown');
          if (!canAccess && !(adminData && adminData.admin_role)) {
            throw new SecurityError('You do not have access to this level', 403);
          }
        }
        return res.status(200).json(await getLearningPaths(level, ctx.userId));
      }
      case 'personal-records': return res.status(200).json(await getPersonalRecords(ctx.userId));
      default: throw new SecurityError('Invalid action', 400);
    }
  }

  throw new SecurityError('Method not allowed', 405);
}

async function getPlatformStats() {
  const cached = getCached('platform_stats');
  if (cached) return cached;
  const { data } = await supabase.from('platform_stats').select('*').eq('id', 1).single();
  if (!data) {
    const { count: qCount } = await supabase.from('quiz_questions').select('id', { count: 'exact', head: true });
    const { count: tCount } = await supabase.from('quiz_topics').select('id', { count: 'exact', head: true });
    const { data: activities } = await supabase.from('user_quiz_activity').select('percentage');
    const avgPass = activities && activities.length ? Math.round(activities.filter(a => a.percentage >= 70).length / activities.length * 100) : 0;
    const stats = { total_questions: qCount || 0, total_topics: tCount || 0, average_pass_rate: avgPass };
    setCached('platform_stats', stats, CACHE_TTL.STATS);
    return stats;
  }
  setCached('platform_stats', data, CACHE_TTL.STATS);
  return data;
}

async function getUserDashboard(userId) {
  const cacheKey = `dashboard:${userId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  // Get user's level for filtering
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('track, role, is_approved_teacher, approved_track')
    .eq('user_id', userId)
    .maybeSingle();

  let userLevel = null;
  let showAllContent = false;

  if (profile) {
    if (profile.role === 'student') {
      userLevel = profile.track;
    } else if (profile.role === 'teacher' && profile.is_approved_teacher) {
      if (profile.approved_track === 'ALL') {
        showAllContent = true;
      } else {
        userLevel = profile.approved_track || profile.track;
      }
    }
  }

  const { data: xpData } = await supabase.from('user_xp').select('total_xp, rank_title').eq('user_id', userId).single();
  const { data: streakData } = await supabase.from('user_recall_stats').select('current_streak').eq('user_id', userId).single();
  const { count: badgesCount } = await supabase.from('user_interactions').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('interaction_type', 'achievement');

  // Filter topics by user's level
  let topicQuery = supabase.from('quiz_topics').select('topic_name');
  if (userLevel && !showAllContent) {
    topicQuery = topicQuery.eq('level', userLevel);
  }
  const { data: allTopics } = await topicQuery;

  const { count: completedTopics } = await supabase
    .from('user_topic_completion')
    .select('topic_key', { count: 'exact', head: true })
    .eq('user_id', userId);

  const { data: nextGoal } = await supabase
    .from('user_quiz_activity')
    .select('topic, block_number')
    .eq('user_id', userId)
    .order('completed_at', { ascending: false })
    .limit(1);

  const nextTopic = nextGoal && nextGoal[0] ? nextGoal[0].topic : 'Genetics';
  const nextBlock = nextGoal && nextGoal[0] ? nextGoal[0].block_number + 1 : 1;
  const displayName = await getUserProfileName(userId) || 'Learner';

  const result = {
    display_name: displayName,
    streak: streakData?.current_streak || 0,
    xp: xpData?.total_xp || 0,
    next_level_xp: (Math.floor((xpData?.total_xp || 0) / 100) + 1) * 100,
    rank_title: xpData?.rank_title || 'Beginner',
    badges_count: badgesCount || 0,
    completed_topics: completedTopics || 0,
    total_topics: allTopics?.length || 0,
    user_level: userLevel,
    show_all_content: showAllContent,
    next_goal: { topic: nextTopic, block: nextBlock }
  };
  setCached(cacheKey, result, CACHE_TTL.DASHBOARD);
  return result;
}

async function getDailyChallenge(userId) {
  const today = new Date().toISOString().slice(0, 10);
  let { data: challenge } = await supabase.from('daily_challenges').select('*').eq('date', today).single();
  if (!challenge) {
    const rand = Math.floor(Math.random() * 3);
    const titles = ['Score 80% in any block', 'Answer 10 questions correctly', 'Earn 100 XP'];
    const types = ['block_score', 'correct_answers', 'xp_earned'];
    const targets = [80, 10, 100];
    const { data: newChallenge } = await supabase.from('daily_challenges').insert({ date: today, title: titles[rand], description: titles[rand], reward_xp: 50, requirement_type: types[rand], requirement_target: targets[rand] }).select().single();
    challenge = newChallenge;
  }
  let progress = 0, completed = false;
  if (challenge?.requirement_type === 'block_score') {
    const { data } = await supabase.from('user_quiz_activity').select('percentage').eq('user_id', userId).gte('completed_at', today).order('percentage', { ascending: false }).limit(1);
    if (data && data[0]) progress = data[0].percentage;
    completed = progress >= challenge.requirement_target;
  } else if (challenge?.requirement_type === 'correct_answers') {
    const { data } = await supabase.from('user_quiz_activity').select('score').eq('user_id', userId).gte('completed_at', today);
    progress = data?.reduce((sum, a) => sum + (a.score || 0), 0) || 0;
    completed = progress >= challenge.requirement_target;
  } else if (challenge?.requirement_type === 'xp_earned') {
    const { data } = await supabase.from('xp_events').select('amount').eq('user_id', userId).gte('created_at', today);
    progress = data?.reduce((sum, ev) => sum + ev.amount, 0) || 0;
    completed = progress >= challenge.requirement_target;
  }
  return { title: challenge?.title || '', reward_xp: challenge?.reward_xp || 0, completed, progress, target: challenge?.requirement_target || 0 };
}

async function getWeakAreas(userId) {
  // Get user's level
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('track')
    .eq('user_id', userId)
    .maybeSingle();

  let query = supabase
    .from('user_topic_performance')
    .select('topic, avg_score')
    .eq('user_id', userId);

  if (profile?.track) {
    query = query.eq('level', profile.track);
  }

  const { data } = await query.order('avg_score', { ascending: true }).limit(3);
  const weakTopics = data?.filter(t => t.avg_score < 70).map(t => t.topic) || [];
  let recommendedBlock = null;
  if (weakTopics.length) {
    const { data: lastBlock } = await supabase.from('user_quiz_activity').select('block_number').eq('user_id', userId).eq('topic', weakTopics[0]).order('block_number', { ascending: false }).limit(1);
    const next = lastBlock && lastBlock[0] ? lastBlock[0].block_number + 1 : 0;
    recommendedBlock = { topic: weakTopics[0], block: next };
  }
  return { weak_topics: weakTopics, recommended_block: recommendedBlock };
}

async function getLearningPaths(level, userId) {
  const { data: paths } = await supabase.from('learning_paths').select('*').eq('level', level).order('display_order');
  if (!paths) return [];
  const { data: progress } = await supabase.from('user_learning_path_progress').select('path_id, completed').eq('user_id', userId);
  const progressMap = new Map(progress?.map(p => [p.path_id, p.completed]) || []);
  return paths.map(p => ({ ...p, completed: progressMap.get(p.id) || false }));
}

async function getPersonalRecords(userId) {
  const { data } = await supabase.from('user_records').select('*').eq('user_id', userId).single();
  return data || { highest_score: 0, fastest_completion: 0, perfect_blocks: 0 };
}

async function toggleFavorite(body, res, ctx) {
  const { resource_id } = body;
  const { data: existing } = await supabase.from('user_interactions').select('id').eq('user_id', ctx.userId).eq('resource_id', resource_id).eq('interaction_type', 'favorite').maybeSingle();
  if (existing) {
    await supabase.from('user_interactions').delete().eq('id', existing.id);
    return res.status(200).json({ favorited: false });
  }
  await supabase.from('user_interactions').insert({ user_id: ctx.userId, resource_id, interaction_type: 'favorite' });
  return res.status(200).json({ favorited: true });
}

async function recordView(body, res, ctx) {
  const { resource_id } = body;
  await supabase.from('user_interactions').insert({ user_id: ctx.userId, resource_id, interaction_type: 'view' });
  return res.status(200).json({ success: true });
}

async function recordDownload(body, res, ctx) {
  const { resource_id } = body;
  await supabase.from('user_interactions').insert({ user_id: ctx.userId, resource_id, interaction_type: 'download' });
  return res.status(200).json({ success: true });
}

async function recordDailyVisit(req, res, ctx) {
  const today = new Date().toISOString().slice(0, 10);
  const { data: existing } = await supabase.from('user_interactions').select('id').eq('user_id', ctx.userId).eq('interaction_type', 'daily_visit').gte('created_at', `${today}T00:00:00Z`).lte('created_at', `${today}T23:59:59Z`).limit(1);
  if (!existing || existing.length === 0) {
    await supabase.from('user_interactions').insert({ user_id: ctx.userId, interaction_type: 'daily_visit' });
  }
  return res.status(200).json({ success: true });
}

async function submitRating(body, res, ctx) {
  const { resource_id, rating } = body;
  const { data: existing } = await supabase.from('user_interactions').select('id').eq('user_id', ctx.userId).eq('resource_id', resource_id).eq('interaction_type', 'rating').maybeSingle();
  if (existing) {
    await supabase.from('user_interactions').update({ value: rating, created_at: new Date().toISOString() }).eq('id', existing.id);
  } else {
    await supabase.from('user_interactions').insert({ user_id: ctx.userId, resource_id, interaction_type: 'rating', value: rating });
  }
  return res.status(200).json({ success: true });
}

async function likeResource(body, res, ctx) {
  const { resource_id } = body;
  const { data: existing } = await supabase.from('user_interactions').select('id').eq('user_id', ctx.userId).eq('resource_id', resource_id).eq('interaction_type', 'favorite').maybeSingle();
  if (existing) {
    await supabase.from('user_interactions').delete().eq('id', existing.id);
  } else {
    await supabase.from('user_interactions').insert({ user_id: ctx.userId, interaction_type: 'favorite', resource_id });
  }
  const { count } = await supabase.from('user_interactions').select('id', { count: 'exact', head: true }).eq('resource_id', resource_id).eq('interaction_type', 'favorite');
  return res.status(200).json({ liked: !existing, like_count: count || 0 });
}

async function commentResource(body, res, ctx) {
  const { resource_id, comment } = body;
  await supabase.from('user_interactions').insert({ user_id: ctx.userId, interaction_type: 'review', resource_id, metadata: { comment } });
  return res.status(200).json({ success: true });
}

async function submitMood(body, res, ctx) {
  const { mood, message } = body;
  await supabase.from('user_interactions').insert({ user_id: ctx.userId, interaction_type: 'mood', resource_id: null, metadata: { mood, message: message || '' } });
  return res.status(200).json({ success: true });
}

async function saveAchievement(body, res, ctx) {
  const { badge } = body;
  if (!badge || (!badge.id && typeof badge !== 'string')) throw new SecurityError('Invalid badge', 400);
  const badgeId = badge.id || badge;
  const { data: existing } = await supabase.from('user_interactions').select('id').eq('user_id', ctx.userId).eq('interaction_type', 'achievement').eq('metadata->>badge', badgeId).maybeSingle();
  if (existing) return res.status(200).json({ success: true, already_earned: true });
  await supabase.from('user_interactions').insert({ user_id: ctx.userId, interaction_type: 'achievement', metadata: { badge: badgeId, ...(typeof badge === 'object' ? badge : {}) } });
  return res.status(200).json({ success: true, already_earned: false });
}

async function updateUserPresence(req, res, ctx) {
  await supabase.from('user_presence').upsert({ user_id: ctx.userId, last_seen: new Date().toISOString() }, { onConflict: 'user_id' });
  return res.status(200).json({ success: true });
}

async function getResourceInteractions(req, res) {
  const { resource_id } = req.query;
  const { count: likeCount } = await supabase.from('user_interactions').select('id', { count: 'exact', head: true }).eq('resource_id', resource_id).eq('interaction_type', 'favorite');
  const { data: comments } = await supabase.from('user_interactions').select('metadata, created_at, user_id').eq('resource_id', resource_id).eq('interaction_type', 'review').order('created_at', { ascending: false }).limit(20);
  const commentList = [];
  if (comments) {
    for (const c of comments) {
      const profileName = await getUserProfileName(c.user_id);
      commentList.push({ comment: c.metadata?.comment || '', user_name: profileName || 'User', created_at: c.created_at });
    }
  }
  return res.status(200).json({ like_count: likeCount || 0, comments: commentList });
}

async function getUserFavorites(req, res, ctx) {
  const { data, error } = await supabase.from('user_interactions').select('resource_id').eq('user_id', ctx.userId).eq('interaction_type', 'favorite').order('created_at', { ascending: false });
  if (error) throw new SecurityError('Failed to fetch favorites', 500);
  const favorites = [];
  for (const f of (data || [])) {
    const { data: resource } = await supabase.from('biology_notes').select('title').eq('id', f.resource_id).maybeSingle();
    favorites.push({ resource_id: f.resource_id, title: resource?.title || 'Unknown' });
  }
  return res.status(200).json(favorites);
}

async function getRecentViews(req, res, ctx) {
  const limit = parseInt(req.query.limit) || 5;
  const { data, error } = await supabase.from('user_interactions').select('resource_id, created_at').eq('user_id', ctx.userId).eq('interaction_type', 'view').order('created_at', { ascending: false }).limit(limit);
  if (error) throw new SecurityError('Failed to fetch recent views', 500);
  const views = [];
  for (const v of (data || [])) {
    const { data: resource } = await supabase.from('biology_notes').select('title').eq('id', v.resource_id).maybeSingle();
    views.push({ resource_id: v.resource_id, title: resource?.title || 'Unknown', created_at: v.created_at });
  }
  return res.status(200).json(views);
}

async function getUserRatings(req, res, ctx) {
  const { data, error } = await supabase.from('user_interactions').select('resource_id, value').eq('user_id', ctx.userId).eq('interaction_type', 'rating');
  if (error) throw new SecurityError('Failed to fetch ratings', 500);
  const userRatings = {};
  (data || []).forEach(r => { userRatings[r.resource_id] = r.value; });
  return res.status(200).json(userRatings);
}

async function getUserAchievements(req, res, ctx) {
  const { data, error } = await supabase.from('user_interactions').select('metadata').eq('user_id', ctx.userId).eq('interaction_type', 'achievement');
  if (error) throw new SecurityError('Failed to fetch achievements', 500);
  return res.status(200).json((data || []).map(d => ({ badge: d.metadata?.badge || 'Unknown' })));
}

async function getUserStreak(req, res, ctx) {
  const { data, error } = await supabase.from('user_interactions').select('created_at').eq('user_id', ctx.userId).eq('interaction_type', 'daily_visit').order('created_at', { ascending: false });
  if (error) throw new SecurityError('Failed to fetch streak', 500);
  const dates = (data || []).map(d => new Date(d.created_at).toISOString().slice(0, 10));
  let streak = 0;
  const today = new Date().toISOString().slice(0, 10);
  let checkDate = today;
  const dateSet = new Set(dates);
  if (!dateSet.has(checkDate)) {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    if (!dateSet.has(yesterday)) return res.status(200).json({ count: 0 });
    checkDate = yesterday;
  }
  while (dateSet.has(checkDate)) {
    streak++;
    const d = new Date(checkDate);
    d.setDate(d.getDate() - 1);
    checkDate = d.toISOString().slice(0, 10);
  }
  return res.status(200).json({ count: streak });
}

async function getPublicStats(req, res) {
  try {
    const [resCount, downCount, quizCount, authUsers] = await Promise.all([
      supabase.from('biology_notes').select('id', { count: 'exact', head: true }),
      supabase.from('user_interactions').select('id', { count: 'exact', head: true }).eq('interaction_type', 'download'),
      supabase.from('user_quiz_activity').select('id', { count: 'exact', head: true }),
      supabase.auth.admin.listUsers()
    ]);
    return res.status(200).json({
      resources_count: resCount.count || 0,
      downloads_count: downCount.count || 0,
      quiz_attempts: quizCount.count || 0,
      users_count: authUsers.data?.users?.length || 0
    });
  } catch {
    return res.status(200).json({ resources_count: 0, downloads_count: 0, quiz_attempts: 0, users_count: 0 });
  }
}

async function saveQuizState(body, res, ctx) {
  const { state } = body;
  if (!state) throw new SecurityError('State required', 400);
  const safeState = {
    topic: state.topic, level: state.level, block: state.block,
    totalBlocks: state.totalBlocks, index: state.index, startTime: state.startTime,
    totalQuestions: state.totalQuestions,
    answers: (state.answers || []).map(a => a ? { selected: a.selected, correct: a.correct, correct_option: a.correct_option, correct_answer_text: a.correct_answer_text } : null),
    questions: (state.questions || []).map(q => ({ id: q.id, question_text: q.question_text, option_a: q.option_a, option_b: q.option_b, option_c: q.option_c, option_d: q.option_d, difficulty: q.difficulty }))
  };
  await supabase.from('user_quiz_sessions').upsert({ user_id: ctx.userId, state: safeState, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  return res.status(200).json({ success: true });
}

async function getQuizState(req, res, ctx) {
  const { data } = await supabase.from('user_quiz_sessions').select('state').eq('user_id', ctx.userId).maybeSingle();
  return res.status(200).json({ state: data?.state || null });
}

async function trackEvent(body, res, ctx) {
  const { event_name, event_data } = body;
  if (!event_name) throw new SecurityError('event_name required', 400);
  await supabase.from('user_analytics').insert({ user_id: ctx.userId, event_name, event_data: event_data || {}, created_at: new Date().toISOString() });
  return res.status(200).json({ success: true });
}
