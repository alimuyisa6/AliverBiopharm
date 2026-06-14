import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function validateSession(token) {
  if (!token || token.length < 20) return null;
  const hashedToken = hashToken(token);
  const { data, error } = await supabase
    .from('user_sessions')
    .select('user_id, expires_at, is_active')
    .eq('session_token_hash', hashedToken)
    .eq('is_active', true)
    .single();
  if (error || !data) return null;
  if (new Date(data.expires_at) < new Date()) {
    await supabase.from('user_sessions').update({ is_active: false }).eq('session_token_hash', hashedToken);
    return null;
  }
  return data;
}

// ─── GET: get_quiz_topics ────────────────────────────────────────────────────
// Returns topics for a given level, with question counts, block counts,
// completed blocks and locked blocks for the authenticated user.
async function getQuizTopics(req, res, userId) {
  const { level } = req.query;
  if (!level) return res.status(400).json({ error: 'level is required' });

  const { data: topics, error } = await supabase
    .from('quiz_topics')
    .select('id, topic_name, level, display_order')
    .eq('level', level)
    .order('display_order', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });

  const enriched = await Promise.all((topics || []).map(async (topic) => {
    // Count questions
    const { count: questionCount } = await supabase
      .from('quiz_questions')
      .select('id', { count: 'exact', head: true })
      .eq('level', level)
      .eq('topic', topic.topic_name);

    // Derive total blocks (10 questions per block)
    const totalBlocks = questionCount ? Math.ceil(questionCount / 10) : 0;

    let completedBlocks = [];
    let lockedBlocks = [];

    if (userId) {
      // Completed blocks for this user/topic/level
      const { data: activity } = await supabase
        .from('user_quiz_activity')
        .select('block_number, passed, completed_at')
        .eq('user_id', userId)
        .eq('level', level)
        .eq('topic', topic.topic_name);

      if (activity && activity.length) {
        completedBlocks = activity.map(a => a.block_number);

        // Locked = completed within last 24h
        const now = new Date();
        lockedBlocks = activity
          .filter(a => {
            const completedAt = new Date(a.completed_at);
            return (now - completedAt) < 24 * 60 * 60 * 1000;
          })
          .map(a => a.block_number);
      }
    }

    return {
      topic_name: topic.topic_name,
      level: topic.level,
      question_count: questionCount || 0,
      total_blocks: totalBlocks,
      completed_blocks: completedBlocks,
      locked_blocks: lockedBlocks,
    };
  }));

  return res.status(200).json(enriched);
}

// ─── GET: get_quiz_block ─────────────────────────────────────────────────────
// Returns 10 questions for the given level/topic/block_number (no answers).
async function getQuizBlock(req, res, userId) {
  const { level, topic, block_number } = req.query;
  if (!level || !topic || block_number === undefined) {
    return res.status(400).json({ error: 'level, topic and block_number are required' });
  }

  const blockNum = parseInt(block_number);
  const offset = blockNum * 10;

  const { data: questions, error } = await supabase
    .from('quiz_questions')
    .select('id, question_text, option_a, option_b, option_c, option_d, difficulty, image_url')
    .eq('level', level)
    .eq('topic', topic)
    .order('id', { ascending: true })
    .range(offset, offset + 9);

  if (error) return res.status(500).json({ error: error.message });
  if (!questions || questions.length === 0) {
    return res.status(404).json({ error: 'No questions found for this block' });
  }

  return res.status(200).json({ questions, block_number: blockNum });
}

// ─── GET: check_daily_retry ──────────────────────────────────────────────────
// Checks whether a user can attempt a block (not locked within 24h).
async function checkDailyRetry(req, res, userId) {
  const { level, topic, block_number } = req.query;
  if (!level || !topic || block_number === undefined) {
    return res.status(400).json({ error: 'level, topic and block_number are required' });
  }

  const blockNum = parseInt(block_number);
  const { data: activity } = await supabase
    .from('user_quiz_activity')
    .select('completed_at')
    .eq('user_id', userId)
    .eq('level', level)
    .eq('topic', topic)
    .eq('block_number', blockNum)
    .order('completed_at', { ascending: false })
    .limit(1);

  if (!activity || activity.length === 0) {
    return res.status(200).json({ can_retry: true });
  }

  const lastAttempt = new Date(activity[0].completed_at);
  const hoursSince = (Date.now() - lastAttempt) / (1000 * 60 * 60);

  if (hoursSince < 24) {
    const hoursLeft = Math.ceil(24 - hoursSince);
    return res.status(200).json({
      can_retry: false,
      reason: `This block is locked. Try again in ${hoursLeft} hour${hoursLeft > 1 ? 's' : ''}.`
    });
  }

  return res.status(200).json({ can_retry: true });
}

// ─── POST: check_quiz_answer ─────────────────────────────────────────────────
// Checks a single answer and returns whether it's correct + correct option.
async function checkQuizAnswer(req, res, userId) {
  const { question_id, selected_option } = req.body;
  if (!question_id || !selected_option) {
    return res.status(400).json({ error: 'question_id and selected_option are required' });
  }

  const { data: question, error } = await supabase
    .from('quiz_questions')
    .select('correct_option, explanation, option_a, option_b, option_c, option_d')
    .eq('id', question_id)
    .single();

  if (error || !question) return res.status(404).json({ error: 'Question not found' });

  const correct = selected_option.toUpperCase() === question.correct_option.toUpperCase();
  const correctKey = `option_${question.correct_option.toLowerCase()}`;
  const correct_answer_text = question[correctKey] || '';

  return res.status(200).json({
    correct,
    correct_option: question.correct_option.toUpperCase(),
    correct_answer_text,
    explanation: question.explanation || ''
  });
}

// ─── POST: submit_quiz_block ─────────────────────────────────────────────────
// Submits a completed block, saves activity, awards XP.
async function submitQuizBlock(req, res, userId) {
  const { level, topic, block_number, answers, time_taken } = req.body;
  if (!level || !topic || block_number === undefined || !answers) {
    return res.status(400).json({ error: 'level, topic, block_number and answers are required' });
  }

  const blockNum = parseInt(block_number);

  // Fetch all questions for the block to build review
  const offset = blockNum * 10;
  const { data: questions } = await supabase
    .from('quiz_questions')
    .select('id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation')
    .eq('level', level)
    .eq('topic', topic)
    .order('id', { ascending: true })
    .range(offset, offset + 9);

  if (!questions || questions.length === 0) {
    return res.status(404).json({ error: 'Questions not found for this block' });
  }

  // Score the answers
  let score = 0;
  const reviewAnswers = questions.map((q, idx) => {
    const submitted = answers[idx] || {};
    const userOption = (submitted.selectedOption || '').toUpperCase();
    const correctOption = (q.correct_option || '').toUpperCase();
    const isCorrect = userOption === correctOption;
    if (isCorrect) score++;

    const optKey = `option_${correctOption.toLowerCase()}`;
    const userOptKey = `option_${userOption.toLowerCase()}`;

    return {
      question: q.question_text,
      userAnswerText: q[userOptKey] || userOption || 'No answer',
      correctAnswerText: q[optKey] || correctOption,
      isCorrect,
      explanation: q.explanation || ''
    };
  });

  const total = questions.length;
  const percentage = Math.round((score / total) * 100);
  const passed = percentage >= 70;

  // Save activity
  await supabase.from('user_quiz_activity').insert({
    user_id: userId,
    level,
    topic,
    block_number: blockNum,
    score,
    total,
    percentage,
    passed,
    time_taken: time_taken || 0,
    completed_at: new Date().toISOString()
  });

  // Award XP
  const xpEarned = passed ? Math.round(10 + (percentage / 10)) : 5;
  await addXp(userId, xpEarned, 'quiz_block');

  // Update topic performance
  await updateTopicPerformance(userId, level, topic, percentage);

  return res.status(200).json({
    score,
    total,
    percentage,
    passed,
    xp_earned: xpEarned,
    answers: reviewAnswers
  });
}

// ─── POST: add_quiz_questions_batch ─────────────────────────────────────────
async function addQuizQuestionsBatch(req, res) {
  const { level, topic, questions, batch_name } = req.body;
  if (!level || !topic || !questions || !Array.isArray(questions)) {
    return res.status(400).json({ error: 'level, topic and questions array are required' });
  }

  const rows = questions.map(q => ({
    level,
    topic,
    question_text: q.question_text,
    option_a: q.option_a,
    option_b: q.option_b,
    option_c: q.option_c,
    option_d: q.option_d,
    correct_option: q.correct_option,
    explanation: q.explanation || '',
    difficulty: q.difficulty || 'medium',
    batch_name: batch_name || null,
    image_url: q.image_url || null
  }));

  const { data, error } = await supabase.from('quiz_questions').insert(rows).select('id');
  if (error) return res.status(500).json({ error: error.message });

  // Upsert topic entry
  await supabase.from('quiz_topics').upsert(
    { topic_name: topic, level, display_order: 999 },
    { onConflict: 'topic_name,level' }
  );

  return res.status(200).json({ inserted: data?.length || 0 });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
async function addXp(userId, amount, reason) {
  const { data: current } = await supabase
    .from('user_xp')
    .select('total_xp, level')
    .eq('user_id', userId)
    .single();

  const newTotal = (current?.total_xp || 0) + amount;
  const newLevel = Math.floor(newTotal / 100) + 1;

  let rankTitle = 'Beginner';
  if (newTotal >= 10000) rankTitle = 'Master Biologist';
  else if (newTotal >= 6000) rankTitle = 'Scientist';
  else if (newTotal >= 3000) rankTitle = 'Biologist';
  else if (newTotal >= 1500) rankTitle = 'Scholar';
  else if (newTotal >= 500) rankTitle = 'Explorer';

  await supabase.from('user_xp').upsert(
    { user_id: userId, total_xp: newTotal, level: newLevel, rank_title: rankTitle },
    { onConflict: 'user_id' }
  );
  await supabase.from('xp_events').insert({ user_id: userId, event_type: reason, amount });

  if (current && current.level < newLevel) {
    await supabase.from('user_milestones').insert({ user_id: userId, milestone: `Level ${newLevel}` });
  }
}

async function updateTopicPerformance(userId, level, topic, percentage) {
  const { data: existing } = await supabase
    .from('user_topic_performance')
    .select('id, attempt_count, avg_score')
    .eq('user_id', userId)
    .eq('level', level)
    .eq('topic', topic)
    .single();

  if (existing) {
    const newCount = existing.attempt_count + 1;
    const newAvg = Math.round(((existing.avg_score * existing.attempt_count) + percentage) / newCount);
    await supabase.from('user_topic_performance').update({
      attempt_count: newCount,
      avg_score: newAvg,
      last_attempted_at: new Date().toISOString()
    }).eq('id', existing.id);
  } else {
    await supabase.from('user_topic_performance').insert({
      user_id: userId,
      level,
      topic,
      attempt_count: 1,
      avg_score: percentage,
      last_attempted_at: new Date().toISOString()
    });
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  setCorsHeaders(res, req);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { path } = req.query;

  // Public paths that don't need auth
  const publicPaths = ['get_quiz_topics'];

  const cookies = parseCookies(req);
  const token = cookies.session || '';
  let userId = null;

  if (token) {
    const session = await validateSession(token);
    if (session) userId = session.user_id;
  }

  if (!userId && !publicPaths.includes(path)) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (req.method === 'GET') {
    switch (path) {
      case 'get_quiz_topics':    return getQuizTopics(req, res, userId);
      case 'get_quiz_block':     return getQuizBlock(req, res, userId);
      case 'check_daily_retry':  return checkDailyRetry(req, res, userId);
      default:                   return res.status(400).json({ error: 'Invalid path' });
    }
  }

  if (req.method === 'POST') {
    switch (path) {
      case 'check_quiz_answer':       return checkQuizAnswer(req, res, userId);
      case 'submit_quiz_block':       return submitQuizBlock(req, res, userId);
      case 'add_quiz_questions_batch': return addQuizQuestionsBatch(req, res);
      default:                        return res.status(400).json({ error: 'Invalid path' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
