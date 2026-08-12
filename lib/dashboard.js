 import { supabase, getPlatformStats, computeRankTitle, computeXpProgress, computeRecallLevel, computeAccuracy } from './core.js';
import { requireAuth, SecurityError } from './security-middleware.js';
import { getUserCurriculumScope } from './curriculum.js';

export async function handler(req, res, path, ctx) {
  try {
    requireAuth(ctx);
    if (req.method !== 'GET') throw new SecurityError('Method not allowed', 405);
    switch (path) {
      case 'summary': return await getSummary(req, res, ctx);
      default: throw new SecurityError('Invalid action', 400);
    }
  } catch (err) {
    console.error(`[dashboard:${path}]`, err);
    if (err instanceof SecurityError) throw err;
    throw new SecurityError('An unexpected error occurred', 500);
  }
}

async function getActiveUnitIds(ctx) {
  try {
    const scope = await getUserCurriculumScope(ctx.userId);
    if (!scope || !scope.active_group_id) return [];
    const { data: units } = await supabase.from('curriculum_units').select('id').eq('group_id', scope.active_group_id).eq('is_active', true);
    return (units || []).map(u => u.id);
  } catch (err) {
    console.error('[dashboard:getActiveUnitIds]', err);
    return [];
  }
}

async function getRecallSummary(userId) {
  try {
    const { data } = await supabase.from('user_recall_stats').select('total_sessions, total_questions, excellent_count, strong_count, best_mastery, mastery').eq('user_id', userId).maybeSingle();
    if (!data) return { available: true, total_sessions: 0, best_mastery: 0, topics_practiced: 0 };
    return { available: true, total_sessions: data.total_sessions || 0, best_mastery: data.best_mastery || 0, topics_practiced: Object.keys(data.mastery || {}).length };
  } catch (err) {
    console.error('[dashboard:getRecallSummary]', err);
    return { available: true, total_sessions: 0, best_mastery: 0, topics_practiced: 0 };
  }
}

async function getQuizSummary(userId) {
  try {
    const { data } = await supabase.from('user_quiz_activity').select('topic, block_number, percentage, passed, completed_at').eq('user_id', userId).order('completed_at', { ascending: false }).limit(30);
    const rows = data || [];
    if (rows.length === 0) return { available: true, blocks_completed: 0, recent_pass_rate: 0, topics_attempted: 0 };
    const uniqueBlocks = new Set(rows.map(r => `${r.topic}:${r.block_number}`));
    const passRate = Math.round((rows.filter(r => r.passed).length / rows.length) * 100);
    return { available: true, blocks_completed: uniqueBlocks.size, recent_pass_rate: passRate, topics_attempted: new Set(rows.map(r => r.topic)).size, last_activity_at: rows[0]?.completed_at || null };
  } catch (err) {
    console.error('[dashboard:getQuizSummary]', err);
    return { available: true, blocks_completed: 0, recent_pass_rate: 0, topics_attempted: 0 };
  }
}

async function getNotesSummary(ctx) {
  try {
    const [{ data: readingStats }, allowedUnitIds] = await Promise.all([
      supabase.from('note_reading_stats').select('*').eq('user_id', ctx.userId).maybeSingle(),
      getActiveUnitIds(ctx),
    ]);
    let continueReading = [];
    if (allowedUnitIds.length) {
      const { data: progressRows } = await supabase.from('reading_progress').select('note_id, scroll_percentage, last_accessed').eq('user_id', ctx.userId).neq('completed', true).gt('scroll_percentage', 5).order('last_accessed', { ascending: false }).limit(10);
      for (const prog of progressRows || []) {
        const { data: note } = await supabase.from('notes').select('id, slug, title, unit_id').eq('id', prog.note_id).maybeSingle();
        if (!note || !allowedUnitIds.includes(note.unit_id)) continue;
        continueReading.push({ note_id: note.id, slug: note.slug, title: note.title, progress_percentage: prog.scroll_percentage });
        if (continueReading.length >= 3) break;
      }
    }
    return { available: true, reading_streak: readingStats?.current_streak || 0, notes_read_count: readingStats?.notes_read_count || 0, continue_reading: continueReading };
  } catch (err) {
    console.error('[dashboard:getNotesSummary]', err);
    return { available: true, reading_streak: 0, notes_read_count: 0, continue_reading: [] };
  }
}

async function getAchievementsSummary(userId) {
  try {
    const [{ data: earned }, { count: total }] = await Promise.all([
      supabase.from('user_achievements').select('achievement_id, earned_at').eq('user_id', userId).order('earned_at', { ascending: false }).limit(5),
      supabase.from('achievements').select('id', { count: 'exact', head: true }),
    ]);
    const ids = (earned || []).map(e => e.achievement_id);
    const { data: details } = ids.length ? await supabase.from('achievements').select('id, name, icon').in('id', ids) : { data: [] };
    const detailMap = new Map((details || []).map(d => [d.id, d]));
    return { earned_count: earned?.length || 0, total_count: total || 0, recent: (earned || []).map(e => ({ ...detailMap.get(e.achievement_id), earned_at: e.earned_at })) };
  } catch (err) {
    console.error('[dashboard:getAchievementsSummary]', err);
    return { earned_count: 0, total_count: 0, recent: [] };
  }
}

async function getWeakAreasSummary(userId, unitIds) {
  if (!unitIds.length) return [];
  try {
    const { data } = await supabase.from('user_weak_concepts_v2').select('concept, incorrect_attempts, last_incorrect_at, unit_id, group_id, level_id, resolved').eq('user_id', userId).in('unit_id', unitIds).eq('resolved', false).order('last_incorrect_at', { ascending: false }).limit(10);
    return (data || []).map(w => ({ concept: w.concept, incorrect_attempts: w.incorrect_attempts, last_incorrect_at: w.last_incorrect_at, unit_id: w.unit_id, resolved: w.resolved }));
  } catch (err) {
    console.error('[dashboard:getWeakAreasSummary]', err);
    return [];
  }
}

async function getRecentActivity(userId) {
  try {
    const [recallActs, quizActs] = await Promise.all([
      supabase.from('recall_sessions').select('created_at, level, topic, session_id').eq('user_id', userId).order('created_at', { ascending: false }).limit(5),
      supabase.from('user_quiz_activity').select('completed_at, level, topic, block_number, percentage').eq('user_id', userId).order('completed_at', { ascending: false }).limit(5),
    ]);
    const feed = [];
    for (const r of (recallActs.data || [])) feed.push({ type: 'recall', date: r.created_at, details: `${r.topic} recall session` });
    for (const q of (quizActs.data || [])) feed.push({ type: 'quiz', date: q.completed_at, details: `${q.topic} block ${q.block_number} (${q.percentage}%)` });
    feed.sort((a, b) => new Date(b.date) - new Date(a.date));
    return feed.slice(0, 10);
  } catch (err) {
    console.error('[dashboard:getRecentActivity]', err);
    return [];
  }
}

async function getPerUnitXp(userId, unitIds) {
  if (!unitIds.length) return [];
  try {
    const { data } = await supabase.from('user_topic_stats').select('unit_id, topic, xp').eq('user_id', userId).in('unit_id', unitIds);
    const unitXp = {};
    for (const row of (data || [])) {
      if (!unitXp[row.unit_id]) unitXp[row.unit_id] = 0;
      unitXp[row.unit_id] += row.xp;
    }
    return Object.entries(unitXp).map(([unit_id, xp]) => ({ unit_id, xp }));
  } catch (err) {
    console.error('[dashboard:getPerUnitXp]', err);
    return [];
  }
}

async function getSummary(req, res, ctx) {
  const [platform, recall, quiz, notes, achievements, scope] = await Promise.all([
    getPlatformStats(ctx.userId),
    getRecallSummary(ctx.userId),
    getQuizSummary(ctx.userId),
    getNotesSummary(ctx),
    getAchievementsSummary(ctx.userId),
    getUserCurriculumScope(ctx.userId),
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
      longest_streak: platform.longest_streak || 0,
    },
    level_id: scope?.active_level_id || null,
    recall,
    quiz,
    notes,
    flashcards: { available: false },
    achievements,
    weak_areas: weakAreas,
    recent_activity: recentActivity,
    unit_xp: unitXp,
  });
}
