/* lib/quiz/analytics.js */
import { supabase } from '../../core.js';
import {
  requireAuth,
  SecurityError
} from '../../security-middleware.js';
import { getUserCurriculumScope } from '../../curriculum.js';

export async function getQuestionStats(req, res, ctx) {
  requireAuth(ctx);

  const { question_id } = req.query;

  if (!question_id) throw new SecurityError('question_id required', 400);

  const { data } = await supabase
    .from('quiz_question_stats')
    .select('question_id, times_answered, times_correct, total_response_time_seconds, last_answered_at, updated_at')
    .eq('question_id', Number(question_id))
    .maybeSingle();

  return res.status(200).json(data || {
    question_id: Number(question_id),
    times_answered: 0,
    times_correct: 0,
    total_response_time_seconds: 0,
    last_answered_at: null,
    updated_at: null
  });
}

export async function getQuizAnalyticsOverview(req, res, ctx) {
  requireAuth(ctx);

  const { data: attempts } = await supabase
    .from('quiz_attempts')
    .select('id, score, total_questions, percentage, passed, xp_earned, time_taken, auto_submitted, submitted_at, created_at')
    .eq('user_id', ctx.userId)
    .order('created_at', { ascending: false })
    .limit(100);

  const rows = attempts || [];

  const passedAttempts = rows.filter((item) => item.passed);
  const averageScore = rows.length
    ? Math.round(rows.reduce((sum, item) => sum + Number(item.percentage || 0), 0) / rows.length)
    : 0;

  const bestScore = rows.length
    ? Math.max(...rows.map((item) => Number(item.percentage || 0)))
    : 0;

  const totalStudyTime = rows.reduce((sum, item) => sum + Number(item.time_taken || 0), 0);

  return res.status(200).json({
    total_attempts: rows.length,
    passed_attempts: passedAttempts.length,
    pass_rate: rows.length ? Math.round((passedAttempts.length / rows.length) * 100) : 0,
    average_score: averageScore,
    best_score: bestScore,
    total_study_time_seconds: totalStudyTime
  });
}
