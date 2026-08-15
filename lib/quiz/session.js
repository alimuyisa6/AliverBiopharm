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

export async function getQuizTopics(req, res, ctx) {
  requireAuth(ctx);

  const { unit_id } = req.query;

  if (!unit_id) throw new SecurityError('unit_id required', 400);

  const unit = await getUnitWithValidation(ctx, unit_id, null);

  const { count: questionCount } = await supabase
    .from('quiz_questions')
    .select('id', { count: 'exact', head: true })
    .eq('unit_id', unit.id)
    .eq('status', 'published')
    .eq('is_active', true);

  const totalBlocks = questionCount ? Math.ceil(questionCount / SESSION_LENGTH) : 0;

  const { data: activity } = await supabase
    .from('quiz_attempts')
    .select('block_number, submitted_at')
    .eq('user_id', ctx.userId)
    .eq('unit_id', unit.id)
    .eq('status', 'passed');

  const completedBlocks = [...new Set((activity || []).map((item) => item.block_number))];
  const now = Date.now();

  const lockedBlocks = (activity || [])
    .filter((item) => now - new Date(item.submitted_at).getTime() < 24 * 60 * 60 * 1000)
    .map((item) => item.block_number);

  return res.status(200).json({
    unit_id: unit.id,
    unit_name: unit.name,
    level_id: unit.levelId,
    level: unit.level,
    total_questions: questionCount || 0,
    total_blocks: totalBlocks,
    completed_blocks: completedBlocks,
    locked_blocks: lockedBlocks,
    all_done: totalBlocks > 0 && completedBlocks.length === totalBlocks
  });
}

export async function listQuizTopics(req, res, ctx) {
  requireAuth(ctx);

  const scope = await getUserCurriculumScope(ctx.userId);

  if (!scope?.active_group_id) {
    return res.status(200).json({ level: null, topics: [] });
  }

  const { data: units } = await supabase
    .from('curriculum_units')
    .select('id, name, group_id')
    .eq('group_id', scope.active_group_id)
    .eq('is_active', true)
    .order('display_order');

  if (!units?.length) {
    return res.status(200).json({ level: scope.active_level_name || null, topics: [] });
  }

  const unitIds = units.map((unit) => unit.id);

  const { data: questionRows } = await supabase
    .from('quiz_questions')
    .select('unit_id')
    .in('unit_id', unitIds)
    .eq('status', 'published')
    .eq('is_active', true);

  const countMap = new Map();

  for (const row of questionRows || []) {
    countMap.set(row.unit_id, (countMap.get(row.unit_id) || 0) + 1);
  }

  const { data: activity } = await supabase
    .from('quiz_attempts')
    .select('unit_id, block_number, submitted_at')
    .eq('user_id', ctx.userId)
    .in('unit_id', unitIds)
    .eq('status', 'passed');

  const activityByUnit = new Map();

  for (const item of activity || []) {
    if (!activityByUnit.has(item.unit_id)) activityByUnit.set(item.unit_id, []);
    activityByUnit.get(item.unit_id).push(item);
  }

  const now = Date.now();
  const topics = [];

  for (const unit of units) {
    const questionCount = countMap.get(unit.id) || 0;
    const totalBlocks = questionCount ? Math.ceil(questionCount / SESSION_LENGTH) : 0;
    const unitActivity = activityByUnit.get(unit.id) || [];
    const completedBlocks = [...new Set(unitActivity.map((item) => item.block_number))];

    const lockedBlocks = unitActivity
      .filter((item) => now - new Date(item.submitted_at).getTime() < 24 * 60 * 60 * 1000)
      .map((item) => item.block_number);

    topics.push({
      unit_id: unit.id,
      topic_name: unit.name,
      question_count: questionCount,
      total_blocks: totalBlocks,
      completed_blocks: completedBlocks,
      locked_blocks: lockedBlocks,
      all_done: totalBlocks > 0 && completedBlocks.length === totalBlocks
    });
  }

  return res.status(200).json({
    level: scope.active_level_name || null,
    topics
  });
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
  const session = await getSession(ctx, unit.id, blockNum);

  if (!session) {
    throw new SecurityError('No active quiz session. Please start this block from the Quiz page.', 403);
  }

  if (session.auto_submitted) {
    throw new SecurityError('This block was auto-submitted due to a violation and is locked.', 403);
  }

  const elapsed = secondsElapsed(session);

  if (elapsed > 600 + 15) {
    await expireSession(ctx, unit, blockNum, session, 'time_expired');
    throw new SecurityError('This quiz block has expired and was automatically submitted.', 403);
  }

  const questionIds = getSessionQuestionIds(session);

  if (!questionIds.length) {
    throw new SecurityError('Session question set missing', 500);
  }

  const { data: questions } = await supabase
    .from('quiz_questions')
    .select('id, question_text, option_a, option_b, option_c, option_d, difficulty, image_url, image_alt_text, status, version')
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

  const priorAnswers = session.state?.answers || {};
  const answeredSoFar = orderedQuestions.map((question) => priorAnswers[question.id] || null);

  const timeLeft = Math.max(0, 600 - elapsed);

  return res.status(200).json({
    questions: orderedQuestions,
    block_number: blockNum,
    prior_answers: answeredSoFar,
    time_left: timeLeft,
    tab_switches: session.tab_switches || 0,
    max_tab_switches: session.max_tab_switches || 3
  });
}

export async function checkDailyRetry(req, res, ctx) {
  requireAuth(ctx);

  const { unit_id, block_number } = req.query;

  if (!unit_id || block_number === undefined) {
    throw new SecurityError('unit_id and block_number required', 400);
  }

  const blockNum = parseInt(block_number, 10);
  const unit = await getUnitWithValidation(ctx, unit_id, blockNum);

  const { data: violation } = await supabase
    .from('quiz_security_logs')
    .select('created_at')
    .eq('user_id', ctx.userId)
    .in('event_type', ['tab_switch_auto_submit', 'time_limit_auto_submit'])
    .eq('details->>unit_id', unit_id)
    .eq('details->>block_number', String(blockNum))
    .order('created_at', { ascending: false })
    .limit(1);

  if (violation?.length) {
    const lastViolation = new Date(violation[0].created_at);
    const hoursSince = (Date.now() - lastViolation.getTime()) / (1000 * 60 * 60);
    const hoursLeft = Math.ceil(48 - hoursSince);

    if (hoursLeft > 0) {
      return res.status(200).json({
        can_retry: false,
        reason: `Integrity lock: try again in ${hoursLeft} hour(s)`,
        integrity_lock: true
      });
    }
  }

  const { data: activity } = await supabase
    .from('quiz_attempts')
    .select('submitted_at')
    .eq('user_id', ctx.userId)
    .eq('unit_id', unit.id)
    .eq('block_number', blockNum)
    .order('submitted_at', { ascending: false })
    .limit(1);

  if (activity?.length) {
    const lastAttempt = new Date(activity[0].submitted_at);
    const hoursSince = (Date.now() - lastAttempt.getTime()) / (1000 * 60 * 60);

    if (hoursSince < 24) {
      const hoursLeft = Math.ceil(24 - hoursSince);

      return res.status(200).json({
        can_retry: false,
        reason: `Try again in ${hoursLeft} hour(s)`
      });
    }
  }

  return res.status(200).json({ can_retry: true });
}

export async function getSessionStatus(req, res, ctx) {
  requireAuth(ctx);

  const { unit_id, block_number } = req.query;

  if (unit_id && block_number !== undefined) {
    const blockNum = parseInt(block_number, 10);
    const unit = await getUnitWithValidation(ctx, unit_id, null);
    const session = await getSession(ctx, unit.id, blockNum);

    if (!session) return res.status(200).json({ exists: false });

    return formatSessionResponse(res, session);
  }

  const scope = await getUserCurriculumScope(ctx.userId);

  if (!scope?.active_group_id) {
    return res.status(200).json({ exists: false });
  }

  const { data: sessions } = await supabase
    .from('user_quiz_sessions')
    .select('*')
    .eq('user_id', ctx.userId)
    .order('updated_at', { ascending: false })
    .limit(1);

  const session = sessions?.[0] || null;

  if (!session) return res.status(200).json({ exists: false });

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
    const stored = await getStoredIdempotencyResponse(ctx.userId, 'quiz_start_session', idempotency_key);

    if (stored) return res.status(200).json(stored);
  }

  const unit = await getUnitWithValidation(ctx, unit_id, blockNum);
  const existing = await getSession(ctx, unit.id, blockNum);

  if (existing) {
    if (existing.auto_submitted) {
      throw new SecurityError('Block locked due to integrity violation', 403);
    }

    const elapsed = secondsElapsed(existing);

    if (elapsed > 600 + 15) {
      await expireSession(ctx, unit, blockNum, existing, 'time_expired');
      throw new SecurityError('This quiz block has expired and was automatically submitted.', 403);
    }

    const response = {
      success: true,
      resumed: true,
      session_id: existing.id,
      tab_switches: existing.tab_switches || 0,
      max_allowed: existing.max_tab_switches || 3,
      time_left: Math.max(0, 600 - elapsed)
    };

    if (idempotency_key) {
      await createIdempotencyKey(ctx.userId, 'quiz_start_session', idempotency_key, response, 200);
    }

    return res.status(200).json(response);
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
      max_tab_switches: 3,
      auto_submitted: false,
      status: 'active',
      mode,
      question_set_hash: questionSetHash,
      started_at: nowIso
    })
    .select()
    .single();

  if (insertError) {
    console.error('[QUIZ_START] session insert error', insertError.message);
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
    console.error('[QUIZ_START] attempt create error', attemptError.message);
  }

  const response = {
    success: true,
    resumed: false,
    session_id: insertedSession.id,
    tab_switches: 0,
    max_allowed: 3,
    time_left: 600,
    mode
  };

  if (idempotency_key) {
    await createIdempotencyKey(ctx.userId, 'quiz_start_session', idempotency_key, response, 200);
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

function secondsElapsed(session) {
  const startedStr = session.state?.started_at || session.started_at || session.updated_at;
  const started = new Date(startedStr).getTime();

  return Math.floor((Date.now() - started) / 1000);
}

function getSessionQuestionIds(session) {
  if (Array.isArray(session.state?.question_ids) && session.state.question_ids.length) {
    return session.state.question_ids.map((id) => Number(id));
  }

  if (Array.isArray(session.question_ids) && session.question_ids.length) {
    return session.question_ids.map((id) => Number(id));
  }

  if (Array.isArray(session.all_question_ids) && session.all_question_ids.length) {
    return session.all_question_ids.map((id) => Number(id));
  }

  return [];
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
    .eq('id', session.id);

  await supabase.from('quiz_session_events').insert({
    session_id: session.id,
    user_id: ctx.userId,
    event_type: 'session_expired',
    metadata: { reason }
  });

  await createNotification(ctx.userId, 'quiz_auto_submitted', {
    topic_name: unit.name,
    block_number: blockNumber + 1
  });
}

async function selectBlockQuestionIds(unitId, blockNumber, mode) {
  const { data } = await supabase
    .from('quiz_questions')
    .select('id, version')
    .eq('unit_id', unitId)
    .eq('status', 'published')
    .eq('is_active', true)
    .order('id', { ascending: true });

  if (!data?.length) return [];

  const offset = blockNumber * SESSION_LENGTH;
  const selected = data.slice(offset, offset + SESSION_LENGTH);

  if (mode === 'exam') {
    selected.sort(() => Math.random() - 0.5);
  }

  return selected.map((item) => Number(item.id));
}

function hashQuestionSet(questionIds) {
  const normalized = questionIds.map((id) => Number(id)).sort((a, b) => a - b);

  return crypto
    .createHash('sha256')
    .update(normalized.join(','))
    .digest('hex');
}

async function getNextAttemptNumber(userId, unitId, blockNumber) {
  const { count } = await supabase
    .from('quiz_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('unit_id', unitId)
    .eq('block_number', blockNumber);

  return (count || 0) + 1;
}

function formatSessionResponse(res, session) {
  return res.status(200).json({
    exists: true,
    session: {
      session_id: session.id,
      level: session.level,
      topic: session.topic,
      block_number: session.block_number,
      tab_switches: session.tab_switches || 0,
      max_allowed: session.max_tab_switches || 3,
      remaining: (session.max_tab_switches || 3) - (session.tab_switches || 0),
      auto_submitted: session.auto_submitted || false,
      time_left: Math.max(0, 600 - secondsElapsed(session)),
      updated_at: session.updated_at,
      mode: session.mode || 'study'
    }
  });
}
