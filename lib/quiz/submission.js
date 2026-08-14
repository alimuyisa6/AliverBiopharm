/* lib/quiz/submission.js */
import { supabase, addXp, recordPlatformActivity, updateTopicXp, updateUserRecords, updateDailyChallengeProgress, recordWeakConcept, updateSpacedRepetition } from '../core.js';
import {
  requireAuth,
  SecurityError,
  rateLimiter
} from '../security-middleware.js';
import { createNotification } from '../notifications.js';
import { getUserCurriculumScope } from '../curriculum.js';
import { checkUnitBlockAccess } from '../premium.js';
import {
  getStoredIdempotencyResponse,
  createIdempotencyKey
} from './idempotency.js';
import { getSessionQuestionIds } from './validation.js';

const BLOCK_TIME_LIMIT_SECONDS = 600;
const BLOCK_TIME_GRACE_SECONDS = 15;
const INTEGRITY_LOCK_HOURS = 48;

export async function submitWithSession(body, res, ctx) {
  requireAuth(ctx);

  const {
    unit_id,
    block_number,
    answers,
    idempotency_key
  } = body;

  if (!unit_id || block_number === undefined || !Array.isArray(answers)) {
    throw new SecurityError('unit_id, block_number, answers required', 400);
  }

  const blockNum = Number.parseInt(block_number, 10);

  if (!Number.isInteger(blockNum) || blockNum < 0) {
    throw new SecurityError('Invalid block_number', 400);
  }

  const ip = ctx.clientIp || 'unknown';

  if (!(await rateLimiter.check(ip, ctx.userId, 'quiz_submit'))) {
    throw new SecurityError('Too many quiz submissions', 429);
  }

  if (idempotency_key) {
    const stored = await getStoredIdempotencyResponse(ctx.userId, 'quiz_submit_with_session', idempotency_key);

    if (stored) return res.status(200).json(stored);
  }

  const unit = await getUnitWithValidation(ctx, unit_id, blockNum);
  const session = await getSession(ctx, unit.id, blockNum);

  if (!session) throw new SecurityError('No active quiz session', 403);

  if (session.status === 'submitted') {
    throw new SecurityError('This quiz session has already been submitted', 409);
  }

  const activeAttempt = await getActiveAttempt(ctx.userId, session.session_id);

  if (!activeAttempt) {
    throw new SecurityError('No active attempt for this session', 409);
  }

  if (['submitted', 'passed', 'failed', 'auto_submitted', 'expired', 'cancelled'].includes(activeAttempt.status)) {
    throw new SecurityError('This quiz attempt has already been finalized', 409);
  }

  const wasAutoSubmitted = !!session.auto_submitted;
  const timeTaken = secondsElapsed(session);
  const timedOut = !wasAutoSubmitted && timeTaken > BLOCK_TIME_LIMIT_SECONDS + BLOCK_TIME_GRACE_SECONDS;

  const questionIds = getSessionQuestionIds(session);

  if (!questionIds.length) {
    throw new SecurityError('Session question set missing', 500);
  }

  const { data: questions } = await supabase
    .from('quiz_questions')
    .select('id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, difficulty, status, version, concept_id, concept_name, subtopic, learning_objective, unit_id')
    .in('id', questionIds)
    .eq('status', 'published')
    .eq('is_active', true);

  const questionMap = new Map();

  for (const question of questions || []) {
    questionMap.set(String(question.id), question);
  }

  const orderedQuestions = questionIds
    .map((id) => questionMap.get(String(id)))
    .filter(Boolean);

  if (!orderedQuestions.length) {
    throw new SecurityError('Questions not found for this session', 404);
  }

  const priorAnswers = session.state?.answers || {};

  let score = 0;

  const reviewAnswers = orderedQuestions.map((question) => {
    const existing = priorAnswers[question.id];
    const submitted = answers.find((item) => String(item.id) === String(question.id)) || {};
    const userOption = String(existing?.selected || submitted.selectedOption || '').trim().toUpperCase();
    const correctOption = String(question.correct_option || '').trim().toUpperCase();
    const isCorrect = userOption === correctOption;

    if (isCorrect) score += 1;

    const correctKey = `option_${correctOption.toLowerCase()}`;
    const userKey = `option_${userOption.toLowerCase()}`;

    return {
      question_id: question.id,
      question: question.question_text,
      userAnswerText: question[userKey] || userOption || 'No answer',
      correctAnswerText: question[correctKey] || correctOption,
      isCorrect,
      explanation: question.explanation || '',
      correct_option: question.correct_option,
      difficulty: question.difficulty || 'medium',
      concept_id: question.concept_id || null,
      concept_name: question.concept_name || null,
      subtopic: question.subtopic || null,
      learning_objective: question.learning_objective || null
    };
  });

  const total = orderedQuestions.length;
  const percentage = Math.round((score / total) * 100);
  const passed = !wasAutoSubmitted && !timedOut && percentage >= 70;
  const autoSubmitted = wasAutoSubmitted || timedOut;
  const autoSubmitReason = wasAutoSubmitted
    ? session.state?.auto_submit_reason || 'integrity_violation'
    : timedOut
      ? 'time_expired'
      : null;

  const xpEarned = autoSubmitted
    ? 0
    : passed
      ? Math.round(10 + percentage / 10)
      : 5;

  const finalStatus = autoSubmitted
    ? 'auto_submitted'
    : passed
      ? 'passed'
      : 'failed';

  const { data: finalized, error: finalizeError } = await supabase.rpc('atomic_finalize_quiz_attempt', {
    p_attempt_id: activeAttempt.id,
    p_user_id: ctx.userId,
    p_score: score,
    p_total_questions: total,
    p_percentage: percentage,
    p_passed: passed,
    p_xp_earned: xpEarned,
    p_time_taken: timeTaken,
    p_auto_submitted: autoSubmitted,
    p_auto_submit_reason: autoSubmitReason,
    p_tab_switches: session.tab_switches || 0
  });

  if (finalizeError || finalized === false) {
    throw new SecurityError('Quiz attempt was already finalized', 409);
  }

  await supabase.from('quiz_attempt_answers').insert(
    reviewAnswers.map((answer) => ({
      attempt_id: activeAttempt.id,
      question_id: answer.question_id,
      selected_option: answer.userAnswerText === 'No answer' ? null : answer.userAnswerText,
      correct: answer.isCorrect,
      time_taken_seconds: 0,
      answered_at: new Date().toISOString()
    }))
  );

  await supabase
    .from('user_quiz_sessions')
    .update({
      status: 'submitted',
      auto_submitted: autoSubmitted,
      updated_at: new Date().toISOString()
    })
    .eq('id', session.id)
    .eq('user_id', ctx.userId);

  if (xpEarned > 0) {
    await addXp(
      ctx.userId,
      xpEarned,
      'quiz_block',
      'quiz',
      {
        attempt_id: activeAttempt.id,
        unit_id: unit.id,
        block_number: blockNum
      },
      unit.id,
      unit.groupId,
      unit.levelId || null
    );

    await Promise.all([
      recordPlatformActivity(ctx.userId),
      updateTopicXp(ctx.userId, unit.id, session.topic, xpEarned)
    ]);
  }

  if (!autoSubmitted) {
    await updateUserRecords(ctx.userId, {
      score: percentage,
      timeTakenSeconds: passed ? timeTaken : 0,
      isPerfect: percentage === 100
    });

    const scope = await getUserCurriculumScope(ctx.userId);

    await updateDailyChallengeProgress(ctx.userId, scope?.active_group_id, 'blocks_completed', 1).catch(() => null);
  }

  for (const answer of reviewAnswers) {
    const conceptName = answer.concept_name || answer.subtopic || answer.learning_objective || null;

    if (!answer.isCorrect && conceptName) {
      await recordWeakConcept(
        ctx.userId,
        'quiz',
        unit.id,
        unit.groupId,
        unit.levelId || null,
        conceptName,
        false,
        answer.question_id
      );
    }
  }

  await supabase.from('quiz_session_events').insert({
    session_id: session.session_id,
    user_id: ctx.userId,
    event_type: autoSubmitted ? 'auto_submitted' : 'session_submitted',
    metadata: {
      score,
      total,
      percentage,
      passed,
      autoSubmitted,
      attempt_id: activeAttempt.id
    }
  });

  if (autoSubmitted) {
    const response = {
      success: true,
      auto_submitted: true,
      attempt_id: activeAttempt.id,
      score,
      total,
      percentage,
      passed: false,
      xp_earned: 0,
      answers: reviewAnswers,
      tab_switches: session.tab_switches || 0,
      max_allowed: session.max_tab_switches || 3,
      message: wasAutoSubmitted
        ? `Auto-submitted due to tab switching. Locked for ${INTEGRITY_LOCK_HOURS}h.`
        : `Auto-submitted: time limit exceeded. Locked for ${INTEGRITY_LOCK_HOURS}h.`
    };

    if (idempotency_key) {
      await createIdempotencyKey(ctx.userId, 'quiz_submit_with_session', idempotency_key, response, 200);
    }

    return res.status(200).json(response);
  }

  if (passed) {
    await createNotification(ctx.userId, 'quiz_passed', {
      topic_name: session.topic,
      score: percentage,
      attempt_id: activeAttempt.id
    });
  } else {
    await createNotification(ctx.userId, 'quiz_failed', {
      topic_name: session.topic,
      score: percentage,
      attempt_id: activeAttempt.id
    });
  }

  const response = {
    success: true,
    auto_submitted: false,
    attempt_id: activeAttempt.id,
    score,
    total,
    percentage,
    passed,
    xp_earned: xpEarned,
    answers: reviewAnswers,
    tab_switches: session.tab_switches || 0,
    max_allowed: session.max_tab_switches || 3,
    wrong_question_count: reviewAnswers.filter((item) => !item.isCorrect).length,
    retry_available: reviewAnswers.some((item) => !item.isCorrect)
  };

  if (idempotency_key) {
    await createIdempotencyKey(ctx.userId, 'quiz_submit_with_session', idempotency_key, response, 200);
  }

  return res.status(200).json(response);
}

async function getUnitWithValidation(ctx, unitId, blockNumber) {
  const scope = await getUserCurriculumScope(ctx.userId);

  if (!scope?.active_group_id) {
    throw new SecurityError('Your curriculum context is not set.', 403);
  }

  const { data: unit } = await supabase
    .from('curriculum_units')
    .select('id, name, group_id, curriculum_groups!inner(level_id, name, curriculum_levels(id, display_name, unit_label, group_label, icon, color))')
    .eq('id', unitId)
    .eq('group_id', scope.active_group_id)
    .eq('is_active', true)
    .maybeSingle();

  if (!unit) {
    throw new SecurityError('Unit not found or not available in your curriculum.', 404);
  }

  if (blockNumber !== null) {
    const { data: authUser } = await supabase.auth.admin.getUserById(ctx.userId);
    const access = await checkUnitBlockAccess(authUser?.user?.email || null, ctx.userId, unit.id, blockNumber);

    if (!access.allowed) {
      if (access.reason === 'restricted') {
        throw new SecurityError('Your access to this content has been restricted.', 403);
      }

      throw new SecurityError('This block requires premium access.', 403);
    }
  }

  const group = unit.curriculum_groups;
  const level = group?.curriculum_levels || null;

  return {
    id: unit.id,
    name: unit.name,
    groupId: unit.group_id,
    groupName: group?.name || null,
    levelId: level?.id || null,
    levelName: level?.display_name || null,
    level
  };
}

async function getSession(ctx, unitId, blockNumber) {
  const { data } = await supabase
    .from('user_quiz_sessions')
    .select('*')
    .eq('user_id', ctx.userId)
    .eq('unit_id', unitId)
    .eq('block_number', blockNumber)
    .maybeSingle();

  return data || null;
}

async function getActiveAttempt(userId, sessionId) {
  const { data } = await supabase
    .from('quiz_attempts')
    .select('*')
    .eq('user_id', userId)
    .eq('session_id', sessionId)
    .eq('status', 'active')
    .maybeSingle();

  return data || null;
}

function secondsElapsed(session) {
  const startedStr = session.started_at || session.created_at || session.updated_at;
  const started = new Date(startedStr).getTime();

  return Math.floor((Date.now() - started) / 1000);
}
