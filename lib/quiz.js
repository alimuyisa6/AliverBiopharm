 import { supabase, addXp, canAccessLevel, isAdmin } from './core.js';
import { parseAndValidateBody, requireAuth, SecurityError } from './security-middleware.js';
import { createNotification } from './notifications.js';

const INTEGRITY_LOCK_HOURS = 48;
const STANDARD_LOCK_HOURS = 24;

export async function handler(req, res, path, ctx) {
  const publicPaths = ['get_quiz_topics'];
  if (!publicPaths.includes(path)) requireAuth(ctx);

  if (req.method === 'GET') {
    switch (path) {
      case 'get_quiz_topics': return getTopics(req, res, ctx.userId);
      case 'get_quiz_block': return getBlock(req, res, ctx.userId);
      case 'check_daily_retry': return checkDailyRetry(req, res, ctx.userId);
      case 'quiz_session_status': return getSessionStatus(req, res, ctx.userId);
      default: throw new SecurityError('Invalid path', 400);
    }
  }

  if (req.method === 'POST') {
    const body = await parseAndValidateBody(req);
    switch (path) {
      case 'quiz_start_session': return startSession(body, res, ctx.userId);
      case 'quiz_tab_switch': return trackTabSwitch(body, res, ctx.userId);
      case 'quiz_submit_with_session': return submitWithSession(body, res, ctx.userId);
      case 'add_quiz_questions_batch': return addQuestionsBatch(body, res);
      default: throw new SecurityError('Invalid path', 400);
    }
  }

  throw new SecurityError('Method not allowed', 405);
}

async function resolveUnit(unit_id) {
  const { data: unit } = await supabase
    .from('curriculum_units')
    .select('id, name, group_id, curriculum_groups(level_id)')
    .eq('id', unit_id)
    .maybeSingle();
  if (!unit) return null;
  return { id: unit.id, name: unit.name, levelId: unit.curriculum_groups?.level_id || null };
}

async function getTopics(req, res, userId) {
  const { unit_id } = req.query;
  if (!unit_id) throw new SecurityError('unit_id required', 400);

  const unit = await resolveUnit(unit_id);
  if (!unit) throw new SecurityError('Unit not found', 404);
  const levelId = unit.levelId;

  if (userId) {
    const canAccess = await canAccessLevel(userId, levelId);
    const admin = await isAdmin(userId, '');
    if (!admin?.admin_role && !canAccess) throw new SecurityError('Access denied', 403);
  }

  const { count: questionCount, error: countError } = await supabase
    .from('quiz_questions')
    .select('id', { count: 'exact', head: true })
    .eq('unit_id', unit_id)
    .eq('is_active', true);
  if (countError) throw new SecurityError('Failed to count questions', 500);

  const totalBlocks = questionCount ? Math.ceil(questionCount / 10) : 0;

  let completedBlocks = [], lockedBlocks = [];
  if (userId) {
    const { data: activity } = await supabase
      .from('user_quiz_activity')
      .select('block_number, passed, completed_at')
      .eq('user_id', userId)
      .eq('level', levelId)
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
  }

  return res.status(200).json({
    unit_id,
    unit_name: unit.name,
    level_id: levelId,
    total_questions: questionCount || 0,
    total_blocks: totalBlocks,
    completed_blocks: completedBlocks,
    locked_blocks: lockedBlocks
  });
}

async function getBlock(req, res, userId) {
  const { unit_id, block_number } = req.query;
  if (!unit_id || block_number === undefined) throw new SecurityError('unit_id and block_number required', 400);
  const blockNum = parseInt(block_number);
  const offset = blockNum * 10;

  const unit = await resolveUnit(unit_id);
  if (!unit) throw new SecurityError('Unit not found', 404);

  const { data: session, error: sessionError } = await supabase
    .from('user_quiz_sessions')
    .select('id, auto_submitted')
    .eq('user_id', userId)
    .eq('level', unit.levelId)
    .eq('topic', unit.name)
    .eq('block_number', blockNum)
    .maybeSingle();

  if (sessionError) throw new SecurityError('Failed to verify quiz session', 500);
  if (!session) throw new SecurityError('No active quiz session. Please start this block from the Quiz page.', 403);
  if (session.auto_submitted) throw new SecurityError('This block was auto-submitted due to a tab-switching violation and is locked.', 403);

  const { data: questions, error } = await supabase
    .from('quiz_questions')
    .select('id, question_text, option_a, option_b, option_c, option_d, difficulty, image_url')
    .eq('unit_id', unit_id)
    .eq('is_active', true)
    .order('id', { ascending: true })
    .range(offset, offset + 9);
  if (error) throw new SecurityError('Failed to fetch questions', 500);
  if (!questions || questions.length === 0) throw new SecurityError('No questions found for this block', 404);

  return res.status(200).json({ questions, block_number: blockNum });
}

async function checkDailyRetry(req, res, userId) {
  const { unit_id, block_number } = req.query;
  if (!unit_id || block_number === undefined) throw new SecurityError('unit_id and block_number required', 400);
  const blockNum = parseInt(block_number);

  const unit = await resolveUnit(unit_id);
  if (!unit) throw new SecurityError('Unit not found', 404);

  const { data: violation } = await supabase
    .from('quiz_security_logs')
    .select('created_at')
    .eq('user_id', userId)
    .eq('event_type', 'tab_switch_auto_submit')
    .eq('details->>unit_id', unit_id)
    .eq('details->>block_number', String(blockNum))
    .order('created_at', { ascending: false })
    .limit(1);

  if (violation && violation.length > 0) {
    const lastViolation = new Date(violation[0].created_at);
    const hoursSince = (Date.now() - lastViolation) / (1000 * 60 * 60);
    const hoursLeft = Math.ceil(INTEGRITY_LOCK_HOURS - hoursSince);
    return res.status(200).json({
      can_retry: false,
      reason: `Integrity lock: try again in ${hoursLeft} hour(s)`,
      integrity_lock: true
    });
  }

  const { data: activity } = await supabase
    .from('user_quiz_activity')
    .select('completed_at')
    .eq('user_id', userId)
    .eq('level', unit.levelId)
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

async function getSessionStatus(req, res, userId) {
  const { unit_id, block_number } = req.query;
  let query = supabase
    .from('user_quiz_sessions')
    .select('*')
    .eq('user_id', userId);

  if (unit_id && block_number !== undefined) {
    const unit = await resolveUnit(unit_id);
    if (!unit) throw new SecurityError('Unit not found', 404);
    query = query.eq('level', unit.levelId).eq('topic', unit.name).eq('block_number', parseInt(block_number)).maybeSingle();
  } else {
    query = query.order('updated_at', { ascending: false }).limit(1);
  }

  const { data, error } = await query;
  if (error) throw new SecurityError('Failed to fetch session', 500);
  const session = Array.isArray(data) ? data[0] : data;
  if (!session) return res.status(200).json({ exists: false });

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
      updated_at: session.updated_at
    }
  });
}

async function startSession(body, res, userId) {
  const { unit_id, block_number, state } = body;
  if (!unit_id || block_number === undefined) throw new SecurityError('unit_id and block_number required', 400);
  const blockNum = parseInt(block_number);

  const unit = await resolveUnit(unit_id);
  if (!unit) throw new SecurityError('Unit not found', 404);
  const levelId = unit.levelId;

  const canAccess = await canAccessLevel(userId, levelId);
  const admin = await isAdmin(userId, '');
  if (!admin?.admin_role && !canAccess) throw new SecurityError('Access denied', 403);

  const { data: existing } = await supabase
    .from('user_quiz_sessions')
    .select('id, auto_submitted, tab_switches')
    .eq('user_id', userId)
    .eq('level', levelId)
    .eq('topic', unit.name)
    .eq('block_number', blockNum)
    .maybeSingle();

  if (existing) {
    if (existing.auto_submitted) throw new SecurityError('Block locked due to integrity violation', 403);
    await supabase
      .from('user_quiz_sessions')
      .update({
        state: state || {},
        updated_at: new Date().toISOString()
      })
      .eq('id', existing.id);
    return res.status(200).json({
      success: true,
      resumed: true,
      tab_switches: existing.tab_switches || 0,
      max_allowed: 3
    });
  }

  await supabase
    .from('user_quiz_sessions')
    .insert({
      user_id: userId,
      block_number: blockNum,
      level: levelId,
      topic: unit.name,
      state: state || {},
      tab_switches: 0,
      max_tab_switches: 3,
      auto_submitted: false
    });

  return res.status(200).json({
    success: true,
    resumed: false,
    tab_switches: 0,
    max_allowed: 3
  });
}

async function trackTabSwitch(body, res, userId) {
  const { unit_id, block_number } = body;
  if (!unit_id || block_number === undefined) throw new SecurityError('unit_id and block_number required', 400);
  const blockNum = parseInt(block_number);

  const unit = await resolveUnit(unit_id);
  if (!unit) throw new SecurityError('Unit not found', 404);

  const { data: session } = await supabase
    .from('user_quiz_sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('level', unit.levelId)
    .eq('topic', unit.name)
    .eq('block_number', blockNum)
    .maybeSingle();

  if (!session) throw new SecurityError('No active session found for this block', 403);
  if (session.auto_submitted) {
    return res.status(200).json({
      success: false,
      auto_submitted: true,
      message: 'This block was already auto-submitted.'
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
      auto_submitted_at: new Date().toISOString()
    };

    await supabase
      .from('user_quiz_sessions')
      .update({
        tab_switches: newCount,
        auto_submitted: true,
        state: updatedState,
        updated_at: new Date().toISOString()
      })
      .eq('id', session.id);

    await supabase
      .from('quiz_security_logs')
      .insert({
        user_id: userId,
        event_type: 'tab_switch_auto_submit',
        details: {
          unit_id,
          block_number: blockNum,
          tab_switches: newCount,
          max_allowed: maxAllowed
        }
      });

    await createNotification(userId, 'quiz_auto_submitted', {
      topic_name: session.topic || '',
      block_number: blockNum + 1
    });

    return res.status(200).json({
      success: false,
      auto_submitted: true,
      message: `Your quiz was auto-submitted after ${newCount} tab switches. Locked for ${INTEGRITY_LOCK_HOURS} hours.`,
      tab_switches: newCount,
      max_allowed: maxAllowed,
      redirect_after_seconds: 10
    });
  }

  const updatedState = {
    ...(typeof session.state === 'object' ? session.state : {}),
    tab_switch_timestamps: timestamps,
    last_tab_switch: new Date().toISOString()
  };

  await supabase
    .from('user_quiz_sessions')
    .update({
      tab_switches: newCount,
      state: updatedState,
      updated_at: new Date().toISOString()
    })
    .eq('id', session.id);

  await supabase
    .from('quiz_security_logs')
    .insert({
      user_id: userId,
      event_type: 'tab_switch',
      details: {
        unit_id,
        block_number: blockNum,
        tab_switches: newCount,
        remaining: maxAllowed - newCount
      }
    });

  return res.status(200).json({
    success: true,
    tab_switches: newCount,
    max_allowed: maxAllowed,
    remaining: maxAllowed - newCount
  });
}

async function submitWithSession(body, res, userId) {
  const { unit_id, block_number, answers, time_taken } = body;
  if (!unit_id || block_number === undefined || !answers) {
    throw new SecurityError('unit_id, block_number, answers required', 400);
  }
  const blockNum = parseInt(block_number);

  const unit = await resolveUnit(unit_id);
  if (!unit) throw new SecurityError('Unit not found', 404);

  const { data: session } = await supabase
    .from('user_quiz_sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('level', unit.levelId)
    .eq('topic', unit.name)
    .eq('block_number', blockNum)
    .maybeSingle();

  if (!session) throw new SecurityError('No active quiz session', 403);

  const wasAutoSubmitted = !!session.auto_submitted;

  const offset = blockNum * 10;
  const { data: questions } = await supabase
    .from('quiz_questions')
    .select('id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation')
    .eq('unit_id', unit_id)
    .eq('is_active', true)
    .order('id', { ascending: true })
    .range(offset, offset + 9);

  if (!questions || questions.length === 0) {
    throw new SecurityError('Questions not found for this block', 404);
  }

  let score = 0;
  const reviewAnswers = questions.map((q, idx) => {
    const submitted = answers[idx] || {};
    const userOption = (submitted.selectedOption || '').toUpperCase();
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
      explanation: q.explanation || ''
    };
  });

  const total = questions.length;
  const percentage = Math.round((score / total) * 100);
  const passed = !wasAutoSubmitted && percentage >= 70;

  await supabase.from('user_quiz_activity').insert({
    user_id: userId,
    level: session.level,
    topic: session.topic,
    block_number: blockNum,
    score,
    total_possible: total,
    percentage,
    passed,
    answers: reviewAnswers,
    time_taken: time_taken || 0,
    completed_at: new Date().toISOString()
  });

  await supabase.from('user_quiz_sessions').delete().eq('id', session.id);

  const xpEarned = wasAutoSubmitted ? 0 : (passed ? Math.round(10 + (percentage / 10)) : 5);
  if (xpEarned > 0) {
    await addXp(userId, xpEarned, 'quiz_block');
  }

  if (!wasAutoSubmitted) {
    const { data: currentStats } = await supabase
      .from('user_topic_stats')
      .select('xp')
      .eq('user_id', userId)
      .eq('topic', session.topic)
      .maybeSingle();
    await supabase.from('user_topic_stats').upsert({
      user_id: userId,
      topic: session.topic,
      xp: (currentStats?.xp || 0) + xpEarned,
      last_activity_date: new Date().toISOString().slice(0, 10)
    }, { onConflict: 'user_id,topic' });
  }

  if (wasAutoSubmitted) {
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
      message: `Auto-submitted due to tab switching. Locked for ${INTEGRITY_LOCK_HOURS}h.`
    });
  }

  if (passed) {
    await createNotification(userId, 'quiz_passed', { topic_name: session.topic, score: percentage });
  } else {
    await createNotification(userId, 'quiz_failed', { topic_name: session.topic, score: percentage });
  }

  const { count: totalQuestions } = await supabase
    .from('quiz_questions')
    .select('id', { count: 'exact', head: true })
    .eq('unit_id', unit_id)
    .eq('is_active', true);
  const expectedBlocks = Math.ceil((totalQuestions || 0) / 10);

  const { data: allBlocks } = await supabase
    .from('user_quiz_activity')
    .select('block_number')
    .eq('user_id', userId)
    .eq('level', session.level)
    .eq('topic', session.topic);

  const completedBlockSet = new Set((allBlocks || []).map(a => a.block_number));
  if (completedBlockSet.size >= expectedBlocks && expectedBlocks > 0) {
    await createNotification(userId, 'quiz_topic_mastered', { topic_name: session.topic });
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
    max_allowed: session.max_tab_switches || 3
  });
}

async function addQuestionsBatch(body, res) {
  const { unit_id, questions } = body;
  if (!unit_id || !Array.isArray(questions)) throw new SecurityError('unit_id and questions array required', 400);

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
    image_url: q.image_url || null
  }));

  const { error } = await supabase.from('quiz_questions').insert(rows);
  if (error) throw new SecurityError('Failed to add questions', 500);
  return res.status(200).json({ inserted: rows.length });
}
