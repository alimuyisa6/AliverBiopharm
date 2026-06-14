import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function setCorsHeaders(res, req) {
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'https://aliverbiopharm.com').split(',').map(o => o.trim());
  const requestOrigin = req.headers.origin || '';
  const corsOrigin = allowedOrigins.includes(requestOrigin) ? requestOrigin : allowedOrigins[0];
  res.setHeader('Access-Control-Allow-Origin', corsOrigin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-CSRF-Token, Cookie');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Cache-Control', 'no-store, must-revalidate');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
}

function parseCookies(req) {
  const cookieHeader = req.headers.cookie || '';
  return Object.fromEntries(cookieHeader.split(';').map(c => {
    const [k, ...v] = c.trim().split('=');
    return [k.trim(), decodeURIComponent(v.join('='))];
  }));
}

function hashToken(token) { return crypto.createHash('sha256').update(token).digest('hex'); }

async function validateSession(token) {
  if (!token || token.length < 20) return null;
  const hashedToken = hashToken(token);
  const { data, error } = await supabase.from('user_sessions').select('user_id, expires_at, is_active').eq('session_token_hash', hashedToken).eq('is_active', true).single();
  if (error || !data) return null;
  if (new Date(data.expires_at) < new Date()) {
    await supabase.from('user_sessions').update({ is_active: false }).eq('session_token_hash', hashedToken);
    return null;
  }
  return data;
}

const CACHE_TTL = { STATS: 30000, DASHBOARD: 30000 };
const cache = new Map();

function getCached(key) {
  const entry = cache.get(key);
  if (entry && Date.now() < entry.expires) return entry.value;
  cache.delete(key);
  return null;
}

function setCached(key, value, ttl) {
  cache.set(key, { value, expires: Date.now() + ttl });
}

async function getPlatformStats() {
  const cached = getCached('platform_stats');
  if (cached) return cached;
  const { data, error } = await supabase.from('platform_stats').select('*').eq('id', 1).single();
  if (error || !data) {
    const { count: qCount } = await supabase.from('quiz_questions').select('id', { count: 'exact', head: true });
    const { count: tCount } = await supabase.from('quiz_topics').select('id', { count: 'exact', head: true });
    const { count: lCount } = await supabase.from('auth.users').select('id', { count: 'exact', head: true });
    const { data: activities } = await supabase.from('user_quiz_activity').select('percentage');
    const avgPass = activities && activities.length ? Math.round(activities.filter(a => a.percentage >= 70).length / activities.length * 100) : 0;
    const stats = { total_questions: qCount || 0, total_topics: tCount || 0, total_learners: lCount || 0, average_pass_rate: avgPass };
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
  const { count: badgesCount } = await supabase.from('user_achievements').select('achievement_id', { count: 'exact', head: true }).eq('user_id', userId);
  const { count: completedTopics } = await supabase.from('user_topic_completion').select('topic_key', { count: 'exact', head: true }).eq('user_id', userId);
  const { data: allTopics } = await supabase.from('quiz_topics').select('topic_name');
  const { data: nextGoal } = await supabase.from('user_quiz_activity').select('topic, block_number').eq('user_id', userId).order('completed_at', { ascending: false }).limit(1);
  const nextTopic = nextGoal && nextGoal[0] ? nextGoal[0].topic : 'Genetics';
  const nextBlock = nextGoal && nextGoal[0] ? nextGoal[0].block_number + 1 : 1;
  const { data: { user } } = await supabase.auth.admin.getUserById(userId);
  const displayName = user?.email?.split('@')[0] || 'Learner';
  const result = {
    display_name: displayName,
    streak: streakData?.current_streak || 0,
    xp: xpData?.total_xp || 0,
    next_level_xp: (Math.floor((xpData?.total_xp || 0) / 100) + 1) * 100,
    rank_title: xpData?.rank_title || 'Beginner',
    badges_count: badgesCount || 0,
    completed_topics: completedTopics || 0,
    total_topics: allTopics?.length || 0,
    next_goal: { topic: nextTopic, block: nextBlock }
  };
  setCached(cacheKey, result, CACHE_TTL.DASHBOARD);
  return result;
}

async function getDailyChallenge(userId) {
  const today = new Date().toISOString().slice(0,10);
  let { data: challenge } = await supabase.from('daily_challenges').select('*').eq('date', today).single();
  if (!challenge) {
    const rand = Math.floor(Math.random() * 3);
    const titles = ['Score 80% in any block', 'Answer 10 questions correctly', 'Earn 100 XP'];
    const types = ['block_score', 'correct_answers', 'xp_earned'];
    const targets = [80, 10, 100];
    const { data: newChallenge } = await supabase.from('daily_challenges').insert({
      date: today, title: titles[rand], description: titles[rand], reward_xp: 50,
      requirement_type: types[rand], requirement_target: targets[rand]
    }).select().single();
    challenge = newChallenge;
  }
  let progress = 0;
  let completed = false;
  if (challenge.requirement_type === 'block_score') {
    const { data } = await supabase.from('user_quiz_activity').select('percentage').eq('user_id', userId).gte('completed_at', today).order('percentage', { ascending: false }).limit(1);
    if (data && data[0]) progress = data[0].percentage;
    completed = progress >= challenge.requirement_target;
  } else if (challenge.requirement_type === 'correct_answers') {
    const { data } = await supabase.from('user_quiz_activity').select('score').eq('user_id', userId).gte('completed_at', today);
    const totalCorrect = data?.reduce((sum, a) => sum + (a.score || 0), 0) || 0;
    progress = totalCorrect;
    completed = progress >= challenge.requirement_target;
  } else if (challenge.requirement_type === 'xp_earned') {
    const { data } = await supabase.from('xp_events').select('amount').eq('user_id', userId).gte('created_at', today);
    const totalXp = data?.reduce((sum, ev) => sum + ev.amount, 0) || 0;
    progress = totalXp;
    completed = progress >= challenge.requirement_target;
  }
  if (completed) {
    const { data: existing } = await supabase.from('user_challenge_progress').select('completed').eq('user_id', userId).eq('challenge_id', challenge.id).single();
    if (!existing?.completed) {
      await supabase.from('user_challenge_progress').upsert({ user_id: userId, challenge_id: challenge.id, progress, completed: true, completed_at: new Date().toISOString() });
      await addXp(userId, challenge.reward_xp, 'daily_challenge');
    }
  }
  return { title: challenge.title, reward_xp: challenge.reward_xp, completed, progress, target: challenge.requirement_target };
}

async function getWeakAreas(userId) {
  const { data } = await supabase.from('user_topic_performance').select('topic, avg_score').eq('user_id', userId).order('avg_score', { ascending: true }).limit(3);
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

async function addXp(userId, amount, reason) {
  const { data: current } = await supabase.from('user_xp').select('total_xp, level').eq('user_id', userId).single();
  const newTotal = (current?.total_xp || 0) + amount;
  const newLevel = Math.floor(newTotal / 100) + 1;
  let rankTitle = 'Beginner';
  if (newTotal >= 10000) rankTitle = 'Master Biologist';
  else if (newTotal >= 6000) rankTitle = 'Scientist';
  else if (newTotal >= 3000) rankTitle = 'Biologist';
  else if (newTotal >= 1500) rankTitle = 'Scholar';
  else if (newTotal >= 500) rankTitle = 'Explorer';
  await supabase.from('user_xp').upsert({ user_id: userId, total_xp: newTotal, level: newLevel, rank_title: rankTitle });
  await supabase.from('xp_events').insert({ user_id: userId, event_type: reason, amount });
  if (current && current.level < newLevel) {
    await supabase.from('user_milestones').insert({ user_id: userId, milestone: `Level ${newLevel}` });
  }
}

export default async function handler(req, res) {
  setCorsHeaders(res, req);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { path } = req.query;
  const cookies = parseCookies(req);
  const token = cookies.session || '';
  let userId = null;
  if (token) {
    const session = await validateSession(token);
    if (session) userId = session.user_id;
  }

  if (!userId && path !== 'platform-stats') {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (req.method === 'GET') {
    switch (path) {
      case 'platform-stats':
        return res.status(200).json(await getPlatformStats());
      case 'dashboard':
        return res.status(200).json(await getUserDashboard(userId));
      case 'daily-challenge':
        return res.status(200).json(await getDailyChallenge(userId));
      case 'weak-areas':
        return res.status(200).json(await getWeakAreas(userId));
      case 'learning-paths': {
        const { level } = req.query;
        if (!level) return res.status(400).json({ error: 'Level required' });
        return res.status(200).json(await getLearningPaths(level, userId));
      }
      case 'personal-records':
        return res.status(200).json(await getPersonalRecords(userId));
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
  }

  res.status(405).json({ error: 'Method not allowed' });
}
