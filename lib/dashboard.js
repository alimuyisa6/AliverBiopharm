 /* lib/dashboard.js */
import { supabase, getPlatformStats, computeRankTitle, computeXpProgress, computeRecallLevel, computeAccuracy } from './core.js';
import { requireAuth, SecurityError } from './security-middleware.js';
import { getUserCurriculumScope } from './curriculum.js';

export async function handler(req, res, path, ctx) {
  requireAuth(ctx);

  if (req.method !== 'GET') {
    throw new SecurityError('Method not allowed', 405);
  }

  if (path !== 'summary') {
    throw new SecurityError('Invalid action', 400);
  }

  return getSummary(req, res, ctx);
}

async function getActiveUnitIds(ctx) {
  const scope = await getUserCurriculumScope(ctx.userId);

  if (!scope?.active_group_id) return [];

  const { data: units } = await supabase
    .from('curriculum_units')
    .select('id')
    .eq('group_id', scope.active_group_id)
    .eq('is_active', true);

  return (units || []).map((unit) => unit.id);
}

async function getRecallSummary(userId) {
  const { data } = await supabase
    .from('user_recall_stats')
    .select('total_sessions, total_questions, excellent_count, strong_count, developing_count, best_mastery, mastery')
    .eq('user_id', userId)
    .maybeSingle();

  if (!data) {
    return {
      available: true,
      total_sessions: 0,
      total_questions: 0,
      best_mastery: 0,
      topics_practiced: 0,
      accuracy: 0
    };
  }

  return {
    available: true,
    total_sessions: data.total_sessions || 0,
    total_questions: data.total_questions || 0,
    excellent_count: data.excellent_count || 0,
    strong_count: data.strong_count || 0,
    developing_count: data.developing_count || 0,
    best_mastery: data.best_mastery || 0,
    topics_practiced: Object.keys(data.mastery || {}).length,
    accuracy: computeAccuracy(
      data.excellent_count || 0,
      data.strong_count || 0,
      data.total_questions || 0
    )
  };
}

async function getQuizSummary(userId) {
  const { data } = await supabase
    .from('user_quiz_activity')
    .select('topic, block_number, percentage, passed, completed_at')
    .eq('user_id', userId)
    .order('completed_at', { ascending: false })
    .limit(30);

  const rows = data || [];

  if (!rows.length) {
    return {
      available: true,
      blocks_completed: 0,
      recent_pass_rate: 0,
      topics_attempted: 0,
      total_attempts: 0
    };
  }

  const uniqueBlocks = new Set(rows.map((row) => `${row.topic}:${row.block_number}`));
  const uniqueTopics = new Set(rows.map((row) => row.topic));

  return {
    available: true,
    blocks_completed: uniqueBlocks.size,
    recent_pass_rate: Math.round((rows.filter((row) => row.passed).length / rows.length) * 100),
    topics_attempted: uniqueTopics.size,
    total_attempts: rows.length,
    last_activity_at: rows[0]?.completed_at || null
  };
}

async function getNotesSummary(ctx) {
  const [{ data: readingStats }, allowedUnitIds] = await Promise.all([
    supabase
      .from('note_reading_stats')
      .select('*')
      .eq('user_id', ctx.userId)
      .maybeSingle(),
    getActiveUnitIds(ctx)
  ]);

  let continueReading = [];

  if (allowedUnitIds.length) {
    const { data: progressRows } = await supabase
      .from('reading_progress')
      .select('note_id, scroll_percentage, last_accessed')
      .eq('user_id', ctx.userId)
      .neq('completed', true)
      .gt('scroll_percentage', 5)
      .order('last_accessed', { ascending: false })
      .limit(10);

    for (const progress of progressRows || []) {
      const { data: note } = await supabase
        .from('notes')
        .select('id, slug, title, unit_id')
        .eq('id', progress.note_id)
        .maybeSingle();

      if (!note || !allowedUnitIds.includes(note.unit_id)) continue;

      continueReading.push({
        note_id: note.id,
        slug: note.slug,
        title: note.title,
        progress_percentage: progress.scroll_percentage
      });

      if (continueReading.length >= 3) break;
    }
  }

  return {
    available: true,
    reading_streak: readingStats?.current_streak || 0,
    notes_read_count: readingStats?.notes_read_count || 0,
    continue_reading: continueReading
  };
}

async function getAchievementsSummary(userId) {
  const [{ count: earnedCount }, { data: earned }, { count: total }] = await Promise.all([
    supabase
      .from('user_achievements')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId),
    supabase
      .from('user_achievements')
      .select('achievement_id, earned_at')
      .eq('user_id', userId)
      .order('earned_at', { ascending: false })
      .limit(5),
    supabase
      .from('achievements')
      .select('id', { count: 'exact', head: true })
  ]);

  const ids = (earned || []).map((item) => item.achievement_id);

  const { data: details } = ids.length
    ? await supabase
        .from('achievements')
        .select('id, name, icon, description')
        .in('id', ids)
    : { data: [] };

  const detailMap = new Map((details || []).map((detail) => [detail.id, detail]));

  return {
    earned_count: earnedCount || 0,
    total_count: total || 0,
    recent: (earned || []).map((item) => ({
      ...(detailMap.get(item.achievement_id) || {}),
      earned_at: item.earned_at
    }))
  };
}

async function getWeakAreasSummary(userId, unitIds) {
  if (!unitIds.length) return [];

  const { data } = await supabase
    .from('user_weak_concepts_v2')
    .select('concept, incorrect_attempts, last_incorrect_at, unit_id, resolved')
    .eq('user_id', userId)
    .in('unit_id', unitIds)
    .eq('resolved', false)
    .order('last_incorrect_at', { ascending: false })
    .limit(10);

  return (data || []).map((item) => ({
    concept: item.concept,
    incorrect_attempts: item.incorrect_attempts,
    last_incorrect_at: item.last_incorrect_at,
    unit_id: item.unit_id,
    resolved: item.resolved
  }));
}

async function getRecentActivity(userId) {
  const [recallActs, quizActs, readingActs] = await Promise.all([
    supabase
      .from('recall_sessions')
      .select('created_at, level, topic, session_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('user_quiz_activity')
      .select('completed_at, level, topic, block_number, percentage')
      .eq('user_id', userId)
      .order('completed_at', { ascending: false })
      .limit(5),
    supabase
      .from('reading_progress')
      .select('last_accessed, note_id, scroll_percentage')
      .eq('user_id', userId)
      .order('last_accessed', { ascending: false })
      .limit(5)
  ]);

  const feed = [];

  for (const row of recallActs.data || []) {
    feed.push({
      type: 'recall',
      date: row.created_at,
      details: `${row.topic} recall session`
    });
  }

  for (const row of quizActs.data || []) {
    feed.push({
      type: 'quiz',
      date: row.completed_at,
      details: `${row.topic} block ${Number(row.block_number) + 1} (${row.percentage}%)`
    });
  }

  for (const row of readingActs.data || []) {
    feed.push({
      type: 'reading',
      date: row.last_accessed,
      details: `Reading progress ${row.scroll_percentage}%`
    });
  }

  feed.sort((a, b) => new Date(b.date) - new Date(a.date));

  return feed.slice(0, 10);
}

async function getPerUnitXp(userId, unitIds) {
  if (!unitIds.length) return [];

  const { data } = await supabase
    .from('user_topic_stats')
    .select('unit_id, topic, xp')
    .eq('user_id', userId)
    .in('unit_id', unitIds);

  const unitXp = {};

  for (const row of data || []) {
    if (!unitXp[row.unit_id]) unitXp[row.unit_id] = 0;
    unitXp[row.unit_id] += row.xp || 0;
  }

  return Object.entries(unitXp).map(([unit_id, xp]) => ({
    unit_id,
    xp
  }));
}

async function getDueReviewCount(userId) {
  const { count } = await supabase
    .from('user_spaced_repetition')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .lte('next_review_date', new Date().toISOString());

  return count || 0;
}

async function getSummary(req, res, ctx) {
  const [platform, recall, quiz, notes, achievements, scope, dueReviewCount] = await Promise.all([
    getPlatformStats(ctx.userId),
    getRecallSummary(ctx.userId),
    getQuizSummary(ctx.userId),
    getNotesSummary(ctx),
    getAchievementsSummary(ctx.userId),
    getUserCurriculumScope(ctx.userId),
    getDueReviewCount(ctx.userId)
  ]);

  const totalXp = platform.total_xp || 0;
  const unitIds = await getActiveUnitIds(ctx);
  const weakAreas = await getWeakAreasSummary(ctx.userId, unitIds);
  const recentActivity = await getRecentActivity(ctx.userId);
  const unitXp = await getPerUnitXp(ctx.userId, unitIds);

  return res.status(200).json({
    platform: {
      total_xp: totalXp,
      level: computeRecallLevel(totalXp),
      rank_title: computeRankTitle(totalXp),
      xp_progress: computeXpProgress(totalXp),
      current_streak: platform.current_streak || 0,
      longest_streak: platform.longest_streak || 0
    },
    level_id: scope?.active_level_id || null,
    recall,
    quiz,
    notes,
    flashcards: {
      available: true,
      due_review_count: dueReviewCount
    },
    achievements,
    weak_areas: weakAreas,
    recent_activity: recentActivity,
    unit_xp: unitXp
  });
}
