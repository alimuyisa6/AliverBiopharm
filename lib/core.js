 import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import https from 'https';

export const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
export const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

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

// Fetches a session row whose CURRENT hash matches, or whose PREVIOUS hash
// matches and is still within its post-rotation grace window. This is what
// stops concurrent in-flight requests (e.g. several parallel dashboard
// fetches on page load) from getting falsely logged out the instant another
// request rotates the session token underneath them.
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
    .select('admin_role, permissions, is_active, is_locked, ip_whitelist, id, is_online, is_busy, admin_email, mfa_enabled, mfa_secret')
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

export function isValidLevel(level) { return level === 'O-Level' || level === 'A-Level' || level === 'Pharmacy'; }

export function isValidTopic(topic) {
  if (topic === null || topic === undefined) return true;
  return /^[a-zA-Z0-9\s\-]{1,50}$/.test(topic);
}

export function isValidSessionId(id) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id); }

export function isValidQuestionId(id) { return Number.isInteger(id) && id > 0; }

export function isValidUserAnswer(answer) { return typeof answer === 'string' && answer.length > 0 && answer.length <= 500; }

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

export async function addXp(userId, amount, reason) {
  const { data: current } = await supabase.from('user_xp').select('total_xp').eq('user_id', userId).maybeSingle();
  const newTotal = (current?.total_xp || 0) + amount;
  await supabase.from('user_xp').upsert({
    user_id: userId,
    total_xp: newTotal,
    level: Math.floor(newTotal / 100) + 1,
    rank_title: computeRankTitle(newTotal)
  }, { onConflict: 'user_id' });
  await supabase.from('xp_events').insert({
    user_id: userId,
    event_type: reason,
    amount,
    created_at: new Date().toISOString()
  });
}

export async function updateTopicPerformance(userId, level, topic, percentage) {
  await supabase.from('user_topic_stats').upsert({
    user_id: userId,
    topic,
    xp: percentage,
    last_activity_date: new Date().toISOString().slice(0, 10)
  }, { onConflict: 'user_id,topic' });
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
  return { success: true, report };
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

const TRACK_RANK = { 'O-Level': 0, 'A-Level': 1, 'Pharmacy': 2 };

export async function enforceClassAccess(userId, requestedLevel, requestedClassName) {
  if (!userId || !requestedLevel || !requestedClassName) return false;
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, track, class_name, onboarding_completed')
    .eq('user_id', userId)
    .maybeSingle();
  if (!profile || !profile.onboarding_completed) return false;
  if (profile.role === 'teacher') return true;

  const requestedRank = TRACK_RANK[requestedLevel];
  const ownRank = TRACK_RANK[profile.track];
  if (requestedRank === undefined || ownRank === undefined) return false;
  if (requestedRank < ownRank) return true;
  if (requestedRank > ownRank) return false;

  if (profile.class_name === requestedClassName) return true;

  const [{ data: ownSeq }, { data: requestedSeq }] = await Promise.all([
    supabase.from('curriculum_groups')
      .select('sequence_order')
      .eq('level_id', profile.track)
      .eq('name', profile.class_name)
      .maybeSingle(),
    supabase.from('curriculum_groups')
      .select('sequence_order')
      .eq('level_id', requestedLevel)
      .eq('name', requestedClassName)
      .maybeSingle()
  ]);

  if (!ownSeq || !requestedSeq) return true;
  return requestedSeq.sequence_order <= ownSeq.sequence_order;
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

export async function canAccessLevel(userId, level) {
  if (!userId || !level) return false;
  if (!isValidLevel(level)) return false;
  const adminData = await isAdmin(userId, 'unknown');
  if (adminData && adminData.admin_role) return true;
  const { data: profile, error } = await supabase
    .from('user_profiles')
    .select('role, track, is_approved_teacher, approved_track')
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !profile) return false;
  if (profile.role === 'student') return profile.track === level;
  if (profile.role === 'teacher') {
    if (!profile.is_approved_teacher) return false;
    if (profile.approved_track === 'ALL') return true;
    return profile.approved_track === level;
  }
  return false;
}

export async function getUserEffectiveLevel(userId) {
  if (!userId) return null;
  const adminData = await isAdmin(userId, 'unknown');
  if (adminData && adminData.admin_role) return 'ALL';
  const { data: profile, error } = await supabase
    .from('user_profiles')
    .select('role, track, is_approved_teacher, approved_track')
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !profile) return null;
  if (profile.role === 'student') return profile.track;
  if (profile.role === 'teacher') {
    if (!profile.is_approved_teacher) return null;
    return profile.approved_track || profile.track;
  }
  return null;
}

export function canUserAccessContent(userProfile, contentLevel) {
  if (!userProfile || !contentLevel) return false;
  if (!isValidLevel(contentLevel)) return false;
  if (userProfile.role === 'teacher' && userProfile.is_approved_teacher && userProfile.approved_track === 'ALL') return true;
  if (userProfile.role === 'teacher' && userProfile.is_approved_teacher) return userProfile.approved_track === contentLevel || userProfile.track === contentLevel;
  if (userProfile.role === 'student') return userProfile.track === contentLevel;
  return false;
}
