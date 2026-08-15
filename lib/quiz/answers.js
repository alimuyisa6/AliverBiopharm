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

  if (
    !unit_id ||
    block_number === undefined ||
    question_id === undefined ||
    !selected_option
  ) {
    throw new SecurityError(
      'unit_id, block_number, question_id, selected_option required',
      400
    );
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
    const stored = await getStoredIdempotencyResponse(
      ctx.userId,
      'quiz_check_answer',
      idempotency_key
    );

    if (stored) {
      return res.status(200).json(stored);
    }
  }

  try {
    const unit = await getUnitWithValidation(ctx, unit_id, blockNum);
    const session = await getSession(ctx, unit.id, blockNum);

    if (!session) {
      throw new SecurityError('No active quiz session', 403);
    }

    if (session.auto_submitted) {
      throw new SecurityError('This block is locked', 403);
    }

    if (
      session.status &&
      ['submitted', 'completed', 'expired', 'cancelled'].includes(
        String(session.status).toLowerCase()
      )
    ) {
      throw new SecurityError('This quiz session is no longer active', 403);
    }

    const elapsed = secondsElapsed(session);

    if (elapsed > BLOCK_TIME_LIMIT_SECONDS + BLOCK_TIME_GRACE_SECONDS) {
      await expireSession(
        ctx,
        unit,
        blockNum,
        session,
        'time_expired'
      );

      return res.status(200).json({
        success: false,
        auto_submitted: true,
        reason: 'time_expired'
      });
    }

    const questionIds = getSessionQuestionIds(session);

    if (!questionIds.length) {
      throw new SecurityError('Session question set missing', 500);
    }

    if (!questionIds.includes(questionId)) {
      await recordSecurityEvent(
        ctx,
        session,
        'invalid_question',
        { questionId }
      );

      throw new SecurityError(
        'Question not found in this session',
        400
      );
    }

    const state =
      session.state && typeof session.state === 'object'
        ? session.state
        : {};

    const answers =
      state.answers && typeof state.answers === 'object'
        ? state.answers
        : {};

    const existing = answers[String(questionId)] || answers[questionId];

    if (existing?.permanent) {
      return res.status(200).json({
        success: true,
        correct: !!existing.correct,
        correct_option: existing.correct_option,
        correct_answer_text: existing.correct_answer_text,
        already_answered: true,
        mode: session.mode || 'study',
        explanation:
          session.mode === 'exam'
            ? null
            : existing.explanation || ''
      });
    }

    const {
      data: question,
      error: questionError
    } = await supabase
      .from('quiz_questions')
      .select(
        'id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, difficulty, status, version, concept_id, concept_name, subtopic, learning_objective'
      )
      .eq('id', questionId)
      .eq('status', 'published')
      .eq('is_active', true)
      .maybeSingle();

    if (questionError) {
      console.error('[QUIZ_ANSWER_QUESTION_LOOKUP_ERROR]', JSON.stringify({
        user_id: ctx.userId,
        question_id: questionId,
        error: questionError.message
      }));

      throw new SecurityError(
        'Unable to load quiz question',
        500
      );
    }

    if (!question) {
      throw new SecurityError(
        'Question not found',
        404
      );
    }

    const correctOption = String(
      question.correct_option || ''
    )
      .trim()
      .toUpperCase();

    if (!['A', 'B', 'C', 'D'].includes(correctOption)) {
      throw new SecurityError(
        'Quiz question has an invalid correct option',
        500
      );
    }

    const isCorrect = userOption === correctOption;

    const correctKey = `option_${correctOption.toLowerCase()}`;

    const correctAnswerText =
      question[correctKey] || correctOption;

    let responseTimeSeconds = 0;

    const storedQuestionStartedAt =
      state.question_started_at &&
      typeof state.question_started_at === 'object'
        ? state.question_started_at[questionId] ||
          state.question_started_at[String(questionId)]
        : null;

    const effectiveQuestionStartedAt =
      storedQuestionStartedAt || question_started_at || null;

    if (effectiveQuestionStartedAt) {
      const startedTime = new Date(
        effectiveQuestionStartedAt
      ).getTime();

      if (Number.isFinite(startedTime)) {
        responseTimeSeconds = Math.max(
          0,
          Math.min(
            600,
            Math.round(
              (Date.now() - startedTime) / 1000
            )
          )
        );
      }
    }

    const updatedAnswers = {
      ...answers,
      [String(questionId)]: {
        selected: userOption,
        correct: isCorrect,
        correct_option: correctOption,
        correct_answer_text: correctAnswerText,
        explanation: question.explanation || '',
        permanent: true,
        answered_at: new Date().toISOString(),
        response_time_seconds: responseTimeSeconds
      }
    };

    const answeredQuestions = Array.isArray(
      state.answered_questions
    )
      ? [...state.answered_questions]
      : [];

    if (!answeredQuestions.includes(questionId)) {
      answeredQuestions.push(questionId);
    }

    const updatedState = {
      ...state,
      answers: updatedAnswers,
      answered_questions: answeredQuestions,
      current_question: Math.max(
        0,
        answeredQuestions.length
      ),
      autosave_version:
        Number(state.autosave_version || 0) + 1
    };

    const {
      error: sessionUpdateError
    } = await supabase
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

    if (sessionUpdateError) {
      console.error('[QUIZ_ANSWER_SESSION_UPDATE_ERROR]', JSON.stringify({
        user_id: ctx.userId,
        session_id: session.id,
        question_id: questionId,
        error: sessionUpdateError.message
      }));

      throw new SecurityError(
        'Unable to save your answer',
        500
      );
    }

    const {
      error: questionAttemptError
    } = await supabase.rpc(
      'atomic_record_quiz_question_attempt',
      {
        p_question_id: questionId,
        p_correct: isCorrect,
        p_response_time_seconds: responseTimeSeconds
      }
    );

    if (questionAttemptError) {
      console.error('[QUIZ_ANSWER_STATS_ERROR]', JSON.stringify({
        user_id: ctx.userId,
        question_id: questionId,
        error: questionAttemptError.message
      }));
    }

    try {
      await updateSpacedRepetition(
        ctx.userId,
        questionId,
        session.level || null,
        session.topic || null,
        isCorrect ? 'strong' : 'developing'
      );
    } catch (err) {
      console.error('[QUIZ_ANSWER_SPACED_REPETITION_ERROR]', JSON.stringify({
        user_id: ctx.userId,
        question_id: questionId,
        error: err.message
      }));
    }

    if (!isCorrect) {
      const conceptName =
        question.concept_name ||
        question.subtopic ||
        question.learning_objective ||
        null;

      if (conceptName) {
        try {
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
        } catch (err) {
          console.error('[QUIZ_ANSWER_WEAK_CONCEPT_ERROR]', JSON.stringify({
            user_id: ctx.userId,
            question_id: questionId,
            error: err.message
          }));
        }
      }
    }

    try {
      const {
        error: eventError
      } = await supabase
        .from('quiz_session_events')
        .insert({
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

      if (eventError) {
        console.error('[QUIZ_ANSWER_EVENT_ERROR]', JSON.stringify({
          user_id: ctx.userId,
          session_id: session.id,
          question_id: questionId,
          error: eventError.message
        }));
      }
    } catch (err) {
      console.error('[QUIZ_ANSWER_EVENT_EXCEPTION]', JSON.stringify({
        user_id: ctx.userId,
        session_id: session.id,
        question_id: questionId,
        error: err.message
      }));
    }

    const response = {
      success: true,
      correct: isCorrect,
      correct_option: correctOption,
      correct_answer_text: correctAnswerText,
      already_answered: false,
      mode: session.mode || 'study',
      explanation:
        session.mode === 'exam'
          ? null
          : question.explanation || ''
    };

    if (idempotency_key) {
      await createIdempotencyKey(
        ctx.userId,
        'quiz_check_answer',
        idempotency_key,
        response,
        200
      );
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
      error_stack: err.stack || null,
      status_code: err.statusCode || 500
    }));

    throw err;
  }
}

async function getUnitWithValidation(
  ctx,
  unitId,
  blockNumber
) {
  const {
    getUserCurriculumScope
  } = await import('../curriculum.js');

  const {
    checkUnitBlockAccess
  } = await import('../premium.js');

  const scope =
    await getUserCurriculumScope(ctx.userId);

  if (!scope?.active_group_id) {
    throw new SecurityError(
      'Your curriculum context is not set.',
      403
    );
  }

  const {
    data: unit,
    error
  } = await supabase
    .from('curriculum_units')
    .select(
      'id, name, group_id, curriculum_groups!inner(level_id, name, curriculum_levels(id, display_name, unit_label, group_label, icon, color))'
    )
    .eq('id', unitId)
    .eq('group_id', scope.active_group_id)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    console.error('[QUIZ_UNIT_LOOKUP_ERROR]', JSON.stringify({
      user_id: ctx.userId,
      unit_id: unitId,
      error: error.message
    }));

    throw new SecurityError(
      'Unable to validate quiz unit',
      500
    );
  }

  if (!unit) {
    throw new SecurityError(
      'Unit not found or not available in your curriculum.',
      404
    );
  }

  if (blockNumber !== null) {
    const {
      data: authUser
    } = await supabase.auth.admin.getUserById(
      ctx.userId
    );

    const access =
      await checkUnitBlockAccess(
        authUser?.user?.email || null,
        ctx.userId,
        unit.id,
        blockNumber
      );

    if (!access.allowed) {
      if (access.reason === 'restricted') {
        throw new SecurityError(
          'Your access to this content has been restricted.',
          403
        );
      }

      throw new SecurityError(
        'This block requires premium access.',
        403
      );
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

async function getSession(
  ctx,
  unitId,
  blockNumber
) {
  const {
    data,
    error
  } = await supabase
    .from('user_quiz_sessions')
    .select('*')
    .eq('user_id', ctx.userId)
    .eq('unit_id', unitId)
    .eq('block_number', blockNumber)
    .maybeSingle();

  if (error) {
    console.error('[QUIZ_SESSION_LOOKUP_ERROR]', JSON.stringify({
      user_id: ctx.userId,
      unit_id: unitId,
      block_number: blockNumber,
      error: error.message
    }));

    throw new SecurityError(
      'Unable to load quiz session',
      500
    );
  }

  return data || null;
}

function secondsElapsed(session) {
  const startedStr =
    session.started_at ||
    session.state?.started_at ||
    session.created_at ||
    session.updated_at;

  const started = new Date(startedStr).getTime();

  if (!Number.isFinite(started)) {
    return 0;
  }

  return Math.max(
    0,
    Math.floor((Date.now() - started) / 1000)
  );
}

async function expireSession(
  ctx,
  unit,
  blockNumber,
  session,
  reason
) {
  const currentState =
    session.state &&
    typeof session.state === 'object'
      ? session.state
      : {};

  const updatedState = {
    ...currentState,
    auto_submitted_at:
      new Date().toISOString(),
    auto_submit_reason: reason
  };

  const {
    error
  } = await supabase
    .from('user_quiz_sessions')
    .update({
      auto_submitted: true,
      status: 'submitted',
      state: updatedState,
      updated_at: new Date().toISOString()
    })
    .eq('id', session.id)
    .eq('user_id', ctx.userId);

  if (error) {
    console.error('[QUIZ_EXPIRE_SESSION_ERROR]', JSON.stringify({
      user_id: ctx.userId,
      session_id: session.id,
      unit_id: unit.id,
      block_number: blockNumber,
      error: error.message
    }));

    throw new SecurityError(
      'Unable to expire quiz session',
      500
    );
  }
}

async function recordSecurityEvent(
  ctx,
  session,
  eventType,
  metadata = {}
) {
  try {
    await supabase
      .from('quiz_session_events')
      .insert({
        session_id: session.id,
        user_id: ctx.userId,
        event_type: eventType,
        metadata
      });
  } catch (err) {
    console.error('[QUIZ_SECURITY_EVENT_ERROR]', JSON.stringify({
      user_id: ctx.userId,
      session_id: session.id,
      event_type: eventType,
      error: err.message
    }));
  }
}
