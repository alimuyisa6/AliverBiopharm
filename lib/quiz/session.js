/* lib/quiz/session.js */

import {
  supabase
} from '../core.js';

import {
  requireAuth,
  SecurityError,
  rateLimiter
} from '../security-middleware.js';

import {
  createNotification
} from '../notifications.js';

import {
  getUserCurriculumScope
} from '../curriculum.js';

import {
  checkUnitBlockAccess
} from '../premium.js';

import {
  createIdempotencyKey,
  getStoredIdempotencyResponse
} from './idempotency.js';

import crypto from 'crypto';

const SESSION_LENGTH = 10;
const BLOCK_TIME_LIMIT_SECONDS = 600;
const BLOCK_TIME_GRACE_SECONDS = 15;
const DAILY_RETRY_HOURS = 24;
const INTEGRITY_LOCK_HOURS = 48;
const MAX_TAB_SWITCHES = 3;

export async function getQuizTopics(req, res, ctx) {
  requireAuth(ctx);

  const { unit_id } = req.query;

  if (!unit_id) {
    throw new SecurityError(
      'unit_id required',
      400
    );
  }

  const unit = await getUnitWithValidation(
    ctx,
    unit_id,
    null
  );

  const {
    count: questionCount,
    error: questionCountError
  } = await supabase
    .from('quiz_questions')
    .select('id', {
      count: 'exact',
      head: true
    })
    .eq('unit_id', unit.id)
    .eq('status', 'published')
    .eq('is_active', true);

  if (questionCountError) {
    console.error(
      '[QUIZ_TOPICS_QUESTION_COUNT_ERROR]',
      questionCountError.message
    );

    throw new SecurityError(
      'Unable to load quiz questions',
      500
    );
  }

  const totalBlocks = questionCount
    ? Math.ceil(
        questionCount / SESSION_LENGTH
      )
    : 0;

  const {
    data: activity,
    error: activityError
  } = await supabase
    .from('quiz_attempts')
    .select(
      'block_number, submitted_at, status'
    )
    .eq('user_id', ctx.userId)
    .eq('unit_id', unit.id)
    .in('status', [
      'passed',
      'failed',
      'auto_submitted',
      'expired'
    ]);

  if (activityError) {
    console.error(
      '[QUIZ_TOPICS_ACTIVITY_ERROR]',
      activityError.message
    );
  }

  const completedBlocks = [
    ...new Set(
      (activity || [])
        .filter(
          (item) =>
            item.status === 'passed'
        )
        .map(
          (item) => item.block_number
        )
    )
  ];

  const now = Date.now();

  const lockedBlocks = [
    ...new Set(
      (activity || [])
        .filter((item) => {
          if (!item.submitted_at) {
            return false;
          }

          const submitted =
            new Date(
              item.submitted_at
            ).getTime();

          return (
            Number.isFinite(submitted) &&
            now - submitted <
              DAILY_RETRY_HOURS *
                60 *
                60 *
                1000
          );
        })
        .map(
          (item) => item.block_number
        )
    )
  ];

  return res.status(200).json({
    unit_id: unit.id,
    unit_name: unit.name,
    level_id: unit.levelId,
    level: unit.level,
    total_questions:
      questionCount || 0,
    total_blocks: totalBlocks,
    completed_blocks:
      completedBlocks,
    locked_blocks:
      lockedBlocks,
    all_done:
      totalBlocks > 0 &&
      completedBlocks.length ===
        totalBlocks
  });
}

export async function listQuizTopics(
  req,
  res,
  ctx
) {
  requireAuth(ctx);

  const scope =
    await getUserCurriculumScope(
      ctx.userId
    );

  if (!scope?.active_group_id) {
    return res.status(200).json({
      level: null,
      topics: []
    });
  }

  const {
    data: units,
    error: unitsError
  } = await supabase
    .from('curriculum_units')
    .select(
      'id, name, group_id'
    )
    .eq(
      'group_id',
      scope.active_group_id
    )
    .eq('is_active', true)
    .order('display_order');

  if (unitsError) {
    console.error(
      '[QUIZ_TOPIC_UNITS_ERROR]',
      unitsError.message
    );

    throw new SecurityError(
      'Unable to load quiz topics',
      500
    );
  }

  if (!units?.length) {
    return res.status(200).json({
      level:
        scope.active_level_name ||
        null,
      topics: []
    });
  }

  const unitIds =
    units.map(
      (unit) => unit.id
    );

  const {
    data: questionRows,
    error: questionError
  } = await supabase
    .from('quiz_questions')
    .select('unit_id')
    .in('unit_id', unitIds)
    .eq('status', 'published')
    .eq('is_active', true);

  if (questionError) {
    console.error(
      '[QUIZ_TOPIC_QUESTION_ERROR]',
      questionError.message
    );

    throw new SecurityError(
      'Unable to load quiz question counts',
      500
    );
  }

  const countMap =
    new Map();

  for (
    const row of
      questionRows || []
  ) {
    countMap.set(
      row.unit_id,
      (
        countMap.get(
          row.unit_id
        ) || 0
      ) + 1
    );
  }

  const {
    data: activity,
    error: activityError
  } = await supabase
    .from('quiz_attempts')
    .select(
      'unit_id, block_number, submitted_at, status'
    )
    .eq(
      'user_id',
      ctx.userId
    )
    .in(
      'unit_id',
      unitIds
    );

  if (activityError) {
    console.error(
      '[QUIZ_TOPIC_ACTIVITY_ERROR]',
      activityError.message
    );
  }

  const activityByUnit =
    new Map();

  for (
    const item of
      activity || []
  ) {
    if (
      !activityByUnit.has(
        item.unit_id
      )
    ) {
      activityByUnit.set(
        item.unit_id,
        []
      );
    }

    activityByUnit
      .get(item.unit_id)
      .push(item);
  }

  const now =
    Date.now();

  const topics = [];

  for (
    const unit of units
  ) {
    const questionCount =
      countMap.get(
        unit.id
      ) || 0;

    const totalBlocks =
      questionCount
        ? Math.ceil(
            questionCount /
              SESSION_LENGTH
          )
        : 0;

    const unitActivity =
      activityByUnit.get(
        unit.id
      ) || [];

    const completedBlocks = [
      ...new Set(
        unitActivity
          .filter(
            (item) =>
              item.status ===
              'passed'
          )
          .map(
            (item) =>
              item.block_number
          )
      )
    ];

    const lockedBlocks = [
      ...new Set(
        unitActivity
          .filter((item) => {
            if (
              !item.submitted_at
            ) {
              return false;
            }

            const submitted =
              new Date(
                item.submitted_at
              ).getTime();

            return (
              Number.isFinite(
                submitted
              ) &&
              now - submitted <
                DAILY_RETRY_HOURS *
                  60 *
                  60 *
                  1000
            );
          })
          .map(
            (item) =>
              item.block_number
          )
      )
    ];

    topics.push({
      unit_id: unit.id,
      topic_name: unit.name,
      question_count:
        questionCount,
      total_blocks:
        totalBlocks,
      completed_blocks:
        completedBlocks,
      locked_blocks:
        lockedBlocks,
      all_done:
        totalBlocks > 0 &&
        completedBlocks.length ===
          totalBlocks
    });
  }

  return res.status(200).json({
    level:
      scope.active_level_name ||
      null,
    topics
  });
}

export async function getQuizBlock(
  req,
  res,
  ctx
) {
  requireAuth(ctx);

  const {
    unit_id,
    block_number
  } = req.query;

  if (
    !unit_id ||
    block_number === undefined
  ) {
    throw new SecurityError(
      'unit_id and block_number required',
      400
    );
  }

  const blockNum =
    Number.parseInt(
      block_number,
      10
    );

  if (
    !Number.isInteger(
      blockNum
    ) ||
    blockNum < 0
  ) {
    throw new SecurityError(
      'Invalid block_number',
      400
    );
  }

  const unit =
    await getUnitWithValidation(
      ctx,
      unit_id,
      blockNum
    );

  const session =
    await getSession(
      ctx,
      unit.id,
      blockNum
    );

  if (!session) {
    throw new SecurityError(
      'No active quiz session. Please start this block from the Quiz page.',
      403
    );
  }

  if (session.auto_submitted) {
    throw new SecurityError(
      'This block was auto-submitted and is temporarily locked.',
      403
    );
  }

  const elapsed =
    secondsElapsed(session);

  if (
    elapsed >
    BLOCK_TIME_LIMIT_SECONDS +
      BLOCK_TIME_GRACE_SECONDS
  ) {
    await expireSession(
      ctx,
      unit,
      blockNum,
      session,
      'time_expired'
    );

    throw new SecurityError(
      'This quiz block has expired and was automatically submitted.',
      403
    );
  }

  const questionIds =
    getSessionQuestionIds(
      session
    );

  if (!questionIds.length) {
    throw new SecurityError(
      'Session question set missing',
      500
    );
  }

  const {
    data: questions,
    error
  } = await supabase
    .from('quiz_questions')
    .select(
      'id, question_text, option_a, option_b, option_c, option_d, difficulty, image_url, image_alt_text, status, version'
    )
    .in(
      'id',
      questionIds
    )
    .eq(
      'status',
      'published'
    )
    .eq(
      'is_active',
      true
    );

  if (error) {
    console.error(
      '[QUIZ_BLOCK_QUESTION_ERROR]',
      error.message
    );

    throw new SecurityError(
      'Unable to load quiz questions',
      500
    );
  }

  const questionMap =
    new Map();

  for (
    const question of
      questions || []
  ) {
    questionMap.set(
      String(question.id),
      question
    );
  }

  const orderedQuestions =
    questionIds
      .map((id) =>
        questionMap.get(
          String(id)
        )
      )
      .filter(Boolean);

  if (
    orderedQuestions.length !==
    questionIds.length
  ) {
    throw new SecurityError(
      'Some questions in this session are no longer available.',
      409
    );
  }

  const priorAnswers =
    session.state?.answers &&
    typeof session.state.answers ===
      'object'
      ? session.state.answers
      : {};

  const answeredSoFar =
    orderedQuestions.map(
      (question) =>
        priorAnswers[
          String(question.id)
        ] || null
    );

  const timeLeft =
    Math.max(
      0,
      BLOCK_TIME_LIMIT_SECONDS -
        elapsed
    );

  return res.status(200).json({
    questions:
      orderedQuestions,
    block_number:
      blockNum,
    prior_answers:
      answeredSoFar,
    time_left:
      timeLeft,
    tab_switches:
      session.tab_switches || 0,
    max_tab_switches:
      session.max_tab_switches ||
      MAX_TAB_SWITCHES
  });
}

export async function checkDailyRetry(
  req,
  res,
  ctx
) {
  requireAuth(ctx);

  const {
    unit_id,
    block_number
  } = req.query;

  if (
    !unit_id ||
    block_number === undefined
  ) {
    throw new SecurityError(
      'unit_id and block_number required',
      400
    );
  }

  const blockNum =
    Number.parseInt(
      block_number,
      10
    );

  if (
    !Number.isInteger(
      blockNum
    ) ||
    blockNum < 0
  ) {
    throw new SecurityError(
      'Invalid block_number',
      400
    );
  }

  const unit =
    await getUnitWithValidation(
      ctx,
      unit_id,
      null
    );

  const now =
    Date.now();

  /*
   * FIRST:
   * Check security logs for integrity violations.
   */
  const {
    data: securityViolations
  } = await supabase
    .from('quiz_security_logs')
    .select(
      'created_at, event_type, details'
    )
    .eq(
      'user_id',
      ctx.userId
    )
    .in(
      'event_type',
      [
        'tab_switch_auto_submit',
        'time_limit_auto_submit'
      ]
    )
    .eq(
      'details->>unit_id',
      unit_id
    )
    .eq(
      'details->>block_number',
      String(blockNum)
    )
    .order(
      'created_at',
      {
        ascending: false
      }
    )
    .limit(1);

  /*
   * SECOND:
   * Also inspect quiz_session_events.
   *
   * Current time-expiration records are stored
   * here in your database.
   */
  const {
    data: sessionEvents
  } = await supabase
    .from('quiz_session_events')
    .select(
      'created_at, event_type, metadata'
    )
    .eq(
      'user_id',
      ctx.userId
    )
    .in(
      'event_type',
      [
        'session_expired',
        'auto_submitted'
      ]
    )
    .eq(
      'session_id',
      await findLatestSessionId(
        ctx.userId,
        unit.id,
        blockNum
      )
    )
    .order(
      'created_at',
      {
        ascending: false
      }
    )
    .limit(1);

  const candidates = [];

  for (
    const event of
      securityViolations ||
      []
  ) {
    if (
      event.created_at
    ) {
      candidates.push({
        created_at:
          event.created_at,
        reason:
          event.event_type
      });
    }
  }

  for (
    const event of
      sessionEvents || []
  ) {
    if (
      event.created_at
    ) {
      candidates.push({
        created_at:
          event.created_at,
        reason:
          event.event_type
      });
    }
  }

  candidates.sort(
    (a, b) =>
      new Date(
        b.created_at
      ).getTime() -
      new Date(
        a.created_at
      ).getTime()
  );

  const latestIntegrity =
    candidates[0] || null;

  if (latestIntegrity) {
    const violationTime =
      new Date(
        latestIntegrity.created_at
      ).getTime();

    if (
      Number.isFinite(
        violationTime
      )
    ) {
      const elapsedHours =
        (now -
          violationTime) /
        (1000 * 60 * 60);

      if (
        elapsedHours <
        INTEGRITY_LOCK_HOURS
      ) {
        const hoursLeft =
          Math.ceil(
            INTEGRITY_LOCK_HOURS -
              elapsedHours
          );

        return res.status(200).json({
          can_retry: false,
          reason:
            `Integrity lock: try again in ${hoursLeft} hour(s)`,
          integrity_lock:
            true,
          hours_remaining:
            hoursLeft
        });
      }
    }
  }

  /*
   * Check ordinary 24-hour retry lock.
   */
  const {
    data: activity
  } = await supabase
    .from('quiz_attempts')
    .select(
      'submitted_at, status'
    )
    .eq(
      'user_id',
      ctx.userId
    )
    .eq(
      'unit_id',
      unit.id
    )
    .eq(
      'block_number',
      blockNum
    )
    .not(
      'submitted_at',
      'is',
      null
    )
    .order(
      'submitted_at',
      {
        ascending: false
      }
    )
    .limit(1);

  if (
    activity?.length
  ) {
    const lastAttempt =
      new Date(
        activity[0]
          .submitted_at
      ).getTime();

    if (
      Number.isFinite(
        lastAttempt
      )
    ) {
      const hoursSince =
        (now -
          lastAttempt) /
        (1000 * 60 * 60);

      if (
        hoursSince <
        DAILY_RETRY_HOURS
      ) {
        const hoursLeft =
          Math.ceil(
            DAILY_RETRY_HOURS -
              hoursSince
          );

        return res.status(200).json({
          can_retry: false,
          reason:
            `Try again in ${hoursLeft} hour(s)`,
          integrity_lock:
            false,
          hours_remaining:
            hoursLeft
        });
      }
    }
  }

  return res.status(200).json({
    can_retry: true,
    integrity_lock:
      false
  });
}

export async function getSessionStatus(
  req,
  res,
  ctx
) {
  requireAuth(ctx);

  const {
    unit_id,
    block_number
  } = req.query;

  if (
    unit_id &&
    block_number !== undefined
  ) {
    const blockNum =
      Number.parseInt(
        block_number,
        10
      );

    if (
      !Number.isInteger(
        blockNum
      ) ||
      blockNum < 0
    ) {
      throw new SecurityError(
        'Invalid block_number',
        400
      );
    }

    const unit =
      await getUnitWithValidation(
        ctx,
        unit_id,
        null
      );

    const session =
      await getSession(
        ctx,
        unit.id,
        blockNum
      );

    if (!session) {
      return res.status(200).json({
        exists: false
      });
    }

    return formatSessionResponse(
      res,
      session
    );
  }

  const scope =
    await getUserCurriculumScope(
      ctx.userId
    );

  if (
    !scope?.active_group_id
  ) {
    return res.status(200).json({
      exists: false
    });
  }

  const {
    data: sessions,
    error
  } = await supabase
    .from('user_quiz_sessions')
    .select('*')
    .eq(
      'user_id',
      ctx.userId
    )
    .order(
      'updated_at',
      {
        ascending: false
      }
    )
    .limit(1);

  if (error) {
    console.error(
      '[QUIZ_SESSION_STATUS_ERROR]',
      error.message
    );

    throw new SecurityError(
      'Unable to load quiz session',
      500
    );
  }

  const session =
    sessions?.[0] ||
    null;

  if (!session) {
    return res.status(200).json({
      exists: false
    });
  }

  return formatSessionResponse(
    res,
    session
  );
}

export async function startSession(
  body,
  res,
  ctx
) {
  requireAuth(ctx);

  const {
    unit_id,
    block_number,
    mode = 'study',
    idempotency_key
  } = body;

  if (
    !unit_id ||
    block_number === undefined
  ) {
    throw new SecurityError(
      'unit_id and block_number required',
      400
    );
  }

  const blockNum =
    Number.parseInt(
      block_number,
      10
    );

  if (
    !Number.isInteger(
      blockNum
    ) ||
    blockNum < 0
  ) {
    throw new SecurityError(
      'Invalid block_number',
      400
    );
  }

  if (
    !['study', 'exam'].includes(
      mode
    )
  ) {
    throw new SecurityError(
      'Invalid quiz mode',
      400
    );
  }

  const ip =
    ctx.clientIp ||
    'unknown';

  if (
    !(await rateLimiter.check(
      ip,
      ctx.userId,
      'quiz_start_session'
    ))
  ) {
    throw new SecurityError(
      'Too many quiz start requests',
      429
    );
  }

  if (idempotency_key) {
    const stored =
      await getStoredIdempotencyResponse(
        ctx.userId,
        'quiz_start_session',
        idempotency_key
      );

    if (stored) {
      return res
        .status(200)
        .json(stored);
    }
  }

  const unit =
    await getUnitWithValidation(
      ctx,
      unit_id,
      blockNum
    );

  let existing =
    await getSession(
      ctx,
      unit.id,
      blockNum
    );

  if (existing) {
    /*
     * Existing active session.
     */
    if (
      !existing.auto_submitted &&
      String(
        existing.status ||
          ''
      ).toLowerCase() ===
        'active'
    ) {
      const elapsed =
        secondsElapsed(
          existing
        );

      if (
        elapsed >
        BLOCK_TIME_LIMIT_SECONDS +
          BLOCK_TIME_GRACE_SECONDS
      ) {
        await expireSession(
          ctx,
          unit,
          blockNum,
          existing,
          'time_expired'
        );

        throw new SecurityError(
          'This quiz block has expired and was automatically submitted.',
          403
        );
      }

      const response = {
        success: true,
        resumed: true,
        session_id:
          existing.id,
        tab_switches:
          existing.tab_switches ||
          0,
        max_allowed:
          existing.max_tab_switches ||
          MAX_TAB_SWITCHES,
        time_left:
          Math.max(
            0,
            BLOCK_TIME_LIMIT_SECONDS -
              elapsed
          ),
        mode:
          existing.mode ||
          mode
      };

      if (idempotency_key) {
        await createIdempotencyKey(
          ctx.userId,
          'quiz_start_session',
          idempotency_key,
          response,
          200
        );
      }

      return res
        .status(200)
        .json(response);
    }

    /*
     * Existing auto-submitted session.
     *
     * IMPORTANT:
     * Do not permanently block the block.
     * First verify the 48-hour integrity lock.
     */
    if (
      existing.auto_submitted
    ) {
      const lock =
        await getIntegrityLockStatus(
          ctx.userId,
          unit.id,
          blockNum,
          existing
        );

      if (lock.locked) {
        throw new SecurityError(
          `Block locked due to integrity violation. Try again in ${lock.hoursLeft} hour(s).`,
          403
        );
      }

      /*
       * Integrity lock expired.
       *
       * Remove the old session so a completely
       * fresh session and attempt can be created.
       */
      await removeExpiredSession(
        ctx.userId,
        existing.id
      );

      existing = null;
    }
  }

  /*
   * If an old non-active session remains,
   * only allow a new attempt when retry rules permit it.
   */
  if (existing) {
    const retry =
      await getRetryStatus(
        ctx.userId,
        unit.id,
        blockNum
      );

    if (!retry.canRetry) {
      throw new SecurityError(
        retry.reason,
        403
      );
    }

    await removeExpiredSession(
      ctx.userId,
      existing.id
    );

    existing = null;
  }

  /*
   * Enforce the 48-hour integrity lock before
   * creating a new session.
   */
  const integrity =
    await getIntegrityLockStatus(
      ctx.userId,
      unit.id,
      blockNum,
      null
    );

  if (integrity.locked) {
    throw new SecurityError(
      `Block locked due to integrity violation. Try again in ${integrity.hoursLeft} hour(s).`,
      403
    );
  }

  /*
   * Enforce ordinary 24-hour retry restriction.
   */
  const retry =
    await getRetryStatus(
      ctx.userId,
      unit.id,
      blockNum
    );

  if (!retry.canRetry) {
    throw new SecurityError(
      retry.reason,
      403
    );
  }

  const questionIds =
    await selectBlockQuestionIds(
      unit.id,
      blockNum,
      mode
    );

  if (
    !questionIds.length
  ) {
    throw new SecurityError(
      'No questions found for this block',
      404
    );
  }

  const questionSetHash =
    hashQuestionSet(
      questionIds
    );

  const nowIso =
    new Date().toISOString();

  const sessionState = {
    question_ids:
      questionIds,
    answers: {},
    current_question: 0,
    answered_questions: [],
    question_started_at: {},
    tab_switch_timestamps: [],
    last_heartbeat: null,
    autosave_version: 0,
    session_version: 1,
    mode,
    started_at: nowIso,
    session_status: 'active',
    question_set_hash:
      questionSetHash
  };

  const {
    data: insertedSession,
    error: insertError
  } = await supabase
    .from('user_quiz_sessions')
    .insert({
      user_id:
        ctx.userId,
      unit_id:
        unit.id,
      group_id:
        unit.groupId,
      block_number:
        blockNum,
      level:
        unit.levelName,
      topic:
        unit.name,
      state:
        sessionState,
      tab_switches: 0,
      max_tab_switches:
        MAX_TAB_SWITCHES,
      auto_submitted:
        false,
      status:
        'active',
      mode,
      question_set_hash:
        questionSetHash,
      started_at:
        nowIso
    })
    .select()
    .single();

  if (insertError) {
    console.error(
      '[QUIZ_START_SESSION_INSERT_ERROR]',
      JSON.stringify({
        user_id:
          ctx.userId,
        unit_id:
          unit.id,
        block_number:
          blockNum,
        error:
          insertError.message
      })
    );

    throw new SecurityError(
      'Failed to create quiz session',
      500
    );
  }

  const attemptNumber =
    await getNextAttemptNumber(
      ctx.userId,
      unit.id,
      blockNum
    );

  const {
    error: attemptError
  } = await supabase.rpc(
    'atomic_create_quiz_attempt',
    {
      p_user_id:
        ctx.userId,
      p_unit_id:
        unit.id,
      p_group_id:
        unit.groupId,
      p_level_id:
        unit.levelId ||
        null,
      p_session_id:
        insertedSession.id,
      p_block_number:
        blockNum,
      p_attempt_number:
        attemptNumber,
      p_status:
        'active',
      p_started_at:
        nowIso,
      p_question_set_hash:
        questionSetHash,
      p_total_questions:
        questionIds.length
    }
  );

  if (attemptError) {
    console.error(
      '[QUIZ_START_ATTEMPT_CREATE_ERROR]',
      JSON.stringify({
        user_id:
          ctx.userId,
        session_id:
          insertedSession.id,
        error:
          attemptError.message
      })
    );

    await supabase
      .from(
        'user_quiz_sessions'
      )
      .delete()
      .eq(
        'id',
        insertedSession.id
      )
      .eq(
        'user_id',
        ctx.userId
      );

    throw new SecurityError(
      'Failed to create quiz attempt',
      500
    );
  }

  const response = {
    success: true,
    resumed: false,
    session_id:
      insertedSession.id,
    tab_switches: 0,
    max_allowed:
      MAX_TAB_SWITCHES,
    time_left:
      BLOCK_TIME_LIMIT_SECONDS,
    mode
  };

  if (idempotency_key) {
    await createIdempotencyKey(
      ctx.userId,
      'quiz_start_session',
      idempotency_key,
      response,
      200
    );
  }

  return res
    .status(200)
    .json(response);
}

async function getUnitWithValidation(
  ctx,
  unitId,
  blockNumber
) {
  const scope =
    await getUserCurriculumScope(
      ctx.userId
    );

  if (
    !scope?.active_group_id
  ) {
    throw new SecurityError(
      'Your curriculum context is not set.',
      403
    );
  }

  const {
    data: unit,
    error
  } = await supabase
    .from(
      'curriculum_units'
    )
    .select(
      'id, name, group_id, curriculum_groups!inner(level_id, name, curriculum_levels(id, display_name, unit_label, group_label, icon, color))'
    )
    .eq(
      'id',
      unitId
    )
    .eq(
      'group_id',
      scope.active_group_id
    )
    .eq(
      'is_active',
      true
    )
    .maybeSingle();

  if (error) {
    console.error(
      '[QUIZ_UNIT_LOOKUP_ERROR]',
      error.message
    );

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

  if (
    blockNumber !== null &&
    blockNumber !== undefined
  ) {
    const {
      data: authUser
    } =
      await supabase.auth.admin.getUserById(
        ctx.userId
      );

    const access =
      await checkUnitBlockAccess(
        authUser?.user?.email ||
          null,
        ctx.userId,
        unit.id,
        blockNumber
      );

    if (!access.allowed) {
      if (
        access.reason ===
        'restricted'
      ) {
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

  const group =
    unit.curriculum_groups;

  const level =
    group?.curriculum_levels ||
    null;

  return {
    id: unit.id,
    name: unit.name,
    groupId:
      unit.group_id,
    groupName:
      group?.name || null,
    levelId:
      level?.id || null,
    levelName:
      level?.display_name ||
      null,
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
    .from(
      'user_quiz_sessions'
    )
    .select('*')
    .eq(
      'user_id',
      ctx.userId
    )
    .eq(
      'unit_id',
      unitId
    )
    .eq(
      'block_number',
      blockNumber
    )
    .order(
      'updated_at',
      {
        ascending: false
      }
    )
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(
      '[QUIZ_SESSION_LOOKUP_ERROR]',
      JSON.stringify({
        user_id:
          ctx.userId,
        unit_id:
          unitId,
        block_number:
          blockNumber,
        error:
          error.message
      })
    );

    throw new SecurityError(
      'Unable to load quiz session',
      500
    );
  }

  return data || null;
}

function secondsElapsed(
  session
) {
  const startedStr =
    session.state?.started_at ||
    session.started_at ||
    session.created_at ||
    session.updated_at;

  const started =
    new Date(
      startedStr
    ).getTime();

  if (
    !Number.isFinite(
      started
    )
  ) {
    return 0;
  }

  return Math.max(
    0,
    Math.floor(
      (Date.now() -
        started) /
        1000
    )
  );
}

function getSessionQuestionIds(
  session
) {
  if (
    Array.isArray(
      session.state
        ?.question_ids
    ) &&
    session.state
      .question_ids.length
  ) {
    return session.state
      .question_ids
      .map(
        (id) =>
          Number(id)
      )
      .filter(
        Number.isFinite
      );
  }

  if (
    Array.isArray(
      session.question_ids
    ) &&
    session.question_ids.length
  ) {
    return session.question_ids
      .map(
        (id) =>
          Number(id)
      )
      .filter(
        Number.isFinite
      );
  }

  if (
    Array.isArray(
      session.all_question_ids
    ) &&
    session.all_question_ids.length
  ) {
    return session
      .all_question_ids
      .map(
        (id) =>
          Number(id)
      )
      .filter(
        Number.isFinite
      );
  }

  return [];
}

async function expireSession(
  ctx,
  unit,
  blockNumber,
  session,
  reason
) {
  const nowIso =
    new Date().toISOString();

  const previousState =
    session.state &&
    typeof session.state ===
      'object'
      ? session.state
      : {};

  const updatedState = {
    ...previousState,
    auto_submitted_at:
      nowIso,
    auto_submit_reason:
      reason,
    session_status:
      'expired'
  };

  const {
    error
  } = await supabase
    .from(
      'user_quiz_sessions'
    )
    .update({
      auto_submitted:
        true,
      status:
        'submitted',
      state:
        updatedState,
      updated_at:
        nowIso
    })
    .eq(
      'id',
      session.id
    )
    .eq(
      'user_id',
      ctx.userId
    );

  if (error) {
    console.error(
      '[QUIZ_EXPIRE_SESSION_ERROR]',
      error.message
    );

    throw new SecurityError(
      'Unable to expire quiz session',
      500
    );
  }

  /*
   * Finalize the currently active attempt.
   *
   * This prevents stale ACTIVE attempts from
   * remaining forever after a time expiration.
   */
  const {
    data: activeAttempt
  } = await supabase
    .from(
      'quiz_attempts'
    )
    .select(
      'id'
    )
    .eq(
      'user_id',
      ctx.userId
    )
    .eq(
      'session_id',
      session.id
    )
    .eq(
      'status',
      'active'
    )
    .maybeSingle();

  if (activeAttempt?.id) {
    const questionIds =
      getSessionQuestionIds(
        session
      );

    const priorAnswers =
      session.state
        ?.answers &&
      typeof session.state
        .answers ===
        'object'
        ? session.state
            .answers
        : {};

    let score = 0;

    if (
      questionIds.length
    ) {
      const {
        data: questions
      } = await supabase
        .from(
          'quiz_questions'
        )
        .select(
          'id, correct_option'
        )
        .in(
          'id',
          questionIds
        );

      const questionMap =
        new Map();

      for (
        const question of
          questions || []
      ) {
        questionMap.set(
          String(
            question.id
          ),
          question
        );
      }

      for (
        const id of
          questionIds
      ) {
        const answer =
          priorAnswers[
            String(id)
          ];

        const question =
          questionMap.get(
            String(id)
          );

        if (
          answer?.selected &&
          question?.correct_option &&
          String(
            answer.selected
          )
            .trim()
            .toUpperCase() ===
            String(
              question.correct_option
            )
              .trim()
              .toUpperCase()
        ) {
          score += 1;
        }
      }
    }

    const total =
      questionIds.length;

    const percentage =
      total > 0
        ? Math.round(
            (score / total) *
              100
          )
        : 0;

    const {
      error:
        finalizeError
    } = await supabase.rpc(
      'atomic_finalize_quiz_attempt',
      {
        p_attempt_id:
          activeAttempt.id,
        p_user_id:
          ctx.userId,
        p_score:
          score,
        p_total_questions:
          total,
        p_percentage:
          percentage,
        p_passed:
          false,
        p_xp_earned:
          0,
        p_time_taken:
          Math.min(
            secondsElapsed(
              session
            ),
            BLOCK_TIME_LIMIT_SECONDS
          ),
        p_auto_submitted:
          true,
        p_auto_submit_reason:
          reason,
        p_tab_switches:
          session.tab_switches ||
          0
      }
    );

    if (finalizeError) {
      console.error(
        '[QUIZ_EXPIRE_ATTEMPT_FINALIZE_ERROR]',
        JSON.stringify({
          user_id:
            ctx.userId,
          session_id:
            session.id,
          attempt_id:
            activeAttempt.id,
          error:
            finalizeError.message
        })
      );
    }
  }

  await supabase
    .from(
      'quiz_session_events'
    )
    .insert({
      session_id:
        session.id,
      user_id:
        ctx.userId,
      event_type:
        'session_expired',
      metadata: {
        reason,
        unit_id:
          unit.id,
        block_number:
          blockNumber,
        autoSubmitted:
          true
      }
    });

  try {
    await createNotification(
      ctx.userId,
      'quiz_auto_submitted',
      {
        topic_name:
          unit.name,
        block_number:
          blockNumber + 1,
        reason
      }
    );
  } catch (err) {
    console.error(
      '[QUIZ_EXPIRE_NOTIFICATION_ERROR]',
      err.message
    );
  }
}

async function selectBlockQuestionIds(
  unitId,
  blockNumber,
  mode
) {
  const {
    data,
    error
  } = await supabase
    .from(
      'quiz_questions'
    )
    .select(
      'id, version'
    )
    .eq(
      'unit_id',
      unitId
    )
    .eq(
      'status',
      'published'
    )
    .eq(
      'is_active',
      true
    )
    .order(
      'id',
      {
        ascending: true
      }
    );

  if (error) {
    console.error(
      '[QUIZ_SELECT_QUESTIONS_ERROR]',
      error.message
    );

    throw new SecurityError(
      'Unable to load quiz questions',
      500
    );
  }

  if (!data?.length) {
    return [];
  }

  const offset =
    blockNumber *
    SESSION_LENGTH;

  const selected =
    data.slice(
      offset,
      offset +
        SESSION_LENGTH
    );

  if (
    mode === 'exam'
  ) {
    selected.sort(
      () =>
        Math.random() -
        0.5
    );
  }

  return selected.map(
    (item) =>
      Number(item.id)
  );
}

function hashQuestionSet(
  questionIds
) {
  const normalized =
    questionIds
      .map(
        (id) =>
          Number(id)
      )
      .sort(
        (a, b) =>
          a - b
      );

  return crypto
    .createHash(
      'sha256'
    )
    .update(
      normalized.join(',')
    )
    .digest('hex');
}

async function getNextAttemptNumber(
  userId,
  unitId,
  blockNumber
) {
  const {
    count,
    error
  } = await supabase
    .from(
      'quiz_attempts'
    )
    .select(
      'id',
      {
        count: 'exact',
        head: true
      }
    )
    .eq(
      'user_id',
      userId
    )
    .eq(
      'unit_id',
      unitId
    )
    .eq(
      'block_number',
      blockNumber
    );

  if (error) {
    console.error(
      '[QUIZ_ATTEMPT_COUNT_ERROR]',
      error.message
    );

    throw new SecurityError(
      'Unable to determine attempt number',
      500
    );
  }

  return (
    count || 0
  ) + 1;
}

async function findLatestSessionId(
  userId,
  unitId,
  blockNumber
) {
  const {
    data
  } = await supabase
    .from(
      'user_quiz_sessions'
    )
    .select(
      'id'
    )
    .eq(
      'user_id',
      userId
    )
    .eq(
      'unit_id',
      unitId
    )
    .eq(
      'block_number',
      blockNumber
    )
    .order(
      'updated_at',
      {
        ascending: false
      }
    )
    .limit(1)
    .maybeSingle();

  return data?.id ||
    null;
}

async function getIntegrityLockStatus(
  userId,
  unitId,
  blockNumber,
  session
) {
  const now =
    Date.now();

  let latestTime =
    0;

  if (
    session?.auto_submitted
  ) {
    const state =
      session.state &&
      typeof session.state ===
        'object'
        ? session.state
        : {};

    const timestamp =
      state.auto_submitted_at ||
      session.updated_at;

    const parsed =
      new Date(
        timestamp
      ).getTime();

    if (
      Number.isFinite(
        parsed
      )
    ) {
      latestTime =
        Math.max(
          latestTime,
          parsed
        );
    }
  }

  const {
    data: securityLogs
  } = await supabase
    .from(
      'quiz_security_logs'
    )
    .select(
      'created_at'
    )
    .eq(
      'user_id',
      userId
    )
    .in(
      'event_type',
      [
        'tab_switch_auto_submit',
        'time_limit_auto_submit'
      ]
    )
    .eq(
      'details->>unit_id',
      unitId
    )
    .eq(
      'details->>block_number',
      String(
        blockNumber
      )
    )
    .order(
      'created_at',
      {
        ascending: false
      }
    )
    .limit(1);

  for (
    const row of
      securityLogs ||
      []
  ) {
    const time =
      new Date(
        row.created_at
      ).getTime();

    if (
      Number.isFinite(
        time
      )
    ) {
      latestTime =
        Math.max(
          latestTime,
          time
        );
    }
  }

  const sessionId =
    session?.id ||
    await findLatestSessionId(
      userId,
      unitId,
      blockNumber
    );

  if (sessionId) {
    const {
      data: events
    } = await supabase
      .from(
        'quiz_session_events'
      )
      .select(
        'created_at, event_type'
      )
      .eq(
        'user_id',
        userId
      )
      .eq(
        'session_id',
        sessionId
      )
      .in(
        'event_type',
        [
          'session_expired',
          'auto_submitted'
        ]
      )
      .order(
        'created_at',
        {
          ascending: false
        }
      )
      .limit(1);

    for (
      const event of
        events || []
    ) {
      const time =
        new Date(
          event.created_at
        ).getTime();

      if (
        Number.isFinite(
          time
        )
      ) {
        latestTime =
          Math.max(
            latestTime,
            time
          );
      }
    }
  }

  if (!latestTime) {
    return {
      locked: false,
      hoursLeft: 0
    };
  }

  const elapsedHours =
    (now -
      latestTime) /
    (1000 * 60 * 60);

  if (
    elapsedHours <
    INTEGRITY_LOCK_HOURS
  ) {
    return {
      locked: true,
      hoursLeft:
        Math.ceil(
          INTEGRITY_LOCK_HOURS -
            elapsedHours
        )
    };
  }

  return {
    locked: false,
    hoursLeft: 0
  };
}

async function getRetryStatus(
  userId,
  unitId,
  blockNumber
) {
  const {
    data
  } = await supabase
    .from(
      'quiz_attempts'
    )
    .select(
      'submitted_at, status'
    )
    .eq(
      'user_id',
      userId
    )
    .eq(
      'unit_id',
      unitId
    )
    .eq(
      'block_number',
      blockNumber
    )
    .not(
      'submitted_at',
      'is',
      null
    )
    .order(
      'submitted_at',
      {
        ascending: false
      }
    )
    .limit(1);

  if (!data?.length) {
    return {
      canRetry: true,
      reason: null
    };
  }

  const submitted =
    new Date(
      data[0].submitted_at
    ).getTime();

  if (
    !Number.isFinite(
      submitted
    )
  ) {
    return {
      canRetry: true,
      reason: null
    };
  }

  const hoursSince =
    (Date.now() -
      submitted) /
    (1000 * 60 * 60);

  if (
    hoursSince <
    DAILY_RETRY_HOURS
  ) {
    const hoursLeft =
      Math.ceil(
        DAILY_RETRY_HOURS -
          hoursSince
      );

    return {
      canRetry: false,
      reason:
        `Try again in ${hoursLeft} hour(s)`
    };
  }

  return {
    canRetry: true,
    reason: null
  };
}

async function removeExpiredSession(
  userId,
  sessionId
) {
  if (!sessionId) {
    return;
  }

  const {
    error
  } = await supabase
    .from(
      'user_quiz_sessions'
    )
    .delete()
    .eq(
      'id',
      sessionId
    )
    .eq(
      'user_id',
      userId
    );

  if (error) {
    console.error(
      '[QUIZ_REMOVE_EXPIRED_SESSION_ERROR]',
      JSON.stringify({
        user_id:
          userId,
        session_id:
          sessionId,
        error:
          error.message
      })
    );

    throw new SecurityError(
      'Unable to prepare a new quiz session',
      500
    );
  }
}

function formatSessionResponse(
  res,
  session
) {
  const elapsed =
    secondsElapsed(
      session
    );

  return res.status(200).json({
    exists: true,
    session: {
      session_id:
        session.id,
      level:
        session.level,
      topic:
        session.topic,
      block_number:
        session.block_number,
      tab_switches:
        session.tab_switches ||
        0,
      max_allowed:
        session.max_tab_switches ||
        MAX_TAB_SWITCHES,
      remaining:
        Math.max(
          0,
          (
            session.max_tab_switches ||
            MAX_TAB_SWITCHES
          ) -
            (
              session.tab_switches ||
              0
            )
        ),
      auto_submitted:
        session.auto_submitted ||
        false,
      time_left:
        Math.max(
          0,
          BLOCK_TIME_LIMIT_SECONDS -
            elapsed
        ),
      updated_at:
        session.updated_at,
      mode:
        session.mode ||
        'study'
    }
  });
}
