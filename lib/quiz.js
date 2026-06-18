 import { supabase, addXp, updateTopicPerformance } from './core.js';
import { parseAndValidateBody, requireAuth, SecurityError } from './security-middleware.js';

export async function handler(req, res, path, ctx) {
  const publicPaths = ['get_quiz_topics'];
  const isPublic = publicPaths.includes(path) && req.method === 'GET';

  if (!isPublic) {
    requireAuth(ctx);
  }

  if (req.method === 'GET') {
    switch (path) {
      case 'get_quiz_topics': return getQuizTopics(req, res, ctx.userId);
      case 'get_quiz_block': return getQuizBlock(req, res);
      case 'check_daily_retry': return checkDailyRetry(req, res, ctx.userId);
      default: throw new SecurityError('Invalid path', 400);
    }
  }

  if (req.method === 'POST') {
    const body = await parseAndValidateBody(req);
    switch (path) {
      case 'check_quiz_answer': return checkQuizAnswer(body, res);
      case 'submit_quiz_block': return submitQuizBlock(body, res, ctx.userId);
      case 'add_quiz_questions_batch': return addQuizQuestionsBatch(body, res);
      default: throw new SecurityError('Invalid path', 400);
    }
  }

  throw new SecurityError('Method not allowed', 405);
}

async function getQuizTopics(req, res, userId) {
  const { level } = req.query;
  if (!level) throw new SecurityError('level is required', 400);
  const { data: topics, error } = await supabase.from('quiz_topics').select('id, topic_name, level, display_order').eq('level', level).order('display_order', { ascending: true });
  if (error) throw new SecurityError('Failed to fetch topics', 500);
  const enriched = await Promise.all((topics || []).map(async (topic) => {
    const { count: questionCount } = await supabase.from('quiz_questions').select('id', { count: 'exact', head: true }).eq('level', level).eq('topic', topic.topic_name);
    const totalBlocks = questionCount ? Math.ceil(questionCount / 10) : 0;
    let completedBlocks = [];
    let lockedBlocks = [];
    if (userId) {
      const { data: activity } = await supabase.from('user_quiz_activity').select('block_number, passed, completed_at').eq('user_id', userId).eq('level', level).eq('topic', topic.topic_name);
      if (activity && activity.length) {
        completedBlocks = activity.map(a => a.block_number);
        const now = new Date();
        lockedBlocks = activity.filter(a => { const completedAt = new Date(a.completed_at); return (now - completedAt) < 24 * 60 * 60 * 1000; }).map(a => a.block_number);
      }
    }
    return { topic_name: topic.topic_name, level: topic.level, question_count: questionCount || 0, total_blocks: totalBlocks, completed_blocks: completedBlocks, locked_blocks: lockedBlocks };
  }));
  return res.status(200).json(enriched);
}

async function getQuizBlock(req, res) {
  const { level, topic, block_number } = req.query;
  if (!level || !topic || block_number === undefined) throw new SecurityError('level, topic and block_number are required', 400);
  const blockNum = parseInt(block_number);
  const offset = blockNum * 10;
  const { data: questions, error } = await supabase.from('quiz_questions').select('id, question_text, option_a, option_b, option_c, option_d, difficulty, image_url').eq('level', level).eq('topic', topic).order('id', { ascending: true }).range(offset, offset + 9);
  if (error) throw new SecurityError('Failed to fetch questions', 500);
  if (!questions || questions.length === 0) throw new SecurityError('No questions found for this block', 404);
  return res.status(200).json({ questions, block_number: blockNum });
}

async function checkDailyRetry(req, res, userId) {
  const { level, topic, block_number } = req.query;
  if (!level || !topic || block_number === undefined) throw new SecurityError('level, topic and block_number are required', 400);
  const blockNum = parseInt(block_number);
  const { data: activity } = await supabase.from('user_quiz_activity').select('completed_at').eq('user_id', userId).eq('level', level).eq('topic', topic).eq('block_number', blockNum).order('completed_at', { ascending: false }).limit(1);
  if (!activity || activity.length === 0) return res.status(200).json({ can_retry: true });
  const lastAttempt = new Date(activity[0].completed_at);
  const hoursSince = (Date.now() - lastAttempt) / (1000 * 60 * 60);
  if (hoursSince < 24) {
    const hoursLeft = Math.ceil(24 - hoursSince);
    return res.status(200).json({ can_retry: false, reason: `This block is locked. Try again in ${hoursLeft} hour${hoursLeft > 1 ? 's' : ''}.` });
  }
  return res.status(200).json({ can_retry: true });
}

async function checkQuizAnswer(body, res) {
  const { question_id, selected_option } = body;
  if (!question_id || !selected_option) throw new SecurityError('question_id and selected_option are required', 400);
  const { data: question, error } = await supabase.from('quiz_questions').select('correct_option, explanation, option_a, option_b, option_c, option_d').eq('id', question_id).single();
  if (error || !question) throw new SecurityError('Question not found', 404);
  const correct = selected_option.toUpperCase() === question.correct_option.toUpperCase();
  const correctKey = `option_${question.correct_option.toLowerCase()}`;
  const correct_answer_text = question[correctKey] || '';
  return res.status(200).json({ correct, correct_option: question.correct_option.toUpperCase(), correct_answer_text, explanation: question.explanation || '' });
}

async function submitQuizBlock(body, res, userId) {
  const { level, topic, block_number, answers, time_taken } = body;
  if (!level || !topic || block_number === undefined || !answers) throw new SecurityError('level, topic, block_number and answers are required', 400);
  const blockNum = parseInt(block_number);
  const offset = blockNum * 10;
  const { data: questions } = await supabase.from('quiz_questions').select('id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation').eq('level', level).eq('topic', topic).order('id', { ascending: true }).range(offset, offset + 9);
  if (!questions || questions.length === 0) throw new SecurityError('Questions not found for this block', 404);
  let score = 0;
  const reviewAnswers = questions.map((q, idx) => {
    const submitted = answers[idx] || {};
    const userOption = (submitted.selectedOption || '').toUpperCase();
    const correctOption = (q.correct_option || '').toUpperCase();
    const isCorrect = userOption === correctOption;
    if (isCorrect) score++;
    const optKey = `option_${correctOption.toLowerCase()}`;
    const userOptKey = `option_${userOption.toLowerCase()}`;
    return { question: q.question_text, userAnswerText: q[userOptKey] || userOption || 'No answer', correctAnswerText: q[optKey] || correctOption, isCorrect, explanation: q.explanation || '' };
  });
  const total = questions.length;
  const percentage = Math.round((score / total) * 100);
  const passed = percentage >= 70;
  await supabase.from('user_quiz_activity').insert({ user_id: userId, level, topic, block_number: blockNum, score, total, percentage, passed, time_taken: time_taken || 0, completed_at: new Date().toISOString() });
  const xpEarned = passed ? Math.round(10 + (percentage / 10)) : 5;
  await addXp(userId, xpEarned, 'quiz_block');
  await updateTopicPerformance(userId, level, topic, percentage);
  return res.status(200).json({ score, total, percentage, passed, xp_earned: xpEarned, answers: reviewAnswers });
}

async function addQuizQuestionsBatch(body, res) {
  const { level, topic, questions, batch_name } = body;
  if (!level || !topic || !questions || !Array.isArray(questions)) throw new SecurityError('level, topic and questions array are required', 400);
  const rows = questions.map(q => ({ level, topic, question_text: q.question_text, option_a: q.option_a, option_b: q.option_b, option_c: q.option_c, option_d: q.option_d, correct_option: q.correct_option, explanation: q.explanation || '', difficulty: q.difficulty || 'medium', batch_name: batch_name || null, image_url: q.image_url || null }));
  const { data, error } = await supabase.from('quiz_questions').insert(rows).select('id');
  if (error) throw new SecurityError('Failed to add questions', 500);
  await supabase.from('quiz_topics').upsert({ topic_name: topic, level, display_order: 999 }, { onConflict: 'topic_name,level' });
  return res.status(200).json({ inserted: data?.length || 0 });
}
