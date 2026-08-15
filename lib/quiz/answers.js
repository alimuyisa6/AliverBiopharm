 /* lib/quiz/answers.js */
import {
  supabase,
  recordWeakConcept,
  updateSpacedRepetition
} from '../core.js';
import {
  requireAuth,
  SecurityError,
  rateLimiter
} from '../security-middleware.js';
import {
  getStoredIdempotencyResponse,
  createIdempotencyKey
} from './idempotency.js';
import {
  validateOption,
  getSessionQuestionIds
} from './validation.js';

const BLOCK_TIME_LIMIT_SECONDS = 600;
const BLOCK_TIME_GRACE_SECONDS = 15;

export async function submitAnswer(body, res, ctx) {
  requireAuth(ctx);

  const {
    unit_id,
    block_number,
    question_id,
    selected_option,
    idempotency_key,
    question_started_at
  } = body;

  if (!unit_id || block_number === undefined || !question_id || !selected_option) {
    throw new SecurityError('unit_id, block_number, question_id, selected_option required', 400);
  }

  const blockNum = Number.parseInt(block_number, 10);

  if (!Number.isInteger(blockNum) || blockNum < 0) {
    throw new SecurityError('Invalid block_number', 400);
  }

  const userOption = validateOption(selected_option);
  const questionId = Number(question_id);

  if (!Number.isSafeInteger(questionId) || questionId <= 0) {
    throw new SecurityError('Invalid question id', 400);
  }

  const ip = ctx.clientIp || 'unknown';

  if (!(await rateLimiter.check(ip, ctx.userId, 'quiz_check_answer'))) {
    throw new SecurityError('Too many answer submissions', 429);
  }

  if (idempotency_key) {
    const stored = await getStoredIdempotencyResponse(ctx.userId, 'quiz_check_answer', idempotency_key);

    if (stored) return res.status(200).json(stored);
  }

  try {
    const unit = await getUnitWithValidation(ctx, unit_id, blockNum);
    const session = await getSession(ctx, unit.id, blockNum);

    if (!session) throw new SecurityError('No active quiz session', 403);
    if (session.auto_submitted) throw new SecurityError('This block is locked', 403);

    const elapsed = secondsElapsed(session);

    if (elapsed > BLOCK_TIME_LIMIT_SECONDS + BLOCK_TIME_GRACE_SECONDS) {
      await expireSession(ctx, unit, blockNum, session, 'time_expired');

      return res.status(200).json({
        success: false,
        auto_submitted: true,
        reason: 'time_expired'
      });
    }

    const questionIds = getSessionQuestionIds(session);

    if (!questionIds.includes(questionId)) {
      await recordSecurityEvent(ctx, session, 'invalid_question', { questionId });
      throw new SecurityError('Question not found in this session', 400);
    }

    const state = session.state || {};
    const answers = state.answers || {};

    if (answers[questionId]?.permanent) {
      const existing = answers[questionId];

      return res.status(200).json({
        correct: existing.correct,
        correct_option: existing.correct_option,
        correct_answer_text: existing.correct_answer_text,
        already_answered: true,
        mode: session.mode || 'study',
        explanation: session.mode === 'exam' ? null : existing.explanation
      });
    }

    const { data: question } = await supabase
      .from('quiz_questions')
      .select('id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, difficulty, status, version, concept_id, concept_name, subtopic, learning_objective')
      .eq('id', questionId)
      .eq('status', 'published')
      .eq('is_active', true)
      .maybeSingle();

    if (!question) throw new SecurityError('Question not found', 404);

    const correctOption = String(question.correct_option || '').trim().toUpperCase();
    const isCorrect = userOption === correctOption;
    const correctKey = `option_${correctOption.toLowerCase()}`;
    const correctAnswerText = question[correctKey] || correctOption;

    const responseTimeSeconds = question_started_at && session.state?.question_started_at?.[questionId]
      ? Math.max(0, Math.min(600, Math.round((Date.now() - new Date(session.state.question_started_at[questionId]).getTime()) / 1000)))
      : 0;

    const updatedAnswers = {
      ...answers,
      [questionId]: {
        selected: userOption,
        correct: isCorrect,
        correct_option: question.correct_option,
        correct_answer_text: correctAnswerText,
        explanation: question.explanation || '',
        permanent: true,
        answered_at: new Date().toISOString(),
        response_time_seconds: responseTimeSeconds
      }
    };

    const answeredQuestions = Array.isArray(state.answered_questions)
      ? state.answered_questions
      : [];

    if (!answeredQuestions.includes(questionId)) {
      answeredQuestions.push(questionId);
    }

    const updatedState = {
      ...state,
      answers: updatedAnswers,
      answered_questions: answeredQuestions,
      current_question: Math.max(0, answeredQuestions.length),
      autosave_version: (state.autosave_version || 0) + 1
    };

    await supabase
      .from('user_quiz_sessions')
      .update({
        state: updatedState,
        updated_at: new Date().toISOString()
      })
      .eq('id', session.id)
      .eq('user_id', ctx.userId)
      .eq('unit_id', unit.id)
      .eq('block_number', blockNum)
      .eq('auto_submitted', false);

    await supabase.rpc('atomic_record_quiz_question_attempt', {
      p_question_id: questionId,
      p_correct: isCorrect,
      p_response_time_seconds: responseTimeSeconds
    });

    await updateSpacedRepetition(
      ctx.userId,
      questionId,
      session.level,
      session.topic,
      isCorrect ? 'strong' : 'developing'
    );

    if (!isCorrect) {
      const conceptName = question.concept_name || question.subtopic || question.learning_objective || question.topic || null;

      if (conceptName) {
        await recordWeakConcept(
          ctx.userId,
          'quiz',
          unit.id,
          unit.groupId,
          unit.levelId || null,
          conceptName,
          false,
          questionId
        );
      }
    }

    await supabase.from('quiz_session_events').insert({
      session_id: session.id,
      user_id: ctx.userId,
      event_type: 'answer_submitted',
      question_id: questionId,
      metadata: {
        correct: isCorrect,
        response_time_seconds: responseTimeSeconds,
        mode: session.mode || 'study'
      }
    });

    const response = {
      correct: isCorrect,
      correct_option: question.correct_option,
      correct_answer_text: correctAnswerText,
      already_answered: false,
      mode: session.mode || 'study',
      explanation: session.mode === 'exam' ? null : question.explanation || ''
    };

    if (idempotency_key) {
      await createIdempotencyKey(ctx.userId, 'quiz_check_answer', idempotency_key, response, 200);
    }

    return res.status(200).json(response);
  } catch (err) {
    console.error('[QUIZ_ANSWER_ERROR]', JSON.stringify({
      user_id: ctx.userId || null,
      unit_id,
      block_number: blockNum,
      question_id: questionId,
      error_name: err.name || null,
      error_message: err.message || null,
      error_stack: err.stack || null
    }));

    throw err;
  }
}

async function getUnitWithValidation(ctx, unitId, blockNumber) {
  const { getUserCurriculumScope } = await import('../curriculum.js');
  const { checkUnitBlockAccess } = await import('../premium.js');

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

function secondsElapsed(session) {
  const startedStr = session.state?.started_at || session.updated_at;
  const started = new Date(startedStr).getTime();

  return Math.floor((Date.now() - started) / 1000);
}

async function expireSession(ctx, unit, blockNumber, session, reason) {
  const updatedState = {
    ...(typeof session.state === 'object' ? session.state : {}),
    auto_submitted_at: new Date().toISOString(),
    auto_submit_reason: reason
  };

  await supabase
    .from('user_quiz_sessions')
    .update({
      auto_submitted: true,
      state: updatedState,
      updated_at: new Date().toISOString()
    })
    .eq('id', session.id)
    .eq('user_id', ctx.userId);
}

async function recordSecurityEvent(ctx, session, eventType, metadata = {}) {
  await supabase.from('quiz_session_events').insert({
    session_id: session.id,
    user_id: ctx.userId,
    event_type: eventType,
    metadata
  });
}
