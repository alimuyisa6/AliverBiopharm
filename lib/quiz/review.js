/* lib/quiz/review.js */
import { supabase } from '../core.js';
import {
  requireAuth,
  SecurityError,
  rateLimiter
} from '../security-middleware.js';
import { getUserCurriculumScope } from '../../curriculum.js';
import {
  getStoredIdempotencyResponse,
  createIdempotencyKey
} from './idempotency.js';

export async function retryWrongQuestions(body, res, ctx) {
  requireAuth(ctx);

  const { attempt_id, unit_id, block_number, idempotency_key } = body;

  if (!attempt_id || !unit_id || block_number === undefined) {
    throw new SecurityError('attempt_id, unit_id, block_number required', 400);
  }

  const ip = ctx.clientIp || 'unknown';

  if (!(await rateLimiter.check(ip, ctx.userId, 'quiz_start_session'))) {
    throw new SecurityError('Too many review session requests', 429);
  }

  if (idempotency_key) {
    const stored = await getStoredIdempotencyResponse(ctx.userId, 'quiz_retry_wrong', idempotency_key);

    if (stored) return res.status(200).json(stored);
  }

  const { data: attempt } = await supabase
    .from('quiz_attempts')
    .select('id, user_id, unit_id, block_number, status')
    .eq('id', attempt_id)
    .eq('user_id', ctx.userId)
    .maybeSingle();

  if (!attempt) throw new SecurityError('Quiz attempt not found', 404);

  const { data: wrongAnswers } = await supabase
    .from('quiz_attempt_answers')
    .select('question_id')
    .eq('attempt_id', attempt.id)
    .eq('correct', false);

  const wrongQuestionIds = (wrongAnswers || []).map((item) => Number(item.question_id));

  if (!wrongQuestionIds.length) {
    return res.status(200).json({
      success: true,
      question_ids: [],
      message: 'No wrong questions to review'
    });
  }

  const { data: questions } = await supabase
    .from('quiz_questions')
    .select('id, question_text, option_a, option_b, option_c, option_d, difficulty, status, version')
    .in('id', wrongQuestionIds)
    .eq('status', 'published')
    .eq('is_active', true);

  const reviewQuestions = questions || [];

  const response = {
    success: true,
    session_type: 'review',
    original_attempt_id: attempt.id,
    unit_id: attempt.unit_id,
    block_number: attempt.block_number,
    question_ids: reviewQuestions.map((item) => Number(item.id)),
    question_count: reviewQuestions.length
  };

  if (idempotency_key) {
    await createIdempotencyKey(ctx.userId, 'quiz_retry_wrong', idempotency_key, response, 200);
  }

  return res.status(200).json(response);
}

export async function getDueReviewQuestions(req, res, ctx) {
  requireAuth(ctx);

  const { limit = 20 } = req.query;

  const { data } = await supabase
    .from('user_spaced_repetition')
    .select('question_id, level, topic, next_review_date, repetitions')
    .eq('user_id', ctx.userId)
    .lte('next_review_date', new Date().toISOString())
    .order('next_review_date', { ascending: true })
    .limit(Math.min(parseInt(limit, 10) || 20, 50));

  const questionIds = (data || []).map((item) => Number(item.question_id));

  if (!questionIds.length) {
    return res.status(200).json([]);
  }

  const { data: questions } = await supabase
    .from('quiz_questions')
    .select('id, question_text, option_a, option_b, option_c, option_d, difficulty, status, version')
    .in('id', questionIds)
    .eq('status', 'published')
    .eq('is_active', true);

  const questionMap = new Map();

  for (const question of questions || []) {
    questionMap.set(Number(question.id), question);
  }

  const due = (data || [])
    .filter((item) => questionMap.has(Number(item.question_id)))
    .map((item) => ({
      ...item,
      question: questionMap.get(Number(item.question_id))
    }));

  return res.status(200).json(due);
}

export async function getBookmarks(req, res, ctx) {
  requireAuth(ctx);

  const { data } = await supabase
    .from('quiz_bookmarks')
    .select('id, question_id, note, created_at, updated_at')
    .eq('user_id', ctx.userId)
    .order('created_at', { ascending: false });

  return res.status(200).json(data || []);
}

export async function bookmarkQuestion(body, res, ctx) {
  requireAuth(ctx);

  const { question_id, note, idempotency_key } = body;

  if (!question_id) throw new SecurityError('question_id required', 400);

  const ip = ctx.clientIp || 'unknown';

  if (!(await rateLimiter.check(ip, ctx.userId, 'quiz_bookmark'))) {
    throw new SecurityError('Too many bookmark requests', 429);
  }

  if (idempotency_key) {
    const stored = await getStoredIdempotencyResponse(ctx.userId, 'bookmark_question', idempotency_key);

    if (stored) return res.status(200).json(stored);
  }

  const { data: existing } = await supabase
    .from('quiz_bookmarks')
    .select('id')
    .eq('user_id', ctx.userId)
    .eq('question_id', question_id)
    .maybeSingle();

  if (existing) {
    const response = { success: true, already_bookmarked: true };

    if (idempotency_key) {
      await createIdempotencyKey(ctx.userId, 'bookmark_question', idempotency_key, response, 200);
    }

    return res.status(200).json(response);
  }

  await supabase.from('quiz_bookmarks').insert({
    user_id: ctx.userId,
    question_id: Number(question_id),
    note: note || null
  });

  const response = { success: true, bookmarked: true };

  if (idempotency_key) {
    await createIdempotencyKey(ctx.userId, 'bookmark_question', idempotency_key, response, 200);
  }

  return res.status(200).json(response);
}

export async function removeBookmark(body, res, ctx) {
  requireAuth(ctx);

  const { question_id } = body;

  if (!question_id) throw new SecurityError('question_id required', 400);

  await supabase
    .from('quiz_bookmarks')
    .delete()
    .eq('user_id', ctx.userId)
    .eq('question_id', question_id);

  return res.status(200).json({ success: true });
}

export async function getQuestionNote(req, res, ctx) {
  requireAuth(ctx);

  const { question_id } = req.query;

  if (!question_id) throw new SecurityError('question_id required', 400);

  const { data } = await supabase
    .from('user_question_notes')
    .select('id, question_id, note, created_at, updated_at')
    .eq('user_id', ctx.userId)
    .eq('question_id', question_id)
    .maybeSingle();

  return res.status(200).json(data || null);
}

export async function saveQuestionNote(body, res, ctx) {
  requireAuth(ctx);

  const { question_id, note, idempotency_key } = body;

  if (!question_id || !note?.trim()) {
    throw new SecurityError('question_id and note required', 400);
  }

  const ip = ctx.clientIp || 'unknown';

  if (!(await rateLimiter.check(ip, ctx.userId, 'quiz_question_note'))) {
    throw new SecurityError('Too many note requests', 429);
  }

  if (idempotency_key) {
    const stored = await getStoredIdempotencyResponse(ctx.userId, 'save_question_note', idempotency_key);

    if (stored) return res.status(200).json(stored);
  }

  const { data: noteRow } = await supabase
    .from('user_question_notes')
    .upsert({
      user_id: ctx.userId,
      question_id: Number(question_id),
      note: note.trim(),
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id,question_id' })
    .select()
    .single();

  const response = { success: true, note: noteRow };

  if (idempotency_key) {
    await createIdempotencyKey(ctx.userId, 'save_question_note', idempotency_key, response, 200);
  }

  return res.status(200).json(response);
}

export async function deleteQuestionNote(body, res, ctx) {
  requireAuth(ctx);

  const { question_id } = body;

  if (!question_id) throw new SecurityError('question_id required', 400);

  await supabase
    .from('user_question_notes')
    .delete()
    .eq('user_id', ctx.userId)
    .eq('question_id', question_id);

  return res.status(200).json({ success: true });
}
