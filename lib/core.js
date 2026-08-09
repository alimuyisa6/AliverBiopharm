 /* api/lib/core.js */
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import https from 'https';

export const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
export const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
export const supabasePasskeyAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false, experimental: { passkey: true } } });

export function setCorsHeaders(res, req) {
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'https://aliverbiopharm.com').split(',').map(o => o.trim());
  const requestOrigin = req.headers.origin || '';
  const corsOrigin = allowedOrigins.includes(requestOrigin) ? requestOrigin : allowedOrigins[0];
  res.setHeader('Access-Control-Allow-Origin', corsOrigin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-CSRF-Token, Cookie');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Cache-Control', 'no-store, max-age=0, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
}

export function parseCookies(req) {
  const cookieHeader = req.headers.cookie || '';
  return Object.fromEntries(cookieHeader.split(';').map(c => {
    const [k, ...v] = c.trim().split('=');
    return [k.trim(), decodeURIComponent(v.join('='))];
  }));
}

export function hashToken(token) { return crypto.createHash('sha256').update(token).digest('hex'); }
export function generateSessionToken() { return crypto.randomBytes(48).toString('base64url'); }

export function getClientIp(req) {
  const vercelIp = req.headers['x-vercel-forwarded-for'];
  if (vercelIp) return vercelIp.split(',')[0].trim();
  const realIp = req.headers['x-real-ip'];
  if (realIp) return realIp.trim();
  const socketIp = req.socket?.remoteAddress || req.connection?.remoteAddress;
  if (socketIp) return socketIp.replace('::ffff:', '');
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return 'unknown';
}

export function getIpNetwork(ip) {
  if (!ip || ip === 'unknown') return 'unknown';
  if (ip.includes(':')) {
    const parts = ip.split(':').filter(Boolean);
    return parts.slice(0, 4).join(':');
  }
  const parts = ip.split('.');
  if (parts.length === 4) return `${parts[0]}.${parts[1]}.${parts[2]}`;
  return ip;
}

export async function verifyTurnstile(token, ip) {
  if (!token) return false;
  try {
    const formData = new URLSearchParams();
    formData.append('secret', process.env.TURNSTILE_SECRET_KEY);
    formData.append('response', token);
    if (ip && ip !== 'unknown') formData.append('remoteip', ip);
    const result = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: formData });
    const outcome = await result.json();
    return outcome.success === true;
  } catch { return false; }
}

async function findSessionRowByToken(hashedToken, selectCols) {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from('user_sessions')
    .select(selectCols)
    .eq('is_active', true)
    .or(`session_token_hash.eq.${hashedToken},and(prev_session_token_hash.eq.${hashedToken},prev_token_grace_until.gt.${nowIso})`)
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

export async function validateSession(token) {
  if (!token || token.length < 20) return null;
  const hashedToken = hashToken(token);
  const data = await findSessionRowByToken(hashedToken, 'user_id, expires_at, is_active, fingerprint, created_at');
  if (!data) return null;
  if (new Date(data.expires_at) < new Date()) {
    await supabase.from('user_sessions').update({ is_active: false, terminated_reason: 'expired' }).eq('session_token_hash', hashedToken);
    return null;
  }
  return data;
}

export async function isAdmin(userId, ip) {
  if (!userId) return null;
  const { data } = await supabase
    .from('admin_master')
    .select('admin_role, permissions, is_active, is_locked, ip_whitelist, id, is_online, is_busy, admin_email, mfa_enabled, mfa_secret, passkey_enabled')
    .eq('admin_id', userId)
    .eq('is_active', true)
    .maybeSingle();
  if (!data) return null;
  if (data.is_locked) return { ...data, admin_role: null };
  if (data.ip_whitelist && data.ip_whitelist.length > 0) {
    const clientIp = (ip || '').split(',')[0].trim();
    if (!data.ip_whitelist.includes(clientIp)) {
      return { ...data, admin_role: null, ip_rejected: true };
    }
  }
  return data;
}

export function normalizeString(s) { return s.toLowerCase().trim().replace(/[^a-z0-9]/g, ''); }

export function containsConcept(sentence, concept) {
  const escaped = concept.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\b`, 'i').test(sentence);
}

export function isNegatedConcept(sentence, concept) {
  const escaped = concept.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`\\bnot\\s+${escaped}\\b`, 'i'),
    new RegExp(`\\bis\\s+not\\s+${escaped}\\b`, 'i'),
    new RegExp(`\\bare\\s+not\\s+${escaped}\\b`, 'i'),
    new RegExp(`\\bwas\\s+not\\s+${escaped}\\b`, 'i'),
    new RegExp(`\\bwere\\s+not\\s+${escaped}\\b`, 'i'),
    new RegExp(`\\bisn't\\s+${escaped}\\b`, 'i'),
    new RegExp(`\\baren't\\s+${escaped}\\b`, 'i'),
    new RegExp(`\\bwasn't\\s+${escaped}\\b`, 'i'),
    new RegExp(`\\bweren't\\s+${escaped}\\b`, 'i'),
    new RegExp(`\\bincorrect\\s*[:\\-]?\\s*${escaped}\\b`, 'i')
  ];
  return patterns.some(p => p.test(sentence));
}

export function containsExactPhrase(sentence, phrase) { return sentence.toLowerCase().includes(phrase.toLowerCase().trim()); }

export function levenshteinDistance(a, b) {
  const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));
  for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= b.length; j++) matrix[j][0] = j;
  for (let j = 1; j <= b.length; j++) for (let i = 1; i <= a.length; i++) {
    const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
    matrix[j][i] = Math.min(matrix[j][i - 1] + 1, matrix[j - 1][i] + 1, matrix[j - 1][i - 1] + indicator);
  }
  return matrix[b.length][a.length];
}

export function calculateRecallStrength(userAnswer, correctAnswer, alternateAnswers, commonMistakes) {
  const normalizedAnswer = normalizeString(userAnswer);
  const acceptedAnswers = [
    { term: correctAnswer, explanation: null, isPrimary: true },
    ...(alternateAnswers || []).map(a => ({ term: a.term, explanation: a.explanation || null, isPrimary: false }))
  ];
  for (const item of acceptedAnswers) {
    const concept = item.term;
    const normalizedConcept = normalizeString(concept);
    if (normalizedAnswer === normalizedConcept) return { strength: 'excellent', matched: concept, xp: 10, explanation: item.explanation, isPrimary: item.isPrimary };
    if (!concept.includes(' ')) {
      if (containsConcept(userAnswer, concept) && !isNegatedConcept(userAnswer, concept)) return { strength: 'excellent', matched: concept, xp: 10, explanation: item.explanation, isPrimary: item.isPrimary };
    } else if (containsExactPhrase(userAnswer, concept)) return { strength: 'excellent', matched: concept, xp: 10, explanation: item.explanation, isPrimary: item.isPrimary };
  }
  for (const mistake of commonMistakes || []) {
    if (containsConcept(userAnswer, mistake.term) && !isNegatedConcept(userAnswer, mistake.term)) return { strength: 'developing', matched: mistake.term, xp: 3, isCommonMistake: true, mistakeExplanation: mistake.explanation };
  }
  for (const item of acceptedAnswers) {
    const concept = item.term;
    const normalizedConcept = normalizeString(concept);
    const distance = levenshteinDistance(normalizedAnswer, normalizedConcept);
    const maxLen = Math.max(normalizedAnswer.length, normalizedConcept.length);
    const similarity = maxLen === 0 ? 1 : 1 - distance / maxLen;
    if (normalizedConcept.length >= 5 && similarity >= 0.85) return { strength: 'strong', matched: concept, xp: 7, explanation: item.explanation, isPrimary: item.isPrimary, note: `The expected term is "${concept}". Your spelling variation was accepted.` };
  }
  return { strength: 'developing', matched: correctAnswer, xp: 3 };
}

export function computeRecallLevel(totalXp) { return Math.floor((totalXp || 0) / 100) + 1; }

export function computeXpProgress(totalXp) {
  const xp = totalXp || 0;
  const level = computeRecallLevel(xp);
  const xpIntoLevel = xp % 100;
  const xpToNext = 100 - xpIntoLevel;
  const progressPercent = xpIntoLevel;
  return { level, xpIntoLevel, xpToNext, progressPercent };
}

export function computeRankTitle(totalXp) {
  const xp = totalXp || 0;
  if (xp >= 10000) return 'Master Biologist';
  if (xp >= 6000) return 'Scientist';
  if (xp >= 3000) return 'Biologist';
  if (xp >= 1500) return 'Scholar';
  if (xp >= 500) return 'Explorer';
  return 'Beginner';
}

export function computeHeatmapIntensity(count) {
  if (!count || count === 0) return 0;
  if (count <= 2) return 1;
  if (count <= 5) return 2;
  if (count <= 10) return 3;
  return 4;
}

export function formatTimeServer(seconds) {
  if (!seconds || seconds <= 0) return '0s';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

export function computeSessionReport(userAnswers, totalQuestions) {
  const answers = userAnswers || [];
  const excellent = answers.filter(a => a.strength === 'excellent').length;
  const strong = answers.filter(a => a.strength === 'strong').length;
  const developing = answers.filter(a => a.strength === 'developing').length;
  const masteryScore = totalQuestions > 0 ? Math.round(((excellent * 100 + strong * 70) / (totalQuestions * 100)) * 100) : 0;
  const totalTime = answers.reduce((sum, a) => sum + (a.time_taken_seconds || 0), 0);
  const avgTime = answers.length > 0 ? Math.round(totalTime / answers.length) : 0;
  const topicCounts = {};
  answers.forEach(a => { if (a.topic) topicCounts[a.topic] = (topicCounts[a.topic] || 0) + 1; });
  const topTopic = Object.entries(topicCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  return {
    excellent,
    strong,
    developing,
    mastery_score: masteryScore,
    total_time_seconds: totalTime,
    total_time_formatted: formatTimeServer(totalTime),
    avg_time_seconds: avgTime,
    avg_time_formatted: formatTimeServer(avgTime),
    top_topic: topTopic
  };
}

export const STRENGTH_MEANINGS = {
  excellent: { label: 'Perfect Match!', description: "You've mastered this concept. The answer matches exactly.", icon: 'star', color: '#27ae60' },
  strong: { label: 'Close Match', description: 'Correct meaning, minor spelling variation accepted.', icon: 'check-circle', color: '#2e86c1' },
  developing: { label: 'Needs Review', description: 'Not quite. Review the correct answer below and try again later.', icon: 'refresh', color: '#e67e22' }
};

export const LEVEL_SPIN_MESSAGES = {
  'O-Level': ['Checking...', 'Reviewing biology...', 'Comparing terms...', 'Feedback ready'],
  'A-Level': ['Reviewing pathways...', 'Analyzing science...', 'Evaluating precision...', 'Feedback ready'],
  'Pharmacy': ['Analyzing pharmacology...', 'Reviewing terminology...', 'Evaluating recall...', 'Feedback ready']
};

export const SUBJECT_ILLUSTRATIONS = { 'O-Level': 'fa-microscope', 'A-Level': 'fa-dna', 'Pharmacy': 'fa-capsules' };

export const MOTIVATIONAL_QUOTES = [
  '"The cell is the basic unit of life." - Schleiden & Schwann',
  '"Knowledge grows through active recall."',
  '"Practice makes progress, not perfect."',
  '"The brain learns by retrieval, not repetition."'
];

export const FLOATING_CARD_CONCEPTS = {
  'O-Level': ['Cell', 'Nucleus', 'Mitochondria'],
  'A-Level': ['DNA', 'Enzyme', 'Chromosome'],
  'Pharmacy': ['Insulin', 'CYP450', 'Statins']
};

export function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export const cache = new Map();

export function getCached(key) {
  const entry = cache.get(key);
  if (entry && Date.now() < entry.expires) return entry.value;
  cache.delete(key);
  return null;
}

export function setCached(key, value, ttl) {
  cache.set(key, { value, expires: Date.now() + ttl });
  if (cache.size > 500) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].expires - b[1].expires)[0];
    cache.delete(oldest[0]);
  }
}

export function invalidateUserCache(userId) {
  cache.delete(`stats:${userId}`);
  cache.delete(`dashboard:${userId}`);
}

const rateLimitBuckets = new Map();
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW = 60000;

export function checkRateLimit(key) {
  const now = Date.now();
  const bucket = rateLimitBuckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    if (rateLimitBuckets.size > 5000) {
      const oldestKey = [...rateLimitBuckets.entries()].sort((a, b) => a[1].resetAt - b[1].resetAt)[0][0];
      rateLimitBuckets.delete(oldestKey);
    }
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1 };
  }
  if (bucket.count >= RATE_LIMIT_MAX) return { allowed: false, remaining: 0, retryAfterMs: bucket.resetAt - now };
  bucket.count++;
  return { allowed: true, remaining: RATE_LIMIT_MAX - bucket.count };
}

export async function addXp(userId, amount, reason, sessionId, questionId) {
  const { data: current } = await supabase.from('user_recall_stats').select('total_xp').eq('user_id', userId).maybeSingle();
  const newTotal = (current?.total_xp || 0) + amount;
  await supabase.from('user_recall_stats').upsert({
    user_id: userId,
    total_xp: newTotal,
    recall_level: computeRecallLevel(newTotal),
    updated_at: new Date().toISOString()
  }, { onConflict: 'user_id' });
  await supabase.from('recall_xp_log').insert({
    user_id: userId,
    amount,
    reason,
    session_id: sessionId || null,
    question_id: questionId || null,
    created_at: new Date().toISOString()
  });
  return newTotal;
}

export async function updateTopicPerformance(userId, level, topic, sessionMasteryScore) {
  const { data: existing } = await supabase
    .from('user_recall_stats')
    .select('mastery, topic_completion, last_topic_date, best_mastery')
    .eq('user_id', userId)
    .maybeSingle();
  const mastery = { ...(existing?.mastery || {}) };
  const topicCompletion = { ...(existing?.topic_completion || {}) };
  const lastTopicDate = { ...(existing?.last_topic_date || {}) };
  const prevAttempts = topicCompletion[topic] || 0;
  const prevMastery = mastery[topic] ?? sessionMasteryScore;
  const weight = Math.min(prevAttempts, 4);
  const newMastery = Math.round((prevMastery * weight + sessionMasteryScore) / (weight + 1));
  mastery[topic] = newMastery;
  topicCompletion[topic] = prevAttempts + 1;
  lastTopicDate[topic] = new Date().toISOString().slice(0, 10);
  const bestMastery = Math.max(existing?.best_mastery || 0, sessionMasteryScore);
  await supabase.from('user_recall_stats').upsert({
    user_id: userId,
    mastery,
    topic_completion: topicCompletion,
    last_topic_date: lastTopicDate,
    best_mastery: bestMastery,
    selected_level: level,
    updated_at: new Date().toISOString()
  }, { onConflict: 'user_id' });
  return newMastery;
}

export async function getMasteryTopics(userId) {
  const { data, error } = await supabase.from('user_recall_stats').select('mastery').eq('user_id', userId).maybeSingle();
  if (error || !data) return {};
  return data.mastery || {};
}

const STREAK_MAX_GAP_DAYS = 1;

export function computeStreak(lastSessionDate, currentStreak) {
  const today = new Date().toISOString().slice(0, 10);
  if (!lastSessionDate) return { streak: 1, isNewDay: true };
  if (lastSessionDate === today) return { streak: currentStreak || 1, isNewDay: false };
  const last = new Date(`${lastSessionDate}T00:00:00Z`);
  const now = new Date(`${today}T00:00:00Z`);
  const diffDays = Math.round((now - last) / 86400000);
  if (diffDays <= STREAK_MAX_GAP_DAYS) return { streak: (currentStreak || 0) + 1, isNewDay: true };
  return { streak: 1, isNewDay: true };
}

export function computeAccuracy(excellentCount, strongCount, totalQuestions) {
  if (!totalQuestions) return 0;
  return Math.round(((excellentCount * 100 + strongCount * 70) / (totalQuestions * 100)) * 100);
}

export async function recordSessionActivity(userId, sessionAnswers) {
  const { data: stats } = await supabase
    .from('user_recall_stats')
    .select('current_streak, longest_streak, best_streak, last_session_date, total_sessions, total_questions, excellent_count, strong_count, developing_count')
    .eq('user_id', userId)
    .maybeSingle();
  const { streak, isNewDay } = computeStreak(stats?.last_session_date, stats?.current_streak);
  const longestStreak = Math.max(streak, stats?.longest_streak || 0);
  const bestStreak = Math.max(streak, stats?.best_streak || 0);
  const answers = sessionAnswers || [];
  const excellentDelta = answers.filter(a => a.strength === 'excellent').length;
  const strongDelta = answers.filter(a => a.strength === 'strong').length;
  const developingDelta = answers.filter(a => a.strength === 'developing').length;
  await supabase.from('user_recall_stats').upsert({
    user_id: userId,
    current_streak: streak,
    longest_streak: longestStreak,
    best_streak: bestStreak,
    last_session_date: new Date().toISOString().slice(0, 10),
    total_sessions: (stats?.total_sessions || 0) + 1,
    total_questions: (stats?.total_questions || 0) + answers.length,
    excellent_count: (stats?.excellent_count || 0) + excellentDelta,
    strong_count: (stats?.strong_count || 0) + strongDelta,
    developing_count: (stats?.developing_count || 0) + developingDelta,
    updated_at: new Date().toISOString()
  }, { onConflict: 'user_id' });
  return { current_streak: streak, longest_streak: longestStreak, best_streak: bestStreak, is_new_day: isNewDay };
}

export async function getLeaderboardEntries(level, limit) {
  const lim = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 50);
  let query = supabase
    .from('user_recall_stats')
    .select('user_id, selected_level, total_xp, current_streak')
    .order('total_xp', { ascending: false })
    .limit(lim);
  if (level) query = query.eq('selected_level', level);
  const { data, error } = await query;
  if (error || !data || data.length === 0) return [];
  const names = await Promise.all(data.map(async (row) => {
    const name = await getUserProfileName(row.user_id);
    return [row.user_id, name];
  }));
  const nameMap = new Map(names);
  return data
    .map(row => ({
      user_id: row.user_id,
      display_name: nameMap.get(row.user_id) || 'Anonymous Learner',
      total_xp: row.total_xp || 0,
      rank_title: computeRankTitle(row.total_xp || 0),
      recall_level: computeRecallLevel(row.total_xp || 0),
      current_streak: row.current_streak || 0
    }))
    .sort((a, b) => b.total_xp - a.total_xp);
}

export async function getCurriculumLevelMeta(levelId) {
  if (!levelId) return null;
  const { data } = await supabase
    .from('curriculum_levels')
    .select('id, display_name, kind, group_label, unit_label, icon, color, display_order')
    .eq('id', levelId)
    .maybeSingle();
  return data || null;
}

export async function getMotivationalQuote(levelId, unitId) {
  let query = supabase
    .from('recall_motivational_quotes')
    .select('quote, author')
    .eq('is_active', true)
    .limit(20);
  if (levelId) query = query.eq('level_id', levelId);
  if (unitId) query = query.or(`unit_id.eq.${unitId},unit_id.is.null`);
  else query = query.is('unit_id', null);
  const { data, error } = await query;
  if (error || !data || data.length === 0) return null;
  return data[Math.floor(Math.random() * data.length)];
}

const SM2_MIN_EASE = 1.3;

export async function updateSpacedRepetition(userId, questionId, level, topic, strength) {
  const quality = strength === 'excellent' ? 5 : strength === 'strong' ? 4 : 2;
  const { data: existing } = await supabase
    .from('user_spaced_repetition')
    .select('ease_factor, interval_days, repetitions')
    .eq('user_id', userId)
    .eq('question_id', questionId)
    .maybeSingle();
  let easeFactor = existing?.ease_factor ?? 2.5;
  let repetitions = existing?.repetitions ?? 0;
  let intervalDays = existing?.interval_days ?? 1;
  if (quality < 3) {
    repetitions = 0;
    intervalDays = 1;
  } else {
    if (repetitions === 0) intervalDays = 1;
    else if (repetitions === 1) intervalDays = 6;
    else intervalDays = Math.round(intervalDays * easeFactor);
    repetitions += 1;
  }
  easeFactor = Math.max(SM2_MIN_EASE, easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));
  const nextReviewDate = new Date(Date.now() + intervalDays * 86400000).toISOString();
  await supabase.from('user_spaced_repetition').upsert({
    user_id: userId,
    question_id: questionId,
    level,
    topic,
    ease_factor: easeFactor,
    interval_days: intervalDays,
    repetitions,
    next_review_date: nextReviewDate,
    last_reviewed_at: new Date().toISOString()
  }, { onConflict: 'user_id,question_id' });
  return { ease_factor: easeFactor, interval_days: intervalDays, repetitions, next_review_date: nextReviewDate };
}

export async function getDueReviewQuestions(userId, limit) {
  const lim = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 50);
  const { data, error } = await supabase
    .from('user_spaced_repetition')
    .select('question_id, level, topic, next_review_date, repetitions')
    .eq('user_id', userId)
    .lte('next_review_date', new Date().toISOString())
    .order('next_review_date', { ascending: true })
    .limit(lim);
  if (error) return [];
  return data || [];
}

export async function checkAndAwardAchievements(userId, stats) {
  const { data: allAchievements } = await supabase.from('achievements').select('*');
  if (!allAchievements || allAchievements.length === 0) return [];
  const { data: earned } = await supabase.from('user_achievements').select('achievement_id').eq('user_id', userId);
  const earnedIds = new Set((earned || []).map(e => e.achievement_id));
  const statsMap = {
    total_xp: stats.total_xp || 0,
    current_streak: stats.current_streak || 0,
    longest_streak: stats.longest_streak || 0,
    total_sessions: stats.total_sessions || 0,
    total_questions: stats.total_questions || 0,
    excellent_count: stats.excellent_count || 0,
    strong_count: stats.strong_count || 0
  };
  const newlyEarned = [];
  for (const ach of allAchievements) {
    if (earnedIds.has(ach.id)) continue;
    const value = statsMap[ach.requirement_type];
    if (value !== undefined && value >= ach.requirement_value) newlyEarned.push(ach);
  }
  if (newlyEarned.length > 0) {
    await supabase.from('user_achievements').insert(
      newlyEarned.map(ach => ({ user_id: userId, achievement_id: ach.id, earned_at: new Date().toISOString() }))
    );
  }
  return newlyEarned;
}

export async function handleGetSession(userId, { level, topic, class_name }) {
  let query = supabase
    .from('recall_sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('level', level)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1);

  if (topic) query = query.eq('topic', topic);
  if (class_name) query = query.eq('class_name', class_name);

  const { data } = await query.maybeSingle();
  return data || null;
}

export async function handleSessionCheck(userId, { level, topic, class_name }) {
  const session = await handleGetSession(userId, { level, topic, class_name });
  if (!session) return { exists: false };
  return {
    exists: true,
    session_id: session.session_id,
    current_index: session.current_index,
    total_questions: (session.question_ids || session.all_question_ids || []).length,
    completed: !session.is_active
  };
}

export async function handleContinueSession(userId, body) {
  const { session_id } = body;
  const { data } = await supabase
    .from('recall_sessions')
    .select('*')
    .eq('session_id', session_id)
    .eq('user_id', userId)
    .eq('is_active', true)
    .single();
  if (!data) throw new Error('Session not found');
  const questionIds = data.all_question_ids || data.question_ids || [];
  const currentIndex = data.current_index || 0;
  const currentQuestionId = questionIds[currentIndex];
  let currentQuestion = null;
  if (currentQuestionId) {
    const { data: q } = await supabase.from('recall_questions_bank').select('*').eq('id', currentQuestionId).single();
    currentQuestion = q;
  }
  return {
    session_id: data.session_id,
    current_index: currentIndex,
    total_questions: questionIds.length,
    current_question: currentQuestion,
    user_answers: data.user_answers || [],
    level: data.level,
    topic: data.topic
  };
}

export async function handleSubmitAnswer(userId, body, fingerprint) {
  const { session_id, question_id, user_answer, nonce, started_at } = body;
  const { data: session } = await supabase
    .from('recall_sessions')
    .select('*')
    .eq('session_id', session_id)
    .eq('user_id', userId)
    .eq('is_active', true)
    .single();
  if (!session) throw new Error('Session not found');
  const { data: question } = await supabase.from('recall_questions_bank').select('*').eq('id', question_id).single();
  if (!question) throw new Error('Question not found');
  const strength = calculateRecallStrength(user_answer, question.correct_answer, question.alternate_answers || [], question.common_mistakes || []);
  const userAnswers = [...(session.user_answers || []), {
    question_id,
    user_answer,
    strength: strength.strength,
    correct_answer: question.correct_answer,
    explanation: strength.explanation || question.correct_explanation || question.explanation || '',
    xp_earned: strength.xp,
    time_taken_seconds: started_at ? Math.round((Date.now() - new Date(started_at).getTime()) / 1000) : 0
  }];
  const newIndex = (session.current_index || 0) + 1;
  const questionIds = session.all_question_ids || session.question_ids || [];
  const isComplete = newIndex >= questionIds.length;
  await supabase.from('recall_sessions').update({
    user_answers: userAnswers,
    current_index: newIndex,
    is_active: !isComplete,
    completed_at: isComplete ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
    version: (session.version || 0) + 1
  }).eq('session_id', session_id);
  if (strength.xp > 0) await addXp(userId, strength.xp, 'recall_answer');
  await drainEnergyForAnswer(userId);
  return {
    strength: strength.strength,
    xp_earned: strength.xp,
    correct_answer: question.correct_answer,
    explanation: strength.explanation || question.correct_explanation || question.explanation || '',
    is_complete: isComplete,
    current_index: newIndex,
    total_questions: questionIds.length
  };
}

export async function handleCompleteSession(userId, body) {
  const { session_id } = body;
  const { data: session } = await supabase
    .from('recall_sessions')
    .select('*')
    .eq('session_id', session_id)
    .eq('user_id', userId)
    .single();
  if (!session) throw new Error('Session not found');
  await supabase.from('recall_sessions').update({
    is_active: false,
    completed_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }).eq('session_id', session_id);
  const userAnswers = session.user_answers || [];
  const report = computeSessionReport(userAnswers, (session.all_question_ids || session.question_ids || []).length);
  await updateTopicPerformance(userId, session.level, session.topic, report.mastery_score);
  const streakInfo = await recordSessionActivity(userId);
  return { success: true, report, streak_info: streakInfo };
}

export async function handleGetStats(userId) {
  const { data } = await supabase.from('user_recall_stats').select('*').eq('user_id', userId).maybeSingle();
  return data || { total_xp: 0, recall_level: 1, current_streak: 0, longest_streak: 0, total_sessions: 0, total_questions: 0 };
}

export async function handleGetAchievements(userId) {
  const { data } = await supabase.from('user_achievements').select('achievement_id, earned_at').eq('user_id', userId);
  const achievements = [];
  for (const a of (data || [])) {
    const { data: ach } = await supabase.from('achievements').select('*').eq('id', a.achievement_id).single();
    if (ach) achievements.push({ ...ach, earned_at: a.earned_at });
  }
  return achievements;
}

export async function handleGetDashboard(userId) {
  const [stats, xp] = await Promise.all([
    handleGetStats(userId),
    supabase.from('user_xp').select('total_xp, rank_title').eq('user_id', userId).maybeSingle()
  ]);
  const xpData = xp?.data || { total_xp: 0, rank_title: 'Beginner' };
  const xpProgress = computeXpProgress(xpData.total_xp);
  return {
    ...stats,
    total_xp: xpData.total_xp,
    rank_title: xpData.rank_title,
    xp_progress: xpProgress
  };
}

export async function getTopicsForLevel(unitId) {
  const { data: questions, error } = await supabase
    .from('recall_questions_bank')
    .select('topic, unit_id')
    .eq('unit_id', unitId)
    .eq('is_active', true);

  if (error) return [];

  const topics = [...new Set((questions || []).map(q => q.topic))];
  const result = [];
  for (const topic of topics) {
    const { count } = await supabase
      .from('recall_questions_bank')
      .select('id', { count: 'exact', head: true })
      .eq('unit_id', unitId)
      .eq('topic', topic)
      .eq('is_active', true);
    result.push({
      topic_name: topic,
      unit_id: unitId,
      question_count: count || 0
    });
  }
  return result;
}

export async function handleSetLevel(userId, level) {
  await supabase.from('user_recall_stats').upsert({
    user_id: userId,
    selected_level: level,
    updated_at: new Date().toISOString()
  }, { onConflict: 'user_id' });
  return { success: true };
}

export async function handleGetLevel(userId) {
  const { data } = await supabase.from('user_recall_stats').select('selected_level').eq('user_id', userId).maybeSingle();
  return { selected_level: data?.selected_level || null };
}

export const supabaseAnon = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

function base64url(input) { return Buffer.from(input).toString('base64url'); }

function signSupabaseJwt(userId) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = { sub: userId, role: 'authenticated', aud: 'authenticated', iat: now, exp: now + 15 * 60 };
  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const signature = crypto.createHmac('sha256', process.env.SUPABASE_JWT_SECRET).update(`${encodedHeader}.${encodedPayload}`).digest('base64url');
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

export function getUserClient(userId) {
  if (!userId) return supabaseAnon;
  const token = signSupabaseJwt(userId);
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

export function getAuthOnlyClient() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

export async function getUserProfileName(userId) {
  if (!userId) return null;
  try {
    const { data: { user } } = await supabase.auth.admin.getUserById(userId);
    return user?.user_metadata?.full_name || null;
  } catch { return null; }
}

export function maskEmail(email) {
  if (!email || typeof email !== 'string') return 'unknown';
  const [local, domain] = email.split('@');
  if (!domain) return 'invalid';
  const maskedLocal = local.length <= 2 ? local[0] + '*' : local[0] + '*'.repeat(Math.min(local.length - 2, 6)) + local[local.length - 1];
  return `${maskedLocal}@${domain}`;
}

export async function auditLog({ actorId, actorRole, action, targetType, targetId, ip, metadata }) {
  try {
    await supabase.from('audit_log').insert({
      actor_id: actorId || null,
      actor_role: actorRole || null,
      action,
      target_type: targetType || null,
      target_id: targetId ? String(targetId) : null,
      ip_address: ip || null,
      metadata: metadata || {},
      created_at: new Date().toISOString()
    });
  } catch (e) {
    console.error('[AUDIT_LOG_FAILED]', JSON.stringify({ action, message: e.message }));
  }
}

export function checkPasswordBreached(password) {
  return new Promise((resolve) => {
    try {
      const sha1 = crypto.createHash('sha1').update(password).digest('hex').toUpperCase();
      const prefix = sha1.substring(0, 5);
      const suffix = sha1.substring(5);
      const req = https.get(`https://api.pwnedpasswords.com/range/${prefix}`, {
        timeout: 2500,
        headers: { 'User-Agent': 'AliverBiopharm-Security-Check' }
      }, (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          const lines = body.split('\n');
          const match = lines.find(l => l.split(':')[0] === suffix);
          resolve(match ? { breached: true, count: parseInt(match.split(':')[1] || '0', 10) } : { breached: false });
        });
      });
      req.on('error', () => resolve({ breached: false, checkFailed: true }));
      req.on('timeout', () => { req.destroy(); resolve({ breached: false, checkFailed: true }); });
    } catch {
      resolve({ breached: false, checkFailed: true });
    }
  });
}

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function generateTotpSecret() {
  const bytes = crypto.randomBytes(20);
  let bits = '';
  for (const byte of bytes) bits += byte.toString(2).padStart(8, '0');
  let secret = '';
  for (let i = 0; i + 5 <= bits.length; i += 5) secret += BASE32_ALPHABET[parseInt(bits.substring(i, i + 5), 2)];
  return secret;
}

function base32Decode(base32) {
  const clean = base32.replace(/=+$/, '').toUpperCase();
  let bits = '';
  for (const char of clean) {
    const val = BASE32_ALPHABET.indexOf(char);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.substring(i, i + 8), 2));
  return Buffer.from(bytes);
}

function totpAt(secretBase32, timeStep) {
  const key = base32Decode(secretBase32);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(timeStep));
  const hmac = crypto.createHmac('sha1', key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = ((hmac[offset] & 0x7f) << 24) | ((hmac[offset + 1] & 0xff) << 16) | ((hmac[offset + 2] & 0xff) << 8) | (hmac[offset + 3] & 0xff);
  return (code % 1000000).toString().padStart(6, '0');
}

export function verifyTotp(secretBase32, userCode) {
  if (!secretBase32 || !userCode || !/^\d{6}$/.test(userCode)) return false;
  const step = Math.floor(Date.now() / 1000 / 30);
  for (const drift of [0, -1, 1]) {
    const expected = totpAt(secretBase32, step + drift);
    if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(userCode))) return true;
  }
  return false;
}

export function totpProvisioningUri(secretBase32, email, issuer = 'AliverBiopharm') {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email)}?secret=${secretBase32}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

export async function isTeacherApproved(userId) {
  if (!userId) return false;
  const { data: profile, error } = await supabase
    .from('user_profiles')
    .select('role, is_approved_teacher, approved_track')
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !profile) return false;
  if (profile.role !== 'teacher') return false;
  return profile.is_approved_teacher === true;
}

export function generateCsrfToken(secret, fingerprint) {
  const timestamp = Math.floor(Date.now() / (15 * 60 * 1000)) * (15 * 60 * 1000);
  const combined = fingerprint ? `${secret}:${fingerprint}` : secret;
  const hmac = crypto.createHmac('sha256', combined).update(timestamp.toString()).digest('hex');
  return `${timestamp}.${hmac}`;
}

export function verifyCsrf(req, secret, userId, fingerprint) {
  const token = req.headers['x-csrf-token'];
  if (!token) throw new Error('Invalid CSRF token');
  try {
    const [timestamp, hmac] = token.split('.');
    if (!timestamp || !hmac) throw new Error('Invalid CSRF token');
    const ts = parseInt(timestamp, 10);
    const currentWindow = Math.floor(Date.now() / (15 * 60 * 1000)) * (15 * 60 * 1000);
    const prevWindow = currentWindow - 15 * 60 * 1000;
    if (ts !== currentWindow && ts !== prevWindow) throw new Error('Invalid CSRF token');
    const combined = fingerprint ? `${secret}:${fingerprint}` : secret;
    const expectedHmac = crypto.createHmac('sha256', combined).update(timestamp).digest('hex');
    if (!crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expectedHmac))) throw new Error('Invalid CSRF token');
  } catch (e) { throw new Error('Invalid CSRF token'); }
}
