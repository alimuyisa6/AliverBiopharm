import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

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

async function isAdmin(userId, ip) {
  if (!userId) return null;
  const { data } = await supabase.from('admin_master').select('admin_role').eq('admin_id', userId).eq('is_active', true).maybeSingle();
  return data;
}

export default async function handler(req, res) {
  setCorsHeaders(res, req);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { path } = req.query;
  const cookies = parseCookies(req);
  const token = cookies.session || '';
  let userId = null;
  let adminData = null;
  if (token) {
    const session = await validateSession(token);
    if (session) userId = session.user_id;
    adminData = await isAdmin(userId, req.headers['x-forwarded-for'] || 'unknown');
  }

  if (req.method === 'GET') {
    switch (path) {
      case 'get_quiz_topics': return getQuizTopics(req, res);
      case 'get_quiz_block': return getQuizBlock(req, res);
      case 'check_daily_retry': return checkDailyRetry(req, res, userId);
      default: return res.status(400).json({ error: 'Invalid action' });
    }
  }
  if (req.method === 'POST') {
    switch (path) {
      case 'check_quiz_answer': return checkQuizAnswer(req, res);
      case 'submit_quiz_block': return submitQuizBlock(req, res, userId);
      case 'add_quiz_questions_batch': return addQuizQuestionsBatch(req, res, adminData);
      default: return res.status(400).json({ error: 'Invalid action' });
    }
  }
  res.status(405).json({ error: 'Method not allowed' });
}

async function getQuizTopics(req, res) {
  const { level } = req.query;
  if (!level) return res.status(400).json({ error: 'Level required' });
  const { data, error } = await supabase.from('quiz_topics').select('id,topic_name,display_order,question_count,total_blocks,completed_blocks,locked_blocks').eq('level', level).eq('is_active', true).order('display_order');
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json(data || []);
}

async function getQuizBlock(req, res) {
  const { level, topic, block_number } = req.query;
  if (!level || !topic || block_number === undefined) return res.status(400).json({ error: 'Level, topic, and block_number required' });
  const offset = parseInt(block_number) * 10;
  const { data, error } = await supabase.from('quiz_questions').select('id,question_text,option_a,option_b,option_c,option_d,difficulty').eq('level', level).eq('topic', topic).eq('is_active', true).order('id').range(offset, offset + 9);
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ block_number: parseInt(block_number), questions: (data || []).sort(() => Math.random() - 0.5), total_in_block: (data || []).length });
}

async function checkDailyRetry(req, res, userId) {
  if (!userId) return res.status(401).json({ error: 'Authentication required' });
  const { level, topic, block_number } = req.query;
  let query = supabase.from('user_quiz_activity').select('completed_at,passed').eq('user_id', userId).eq('level', level).eq('topic', topic);
  if (block_number !== undefined) query = query.eq('block_number', block_number);
  query = query.order('completed_at', { ascending: false }).limit(1);
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  const last = data && data[0];
  if (!last) return res.status(200).json({ can_retry: true, reason: null, locked_blocks: [] });
  const today = new Date();
  const lastDate = new Date(last.completed_at);
  const sameDay = today.toDateString() === lastDate.toDateString();
  if (block_number !== undefined) return res.status(200).json({ can_retry: !sameDay, reason: sameDay ? 'You have already attempted this block today. Please try again tomorrow.' : null });
  const { data: allBlocks } = await supabase.from('user_quiz_activity').select('block_number,completed_at').eq('user_id', userId).eq('level', level).eq('topic', topic).order('completed_at', { ascending: false });
  const lockedBlocks = [];
  if (allBlocks) { allBlocks.forEach(b => { if (new Date(b.completed_at).toDateString() === today.toDateString()) lockedBlocks.push(b.block_number); }); }
  return res.status(200).json({ can_retry: true, locked_blocks: lockedBlocks });
}

async function checkQuizAnswer(req, res) {
  const { question_id, selected_option } = req.body;
  const { data: question, error } = await supabase.from('quiz_questions').select('id,correct_option,option_a,option_b,option_c,option_d').eq('id', question_id).single();
  if (error || !question) return res.status(404).json({ error: 'Question not found' });
  const isCorrect = selected_option === question.correct_option;
  const allOpts = { A: question.option_a, B: question.option_b, C: question.option_c, D: question.option_d };
  return res.status(200).json({ correct: isCorrect, correct_option: question.correct_option, correct_answer_text: allOpts[question.correct_option] });
}

async function submitQuizBlock(req, res, userId) {
  if (!userId) return res.status(401).json({ error: 'Authentication required' });
  const { level, topic, block_number, answers, time_taken } = req.body;
  if (!answers || !Array.isArray(answers) || answers.length === 0) return res.status(400).json({ error: 'Answers required' });
  const todayStart = new Date().toISOString().slice(0, 10) + 'T00:00:00Z';
  const { data: existingAttempt } = await supabase.from('user_quiz_activity').select('id').eq('user_id', userId).eq('level', level).eq('topic', topic).eq('block_number', block_number).gte('completed_at', todayStart).maybeSingle();
  if (existingAttempt) return res.status(429).json({ error: 'You have already attempted this block today. Please try again tomorrow.' });
  const questionIds = answers.map(a => a.id);
  const { data: questions, error: qe } = await supabase.from('quiz_questions').select('id,correct_option,explanation,question_text,option_a,option_b,option_c,option_d,difficulty').in('id', questionIds);
  if (qe) return res.status(500).json({ error: qe.message });
  const qMap = new Map(); (questions || []).forEach(q => qMap.set(q.id, q));
  let score = 0;
  const graded = answers.map(answer => {
    const q = qMap.get(answer.id);
    if (!q) return { id: answer.id, question: 'Question unavailable', userAnswer: 'X', correctAnswer: 'N/A', userAnswerText: 'Not answered', correctAnswerText: 'N/A', isCorrect: false, explanation: 'Removed.' };
    const userOpt = answer.selectedOption || 'X';
    const isCorrect = userOpt === q.correct_option;
    if (isCorrect) score++;
    const allOpts = { A: q.option_a, B: q.option_b, C: q.option_c, D: q.option_d };
    return { id: q.id, question: q.question_text, userAnswer: userOpt, correctAnswer: q.correct_option, userAnswerText: allOpts[userOpt] || 'Not answered', correctAnswerText: allOpts[q.correct_option], isCorrect, explanation: q.explanation };
  });
  const total = answers.length, percentage = Math.round((score / total) * 100), passed = percentage >= 70;
  const { error: ie } = await supabase.from('user_quiz_activity').insert({ user_id: userId, level, topic, block_number, score, total_questions: total, percentage, passed, answers: graded, time_taken: time_taken || 0, completed_at: new Date().toISOString() });
  if (ie) return res.status(500).json({ error: ie.message });
  return res.status(200).json({ score, total, percentage, passed, answers: graded, block_number });
}

async function addQuizQuestionsBatch(req, res, adminData) {
  if (!adminData) return res.status(403).json({ error: 'Admin required' });
  const { level, topic, questions, batch_name } = req.body;
  if (!level || !topic || !questions || !Array.isArray(questions) || questions.length === 0) return res.status(400).json({ error: 'Invalid batch data' });
  const { data: existingTopic } = await supabase.from('quiz_topics').select('id').eq('level', level).eq('topic_name', topic).maybeSingle();
  let topicId;
  if (existingTopic) {
    topicId = existingTopic.id;
  } else {
    const { data: newTopic } = await supabase.from('quiz_topics').insert({ level, topic_name: topic, is_active: true }).select().single();
    topicId = newTopic.id;
  }
  const qb = questions.map(q => ({
    level, topic, question_text: q.question_text, option_a: q.option_a, option_b: q.option_b, option_c: q.option_c, option_d: q.option_d, correct_option: q.correct_option.toUpperCase(), explanation: q.explanation, difficulty: q.difficulty || 'medium', batch_name: batch_name || 'Batch ' + new Date().toISOString()
  }));
  const { error } = await supabase.from('quiz_questions').insert(qb);
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ success: true, questions_added: questions.length });
}
