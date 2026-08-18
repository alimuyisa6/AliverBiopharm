 /* lib/quiz/session.js */

import {
  supabase,
  recordPlatformActivity,
  updateTopicXp,
  updateUserRecords,
  updateDailyChallengeProgress,
  recordWeakConcept
} from '../core.js';

import {
  requireAuth,
  SecurityError,
  rateLimiter
} from '../security-middleware.js';

import { createNotification } from '../notifications.js';
import { getUserCurriculumScope } from '../curriculum.js';
import { checkUnitBlockAccess } from '../premium.js';

import {
  createIdempotencyKey,
  getStoredIdempotencyResponse
} from './idempotency.js';

import crypto from 'crypto';

const SESSION_LENGTH = 10;
const BLOCK_TIME_LIMIT_SECONDS = 600;
const BLOCK_TIME_GRACE_SECONDS = 15;
const INTEGRITY_LOCK_HOURS = 48;
const RETRY_LOCK_HOURS = 24;
const MAX_TAB_SWITCHES = 3;

const INTEGRITY_EVENTS = [
  'tab_switch_auto_submit',
  'time_limit_auto_submit'
];

export async function getQuizTopics(req, res, ctx) {
  requireAuth(ctx);

  const { unit_id } = req.query;

  if (!unit_id) {
    throw new SecurityError('unit_id required', 400);
  }

  const unit = await getUnitWithValidation(ctx, unit_id, null);

  const { count: questionCount, error: questionCountError } = await supabase
    .from('quiz_questions')
    .select('id', { count: 'exact', head: true })
    .eq('unit_id', unit.id)
    .eq('status', 'published')
    .eq('is_active', true);

  if (questionCountError) {
    console.error('[QUIZ_TOPICS_COUNT_ERROR]', JSON.stringify({
      user_id: ctx.userId,
      unit_id: unit.id,
      error: questionCountError.message
    }));

    throw new SecurityError('Unable to load quiz questions', 500);
  }

  const totalBlocks = questionCount ? Math.ceil(questionCount / SESSION_LENGTH) : 0;

  const { data: activity, error: activityError } = await supabase
    .from('quiz_attempts')
    .select('block_number, submitted_at, status, auto_submitted')
    .eq('user_id', ctx.userId)
    .eq('unit_id', unit.id);

  if (activityError) {
    console.error('[QUIZ_TOPICS_ACTIVITY_ERROR]', JSON.stringify({
      user_id: ctx.userId,
      unit_id: unit.id,
      error: activityError.message
    }));

    throw new SecurityError('Unable to load quiz progress', 500);
  }

  const passedBlocks = [
    ...new Set(
      (activity || [])
        .filter((item) => String(item.status).toLowerCase() === 'passed')
        .map((item) => Number(item.block_number))
        .filter(Number.isInteger)
    )
  ];

  const now = Date.now();

  const lockedBlocks = [
    ...new Set(
      (activity || [])
        .filter((item) => {
          if (!item.submitted_at) return false;

          const submitted = new Date(item.submitted_at).getTime();

          return (
            Number.isFinite(submitted) &&
            now - submitted < RETRY_LOCK_HOURS * 60 * 60 * 1000
          );
        })
        .map((item) => Number(item.block_number))
        .filter(Number.isInteger)
    )
  ];

  return res.status(200).json({
    unit_id: unit.id,
    unit_name: unit.name,
    level_id: unit.levelId,
    level: unit.level,
    topic_image_url: unit.topicImageUrl || null,
    total_questions: questionCount || 0,
    total_blocks: totalBlocks,
    completed_blocks: passedBlocks,
    locked_blocks: lockedBlocks,
    all_done: totalBlocks > 0 && passedBlocks.length === totalBlocks
  });
}

export async function listQuizTopics(req, res, ctx) {
  requireAuth(ctx);

  const scope = await getUserCurriculumScope(ctx.userId);

  if (!scope?.active_group_id) {
    return res.status(200).json({ level: null, topics: [] });
  }

  const { data: units, error: unitsError } = await supabase
    .from('curriculum_units')
    .select('id, name, group_id, topic_image_url')
    .eq('group_id', scope.active_group_id)
    .eq('is_active', true)
    .order('display_order');

  if (unitsError) {
    console.error('[QUIZ_LIST_UNITS_ERROR]', JSON.stringify({
      user_id: ctx.userId,
      error: unitsError.message
    }));

    throw new SecurityError('Unable to load quiz topics', 500);
  }

  if (!units?.length) {
    return res.status(200).json({ level: scope.active_level_name || null, topics: [] });
  }

  const unitIds = units.map((unit) => unit.id);

  const { data: questionRows, error: questionError } = await supabase
    .from('quiz_questions')
    .select('unit_id')
    .in('unit_id', unitIds)
    .eq('status', 'published')
    .eq('is_active', true);

  if (questionError) {
    console.error('[QUIZ_LIST_QUESTIONS_ERROR]', JSON.stringify({
      user_id: ctx.userId,
      error: questionError.message
    }));

    throw new SecurityError('Unable to load quiz question counts', 500);
  }

  const countMap = new Map();

  for (const row of questionRows || []) {
    countMap.set(row.unit_id, (countMap.get(row.unit_id) || 0) + 1);
  }

  const { data: activity, error: activityError } = await supabase
    .from('quiz_attempts')
    .select('unit_id, block_number, submitted_at, status')
    .eq('user_id', ctx.userId)
    .in('unit_id', unitIds);

  if (activityError) {
    console.error('[QUIZ_LIST_ACTIVITY_ERROR]', JSON.stringify({
      user_id: ctx.userId,
      error: activityError.message
    }));

    throw new SecurityError('Unable to load quiz progress', 500);
  }

  const activityByUnit = new Map();

  for (const item of activity || []) {
    if (!activityByUnit.has(item.unit_id)) {
      activityByUnit.set(item.unit_id, []);
    }

    activityByUnit.get(item.unit_id).push(item);
  }

  const now = Date.now();
  const topics = [];

  for (const unit of units) {
    const questionCount = countMap.get(unit.id) || 0;
    const totalBlocks = questionCount ? Math.ceil(questionCount / SESSION_LENGTH) : 0;
    const unitActivity = activityByUnit.get(unit.id) || [];

    const completedBlocks = [
      ...new Set(
        unitActivity
          .filter((item) => String(item.status).toLowerCase() === 'passed')
          .map((item) => Number(item.block_number))
          .filter(Number.isInteger)
      )
    ];

    const lockedBlocks = [
      ...new Set(
        unitActivity
          .filter((item) => {
            if (!item.submitted_at) return false;

            const submitted = new Date(item.submitted_at).getTime();

            return (
              Number.isFinite(submitted) &&
              now - submitted < RETRY_LOCK_HOURS * 60 * 60 * 1000
            );
          })
          .map((item) => Number(item.block_number))
          .filter(Number.isInteger)
      )
    ];

    topics.push({
      unit_id: unit.id,
      topic_name: unit.name,
      topic_image_url: unit.topic_image_url || null,
      question_count: questionCount,
      total_blocks: totalBlocks,
      completed_blocks: completedBlocks,
      locked_blocks: lockedBlocks,
      all_done: totalBlocks > 0 && completedBlocks.length === totalBlocks
    });
  }

  return res.status(200).json({ level: scope.active_level_name || null, topics });
}

export async function getQuizBlock(req, res, ctx) {
  requireAuth(ctx);

  const { unit_id, block_number } = req.query;

  if (!unit_id || block_number === undefined) {
    throw new SecurityError('unit_id and block_number required', 400);
  }

  const blockNum = Number.parseInt(block_number, 10);

  if (!Number.isInteger(blockNum) || blockNum < 0) {
    throw new SecurityError('Invalid block_number', 400);
  }

  const unit = await getUnitWithValidation(ctx, unit_id, blockNum);
  const integrity = await getIntegrityLock(ctx.userId, unit.id, blockNum);

  if (integrity.locked) {
    throw new SecurityError(
      `Block locked due to integrity violation. Try again in ${integrity.hoursLeft} hour(s).`,
      403
    );
  }

  const session = await getSession(ctx, unit.id, blockNum);

  if (!session) {
    throw new SecurityError('No active quiz session. Please start this block from the Quiz page.', 403);
  }

  if (session.auto_submitted) {
    throw new SecurityError('This block was auto-submitted due to a violation and is locked.', 403);
  }

  const elapsed = secondsElapsed(session);

  if (elapsed > BLOCK_TIME_LIMIT_SECONDS + BLOCK_TIME_GRACE_SECONDS) {
    await expireSession(ctx, unit, blockNum, session, 'time_expired');

    throw new SecurityError('This quiz block has expired and was automatically submitted.', 403);
  }

  const questionIds = getSessionQuestionIds(session);

  if (!questionIds.length) {
    throw new SecurityError('Session question set missing', 500);
  }

  const { data: questions, error } = await supabase
    .from('quiz_questions')
    .select('id, question_text, option_a, option_b, option_c, option_d, difficulty, image_url, image_alt_text, status, version')
    .in('id', questionIds)
    .eq('status', 'published')
    .eq('is_active', true);

  if (error) {
    console.error('[QUIZ_BLOCK_QUESTION_ERROR]', JSON.stringify({
      user_id: ctx.userId,
      session_id: session.id,
      error: error.message
    }));

    throw new SecurityError('Unable to load quiz questions', 500);
  }

  const questionMap = new Map();

  for (const question of questions || []) {
    questionMap.set(String(question.id), question);
  }

  const orderedQuestions = questionIds
    .map((id) => questionMap.get(String(id)))
    .filter(Boolean);

  if (orderedQuestions.length !== questionIds.length) {
    throw new SecurityError('Some session questions are no longer available', 409);
  }

  const priorAnswers =
    session.state?.answers && typeof session.state.answers === 'object'
      ? session.state.answers
      : {};

  const answeredSoFar = orderedQuestions.map(
    (question) => priorAnswers[String(question.id)] || priorAnswers[question.id] || null
  );

  const timeLeft = Math.max(0, BLOCK_TIME_LIMIT_SECONDS - elapsed);

  return res.status(200).json({
    questions: orderedQuestions,
    block_number: blockNum,
    prior_answers: answeredSoFar,
    time_left: timeLeft,
    tab_switches: session.tab_switches || 0,
    max_tab_switches: session.max_tab_switches || MAX_TAB_SWITCHES
  });
}

export async function checkDailyRetry(req, res, ctx) {
  requireAuth(ctx);

  const { unit_id, block_number } = req.query;

  if (!unit_id || block_number === undefined) {
    throw new SecurityError('unit_id and block_number required', 400);
  }

  const blockNum = Number.parseInt(block_number, 10);

  if (!Number.isInteger(blockNum) || blockNum < 0) {
    throw new SecurityError('Invalid block_number', 400);
  }

  const unit = await getUnitWithValidation(ctx, unit_id, null);
  const integrity = await getIntegrityLock(ctx.userId, unit.id, blockNum);

  if (integrity.locked) {
    return res.status(200).json({
      can_retry: false,
      reason: `Integrity lock: try again in ${integrity.hoursLeft} hour(s)`,
      integrity_lock: true,
      hours_left: integrity.hoursLeft,
      locked_until: integrity.locked_until
    });
  }

  const { data: activity, error } = await supabase
    .from('quiz_attempts')
    .select('submitted_at, status, auto_submitted')
    .eq('user_id', ctx.userId)
    .eq('unit_id', unit.id)
    .eq('block_number', blockNum)
    .not('submitted_at', 'is', null)
    .order('submitted_at', { ascending: false })
    .limit(1);

  if (error) {
    console.error('[QUIZ_RETRY_LOOKUP_ERROR]', JSON.stringify({
      user_id: ctx.userId,
      unit_id: unit.id,
      block_number: blockNum,
      error: error.message
    }));

    throw new SecurityError('Unable to check retry availability', 500);
  }

  if (activity?.length) {
    const lastAttempt = new Date(activity[0].submitted_at).getTime();

    if (Number.isFinite(lastAttempt)) {
      const elapsed = Date.now() - lastAttempt;

      if (elapsed < RETRY_LOCK_HOURS * 60 * 60 * 1000) {
        const hoursLeft = Math.max(
          1,
          Math.ceil((RETRY_LOCK_HOURS * 60 * 60 * 1000 - elapsed) / (60 * 60 * 1000))
        );

        return res.status(200).json({
          can_retry: false,
          reason: `Try again in ${hoursLeft} hour(s)`,
          integrity_lock: false,
          hours_left: hoursLeft
        });
      }
    }
  }

  return res.status(200).json({ can_retry: true, integrity_lock: false });
}

export async function getSessionStatus(req, res, ctx) {
  requireAuth(ctx);

  const { unit_id, block_number } = req.query;

  if (unit_id && block_number !== undefined) {
    const blockNum = Number.parseInt(block_number, 10);

    if (!Number.isInteger(blockNum) || blockNum < 0) {
      throw new SecurityError('Invalid block_number', 400);
    }

    const unit = await getUnitWithValidation(ctx, unit_id, null);
    const session = await getSession(ctx, unit.id, blockNum);

    if (!session) {
      return res.status(200).json({ exists: false });
    }

    return formatSessionResponse(res, session);
  }

  const scope = await getUserCurriculumScope(ctx.userId);

  if (!scope?.active_group_id) {
    return res.status(200).json({ exists: false });
  }

  const { data: sessions, error } = await supabase
    .from('user_quiz_sessions')
    .select('*')
    .eq('user_id', ctx.userId)
    .order('updated_at', { ascending: false })
    .limit(1);

  if (error) {
    throw new SecurityError('Unable to load quiz session', 500);
  }

  const session = sessions?.[0] || null;

  if (!session) {
    return res.status(200).json({ exists: false });
  }

  return formatSessionResponse(res, session);
}

export async function startSession(body, res, ctx) {
  requireAuth(ctx);

  const { unit_id, block_number, mode = 'study', idempotency_key } = body;

  if (!unit_id || block_number === undefined) {
    throw new SecurityError('unit_id and block_number required', 400);
  }

  const blockNum = Number.parseInt(block_number, 10);

  if (!Number.isInteger(blockNum) || blockNum < 0) {
    throw new SecurityError('Invalid block_number', 400);
  }

  if (!['study', 'exam'].includes(mode)) {
    throw new SecurityError('Invalid quiz mode', 400);
  }

  const ip = ctx.clientIp || 'unknown';

  if (!(await rateLimiter.check(ip, ctx.userId, 'quiz_start_session'))) {
    throw new SecurityError('Too many quiz start requests', 429);
  }

  if (idempotency_key) {
    const stored = await getStoredIdempotencyResponse(
      ctx.userId,
      'quiz_start_session',
      idempotency_key
    );

    if (stored) {
      return res.status(200).json(stored);
    }
  }

  const unit = await getUnitWithValidation(ctx, unit_id, blockNum);
  const integrity = await getIntegrityLock(ctx.userId, unit.id, blockNum);

  if (integrity.locked) {
    throw new SecurityError(
      `Block locked due to integrity violation. Try again in ${integrity.hoursLeft} hour(s).`,
      403
    );
  }

  const existing = await getSession(ctx, unit.id, blockNum);

  if (existing) {
    if (existing.auto_submitted) {
      const autoSubmittedAt = new Date(
        existing.state?.auto_submitted_at || existing.updated_at
      ).getTime();

      const lockDurationMs = INTEGRITY_LOCK_HOURS * 60 * 60 * 1000;

      if (Number.isFinite(autoSubmittedAt) && Date.now() - autoSubmittedAt < lockDurationMs) {
        throw new SecurityError('This block was auto-submitted due to an integrity violation.', 403);
      }

      await supabase
        .from('user_quiz_sessions')
        .delete()
        .eq('id', existing.id)
        .eq('user_id', ctx.userId);
    } else if (String(existing.status).toLowerCase() === 'submitted') {
      const submittedAt = new Date(existing.updated_at || existing.created_at).getTime();
      const lockDurationMs = RETRY_LOCK_HOURS * 60 * 60 * 1000;

      if (Number.isFinite(submittedAt) && Date.now() - submittedAt < lockDurationMs) {
        throw new SecurityError('This quiz block has already been submitted.', 409);
      }

      await supabase
        .from('user_quiz_sessions')
        .delete()
        .eq('id', existing.id)
        .eq('user_id', ctx.userId);
    } else if (String(existing.status).toLowerCase() === 'active') {
      const elapsed = secondsElapsed(existing);

      if (elapsed > BLOCK_TIME_LIMIT_SECONDS + BLOCK_TIME_GRACE_SECONDS) {
        await expireSession(ctx, unit, blockNum, existing, 'time_expired');

        throw new SecurityError('This quiz block has expired and was automatically submitted.', 403);
      }

      const response = {
        success: true,
        resumed: true,
        session_id: existing.id,
        tab_switches: existing.tab_switches || 0,
        max_allowed: existing.max_tab_switches || MAX_TAB_SWITCHES,
        time_left: Math.max(0, BLOCK_TIME_LIMIT_SECONDS - elapsed),
        mode: existing.mode || mode
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

      return res.status(200).json(response);
    } else {
      await supabase
        .from('user_quiz_sessions')
        .delete()
        .eq('id', existing.id)
        .eq('user_id', ctx.userId);
    }
  }

  const questionIds = await selectBlockQuestionIds(unit.id, blockNum, mode);

  if (!questionIds.length) {
    throw new SecurityError('No questions found for this block', 404);
  }

  const questionSetHash = hashQuestionSet(questionIds);
  const nowIso = new Date().toISOString();

  const sessionState = {
    question_ids: questionIds,
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
    question_set_hash: questionSetHash
  };

  const { data: insertedSession, error: insertError } = await supabase
    .from('user_quiz_sessions')
    .insert({
      user_id: ctx.userId,
      unit_id: unit.id,
      group_id: unit.groupId,
      block_number: blockNum,
      level: unit.levelName,
      topic: unit.name,
      state: sessionState,
      tab_switches: 0,
      max_tab_switches: MAX_TAB_SWITCHES,
      auto_submitted: false,
      status: 'active',
      mode,
      question_set_hash: questionSetHash,
      started_at: nowIso
    })
    .select()
    .single();

  if (insertError) {
    console.error('[QUIZ_START_SESSION_INSERT_ERROR]', JSON.stringify({
      user_id: ctx.userId,
      unit_id: unit.id,
      block_number: blockNum,
      error: insertError.message
    }));

    throw new SecurityError('Failed to create quiz session', 500);
  }

  const attemptNumber = await getNextAttemptNumber(ctx.userId, unit.id, blockNum);

  const { error: attemptError } = await supabase.rpc('atomic_create_quiz_attempt', {
    p_user_id: ctx.userId,
    p_unit_id: unit.id,
    p_group_id: unit.groupId,
    p_level_id: unit.levelId || null,
    p_session_id: insertedSession.id,
    p_block_number: blockNum,
    p_attempt_number: attemptNumber,
    p_status: 'active',
    p_started_at: nowIso,
    p_question_set_hash: questionSetHash,
    p_total_questions: questionIds.length
  });

  if (attemptError) {
    console.error('[QUIZ_START_ATTEMPT_CREATE_ERROR]', JSON.stringify({
      user_id: ctx.userId,
      session_id: insertedSession.id,
      error: attemptError.message
    }));

    await supabase
      .from('user_quiz_sessions')
      .delete()
      .eq('id', insertedSession.id)
      .eq('user_id', ctx.userId);

    throw new SecurityError('Failed to create quiz attempt', 500);
  }

  const response = {
    success: true,
    resumed: false,
    session_id: insertedSession.id,
    tab_switches: 0,
    max_allowed: MAX_TAB_SWITCHES,
    time_left: BLOCK_TIME_LIMIT_SECONDS,
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

  return res.status(200).json(response);
}

async function getUnitWithValidation(ctx, unitId, blockNumber) {
  const scope = await getUserCurriculumScope(ctx.userId);

  if (!scope?.active_group_id) {
    throw new SecurityError('Your curriculum context is not set.', 403);
  }

  const { data: unit, error } = await supabase
    .from('curriculum_units')
    .select('id, name, group_id, topic_image_url, curriculum_groups!inner(level_id, name, curriculum_levels(id, display_name, unit_label, group_label, icon, color))')
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

    throw new SecurityError('Unable to validate quiz unit', 500);
  }

  if (!unit) {
    throw new SecurityError('Unit not found or not available in your curriculum.', 404);
  }

  if (blockNumber !== null) {
    const { data: authUser } = await supabase.auth.admin.getUserById(ctx.userId);
    const access = await checkUnitBlockAccess(
      authUser?.user?.email || null,
      ctx.userId,
      unit.id,
      blockNumber
    );

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
    topicImageUrl: unit.topic_image_url || null,
    level
  };
}

async function getSession(ctx, unitId, blockNumber) {
  const { data, error } = await supabase
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

    throw new SecurityError('Unable to load quiz session', 500);
  }

  return data || null;
}

async function getIntegrityLock(userId, unitId, blockNumber) {
  const { data, error } = await supabase
    .from('quiz_security_logs')
    .select('id, event_type, details, created_at')
    .eq('user_id', userId)
    .in('event_type', INTEGRITY_EVENTS)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    console.error('[QUIZ_INTEGRITY_LOCK_LOOKUP_ERROR]', JSON.stringify({
      user_id: userId,
      unit_id: unitId,
      block_number: blockNumber,
      error: error.message
    }));

    throw new SecurityError('Unable to verify quiz integrity status', 500);
  }

  const now = Date.now();
  let latestViolation = null;

  for (const row of data || []) {
    const details = row.details && typeof row.details === 'object' ? row.details : {};

    if (row.event_type === 'time_limit_auto_submit' && details.no_lock === true) {
      continue;
    }

    const loggedUnitId = details.unit_id || details.unitId || null;
    const loggedBlock = details.block_number ?? details.blockNumber ?? null;

    if (!loggedUnitId || !loggedBlock) {
      continue;
    }

    if (String(loggedUnitId) !== String(unitId)) {
      continue;
    }

    if (Number(loggedBlock) !== Number(blockNumber)) {
      continue;
    }

    const created = new Date(row.created_at).getTime();

    if (!Number.isFinite(created)) {
      continue;
    }

    if (now - created >= INTEGRITY_LOCK_HOURS * 60 * 60 * 1000) {
      continue;
    }

    latestViolation = { ...row, createdMs: created };
    break;
  }

  if (!latestViolation) {
    return { locked: false, hoursLeft: 0, locked_until: null };
  }

  const lockedUntilMs = latestViolation.createdMs + INTEGRITY_LOCK_HOURS * 60 * 60 * 1000;
  const remainingMs = Math.max(0, lockedUntilMs - now);
  const hoursLeft = Math.max(1, Math.ceil(remainingMs / (60 * 60 * 1000)));

  return {
    locked: true,
    hoursLeft,
    locked_until: new Date(lockedUntilMs).toISOString(),
    event_type: latestViolation.event_type,
    violation_id: latestViolation.id
  };
}

function secondsElapsed(session) {
  const startedStr =
    session.state?.started_at ||
    session.started_at ||
    session.created_at ||
    session.updated_at;

  const started = new Date(startedStr).getTime();

  if (!Number.isFinite(started)) {
    return 0;
  }

  return Math.max(0, Math.floor((Date.now() - started) / 1000));
}

function getSessionQuestionIds(session) {
  if (Array.isArray(session.state?.question_ids) && session.state.question_ids.length) {
    return session.state.question_ids.map((id) => Number(id)).filter(Number.isInteger);
  }

  if (Array.isArray(session.question_ids) && session.question_ids.length) {
    return session.question_ids.map((id) => Number(id)).filter(Number.isInteger);
  }

  if (Array.isArray(session.all_question_ids) && session.all_question_ids.length) {
    return session.all_question_ids.map((id) => Number(id)).filter(Number.isInteger);
  }

  return [];
}

async function expireSession(ctx, unit, blockNumber, session, reason) {
  const now = new Date().toISOString();

  const updatedState = {
    ...(session.state && typeof session.state === 'object' ? session.state : {}),
    auto_submitted_at: now,
    auto_submit_reason: reason,
    session_status: 'auto_submitted'
  };

  const { error: sessionError } = await supabase
    .from('user_quiz_sessions')
    .update({
      auto_submitted: true,
      status: 'submitted',
      state: updatedState,
      updated_at: now
    })
    .eq('id', session.id)
    .eq('user_id', ctx.userId);

  if (sessionError) {
    console.error('[QUIZ_EXPIRE_SESSION_ERROR]', JSON.stringify({
      user_id: ctx.userId,
      session_id: session.id,
      error: sessionError.message
    }));

    throw new SecurityError('Unable to expire quiz session', 500);
  }

  const { data: activeAttempt } = await supabase
    .from('quiz_attempts')
    .select('id')
    .eq('user_id', ctx.userId)
    .eq('session_id', session.id)
    .eq('status', 'active')
    .maybeSingle();

  if (activeAttempt) {
    const { error: finalizeError } = await supabase.rpc('atomic_finalize_quiz_attempt', {
      p_attempt_id: activeAttempt.id,
      p_user_id: ctx.userId,
      p_score: 0,
      p_total_questions: getSessionQuestionIds(session).length,
      p_percentage: 0,
      p_passed: false,
      p_xp_earned: 0,
      p_time_taken: secondsElapsed(session),
      p_auto_submitted: true,
      p_auto_submit_reason: reason,
      p_tab_switches: session.tab_switches || 0
    });

    if (finalizeError) {
      console.error('[QUIZ_EXPIRE_ATTEMPT_ERROR]', JSON.stringify({
        user_id: ctx.userId,
        attempt_id: activeAttempt.id,
        error: finalizeError.message
      }));
    }
  }

  if (reason === 'tab_switch') {
    const { error: securityError } = await supabase
      .from('quiz_security_logs')
      .insert({
        user_id: ctx.userId,
        event_type: 'tab_switch_auto_submit',
        details: {
          unit_id: unit.id,
          block_number: blockNumber,
          reason,
          session_id: session.id,
          max_allowed: MAX_TAB_SWITCHES,
          created_at: now
        }
      });

    if (securityError) {
      console.error('[QUIZ_SECURITY_LOG_ERROR]', JSON.stringify({
        user_id: ctx.userId,
        session_id: session.id,
        error: securityError.message
      }));
    }
  } else {
    const { error: securityError } = await supabase
      .from('quiz_security_logs')
      .insert({
        user_id: ctx.userId,
        event_type: 'time_limit_auto_submit',
        details: {
          unit_id: unit.id,
          block_number: blockNumber,
          reason,
          session_id: session.id,
          max_allowed: MAX_TAB_SWITCHES,
          created_at: now,
          no_lock: true
        }
      });

    if (securityError) {
      console.error('[QUIZ_SECURITY_LOG_ERROR]', JSON.stringify({
        user_id: ctx.userId,
        session_id: session.id,
        error: securityError.message
      }));
    }
  }

  const { error: eventError } = await supabase
    .from('quiz_session_events')
    .insert({
      session_id: session.id,
      user_id: ctx.userId,
      event_type: 'session_expired',
      metadata: {
        reason,
        unit_id: unit.id,
        block_number: blockNumber
      }
    });

  if (eventError) {
    console.error('[QUIZ_SESSION_EVENT_ERROR]', JSON.stringify({
      user_id: ctx.userId,
      session_id: session.id,
      error: eventError.message
    }));
  }

  try {
    await createNotification(ctx.userId, 'quiz_auto_submitted', {
      topic_name: unit.name,
      block_number: blockNumber + 1
    });
  } catch (err) {
    console.error('[QUIZ_AUTO_SUBMIT_NOTIFICATION_ERROR]', JSON.stringify({
      user_id: ctx.userId,
      error: err.message
    }));
  }
}

async function selectBlockQuestionIds(unitId, blockNumber, mode) {
  const { data, error } = await supabase
    .from('quiz_questions')
    .select('id, version')
    .eq('unit_id', unitId)
    .eq('status', 'published')
    .eq('is_active', true)
    .order('id', { ascending: true });

  if (error) {
    console.error('[QUIZ_QUESTION_SELECTION_ERROR]', JSON.stringify({
      unit_id: unitId,
      block_number: blockNumber,
      error: error.message
    }));

    throw new SecurityError('Unable to load quiz questions', 500);
  }

  if (!data?.length) {
    return [];
  }

  const offset = blockNumber * SESSION_LENGTH;
  const selected = data.slice(offset, offset + SESSION_LENGTH);

  if (mode === 'exam') {
    for (let i = selected.length - 1; i > 0; i--) {
      const j = crypto.randomInt(0, i + 1);

      [selected[i], selected[j]] = [selected[j], selected[i]];
    }
  }

  return selected.map((item) => Number(item.id));
}

function hashQuestionSet(questionIds) {
  const normalized = questionIds
    .map((id) => Number(id))
    .sort((a, b) => a - b);

  return crypto
    .createHash('sha256')
    .update(normalized.join(','))
    .digest('hex');
}

async function getNextAttemptNumber(userId, unitId, blockNumber) {
  const { count, error } = await supabase
    .from('quiz_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('unit_id', unitId)
    .eq('block_number', blockNumber);

  if (error) {
    console.error('[QUIZ_ATTEMPT_NUMBER_ERROR]', JSON.stringify({
      user_id: userId,
      unit_id: unitId,
      block_number: blockNumber,
      error: error.message
    }));

    throw new SecurityError('Unable to determine quiz attempt number', 500);
  }

  return (count || 0) + 1;
}

function formatSessionResponse(res, session) {
  const elapsed = secondsElapsed(session);

  return res.status(200).json({
    exists: true,
    session: {
      session_id: session.id,
      level: session.level,
      topic: session.topic,
      block_number: session.block_number,
      tab_switches: session.tab_switches || 0,
      max_allowed: session.max_tab_switches || MAX_TAB_SWITCHES,
      remaining: Math.max(
        0,
        (session.max_tab_switches || MAX_TAB_SWITCHES) - (session.tab_switches || 0)
      ),
      auto_submitted: session.auto_submitted || false,
      time_left: Math.max(0, BLOCK_TIME_LIMIT_SECONDS - elapsed),
      updated_at: session.updated_at,
      mode: session.mode || 'study'
    }
  });
}
