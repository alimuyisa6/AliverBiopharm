 import { supabase, addXp } from './core.js';
import {
  parseAndValidateBody,
  requireAuth,
  SecurityError,
} from './security-middleware.js';
import { getUserCurriculumScope } from './curriculum.js';
import { checkUnitBlockAccess } from './premium.js';

const SESSION_LENGTH = 10;

export async function handler(req, res, path, ctx) {
  requireAuth(ctx);

  if (req.method === 'GET') {
    return handleGet(path, req, res, ctx);
  }
  if (req.method === 'POST') {
    const body = await parseAndValidateBody(req);
    return handlePost(path, body, req, res, ctx);
  }
  throw new SecurityError('Method not allowed', 405);
}

async function handleGet(path, req, res, ctx) {
  switch (path) {
    case 'session':         return getSession(req, res, ctx);
    case 'session_check':   return checkSession(req, res, ctx);
    case 'stats':           return getStats(req, res, ctx);
    case 'achievements':    return getAchievements(req, res, ctx);
    case 'dashboard':       return getDashboard(req, res, ctx);
    case 'topics':          return getTopics(req, res, ctx);
    case 'notifications':   return getNotifications(req, res, ctx);
    case 'notification_prefs': return getNotificationPrefs(req, res, ctx);
    default: throw new SecurityError('Invalid action', 400);
  }
}

async function handlePost(path, body, req, res, ctx) {
  switch (path) {
    case 'start':                 return startSession(body, res, ctx);
    case 'continue':              return continueSession(body, res, ctx);
    case 'answer':                return submitAnswer(body, res, ctx);
    case 'complete':              return completeSession(body, res, ctx);
    case 'notification_read':     return markNotificationRead(body, res, ctx);
    case 'notification_read_all': return markAllNotificationsRead(res, ctx);
    case 'notification_dismiss':  return dismissNotification(body, res, ctx);
    case 'notification_prefs_update': return updateNotificationPrefs(body, res, ctx);
    default: throw new SecurityError('Invalid action', 400);
  }
}

// ---- helpers ----

async function getActiveGroupUnits(ctx) {
  const scope = await getUserCurriculumScope(ctx.userId);
  if (!scope || !scope.active_group_id) return [];
  const { data: units } = await supabase
    .from('curriculum_units')
    .select('id, name, group_id, curriculum_groups(level_id, curriculum_levels(display_name))')
    .eq('group_id', scope.active_group_id)
    .eq('is_active', true)
    .order('display_order');
  return units || [];
}

async function validateUnitAccess(ctx, unitId) {
  const allowedUnits = await getActiveGroupUnits(ctx);
  const unit = allowedUnits.find(u => u.id === unitId);
  if (!unit) throw new SecurityError('Unit not available in your curriculum', 403);

  const { data: { user } } = await supabase.auth.admin.getUserById(ctx.userId);
  const access = await checkUnitBlockAccess(user?.email || null, ctx.userId, unitId, null);
  if (!access.allowed) {
    if (access.reason === 'restricted') throw new SecurityError('Your access to this content has been restricted.', 403);
    throw new SecurityError('This topic requires premium access.', 403);
  }

  return unit;
}

// ---- endpoints ----

async function getSession(req, res, ctx) {
  const { unit_id } = req.query;
  if (!unit_id) throw new SecurityError('unit_id required', 400);

  const unit = await validateUnitAccess(ctx, unit_id);

  const { data: session } = await supabase
    .from('recall_sessions')
    .select('*')
    .eq('user_id', ctx.userId)
    .eq('level', unit.curriculum_groups?.curriculum_levels?.display_name)
    .eq('topic', unit.name)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return res.status(200).json(session || null);
}

async function checkSession(req, res, ctx) {
  const { unit_id } = req.query;
  if (!unit_id) throw new SecurityError('unit_id required', 400);

  const unit = await validateUnitAccess(ctx, unit_id);

  const { data: session } = await supabase
    .from('recall_sessions')
    .select('session_id, is_active, current_index, all_question_ids')
    .eq('user_id', ctx.userId)
    .eq('level', unit.curriculum_groups?.curriculum_levels?.display_name)
    .eq('topic', unit.name)
    .eq('is_active', true)
    .maybeSingle();

  if (!session) return res.status(200).json({ exists: false });

  return res.status(200).json({
    exists: true,
    session_id: session.session_id,
    current_index: session.current_index,
    total_questions: (session.all_question_ids || []).length,
    completed: !session.is_active,
  });
}

async function getStats(req, res, ctx) {
  const { data } = await supabase
    .from('user_recall_stats')
    .select('*')
    .eq('user_id', ctx.userId)
    .maybeSingle();
  return res.status(200).json(data || { total_xp: 0, recall_level: 1, current_streak: 0 });
}

async function getAchievements(req, res, ctx) {
  const { data } = await supabase
    .from('user_achievements')
    .select('achievement_id, earned_at')
    .eq('user_id', ctx.userId);
  const ids = (data || []).map(a => a.achievement_id);
  const { data: achievements } = ids.length
    ? await supabase.from('achievements').select('*').in('id', ids)
    : { data: [] };
  return res.status(200).json(achievements || []);
}

async function getDashboard(req, res, ctx) {
  const [stats, xp] = await Promise.all([
    supabase.from('user_recall_stats').select('*').eq('user_id', ctx.userId).maybeSingle(),
    supabase.from('user_xp').select('total_xp, rank_title').eq('user_id', ctx.userId).maybeSingle(),
  ]);
  return res.status(200).json({
    ...(stats?.data || {}),
    ...(xp?.data || {}),
  });
}

async function getTopics(req, res, ctx) {
  const allowedUnits = await getActiveGroupUnits(ctx);
  if (!allowedUnits.length) return res.status(200).json([]);

  const topics = [];
  for (const unit of allowedUnits) {
    const { count } = await supabase
      .from('recall_questions_bank')
      .select('id', { count: 'exact', head: true })
      .eq('unit_id', unit.id)
      .eq('is_active', true);
    if (count) {
      topics.push({
        unit_id: unit.id,
        topic_name: unit.name,
        question_count: count,
      });
    }
  }

  return res.status(200).json(topics);
}

async function startSession(body, res, ctx) {
  const { unit_id } = body;
  if (!unit_id) throw new SecurityError('unit_id required', 400);

  const unit = await validateUnitAccess(ctx, unit_id);
  const levelName = unit.curriculum_groups?.curriculum_levels?.display_name;

  const { data: existing } = await supabase
    .from('recall_sessions')
    .select('session_id, current_index, all_question_ids')
    .eq('user_id', ctx.userId)
    .eq('level', levelName)
    .eq('topic', unit.name)
    .eq('is_active', true)
    .maybeSingle();

  if (existing) {
    await supabase
      .from('recall_sessions')
      .update({ updated_at: new Date().toISOString() })
      .eq('session_id', existing.session_id);

    return res.status(200).json({
      session_id: existing.session_id,
      resumed: true,
      current_index: existing.current_index,
      total_questions: (existing.all_question_ids || []).length,
    });
  }

  const { data: questions } = await supabase
    .from('recall_questions_bank')
    .select('id')
    .eq('unit_id', unit.id)
    .eq('is_active', true);

  if (!questions || questions.length === 0) throw new SecurityError('No questions available for this topic', 404);

  const shuffled = [...questions].sort(() => Math.random() - 0.5);
  const questionIds = shuffled.slice(0, Math.min(SESSION_LENGTH, shuffled.length)).map(q => q.id);

  const sessionId = crypto.randomUUID();
  const nowIso = new Date().toISOString();

  const { error } = await supabase.from('recall_sessions').insert({
    session_id: sessionId,
    user_id: ctx.userId,
    level: levelName,
    topic: unit.name,
    question_ids: questionIds,
    all_question_ids: questionIds,
    current_index: 0,
    user_answers: [],
    is_active: true,
    created_at: nowIso,
    updated_at: nowIso,
    version: 0,
  });
  if (error) throw new SecurityError('Failed to start session', 500);

  return res.status(200).json({
    session_id: sessionId,
    resumed: false,
    current_index: 0,
    total_questions: questionIds.length,
  });
}

async function continueSession(body, res, ctx) {
  const { session_id } = body;
  if (!session_id) throw new SecurityError('session_id required', 400);

  const { data: session } = await supabase
    .from('recall_sessions')
    .select('*')
    .eq('session_id', session_id)
    .eq('user_id', ctx.userId)
    .eq('is_active', true)
    .maybeSingle();

  if (!session) throw new SecurityError('Session not found', 404);

  const questionIds = session.all_question_ids || session.question_ids || [];
  const currentQuestionId = questionIds[session.current_index];
  const { data: currentQuestion } = currentQuestionId
    ? await supabase.from('recall_questions_bank').select('*').eq('id', currentQuestionId).maybeSingle()
    : { data: null };

  await supabase
    .from('recall_sessions')
    .update({ updated_at: new Date().toISOString() })
    .eq('session_id', session_id);

  return res.status(200).json({
    session_id: session.session_id,
    current_index: session.current_index,
    total_questions: questionIds.length,
    current_question: currentQuestion,
    user_answers: session.user_answers || [],
    level: session.level,
    topic: session.topic,
  });
}

async function submitAnswer(body, res, ctx) {
  const { session_id, question_id, user_answer } = body;
  if (!session_id || !question_id || user_answer === undefined) {
    throw new SecurityError('session_id, question_id, user_answer required', 400);
  }

  const { data: session } = await supabase
    .from('recall_sessions')
    .select('*')
    .eq('session_id', session_id)
    .eq('user_id', ctx.userId)
    .eq('is_active', true)
    .maybeSingle();
  if (!session) throw new SecurityError('Session not found', 404);

  const questionIds = session.all_question_ids || session.question_ids || [];
  const expectedQuestionId = questionIds[session.current_index];
  if (!expectedQuestionId || question_id !== expectedQuestionId) {
    throw new SecurityError('question_id does not match the current question in this session', 400);
  }

  const { data: question } = await supabase
    .from('recall_questions_bank')
    .select('*')
    .eq('id', question_id)
    .maybeSingle();
  if (!question) throw new SecurityError('Question not found', 404);

  const startedAt = session.updated_at || session.created_at;
  const timeTakenSeconds = Math.max(0, Math.round((Date.now() - new Date(startedAt).getTime()) / 1000));

  const strength = evaluateRecallAnswer(user_answer, question);
  const userAnswers = [
    ...(session.user_answers || []),
    {
      question_id,
      user_answer,
      strength: strength.strength,
      correct_answer: question.correct_answer,
      explanation: strength.explanation || question.correct_explanation || question.explanation || '',
      xp_earned: strength.xp,
      time_taken_seconds: timeTakenSeconds,
    },
  ];

  const newIndex = (session.current_index || 0) + 1;
  const isComplete = newIndex >= questionIds.length;

  await supabase
    .from('recall_sessions')
    .update({
      user_answers: userAnswers,
      current_index: newIndex,
      is_active: !isComplete,
      completed_at: isComplete ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
      version: (session.version || 0) + 1,
    })
    .eq('session_id', session_id);

  if (strength.xp > 0) {
    await addXp(ctx.userId, strength.xp, 'recall_answer');
  }

  return res.status(200).json({
    strength: strength.strength,
    xp_earned: strength.xp,
    correct_answer: question.correct_answer,
    explanation: strength.explanation || question.correct_explanation || question.explanation || '',
    is_complete: isComplete,
    current_index: newIndex,
    total_questions: questionIds.length,
  });
}

async function completeSession(body, res, ctx) {
  const { session_id } = body;
  const { data: session } = await supabase
    .from('recall_sessions')
    .select('*')
    .eq('session_id', session_id)
    .eq('user_id', ctx.userId)
    .maybeSingle();
  if (!session) throw new SecurityError('Session not found', 404);

  await supabase
    .from('recall_sessions')
    .update({
      is_active: false,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('session_id', session_id);

  return res.status(200).json({ success: true });
}

// ---- answer evaluation (unchanged) ----

function evaluateRecallAnswer(userAnswer, question) {
  const answer = (userAnswer || '').trim();
  const correct = question.correct_answer || '';
  const alternates = question.alternate_answers || [];
  const commonMistakes = question.common_mistakes || [];

  if (answer.toLowerCase() === correct.toLowerCase()) {
    return { strength: 'excellent', xp: 10, explanation: question.correct_explanation || null };
  }

  for (const alt of alternates) {
    const term = typeof alt === 'string' ? alt : alt.term;
    if (answer.toLowerCase() === term.toLowerCase()) {
      return { strength: 'excellent', xp: 10, explanation: alt.explanation || question.correct_explanation || null };
    }
    if (answer.toLowerCase().includes(term.toLowerCase()) && term.length > 3) {
      return { strength: 'strong', xp: 7, explanation: alt.explanation || question.correct_explanation || null };
    }
  }

  if (answer.toLowerCase().includes(correct.toLowerCase()) && correct.length > 3) {
    return { strength: 'strong', xp: 7, explanation: question.correct_explanation || null };
  }

  for (const mistake of commonMistakes) {
    const term = typeof mistake === 'string' ? mistake : mistake.term;
    if (answer.toLowerCase() === term.toLowerCase()) {
      return { strength: 'developing', xp: 3, explanation: mistake.explanation || question.explanation || null };
    }
  }

  const dist = levenshteinDistance(answer.toLowerCase(), correct.toLowerCase());
  if (dist <= 2 && correct.length > 4) {
    return { strength: 'strong', xp: 7, explanation: question.correct_explanation || null };
  }

  return { strength: 'developing', xp: 3, explanation: question.explanation || null };
}

function levenshteinDistance(a, b) {
  const m = a.length,
    n = b.length;
  const dp = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[0][i] = i;
  for (let j = 0; j <= n; j++) dp[j][0] = j;
  for (let j = 1; j <= n; j++) {
    for (let i = 1; i <= m; i++) {
      dp[j][i] = Math.min(
        dp[j - 1][i] + 1,
        dp[j][i - 1] + 1,
        dp[j - 1][i - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return dp[n][m];
}

// ---- notifications (unchanged) ----

async function getNotifications(req, res, ctx) {
  const { limit = 50, offset = 0, module, unreadOnly } = req.query;
  let query = supabase
    .from('notifications')
    .select('*', { count: 'exact' })
    .eq('user_id', ctx.userId)
    .eq('is_dismissed', false)
    .order('created_at', { ascending: false })
    .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

  if (module) query = query.eq('module', module);
  if (unreadOnly === 'true') query = query.eq('is_read', false);

  const { data, error, count } = await query;
  if (error) throw new SecurityError('Failed to fetch notifications', 500);

  const { count: unreadCount } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', ctx.userId)
    .eq('is_read', false)
    .eq('is_dismissed', false);

  return res.status(200).json({
    notifications: data || [],
    total: count || 0,
    unread_count: unreadCount || 0,
  });
}

async function markNotificationRead(body, res, ctx) {
  await supabase
    .from('notifications')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('id', body.notification_id)
    .eq('user_id', ctx.userId);
  return res.status(200).json({ success: true });
}

async function markAllNotificationsRead(res, ctx) {
  await supabase
    .from('notifications')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('user_id', ctx.userId)
    .eq('is_read', false);
  return res.status(200).json({ success: true });
}

async function dismissNotification(body, res, ctx) {
  await supabase
    .from('notifications')
    .update({ is_dismissed: true, dismissed_at: new Date().toISOString() })
    .eq('id', body.notification_id)
    .eq('user_id', ctx.userId);
  return res.status(200).json({ success: true });
}

async function getNotificationPrefs(req, res, ctx) {
  const { data } = await supabase
    .from('notification_preferences')
    .select('module, in_app, email, push')
    .eq('user_id', ctx.userId);
  return res.status(200).json(data || []);
}

async function updateNotificationPrefs(body, res, ctx) {
  const entries = Object.entries(body.preferences).map(([module, settings]) => ({
    user_id: ctx.userId,
    module,
    in_app: settings.in_app !== undefined ? settings.in_app : true,
    email: settings.email || false,
    push: settings.push || false,
    updated_at: new Date().toISOString(),
  }));
  await supabase.from('notification_preferences').upsert(entries, { onConflict: 'user_id,module' });
  return res.status(200).json({ success: true });
}
