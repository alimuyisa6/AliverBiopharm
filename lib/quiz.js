import { supabase, addXp, recordPlatformActivity } from './core.js';
import {
  parseAndValidateBody,
  requireAuth,
  requireAdmin,
  SecurityError,
} from './security-middleware.js';
import { createNotification } from './notifications.js';
import { getUserCurriculumScope } from './curriculum.js';
import { checkUnitBlockAccess } from './premium.js';

const INTEGRITY_LOCK_HOURS = 48;
const STANDARD_LOCK_HOURS = 24;
const BLOCK_TIME_LIMIT_SECONDS = 600;
const BLOCK_TIME_GRACE_SECONDS = 15;

export async function handler(req, res, path, ctx) {
  if (req.method === 'GET') {
    requireAuth(ctx);
    switch (path) {
      case 'get_quiz_topics':      return getTopics(req, res, ctx);
      case 'get_quiz_block':       return getBlock(req, res, ctx);
      case 'check_daily_retry':    return checkDailyRetry(req, res, ctx);
      case 'quiz_session_status':  return getSessionStatus(req, res, ctx);
      default: throw new SecurityError('Invalid action', 400);
    }
  }

  if (req.method === 'POST') {
    const body = await parseAndValidateBody(req);
    switch (path) {
      case 'quiz_start_session':        requireAuth(ctx); return startSession(body, res, ctx);
      case 'quiz_check_answer':         requireAuth(ctx); return checkAnswer(body, res, ctx);
      case 'quiz_tab_switch':           requireAuth(ctx); return trackTabSwitch(body, res, ctx);
      case 'quiz_submit_with_session':  requireAuth(ctx); return submitWithSession(body, res, ctx);
      case 'add_quiz_questions_batch':  requireAdmin(ctx); return addQuestionsBatch(body, res);
      default: throw new SecurityError('Invalid action', 400);
    }
  }

  throw new SecurityError('Method not allowed', 405);
}

// ---------- helpers ----------

async function getUnitWithValidation(ctx, unitId, blockNumber = null) {
  const scope = await getUserCurriculumScope(ctx.userId);
  if (!scope || !scope.active_group_id) {
    throw new SecurityError('Your curriculum context is not set.', 403);
  }

  const { data: unit } = await supabase
    .from('curriculum_units')
    .select('id, name, group_id, curriculum_groups(level_id, curriculum_levels(id, display_name, unit_label, group_label, icon, color))')
    .eq('id', unitId)
    .eq('group_id', scope.active_group_id)
    .eq('is_active', true)
    .maybeSingle();

  if (!unit) throw new SecurityError('Unit not found or not available in your curriculum.', 404);

  if (blockNumber !== null) {
    const { data: { user } } = await supabase.auth.admin.getUserById(ctx.userId);
    const access = await checkUnitBlockAccess(user?.email || null, ctx.userId, unit.id, blockNumber);
    if (!access.allowed) {
      if (access.reason === 'restricted') throw new SecurityError('Your access to this content has been restricted.', 403);
      throw new SecurityError('This block requires premium access.', 403);
    }
  }

  const level = unit.curriculum_groups?.curriculum_levels || null;

  return {
    id: unit.id,
    name: unit.name,
    levelId: level?.id || null,
    levelName: level?.display_name || null,
    level,
  };
}

async function getSession(ctx, unit, blockNum) {
  const { data: session, error } = await supabase
    .from('user_quiz_sessions')
    .select('*')
    .eq('user_id', ctx.userId)
    .eq('level', unit.levelName)
    .eq('topic', unit.name)
    .eq('block_number', blockNum)
    .maybeSingle();
  if (error) throw new SecurityError('Failed to verify quiz session', 500);
  return session;
}

function secondsElapsed(session) {
  const started = new Date(session.started_at || session.created_at).getTime();
  return Math.floor((Date.now() - started) / 1000);
}

async function computeTopicPerformance(userId, levelName, topic) {
  const { data } = await supabase
    .from('user_quiz_activity')
    .select('percentage, passed, completed_at')
    .eq('user_id', userId)
    .eq('level', levelName)
    .eq('topic', topic)
    .order('completed_at', { ascending: false })
    .limit(5);
  if (!data || data.length === 0) return null;
  const avgPercentage = Math.round(data.reduce((sum, a) => sum + (a.percentage || 0), 0) / data.length);
  const passRate = Math.round((data.filter(a => a.passed).length / data.length) * 100);
  return { avg_percentage: avgPercentage, pass_rate: passRate, attempts_considered: data.length };
}

async function autoSubmitForTimeout(ctx, unit, blockNum, session) {
  const updatedState = {
    ...(typeof session.state === 'object' ? session.state : {}),
    auto_submitted_at: new Date().toISOString(),
    auto_submit_reason: 'time_expired',
  };

  await supabase
    .from('user_quiz_sessions')
    .update({
      auto_submitted: true,
      state: updatedState,
      updated_at: new Date().toISOString(),
    })
    .eq('id', session.id);

  await supabase.from('quiz_security_logs').insert({
    user_id: ctx.userId,
    event_type: 'time_limit_auto_submit',
    details: { unit_id: unit.id, block_number: blockNum },
  });

  await createNotification(ctx.userId, 'quiz_auto_submitted', {
    topic_name: unit.name,
    block_number: blockNum + 1,
  });
}

// ---------- endpoints ----------

async function getTopics(req, res, ctx) {
  const { unit_id } = req.query;
  if (!unit_id) throw new SecurityError('unit_id required', 400);

  const unit = await getUnitWithValidation(ctx, unit_id);

  const { count: questionCount, error: countError } = await supabase
    .from('quiz_questions')
    .select('id', { count: 'exact', head: true })
    .eq('unit_id', unit.id)
    .eq('is_active', true);
  if (countError) throw new SecurityError('Failed to count questions', 500);

  const totalBlocks = questionCount ? Math.ceil(questionCount / 10) : 0;

  let completedBlocks = [];
  let lockedBlocks = [];

  const { data: activity } = await supabase
    .from('user_quiz_activity')
    .select('block_number, passed, completed_at')
    .eq('user_id', ctx.userId)
    .eq('level', unit.levelName)
    .eq('topic', unit.name);

  if (activity) {
    completedBlocks = activity.map(a => a.block_number);
    const now = Date.now();
    lockedBlocks = activity
      .filter(a => {
        const completedAt = new Date(a.completed_at);
        return (now - completedAt) < STANDARD_LOCK_HOURS * 60 * 60 * 1000;
      })
      .map(a => a.block_number);
  }

  const performance = await computeTopicPerformance(ctx.userId, unit.levelName, unit.name);

  return res.status(200).json({
    unit_id: unit.id,
    unit_name: unit.name,
    level_id: unit.levelId,
    level: unit.level,
    total_questions: questionCount || 0,
    total_blocks: totalBlocks,
    completed_blocks: completedBlocks,
    locked_blocks: lockedBlocks,
    all_done: totalBlocks > 0 && completedBlocks.length === totalBlocks,
    performance,
  });
}

async function getBlock(req, res, ctx) {
  const { unit_id, block_number } = req.query;
  if (!unit_id || block_number === undefined) throw new SecurityError('unit_id and block_number required', 400);

  const blockNum = parseInt(block_number);
  const unit = await getUnitWithValidation(ctx, unit_id, blockNum);

  const session = await getSession(ctx, unit, blockNum);
  if (!session) throw new SecurityError('No active quiz session. Please start this block from the Quiz page.', 403);
  if (session.auto_submitted) throw new SecurityError('This block was auto-submitted due to a violation and is locked.', 403);

  const offset = blockNum * 10;
  const { data: questions, error } = await supabase
    .from('quiz_questions')
    .select('id, question_text, option_a, option_b, option_c, option_d, difficulty, image_url')
    .eq('unit_id', unit.id)
    .eq('is_active', true)
    .order('id', { ascending: true })
    .range(offset, offset + 9);

  if (error) throw new SecurityError('Failed to fetch questions', 500);
  if (!questions || questions.length === 0) throw new SecurityError('No questions found for this block', 404);

  const priorAnswers = (typeof session.state === 'object' && session.state?.answers) || {};
  const answeredSoFar = questions.map(q => priorAnswers[q.id] || null);

  const elapsed = secondsElapsed(session);
  const timeLeft = Math.max(0, BLOCK_TIME_LIMIT_SECONDS - elapsed);

  return res.status(200).json({
    questions,
    block_number: blockNum,
    prior_answers: answeredSoFar,
    time_left: timeLeft,
    tab_switches: session.tab_switches || 0,
    max_tab_switches: session.max_tab_switches || 3,
  });
}

async function checkDailyRetry(req, res, ctx) {
  const { unit_id, block_number } = req.query;
  if (!unit_id || block_number === undefined) throw new SecurityError('unit_id and block_number required', 400);

  const blockNum = parseInt(block_number);
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

  if (violation && violation.length > 0) {
    const lastViolation = new Date(violation[0].created_at);
    const hoursSince = (Date.now() - lastViolation) / (1000 * 60 * 60);
    const hoursLeft = Math.ceil(INTEGRITY_LOCK_HOURS - hoursSince);
    if (hoursLeft > 0) {
      return res.status(200).json({
        can_retry: false,
        reason: `Integrity lock: try again in ${hoursLeft} hour(s)`,
        integrity_lock: true,
      });
    }
  }

  const { data: activity } = await supabase
    .from('user_quiz_activity')
    .select('completed_at')
    .eq('user_id', ctx.userId)
    .eq('level', unit.levelName)
    .eq('topic', unit.name)
    .eq('block_number', blockNum)
    .order('completed_at', { ascending: false })
    .limit(1);

  if (activity && activity.length > 0) {
    const lastAttempt = new Date(activity[0].completed_at);
    const hoursSince = (Date.now() - lastAttempt) / (1000 * 60 * 60);
    if (hoursSince < STANDARD_LOCK_HOURS) {
      const hoursLeft = Math.ceil(STANDARD_LOCK_HOURS - hoursSince);
      return res.status(200).json({ can_retry: false, reason: `Try again in ${hoursLeft} hour(s)` });
    }
  }

  return res.status(200).json({ can_retry: true });
}

async function getSessionStatus(req, res, ctx) {
  const { unit_id, block_number } = req.query;

  if (unit_id && block_number !== undefined) {
    const unit = await getUnitWithValidation(ctx, unit_id);
    const blockNum = parseInt(block_number);
    const session = await getSession(ctx, unit, blockNum);
    if (!session) return res.status(200).json({ exists: false });
    return formatSessionResponse(res, session);
  }

  const scope = await getUserCurriculumScope(ctx.userId);
  const levelName = scope?.active_level_name;
  if (!levelName) return res.status(200).json({ exists: false });

  const { data: sessions } = await supabase
    .from('user_quiz_sessions')
    .select('*')
    .eq('user_id', ctx.userId)
    .eq('level', levelName)
    .order('updated_at', { ascending: false })
    .limit(1);

  const session = sessions?.[0] || null;
  if (!session) return res.status(200).json({ exists: false });
  return formatSessionResponse(res, session);
}

function formatSessionResponse(res, session) {
  return res.status(200).json({
    exists: true,
    session: {
      level: session.level,
      topic: session.topic,
      block_number: session.block_number,
      tab_switches: session.tab_switches || 0,
      max_allowed: session.max_tab_switches || 3,
      remaining: (session.max_tab_switches || 3) - (session.tab_switches || 0),
      auto_submitted: session.auto_submitted || false,
      time_left: Math.max(0, BLOCK_TIME_LIMIT_SECONDS - secondsElapsed(session)),
      updated_at: session.updated_at,
    },
  });
}

async function startSession(body, res, ctx) {
  const { unit_id, block_number } = body;
  if (!unit_id || block_number === undefined) throw new SecurityError('unit_id and block_number required', 400);

  const blockNum = parseInt(block_number);
  const unit = await getUnitWithValidation(ctx, unit_id, blockNum);

  const existing = await getSession(ctx, unit, blockNum);

  if (existing) {
    if (existing.auto_submitted) throw new SecurityError('Block locked due to integrity violation', 403);
    return res.status(200).json({
      success: true,
      resumed: true,
      tab_switches: existing.tab_switches || 0,
      max_allowed: existing.max_tab_switches || 3,
      time_left: Math.max(0, BLOCK_TIME_LIMIT_SECONDS - secondsElapsed(existing)),
    });
  }

  const nowIso = new Date().toISOString();
  await supabase.from('user_quiz_sessions').insert({
    user_id: ctx.userId,
    block_number: blockNum,
    level: unit.levelName,
    topic: unit.name,
    state: {},
    tab_switches: 0,
    max_tab_switches: 3,
    auto_submitted: false,
    started_at: nowIso,
  });

  return res.status(200).json({
    success: true,
    resumed: false,
    tab_switches: 0,
    max_allowed: 3,
    time_left: BLOCK_TIME_LIMIT_SECONDS,
  });
}

async function checkAnswer(body, res, ctx) {
  const { unit_id, block_number, question_id, selected_option } = body;
  if (!unit_id || block_number === undefined || !question_id || !selected_option) {
    throw new SecurityError('unit_id, block_number, question_id, selected_option required', 400);
  }

  const blockNum = parseInt(block_number);
  const unit = await getUnitWithValidation(ctx, unit_id, blockNum);
  const session = await getSession(ctx, unit, blockNum);
  if (!session) throw new SecurityError('No active quiz session', 403);
  if (session.auto_submitted) throw new SecurityError('This block is locked', 403);

  if (secondsElapsed(session) > BLOCK_TIME_LIMIT_SECONDS + BLOCK_TIME_GRACE_SECONDS) {
    await autoSubmitForTimeout(ctx, unit, blockNum, session);
    return res.status(200).json({ success: false, auto_submitted: true, reason: 'time_expired' });
  }

  const offset = blockNum * 10;
  const { data: questions } = await supabase
    .from('quiz_questions')
    .select('id, option_a, option_b, option_c, option_d, correct_option, times_answered, times_correct')
    .eq('unit_id', unit.id)
    .eq('is_active', true)
    .order('id', { ascending: true })
    .range(offset, offset + 9);

  const question = (questions || []).find(q => q.id === question_id);
  if (!question) throw new SecurityError('Question not found in this block', 404);

  const state = typeof session.state === 'object' ? session.state : {};
  if (state.answers?.[question_id]) {
    const prior = state.answers[question_id];
    const correctOptKey = `option_${(question.correct_option || '').toLowerCase()}`;
    return res.status(200).json({
      correct: prior.correct,
      correct_option: question.correct_option,
      correct_answer_text: question[correctOptKey],
    });
  }

  const userOption = selected_option.toUpperCase();
  const correctOption = (question.correct_option || '').toUpperCase();
  const isCorrect = userOption === correctOption;
  const correctOptKey = `option_${correctOption.toLowerCase()}`;

  const updatedState = {
    ...state,
    answers: {
      ...(state.answers || {}),
      [question_id]: { selected: userOption, correct: isCorrect },
    },
  };

  await supabase
    .from('user_quiz_sessions')
    .update({ state: updatedState, updated_at: new Date().toISOString() })
    .eq('id', session.id);

  await supabase
    .from('quiz_questions')
    .update({
      times_answered: (question.times_answered || 0) + 1,
      times_correct: (question.times_correct || 0) + (isCorrect ? 1 : 0),
    })
    .eq('id', question_id);

  return res.status(200).json({
    correct: isCorrect,
    correct_option: question.correct_option,
    correct_answer_text: question[correctOptKey],
  });
}

async function trackTabSwitch(body, res, ctx) {
  const { unit_id, block_number } = body;
  if (!unit_id || block_number === undefined) throw new SecurityError('unit_id and block_number required', 400);

  const blockNum = parseInt(block_number);
  const unit = await getUnitWithValidation(ctx, unit_id, blockNum);
  const session = await getSession(ctx, unit, blockNum);

  if (!session) throw new SecurityError('No active session found for this block', 403);
  if (session.auto_submitted) {
    return res.status(200).json({
      success: false,
      auto_submitted: true,
      message: 'This block was already auto-submitted.',
    });
  }

  const newCount = (session.tab_switches || 0) + 1;
  const maxAllowed = session.max_tab_switches || 3;

  let timestamps = [];
  if (typeof session.state === 'object' && Array.isArray(session.state?.tab_switch_timestamps)) {
    timestamps = session.state.tab_switch_timestamps;
  }
  timestamps.push(new Date().toISOString());

  if (newCount >= maxAllowed) {
    const updatedState = {
      ...(typeof session.state === 'object' ? session.state : {}),
      tab_switch_timestamps: timestamps,
      auto_submitted_at: new Date().toISOString(),
      auto_submit_reason: 'tab_switch',
    };

    await supabase
      .from('user_quiz_sessions')
      .update({
        tab_switches: newCount,
        auto_submitted: true,
        state: updatedState,
        updated_at: new Date().toISOString(),
      })
      .eq('id', session.id);

    await supabase.from('quiz_security_logs').insert({
      user_id: ctx.userId,
      event_type: 'tab_switch_auto_submit',
      details: {
        unit_id,
        block_number: blockNum,
        tab_switches: newCount,
        max_allowed: maxAllowed,
      },
    });

    await createNotification(ctx.userId, 'quiz_auto_submitted', {
      topic_name: session.topic || '',
      block_number: blockNum + 1,
    });

    return res.status(200).json({
      success: false,
      auto_submitted: true,
      message: `Your quiz was auto-submitted after ${newCount} tab switches. Locked for ${INTEGRITY_LOCK_HOURS} hours.`,
      tab_switches: newCount,
      max_allowed: maxAllowed,
      redirect_after_seconds: 10,
    });
  }

  const updatedState = {
    ...(typeof session.state === 'object' ? session.state : {}),
    tab_switch_timestamps: timestamps,
    last_tab_switch: new Date().toISOString(),
  };

  await supabase
    .from('user_quiz_sessions')
    .update({
      tab_switches: newCount,
      state: updatedState,
      updated_at: new Date().toISOString(),
    })
    .eq('id', session.id);

  await supabase.from('quiz_security_logs').insert({
    user_id: ctx.userId,
    event_type: 'tab_switch',
    details: {
      unit_id,
      block_number: blockNum,
      tab_switches: newCount,
      remaining: maxAllowed - newCount,
    },
  });

  return res.status(200).json({
    success: true,
    tab_switches: newCount,
    max_allowed: maxAllowed,
    remaining: maxAllowed - newCount,
  });
}

async function submitWithSession(body, res, ctx) {
  const { unit_id, block_number, answers } = body;
  if (!unit_id || block_number === undefined || !answers) {
    throw new SecurityError('unit_id, block_number, answers required', 400);
  }

  const blockNum = parseInt(block_number);
  const unit = await getUnitWithValidation(ctx, unit_id, blockNum);
  const session = await getSession(ctx, unit, blockNum);
  if (!session) throw new SecurityError('No active quiz session', 403);

  const wasAutoSubmitted = !!session.auto_submitted;
  const timeTaken = secondsElapsed(session);
  const timedOut = !wasAutoSubmitted && timeTaken > BLOCK_TIME_LIMIT_SECONDS + BLOCK_TIME_GRACE_SECONDS;

  const offset = blockNum * 10;
  const { data: questions } = await supabase
    .from('quiz_questions')
    .select('id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation')
    .eq('unit_id', unit.id)
    .eq('is_active', true)
    .order('id', { ascending: true })
    .range(offset, offset + 9);

  if (!questions || questions.length === 0) throw new SecurityError('Questions not found for this block', 404);

  const priorAnswers = (typeof session.state === 'object' && session.state?.answers) || {};

  let score = 0;
  const reviewAnswers = questions.map((q, idx) => {
    const fromSession = priorAnswers[q.id];
    const submitted = answers[idx] || {};
    const userOption = (fromSession?.selected || submitted.selectedOption || '').toUpperCase();
    const correctOption = (q.correct_option || '').toUpperCase();
    const isCorrect = userOption === correctOption;
    if (isCorrect) score++;
    const optKey = `option_${correctOption.toLowerCase()}`;
    const userOptKey = `option_${userOption.toLowerCase()}`;
    return {
      question: q.question_text,
      userAnswerText: q[userOptKey] || userOption || 'No answer',
      correctAnswerText: q[optKey] || correctOption,
      isCorrect,
      explanation: q.explanation || '',
    };
  });

  const total = questions.length;
  const percentage = Math.round((score / total) * 100);
  const passed = !wasAutoSubmitted && !timedOut && percentage >= 70;
  const autoSubmitted = wasAutoSubmitted || timedOut;

  await supabase.from('user_quiz_activity').insert({
    user_id: ctx.userId,
    level: session.level,
    topic: session.topic,
    block_number: blockNum,
    score,
    total_possible: total,
    total_questions: total,
    percentage,
    passed,
    answers: reviewAnswers,
    time_taken: timeTaken,
    completed_at: new Date().toISOString(),
  });

  await supabase.from('user_quiz_sessions').delete().eq('id', session.id);

  const xpEarned = autoSubmitted ? 0 : (passed ? Math.round(10 + (percentage / 10)) : 5);

  if (xpEarned > 0) {
    await Promise.all([
      addXp(ctx.userId, xpEarned, 'quiz_block', 'quiz', { unit_id: unit.id, topic: unit.name, block_number: blockNum }),
      recordPlatformActivity(ctx.userId),
    ]);
  }

  if (timedOut) {
    await supabase.from('quiz_security_logs').insert({
      user_id: ctx.userId,
      event_type: 'time_limit_auto_submit',
      details: { unit_id: unit.id, block_number: blockNum },
    });
  }

  if (autoSubmitted) {
    return res.status(200).json({
      success: true,
      auto_submitted: true,
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
        : `Auto-submitted: time limit exceeded. Locked for ${INTEGRITY_LOCK_HOURS}h.`,
    });
  }

  if (passed) {
    await createNotification(ctx.userId, 'quiz_passed', { topic_name: session.topic, score: percentage });
  } else {
    await createNotification(ctx.userId, 'quiz_failed', { topic_name: session.topic, score: percentage });
  }

  const { count: totalQuestions } = await supabase
    .from('quiz_questions')
    .select('id', { count: 'exact', head: true })
    .eq('unit_id', unit.id)
    .eq('is_active', true);
  const expectedBlocks = Math.ceil((totalQuestions || 0) / 10);

  const { data: allBlocks } = await supabase
    .from('user_quiz_activity')
    .select('block_number')
    .eq('user_id', ctx.userId)
    .eq('level', session.level)
    .eq('topic', session.topic);

  const completedBlockSet = new Set((allBlocks || []).map(a => a.block_number));
  if (completedBlockSet.size >= expectedBlocks && expectedBlocks > 0) {
    await createNotification(ctx.userId, 'quiz_topic_mastered', { topic_name: session.topic });
  }

  return res.status(200).json({
    success: true,
    auto_submitted: false,
    score,
    total,
    percentage,
    passed,
    xp_earned: xpEarned,
    answers: reviewAnswers,
    tab_switches: session.tab_switches || 0,
    max_allowed: session.max_tab_switches || 3,
  });
}

async function addQuestionsBatch(body, res) {
  const { unit_id, questions } = body;
  if (!unit_id || !Array.isArray(questions)) throw new SecurityError('unit_id and questions array required', 400);

  const { data: unit } = await supabase
    .from('curriculum_units')
    .select('id')
    .eq('id', unit_id)
    .maybeSingle();
  if (!unit) throw new SecurityError('Curriculum unit not found', 404);

  const rows = questions.map(q => ({
    unit_id,
    question_text: q.question_text,
    option_a: q.option_a,
    option_b: q.option_b,
    option_c: q.option_c,
    option_d: q.option_d,
    correct_option: q.correct_option,
    explanation: q.explanation || '',
    difficulty: q.difficulty || 'medium',
    image_url: q.image_url || null,
  }));

  const { error } = await supabase.from('quiz_questions').insert(rows);
  if (error) throw new SecurityError('Failed to add questions', 500);
  return res.status(200).json({ inserted: rows.length });
}
