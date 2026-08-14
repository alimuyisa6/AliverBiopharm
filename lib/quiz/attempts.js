/* lib/quiz/attempts.js */
import { supabase } from '../../core.js';
import {
  requireAuth,
  SecurityError
} from '../../security-middleware.js';

export async function getQuizAttempts(req, res, ctx) {
  requireAuth(ctx);

  const { unit_id, block_number, limit = 20 } = req.query;

  let query = supabase
    .from('quiz_attempts')
    .select('id, unit_id, block_number, attempt_number, status, score, total_questions, percentage, passed, xp_earned, time_taken, auto_submitted, auto_submit_reason, tab_switches, started_at, submitted_at, created_at')
    .eq('user_id', ctx.userId)
    .order('created_at', { ascending: false })
    .limit(Math.min(parseInt(limit, 10) || 20, 50));

  if (unit_id) query = query.eq('unit_id', unit_id);
  if (block_number !== undefined) query = query.eq('block_number', Number(block_number));

  const { data, error } = await query;

  if (error) throw new SecurityError('Failed to load quiz attempts', 500);

  const attempts = data || [];

  const bestScore = attempts.length
    ? Math.max(...attempts.map((item) => Number(item.percentage) || 0))
    : 0;

  const latestScore = attempts.length ? Number(attempts[0].percentage) || 0 : 0;
  const averageScore = attempts.length
    ? Math.round(attempts.reduce((sum, item) => sum + (Number(item.percentage) || 0), 0) / attempts.length)
    : 0;

  return res.status(200).json({
    attempts,
    summary: {
      attempt_count: attempts.length,
      best_score: bestScore,
      latest_score: latestScore,
      average_score: averageScore
    }
  });
}

export async function getQuizAttempt(req, res, ctx) {
  requireAuth(ctx);

  const { attempt_id } = req.query;

  if (!attempt_id) throw new SecurityError('attempt_id required', 400);

  const { data: attempt } = await supabase
    .from('quiz_attempts')
    .select('*')
    .eq('id', attempt_id)
    .eq('user_id', ctx.userId)
    .maybeSingle();

  if (!attempt) throw new SecurityError('Quiz attempt not found', 404);

  const { data: answers } = await supabase
    .from('quiz_attempt_answers')
    .select('question_id, selected_option, correct, time_taken_seconds, answer_changed, answered_at')
    .eq('attempt_id', attempt.id)
    .order('answered_at', { ascending: true });

  const questionIds = (answers || []).map((item) => item.question_id);

  const { data: questions } = questionIds.length
    ? await supabase
        .from('quiz_question_revisions')
        .select('question_id, version, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, difficulty, image_url')
        .in('question_id', questionIds)
    : { data: [] };

  const revisionMap = new Map();

  for (const revision of questions || []) {
    const key = String(revision.question_id);
    const current = revisionMap.get(key);

    if (!current || Number(revision.version) > Number(current.version)) {
      revisionMap.set(key, revision);
    }
  }

  const detailedAnswers = (answers || []).map((answer) => {
    const revision = revisionMap.get(String(answer.question_id));

    const correctKey = `option_${String(revision?.correct_option || '').toLowerCase()}`;
    const userKey = `option_${String(answer.selected_option || '').toLowerCase()}`;

    return {
      ...answer,
      question_text: revision?.question_text || null,
      correct_answer_text: revision?.[correctKey] || null,
      user_answer_text: revision?.[userKey] || answer.selected_option || 'No answer',
      explanation: revision?.explanation || null,
      difficulty: revision?.difficulty || null
    };
  });

  return res.status(200).json({
    ...attempt,
    answers: detailedAnswers
  });
}
