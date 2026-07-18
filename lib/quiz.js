 import { supabase, addXp, updateTopicPerformance, enforceClassAccess } from './core.js';
import { parseAndValidateBody, requireAuth, SecurityError } from './security-middleware.js';
import { createNotification } from './notifications.js';

const INTEGRITY_LOCK_HOURS = 48;
const STANDARD_LOCK_HOURS = 24;
const REDIRECT_SECONDS = 10;

async function isSuperAdmin(userId) {
  const { data } = await supabase
    .from('admin_master')
    .select('admin_role')
    .eq('admin_id', userId)
    .maybeSingle();
  return data?.admin_role === 'super_admin';
}

export async function handler(req, res, path, ctx) {
  const publicPaths = ['get_quiz_topics'];
  const isPublic = publicPaths.includes(path) && req.method === 'GET';

  if (!isPublic) {
    requireAuth(ctx);
  }

  if (req.method === 'GET') {
    switch (path) {
      case 'get_quiz_topics': return getQuizTopics(req, res, ctx.userId);
      case 'get_quiz_block': return getQuizBlock(req, res, ctx.userId);
      case 'check_daily_retry': return checkDailyRetry(req, res, ctx.userId);
      case 'quiz_session_status': return getQuizSessionStatus(req, res, ctx.userId);
      default: throw new SecurityError('Invalid path', 400);
    }
  }

  if (req.method === 'POST') {
    const body = await parseAndValidateBody(req);
    switch (path) {
      case 'check_quiz_answer': return checkQuizAnswer(body, res);
      case 'submit_quiz_block': return submitQuizBlockDeprecated(res);
      case 'add_quiz_questions_batch': return addQuizQuestionsBatch(body, res);
      case 'quiz_start_session': return startQuizSession(body, res, ctx.userId);
      case 'quiz_tab_switch': return trackTabSwitch(body, res, ctx.userId);
      case 'quiz_submit_with_session': return submitQuizWithSession(body, res, ctx.userId);
      default: throw new SecurityError('Invalid path', 400);
    }
  }

  throw new SecurityError('Method not allowed', 405);
}

async function getQuizTopics(req, res, userId) {
  const { level } = req.query;
  if (!level) throw new SecurityError('level is required', 400);
  const { data: topics, error } = await supabase.from('quiz_topics').select('id, topic_name, level, display_order, class_name').eq('level', level).order('display_order', { ascending: true });
  if (error) throw new SecurityError('Failed to fetch topics', 500);
  const enriched = await Promise.all((topics || []).map(async (topic) => {
    const { count: questionCount } = await supabase.from('quiz_questions').select('id', { count: 'exact', head: true }).eq('level', level).eq('topic', topic.topic_name);
    const totalBlocks = questionCount ? Math.ceil(questionCount / 10) : 0;
    let completedBlocks = [];
    let lockedBlocks = [];
    if (userId) {
      const { data: activity } = await supabase.from('user_quiz_activity').select('block_number, passed, completed_at').eq('user_id', userId).eq('level', level).eq('topic', topic.topic_name);
      if (activity && activity.length) {
        completedBlocks = activity.map(a => a.block_number);
        const now = new Date();
        lockedBlocks = activity.filter(a => { const completedAt = new Date(a.completed_at); return (now - completedAt) < STANDARD_LOCK_HOURS * 60 * 60 * 1000; }).map(a => a.block_number);
      }
    }
    return { topic_name: topic.topic_name, level: topic.level, class_name: topic.class_name || null, question_count: questionCount || 0, total_blocks: totalBlocks, completed_blocks: completedBlocks, locked_blocks: lockedBlocks };
  }));
  return res.status(200).json(enriched);
}

async function getQuizBlock(req, res, userId) {
  const { level, topic, block_number } = req.query;
  if (!level || !topic || block_number === undefined) throw new SecurityError('level, topic and block_number are required', 400);
  const blockNum = parseInt(block_number);

  const { data: session, error: sessionError } = await supabase
    .from('user_quiz_sessions')
    .select('id, auto_submitted')
    .eq('user_id', userId)
    .eq('level', level)
    .eq('topic', topic)
    .eq('block_number', blockNum)
    .maybeSingle();

  if (sessionError) throw new SecurityError('Failed to verify quiz session', 500);
  if (!session) throw new SecurityError('No active quiz session. Please start this block from the Quiz page.', 403);
  if (session.auto_submitted) throw new SecurityError('This block was auto-submitted due to a tab-switching violation and is locked.', 403);

  const { data: topicData } = await supabase.from('quiz_topics').select('class_name').eq('topic_name', topic).eq('level', level).maybeSingle();
  const className = topicData?.class_name;
  if (className) {
    const superAdmin = await isSuperAdmin(userId);
    if (!superAdmin) {
      const allowed = await enforceClassAccess(userId, level, className);
      if (!allowed) throw new SecurityError('Access denied – content not available for your class', 403);
    }
  }

  const offset = blockNum * 10;
  const { data: questions, error } = await supabase.from('quiz_questions').select('id, question_text, option_a, option_b, option_c, option_d, difficulty, image_url').eq('level', level).eq('topic', topic).order('id', { ascending: true }).range(offset, offset + 9);
  if (error) throw new SecurityError('Failed to fetch questions', 500);
  if (!questions || questions.length === 0) throw new SecurityError('No questions found for this block', 404);
  return res.status(200).json({ questions, block_number: blockNum });
}

async function checkDailyRetry(req, res, userId) {
  const { level, topic, block_number } = req.query;
  if (!level || !topic || block_number === undefined) throw new SecurityError('level, topic and block_number are required', 400);
  const blockNum = parseInt(block_number);

  const integrityCutoff = new Date(Date.now() - INTEGRITY_LOCK_HOURS * 60 * 60 * 1000).toISOString();
  const { data: violation } = await supabase
    .from('quiz_security_logs')
    .select('created_at')
    .eq('user_id', userId)
    .eq('event_type', 'tab_switch_auto_submit')
    .filter('details->>level', 'eq', level)
    .filter('details->>topic', 'eq', topic)
    .filter('details->>block_number', 'eq', String(blockNum))
    .gte('created_at', integrityCutoff)
    .order('created_at', { ascending: false })
    .limit(1);

  if (violation && violation.length > 0) {
    const lastViolation = new Date(violation[0].created_at);
    const hoursSince = (Date.now() - lastViolation) / (1000 * 60 * 60);
    const hoursLeft = Math.ceil(INTEGRITY_LOCK_HOURS - hoursSince);
    return res.status(200).json({
      can_retry: false,
      reason: `This block was auto-submitted for a tab-switching violation and is locked for academic integrity. Try again in ${hoursLeft} hour${hoursLeft > 1 ? 's' : ''}.`,
      integrity_lock: true
    });
  }

  const { data: activity } = await supabase.from('user_quiz_activity').select('completed_at').eq('user_id', userId).eq('level', level).eq('topic', topic).eq('block_number', blockNum).order('completed_at', { ascending: false }).limit(1);
  if (!activity || activity.length === 0) return res.status(200).json({ can_retry: true });
  const lastAttempt = new Date(activity[0].completed_at);
  const hoursSince = (Date.now() - lastAttempt) / (1000 * 60 * 60);
  if (hoursSince < STANDARD_LOCK_HOURS) {
    const hoursLeft = Math.ceil(STANDARD_LOCK_HOURS - hoursSince);
    return res.status(200).json({ can_retry: false, reason: `This block is locked. Try again in ${hoursLeft} hour${hoursLeft > 1 ? 's' : ''}.` });
  }
  return res.status(200).json({ can_retry: true });
}

async function checkQuizAnswer(body, res) {
  const { question_id, selected_option } = body;
  if (!question_id || !selected_option) throw new SecurityError('question_id and selected_option are required', 400);
  const { data: question, error } = await supabase.from('quiz_questions').select('correct_option, explanation, option_a, option_b, option_c, option_d').eq('id', question_id).single();
  if (error || !question) throw new SecurityError('Question not found', 404);
  const correct = selected_option.toUpperCase() === question.correct_option.toUpperCase();
  const correctKey = `option_${question.correct_option.toLowerCase()}`;
  const correct_answer_text = question[correctKey] || '';
  return res.status(200).json({ correct, correct_option: question.correct_option.toUpperCase(), correct_answer_text, explanation: question.explanation || '' });
}

async function startQuizSession(body, res, userId) {
  const { level, topic, block_number, state } = body;

  if (!level || !topic || block_number === undefined) {
    throw new SecurityError('level, topic and block_number are required', 400);
  }

  const blockNum = parseInt(block_number);

  const { data: topicData } = await supabase.from('quiz_topics').select('class_name').eq('topic_name', topic).eq('level', level).maybeSingle();
  if (topicData?.class_name) {
    const superAdmin = await isSuperAdmin(userId);
    if (!superAdmin) {
      const allowed = await enforceClassAccess(userId, level, topicData.class_name);
      if (!allowed) throw new SecurityError('Access denied', 403);
    }
  }

  const { data: existing, error: fetchError } = await supabase
    .from('user_quiz_sessions')
    .select('id, state, tab_switches, max_tab_switches, auto_submitted')
    .eq('user_id', userId)
    .eq('level', level)
    .eq('topic', topic)
    .eq('block_number', blockNum)
    .maybeSingle();

  if (fetchError) {
    throw new SecurityError('Failed to check existing session', 500);
  }

  if (existing) {
    if (existing.auto_submitted) {
      return res.status(200).json({
        success: false,
        auto_submitted: true,
        message: 'This block was auto-submitted due to excessive tab switching and is locked.',
        tab_switches: existing.tab_switches || 0
      });
    }

    const { error: updateError } = await supabase
      .from('user_quiz_sessions')
      .update({
        state: state || existing.state,
        updated_at: new Date().toISOString()
      })
      .eq('id', existing.id);

    if (updateError) {
      throw new SecurityError('Failed to update quiz session', 500);
    }

    return res.status(200).json({
      success: true,
      tab_switches: existing.tab_switches || 0,
      max_allowed: existing.max_tab_switches || 3,
      resumed: true
    });
  }

  const { error: insertError } = await supabase
    .from('user_quiz_sessions')
    .upsert({
      user_id: userId,
      level,
      topic,
      block_number: blockNum,
      state: state || {},
      tab_switches: 0,
      max_tab_switches: 3,
      auto_submitted: false,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id,level,topic,block_number' });

  if (insertError) {
    throw new SecurityError('Failed to create quiz session', 500);
  }

  return res.status(200).json({
    success: true,
    tab_switches: 0,
    max_allowed: 3,
    resumed: false
  });
}

async function trackTabSwitch(body, res, userId) {
  const { level, topic, block_number } = body;

  if (!level || !topic || block_number === undefined) {
    throw new SecurityError('level, topic and block_number are required', 400);
  }

  const blockNum = parseInt(block_number);

  const { data: session, error: fetchError } = await supabase
    .from('user_quiz_sessions')
    .select('id, tab_switches, max_tab_switches, auto_submitted, state')
    .eq('user_id', userId)
    .eq('level', level)
    .eq('topic', topic)
    .eq('block_number', blockNum)
    .maybeSingle();

  if (fetchError || !session) {
    return res.status(404).json({
      success: false,
      error: 'Quiz session not found for this block'
    });
  }

  if (session.auto_submitted) {
    return res.status(200).json({
      success: false,
      auto_submitted: true,
      message: 'This block was already auto-submitted due to excessive tab switching.',
      redirect_after_seconds: REDIRECT_SECONDS
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
          level,
          topic,
          block_number: blockNum,
          tab_switches: newCount,
          max_allowed: maxAllowed,
          timestamp: new Date().toISOString()
        }
      });

    await createNotification(userId, 'quiz_auto_submitted', {
      topic_name: topic,
      block_number: blockNum + 1
    });

    return res.status(200).json({
      success: false,
      auto_submitted: true,
      message: `Your quiz was auto-submitted after ${newCount} tab switches to maintain assessment integrity. This block is now locked for ${INTEGRITY_LOCK_HOURS} hours.`,
      tab_switches: newCount,
      max_allowed: maxAllowed,
      redirect_after_seconds: REDIRECT_SECONDS
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
        level,
        topic,
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

async function submitQuizWithSession(body, res, userId) {
  const { level, topic, block_number, answers, time_taken } = body;

  if (!level || !topic || block_number === undefined || !answers) {
    throw new SecurityError('level, topic, block_number and answers are required', 400);
  }

  const blockNum = parseInt(block_number);

  const { data: session, error: fetchError } = await supabase
    .from('user_quiz_sessions')
    .select('id, tab_switches, max_tab_switches, auto_submitted')
    .eq('user_id', userId)
    .eq('level', level)
    .eq('topic', topic)
    .eq('block_number', blockNum)
    .maybeSingle();

  if (fetchError) {
    throw new SecurityError('Failed to fetch quiz session', 500);
  }

  if (!session) {
    throw new SecurityError('No active quiz session found for this block. Please start it from the Quiz page.', 403);
  }

  const wasAutoSubmitted = !!session.auto_submitted;

  const offset = blockNum * 10;
  const { data: questions } = await supabase
    .from('quiz_questions')
    .select('id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation')
    .eq('level', level)
    .eq('topic', topic)
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
    level,
    topic,
    block_number: blockNum,
    score,
    total,
    percentage,
    passed,
    time_taken: time_taken || 0,
    completed_at: new Date().toISOString(),
    tab_switches: session.tab_switches || 0
  });

  await supabase
    .from('user_quiz_sessions')
    .delete()
    .eq('id', session.id);

  const xpEarned = wasAutoSubmitted ? 0 : (passed ? Math.round(10 + (percentage / 10)) : 5);
  if (xpEarned > 0) {
    await addXp(userId, xpEarned, 'quiz_block');
  }
  if (!wasAutoSubmitted) {
    await updateTopicPerformance(userId, level, topic, percentage);
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
      message: `This block was auto-submitted due to a tab-switching violation and is locked for ${INTEGRITY_LOCK_HOURS} hours.`,
      redirect_after_seconds: REDIRECT_SECONDS
    });
  }

  if (passed) {
    await createNotification(userId, 'quiz_passed', { topic_name: topic, score: percentage });
  } else {
    await createNotification(userId, 'quiz_failed', { topic_name: topic, score: percentage });
  }

  const { count: totalBlocks } = await supabase
    .from('quiz_questions')
    .select('id', { count: 'exact', head: true })
    .eq('level', level)
    .eq('topic', topic);

  const expectedBlocks = Math.ceil((totalBlocks || 0) / 10);

  const { data: allBlocks } = await supabase
    .from('user_quiz_activity')
    .select('block_number')
    .eq('user_id', userId)
    .eq('level', level)
    .eq('topic', topic);

  const completedBlockSet = new Set((allBlocks || []).map(a => a.block_number));

  if (completedBlockSet.size >= expectedBlocks && expectedBlocks > 0) {
    await createNotification(userId, 'quiz_topic_mastered', { topic_name: topic });
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

async function getQuizSessionStatus(req, res, userId) {
  const { level, topic, block_number } = req.query;

  let query = supabase
    .from('user_quiz_sessions')
    .select('level, topic, block_number, tab_switches, max_tab_switches, auto_submitted, updated_at')
    .eq('user_id', userId);

  if (level && topic && block_number !== undefined) {
    query = query.eq('level', level).eq('topic', topic).eq('block_number', parseInt(block_number)).maybeSingle();
  } else {
    query = query.order('updated_at', { ascending: false }).limit(1);
  }

  const { data, error } = await query;

  if (error) {
    return res.status(404).json({
      success: false,
      error: 'Session not found'
    });
  }

  const session = Array.isArray(data) ? data[0] : data;

  if (!session) {
    return res.status(200).json({
      success: true,
      session: null,
      exists: false
    });
  }

  return res.status(200).json({
    success: true,
    session: {
      level: session.level,
      topic: session.topic,
      block_number: session.block_number,
      tab_switches: session.tab_switches || 0,
      max_allowed: session.max_tab_switches || 3,
      remaining: (session.max_tab_switches || 3) - (session.tab_switches || 0),
      auto_submitted: session.auto_submitted || false,
      updated_at: session.updated_at
    },
    exists: true
  });
}

function submitQuizBlockDeprecated(res) {
  throw new SecurityError('This endpoint has been deprecated. Use quiz_submit_with_session instead.', 410);
}

async function addQuizQuestionsBatch(body, res) {
  const { level, topic, questions, batch_name } = body;
  if (!level || !topic || !questions || !Array.isArray(questions)) throw new SecurityError('level, topic and questions array are required', 400);
  const rows = questions.map(q => ({ level, topic, question_text: q.question_text, option_a: q.option_a, option_b: q.option_b, option_c: q.option_c, option_d: q.option_d, correct_option: q.correct_option, explanation: q.explanation || '', difficulty: q.difficulty || 'medium', batch_name: batch_name || null, image_url: q.image_url || null }));
  const { data, error } = await supabase.from('quiz_questions').insert(rows).select('id');
  if (error) throw new SecurityError('Failed to add questions', 500);
  await supabase.from('quiz_topics').upsert({ topic_name: topic, level, display_order: 999 }, { onConflict: 'topic_name,level' });
  return res.status(200).json({ inserted: data?.length || 0 });
}
