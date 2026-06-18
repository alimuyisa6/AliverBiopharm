 import { supabase } from './core.js';
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
  const { data: xpData } = await supabase.from('user_xp').select('total_xp, rank_title').eq('user_id', userId).single();
  const { data: streakData } = await supabase.from('user_recall_stats').select('current_streak').eq('user_id', userId).single();
  const { count: badgesCount } = await supabase.from('user_interactions').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('interaction_type', 'achievement');
  const { count: completedTopics } = await supabase.from('user_topic_completion').select('topic_key', { count: 'exact', head: true }).eq('user_id', userId);
  const { data: allTopics } = await supabase.from('quiz_topics').select('topic_name');
  const { data: nextGoal } = await supabase.from('user_quiz_activity').select('topic, block_number').eq('user_id', userId).order('completed_at', { ascending: false }).limit(1);
  const nextTopic = nextGoal && nextGoal[0] ? nextGoal[0].topic : 'Genetics';
  const nextBlock = nextGoal && nextGoal[0] ? nextGoal[0].block_number + 1 : 1;
  const { data: { user } } = await supabase.auth.admin.getUserById(userId);
  const displayName = user?.email?.split('@')[0] || 'Learner';
  const result = { display_name: displayName, streak: streakData?.current_streak || 0, xp: xpData?.total_xp || 0, next_level_xp: (Math.floor((xpData?.total_xp || 0) / 100) + 1) * 100, rank_title: xpData?.rank_title || 'Beginner', badges_count: badgesCount || 0, completed_topics: completedTopics || 0, total_topics: allTopics?.length || 0, next_goal: { topic: nextTopic, block: nextBlock } };
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
  const { data } = await supabase.from('user_topic_performance').select('topic, avg_score').eq('user_id', userId).order('avg_score
