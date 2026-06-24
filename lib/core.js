 import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

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
  const forwarded = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown';
  return forwarded.split(',')[0].trim();
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

export async function validateSession(token) {
  if (!token || token.length < 20) return null;
  const hashedToken = hashToken(token);
  const { data, error } = await supabase
    .from('user_sessions')
    .select('user_id, expires_at, is_active, fingerprint, created_at')
    .eq('session_token_hash', hashedToken)
    .eq('is_active', true)
    .single();
  if (error || !data) return null;
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
    .select('admin_role, permissions, is_active, is_locked, ip_whitelist, id, is_online, is_busy, admin_email')
    .eq('admin_id', userId)
    .eq('is_active', true)
    .maybeSingle();
  if (!data) return null;
  if (data.is_locked) return { ...data, admin_role: null };
  if (data.ip_whitelist && data.ip_whitelist.length > 0) {
    const clientIp = ip.split(',')[0].trim();
    if (!data.ip_whitelist.includes(clientIp) && !data.ip_whitelist.includes(ip)) {
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
  for (let j = 1; j <= b.length; j++) {
    for (let i = 1; i <= a.length; i++) {
      const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(matrix[j][i - 1] + 1, matrix[j - 1][i] + 1, matrix[j - 1][i - 1] + indicator);
    }
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
    if (normalizedAnswer === normalizedConcept) {
      return { strength: 'excellent', matched: concept, xp: 10, explanation: item.explanation, isPrimary: item.isPrimary };
    }
    if (!concept.includes(' ')) {
      if (containsConcept(userAnswer, concept) && !isNegatedConcept(userAnswer, concept)) {
        return { strength: 'excellent', matched: concept, xp: 10, explanation: item.explanation, isPrimary: item.isPrimary };
      }
    } else {
      if (containsExactPhrase(userAnswer, concept)) {
        return { strength: 'excellent', matched: concept, xp: 10, explanation: item.explanation, isPrimary: item.isPrimary };
      }
    }
  }
  for (const mistake of commonMistakes || []) {
    if (containsConcept(userAnswer, mistake.term) && !isNegatedConcept(userAnswer, mistake.term)) {
      return { strength: 'developing', matched: mistake.term, xp: 3, isCommonMistake: true, mistakeExplanation: mistake.explanation };
    }
  }
  for (const item of acceptedAnswers) {
    const concept = item.term;
    const normalizedConcept = normalizeString(concept);
    const distance = levenshteinDistance(normalizedAnswer, normalizedConcept);
    const maxLen = Math.max(normalizedAnswer.length, normalizedConcept.length);
    const similarity = maxLen === 0 ? 1 : 1 - distance / maxLen;
    if (normalizedConcept.length >= 5 && similarity >= 0.85) {
      return { strength: 'strong', matched: concept, xp: 7, explanation: item.explanation, isPrimary: item.isPrimary, note: `The expected term is "${concept}". Your spelling variation was accepted.` };
    }
  }
  return { strength: 'developing', matched: correctAnswer, xp: 3 };
}

export function isValidLevel(level) { return level === 'O-Level' || level === 'A-Level' || level === 'Pharmacy'; }
export function isValidTopic(topic) { if (topic === null || topic === undefined) return true; return /^[a-zA-Z0-9\s\-]{1,50}$/.test(topic); }
export function isValidSessionId(id) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id); }
export function isValidQuestionId(id) { return Number.isInteger(id) && id > 0; }
export function isValidUserAnswer(answer) { return typeof answer === 'string' && answer.length <= 500; }

export function generateCsrfToken(secret) {
  const timestamp = Math.floor(Date.now() / (15 * 60 * 1000)) * (15 * 60 * 1000);
  const hmac = crypto.createHmac('sha256', secret).update(timestamp.toString()).digest('hex');
  return `${timestamp}.${hmac}`;
}

export function verifyCsrf(req, secret, userId, ip) {
  const token = req.headers['x-csrf-token'];
  if (!token) throw new Error('Invalid CSRF token');
  try {
    const [timestamp, hmac] = token.split('.');
    if (!timestamp || !hmac) throw new Error('Invalid CSRF token');
    const ts = parseInt(timestamp, 10);
    const currentWindow = Math.floor(Date.now() / (15 * 60 * 1000)) * (15 * 60 * 1000);
    const prevWindow = currentWindow - 15 * 60 * 1000;
    if (ts !== currentWindow && ts !== prevWindow) throw new Error('Invalid CSRF token');
    const expectedHmac = crypto.createHmac('sha256', secret).update(timestamp).digest('hex');
    if (!crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expectedHmac))) throw new Error('Invalid CSRF token');
  } catch (e) {
    throw new Error('Invalid CSRF token');
  }
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
export function invalidateUserCache(userId) { cache.delete(`stats:${userId}`); cache.delete(`dashboard:${userId}`); }

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
  if (bucket.count >= RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0, retryAfterMs: bucket.resetAt - now };
  }
  bucket.count++;
  return { allowed: true, remaining: RATE_LIMIT_MAX - bucket.count };
}

export async function handleSessionCheck(userId, { level, topic }) {
  if (!isValidLevel(level)) throw new Error('Invalid level');
  if (!isValidTopic(topic)) throw new Error('Invalid topic');
  const today = new Date().toISOString().split('T')[0];
  const topicKey = topic || 'all';
  const { data } = await supabase.from('user_topic_completion').select('last_completed').eq('user_id', userId).eq('topic_key', topicKey).maybeSingle();
  if (data?.last_completed === today) return { available: false, message: 'You already completed this topic today. Come back tomorrow.' };
  return { available: true };
}

export async function handleGetSession(userId, { level, topic }) {
  if (!isValidLevel(level)) throw new Error('Invalid level');
  if (!isValidTopic(topic)) throw new Error('Invalid topic');
  const today = new Date().toISOString().split('T')[0];
  const topicKey = topic || 'all';
  let query = supabase
    .from('recall_sessions')
    .select('session_id, current_index, user_answers, question_ids, all_question_ids, topic, is_active')
    .eq('user_id', userId)
    .eq('level', level)
    .gte('created_at', today)
    .eq('is_active', true);
  if (topic) query = query.eq('topic', topic);
  else query = query.is('topic', null);
  const { data: existing } = await query.maybeSingle();
  if (existing && existing.question_ids?.length) {
    const questionIds = existing.question_ids.map(id => Number(id)).filter(id => !isNaN(id));
    if (!questionIds.length) throw new Error('No questions available for this topic yet.');
    const { data: questions } = await supabase.from('recall_questions_bank').select('id, question_text, topic').in('id', questionIds);
    const ordered = questionIds.map(id => questions?.find(q => Number(q.id) === id)).filter(Boolean);
    return {
      session_id: existing.session_id,
      questions: ordered.map(q => ({ id: q.id, text: q.question_text, topic: q.topic, concepts: [] })),
      current_index: existing.current_index || 0,
      user_answers: existing.user_answers || [],
      has_more: existing.question_ids.length < (existing.all_question_ids?.length || 0)
    };
  }
  const { data: completion } = await supabase.from('user_topic_completion').select('last_completed').eq('user_id', userId).eq('topic_key', topicKey).maybeSingle();
  if (completion?.last_completed === today) throw new Error('You already completed this topic today. Come back tomorrow.');
  const { data: weakConcepts } = await supabase.from('user_weak_concepts').select('concept').eq('user_id', userId);
  const weakSet = new Set((weakConcepts || []).map(w => w.concept));
  let qQuery = supabase.from('recall_questions_bank').select('id, question_text, topic, correct_answer, alternate_answers').eq('level', level).eq('is_active', true);
  if (topic) qQuery = qQuery.eq('topic', topic);
  const { data: rawQuestions } = await qQuery;
  if (!rawQuestions?.length) throw new Error('No questions available for this topic yet.');
  const weakQs = rawQuestions.filter(q => weakSet.has(q.correct_answer));
  const normalQs = rawQuestions.filter(q => !weakSet.has(q.correct_answer));
  shuffleArray(normalQs);
  const allSelected = [...weakQs, ...normalQs].slice(0, 20);
  const allQuestionIds = allSelected.map(q => Number(q.id));
  const firstBatchIds = allQuestionIds.slice(0, 5);
  const { data: newSession, error: sessionError } = await supabase
    .from('recall_sessions')
    .insert({ user_id: userId, level, topic: topic || null, question_ids: firstBatchIds, all_question_ids: allQuestionIds, current_index: 0, user_answers: [], is_active: true })
    .select('session_id')
    .single();
  if (sessionError) throw new Error(`Failed to create session: ${sessionError.message}`);
  const firstQuestions = allSelected.slice(0, 5).map(q => ({ id: q.id, text: q.question_text, topic: q.topic, concepts: [q.correct_answer, ...(q.alternate_answers?.map(a => a.term) || [])] }));
  return { session_id: newSession.session_id, questions: firstQuestions, has_more: allQuestionIds.length > 5 };
}

export async function handleContinueSession(userId, { session_id }) {
  if (!isValidSessionId(session_id)) throw new Error('Invalid session ID');
  const { data: session, error: sessionError } = await supabase.from('recall_sessions').select('question_ids, all_question_ids').eq('session_id', session_id).eq('user_id', userId).maybeSingle();
  if (sessionError || !session) throw new Error('Session not found');
  const currentIds = (session.question_ids || []).map(id => Number(id));
  const allIds = (session.all_question_ids || []).map(id => Number(id));
  const nextStart = currentIds.length;
  const nextBatch = allIds.slice(nextStart, nextStart + 5);
  if (nextBatch.length === 0) return { has_more: false, questions: [] };
  const newQuestionIds = [...currentIds, ...nextBatch];
  await supabase.from('recall_sessions').update({ question_ids: newQuestionIds }).eq('session_id', session_id);
  const { data: questions } = await supabase.from('recall_questions_bank').select('id, question_text, topic, correct_answer, alternate_answers').in('id', nextBatch);
  const ordered = nextBatch.map(id => questions?.find(q => Number(q.id) === id)).filter(Boolean);
  return { has_more: newQuestionIds.length < allIds.length, questions: ordered.map(q => ({ id: q.id, text: q.question_text, topic: q.topic, concepts: [q.correct_answer, ...(q.alternate_answers?.map(a => a.term) || [])] })) };
}

export async function handleSubmitAnswer(userId, params, ip) {
  const { session_id, question_id, user_answer, nonce } = params;
  if (!isValidSessionId(session_id)) throw new Error('Invalid session ID');
  if (!isValidQuestionId(question_id)) throw new Error('Invalid question ID');
  if (!isValidUserAnswer(user_answer)) throw new Error('Invalid answer');
  if (!nonce || typeof nonce !== 'string' || nonce.length < 16) throw new Error('Invalid request');
  const { data: nonceEntry } = await supabase.from('request_nonces').select('nonce').eq('nonce', nonce).eq('user_id', userId).maybeSingle();
  if (nonceEntry) throw new Error('Duplicate request');
  await supabase.from('request_nonces').insert({ nonce, user_id: userId, action: 'answer', expires_at: new Date(Date.now() + 30000).toISOString() });
  const today = new Date().toISOString().split('T')[0];
  const { data: session, error: sessionError } = await supabase.from('recall_sessions').select('session_id, current_index, user_answers, question_ids, is_active, topic, version').eq('session_id', session_id).eq('user_id', userId).maybeSingle();
  if (sessionError || !session) throw new Error('Session not found');
  if (!session.is_active) throw new Error('Session already completed');
  if (session.current_index >= session.question_ids.length) throw new Error('All questions answered');
  if (session.user_answers?.some(a => a.question_id === question_id)) throw new Error('Question already answered');
  const { data: questionBank } = await supabase.from('recall_questions_bank').select('correct_answer, correct_explanation, alternate_answers, common_mistakes').eq('id', question_id).single();
  if (!questionBank) throw new Error('Question not found');
  const result = calculateRecallStrength(user_answer, questionBank.correct_answer, questionBank.alternate_answers, questionBank.common_mistakes);
  const newUserAnswers = [
    ...(session.user_answers || []),
    { question_id, answer: user_answer, strength: result.strength, xp_earned: result.xp, answered_at: new Date().toISOString() }
  ];
  const newIndex = session.current_index + 1;
  const completed = newIndex >= session.question_ids.length;
  const { error: updateError } = await supabase
    .from('recall_sessions')
    .update({ user_answers: newUserAnswers, current_index: newIndex, is_active: !completed, completed_at: completed ? new Date().toISOString() : null, version: (session.version || 0) + 1 })
    .eq('session_id', session_id)
    .eq('version', session.version || 0);
  if (updateError) throw new Error('Concurrent modification, please retry');
  const { data: stats } = await supabase.from('user_recall_stats').select('total_xp, recall_level, current_streak, mastery, best_streak, best_mastery, milestones, last_session_date').eq('user_id', userId).maybeSingle();
  let statsData = stats || { total_xp: 0, recall_level: 1, current_streak: 0, mastery: {}, best_streak: 0, best_mastery: 0, milestones: [] };
  const newTotalXp = (statsData.total_xp || 0) + result.xp;
  const newRecallLevel = Math.floor(newTotalXp / 100) + 1;
  const currentMastery = statsData.mastery || {};
  const newMastery = { ...currentMastery };
  const topicName = session.topic || 'General';
  if (result.strength === 'excellent') newMastery[topicName] = Math.min(100, (currentMastery[topicName] || 0) + 5);
  else if (result.strength === 'strong') newMastery[topicName] = Math.min(100, (currentMastery[topicName] || 0) + 2);
  else newMastery[topicName] = Math.max(0, (currentMastery[topicName] || 100) - 3);
  if (result.strength === 'developing') {
    await supabase.from('user_weak_concepts').upsert({ user_id: userId, concept: questionBank.correct_answer }, { onConflict: 'user_id,concept' });
  }
  let newStreak = statsData.current_streak || 0;
  if (statsData.last_session_date !== today) {
    if (statsData.last_session_date === new Date(Date.now() - 86400000).toISOString().split('T')[0]) newStreak++;
    else newStreak = 1;
  }
  await supabase.from('user_daily_activity').upsert({ user_id: userId, activity_date: today, count: 1 }, { onConflict: 'user_id,activity_date' });
  await supabase.from('user_topic_stats').upsert({ user_id: userId, topic: topicName, xp: result.xp, streak: 1, last_activity_date: today }, { onConflict: 'user_id,topic' });
  let milestones = statsData.milestones || [];
  if (newRecallLevel > (statsData.recall_level || 1) && !milestones.includes(`Level ${newRecallLevel}`)) {
    milestones.push(`Level ${newRecallLevel}`);
    await supabase.from('user_milestones').insert({ user_id: userId, milestone: `Level ${newRecallLevel}` });
  }
  if (newStreak === 7 && !milestones.includes('7 Day Streak')) { milestones.push('7 Day Streak'); await supabase.from('user_milestones').insert({ user_id: userId, milestone: '7 Day Streak' }); }
  if (newStreak === 30 && !milestones.includes('30 Day Streak')) { milestones.push('30 Day Streak'); await supabase.from('user_milestones').insert({ user_id: userId, milestone: '30 Day Streak' }); }
  if (newStreak === 100 && !milestones.includes('100 Day Streak')) { milestones.push('100 Day Streak'); await supabase.from('user_milestones').insert({ user_id: userId, milestone: '100 Day Streak' }); }
  const bestStreak = Math.max(statsData.best_streak || 0, newStreak);
  const masteryValues = Object.values(newMastery);
  const avgMastery = masteryValues.length ? masteryValues.reduce((a, b) => a + b, 0) / masteryValues.length : 0;
  const bestMastery = Math.max(statsData.best_mastery || 0, avgMastery);
  await supabase.from('user_recall_stats').upsert({
    user_id: userId, total_xp: newTotalXp, recall_level: newRecallLevel, current_streak: newStreak,
    last_session_date: today, total_questions: (statsData.total_questions || 0) + 1,
    excellent_count: (statsData.excellent_count || 0) + (result.strength === 'excellent' ? 1 : 0),
    strong_count: (statsData.strong_count || 0) + (result.strength === 'strong' ? 1 : 0),
    developing_count: (statsData.developing_count || 0) + (result.strength === 'developing' ? 1 : 0),
    mastery: newMastery, best_streak: bestStreak, best_mastery: bestMastery, milestones
  }, { onConflict: 'user_id' });
  supabase.from('recall_xp_log').insert({ user_id: userId, amount: result.xp, reason: result.strength, session_id, question_id }).catch(() => {});
  invalidateUserCache(userId);
  if (completed) {
    const topicKey = session.topic || 'all';
    await supabase.from('user_topic_completion').upsert({ user_id: userId, topic_key: topicKey, last_completed: today }, { onConflict: 'user_id,topic_key' });
  }
  return {
    strength: result.strength, xp: result.xp, matched: result.matched,
    feedback: { correct_answer: questionBank.correct_answer, answer_explanation: questionBank.correct_explanation || null, related_concepts: [questionBank.correct_answer, ...(questionBank.alternate_answers?.map(a => a.term) || [])], common_mistakes: questionBank.common_mistakes || [] },
    common_mistake_explanation: result.mistakeExplanation || null, study_note: result.note || null
  };
}

export async function handleCompleteSession(userId, { session_id }) {
  if (!isValidSessionId(session_id)) throw new Error('Invalid session ID');
  const { data: session } = await supabase.from('recall_sessions').select('user_answers, topic, is_active').eq('session_id', session_id).eq('user_id', userId).maybeSingle();
  if (!session) throw new Error('Session not found');
  if (!session.is_active) {
    const totalXp = session.user_answers?.reduce((sum, a) => sum + (a.xp_earned || 0), 0) || 0;
    return { success: true, xp_earned_total: totalXp, already_completed: true };
  }
  const totalXp = session.user_answers?.reduce((sum, a) => sum + (a.xp_earned || 0), 0) || 0;
  await supabase.from('recall_sessions').update({ is_active: false, completed_at: new Date().toISOString() }).eq('session_id', session_id);
  const today = new Date().toISOString().split('T')[0];
  const topicKey = session.topic || 'all';
  await supabase.from('user_topic_completion').upsert({ user_id: userId, topic_key: topicKey, last_completed: today }, { onConflict: 'user_id,topic_key' });
  const { data: stats } = await supabase.from('user_recall_stats').select('total_sessions').eq('user_id', userId).single();
  if (stats) { await supabase.from('user_recall_stats').update({ total_sessions: (stats.total_sessions || 0) + 1 }).eq('user_id', userId); }
  return { success: true, xp_earned_total: totalXp };
}

export async function handleGetStats(userId) {
  const cacheKey = `stats:${userId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  const { data: stats } = await supabase.from('user_recall_stats').select('total_xp, current_streak, mastery, excellent_count, strong_count, developing_count, recall_level, total_questions, best_streak, best_mastery, milestones, selected_level').eq('user_id', userId).maybeSingle();
  if (!stats) {
    const empty = { total_xp: 0, streak_days: 0, mastery_percent: 0, excellent: 0, strong: 0, developing: 0, topic_mastery: {}, heatmap: {}, weak_concepts: [], recall_level: 1, achievements: [], topic_xp: {}, topic_streak: {}, selected_level: null, milestones: [], best_streak: 0, best_mastery: 0, total_questions: 0 };
    setCached(cacheKey, empty, 30000);
    return empty;
  }
  const masteryValues = Object.values(stats.mastery || {});
  const masteryPercent = masteryValues.length ? Math.round(masteryValues.reduce((a, b) => a + b, 0) / masteryValues.length) : 0;
  const { data: daily } = await supabase.from('user_daily_activity').select('activity_date, count').eq('user_id', userId);
  const heatmap = {};
  (daily || []).forEach(d => { heatmap[d.activity_date] = d.count; });
  const { data: topics } = await supabase.from('user_topic_stats').select('topic, xp, streak').eq('user_id', userId);
  const topicXp = {}, topicStreak = {};
  (topics || []).forEach(t => { topicXp[t.topic] = t.xp; topicStreak[t.topic] = t.streak; });
  const { data: weaks } = await supabase.from('user_weak_concepts').select('concept').eq('user_id', userId);
  const weakConcepts = (weaks || []).map(w => w.concept);
  const result = { total_xp: stats.total_xp || 0, streak_days: stats.current_streak || 0, mastery_percent: masteryPercent, excellent: stats.excellent_count || 0, strong: stats.strong_count || 0, developing: stats.developing_count || 0, topic_mastery: stats.mastery || {}, heatmap, weak_concepts: weakConcepts, recall_level: stats.recall_level || 1, achievements: [], topic_xp: topicXp, topic_streak: topicStreak, selected_level: stats.selected_level || null, milestones: stats.milestones || [], best_streak: stats.best_streak || 0, best_mastery: stats.best_mastery || 0, total_questions: stats.total_questions || 0 };
  setCached(cacheKey, result, 30000);
  return result;
}

export async function handleGetAchievements(userId) {
  const { data: stats } = await supabase.from('user_recall_stats').select('total_xp, current_streak, mastery, total_questions').eq('user_id', userId).single();
  if (!stats) return [];
  const xpTotal = stats.total_xp || 0;
  const streak = stats.current_streak || 0;
  const mastery = stats.mastery || {};
  const totalQuestions = stats.total_questions || 0;
  return [
    { key: 'firstRecall', title: 'First Recall', icon: 'fa-fire', unlocked: xpTotal > 0 },
    { key: 'tenQuestions', title: '10 Questions', icon: 'fa-bolt', unlocked: totalQuestions >= 10 },
    { key: 'fiftyQuestions', title: '50 Questions', icon: 'fa-trophy', unlocked: totalQuestions >= 50 },
    { key: 'hundredQuestions', title: '100 Questions', icon: 'fa-crown', unlocked: totalQuestions >= 100 },
    { key: 'sevenStreak', title: '7 Day Streak', icon: 'fa-fire', unlocked: streak >= 7 },
    { key: 'thirtyStreak', title: '30 Day Streak', icon: 'fa-star', unlocked: streak >= 30 },
    { key: 'hundredStreak', title: '100 Day Streak', icon: 'fa-gem', unlocked: streak >= 100 },
    { key: 'geneticsMaster', title: 'Genetics Master', icon: 'fa-dna', unlocked: (mastery.Genetics || 0) >= 80 },
    { key: 'cellMaster', title: 'Cell Biology Master', icon: 'fa-microscope', unlocked: (mastery['Cell Biology'] || 0) >= 80 },
    { key: 'pharmaMaster', title: 'Pharmacology Master', icon: 'fa-capsules', unlocked: (mastery.Pharmacology || 0) >= 80 }
  ];
}

export async function handleGetDashboard(userId) {
  const cacheKey = `dashboard:${userId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  const { data: stats } = await supabase.from('user_recall_stats').select('total_xp, recall_level, current_streak, best_streak, best_mastery, total_questions, selected_level').eq('user_id', userId).single();
  if (!stats) {
    const empty = { level: 1, xp: 0, xpToNext: 100, progressPercent: 0, streak: 0, bestStreak: 0, bestMastery: 0, totalQuestions: 0, milestones: [], dailyChallenge: { completed: 0, target: 10, progressPercent: 0 }, gardenStage: 'seedling', subjectIllustration: 'fa-flask', quote: 'Welcome! Start your first recall session.', brainEnergy: 100 };
    setCached(cacheKey, empty, 30000);
    return empty;
  }
  const today = new Date().toISOString().split('T')[0];
  const { data: daily } = await supabase.from('user_daily_activity').select('count').eq('user_id', userId).eq('activity_date', today).maybeSingle();
  const dailyQuestions = daily?.count || 0;
  const progressPercent = stats.total_xp % 100;
  let gardenStage = 'seedling';
  if (stats.current_streak >= 100) gardenStage = 'tree';
  else if (stats.current_streak >= 30) gardenStage = 'tree';
  else if (stats.current_streak >= 7) gardenStage = 'seedling';
  const subjectIllustration = { 'O-Level': 'fa-microscope', 'A-Level': 'fa-dna', 'Pharmacy': 'fa-capsules' };
  const quotes = ['"The cell is the basic unit of life." - Schleiden & Schwann', '"Knowledge grows through active recall."', '"Practice makes progress, not perfect."', '"The brain learns by retrieval, not repetition."'];
  const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
  const { data: milestones } = await supabase.from('user_milestones').select('milestone').eq('user_id', userId);
  const milestoneList = (milestones || []).map(m => m.milestone);
  const result = { level: stats.recall_level || 1, xp: stats.total_xp || 0, xpToNext: 100 - (stats.total_xp % 100), progressPercent, streak: stats.current_streak || 0, bestStreak: stats.best_streak || 0, bestMastery: stats.best_mastery || 0, totalQuestions: stats.total_questions || 0, milestones: milestoneList, dailyChallenge: { completed: dailyQuestions, target: 10, progressPercent: (dailyQuestions / 10) * 100 }, gardenStage, subjectIllustration: subjectIllustration[stats.selected_level] || 'fa-flask', quote: randomQuote, brainEnergy: 100 };
  setCached(cacheKey, result, 30000);
  return result;
}

export async function getTopicsForLevel(level) {
  const cacheKey = `topics:${level}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  const { data } = await supabase.from('recall_questions_bank').select('topic').eq('level', level).eq('is_active', true);
  const uniqueTopics = [...new Set((data || []).map(row => row.topic).filter(Boolean))];
  const result = uniqueTopics.map(t => ({ name: t, icon: 'fa-book' }));
  setCached(cacheKey, result, 3600000);
  return result;
}

export async function handleSetLevel(userId, level) {
  if (!isValidLevel(level)) throw new Error('Invalid level');
  const { data: existing } = await supabase.from('user_recall_stats').select('selected_level').eq('user_id', userId).maybeSingle();
  const { data: admin } = await supabase.from('admin_master').select('admin_role').eq('admin_id', userId).eq('is_active', true).maybeSingle();
  const isUserAdmin = admin?.admin_role === 'super_admin';
  if (existing?.selected_level && !isUserAdmin) throw new Error('Level already set and cannot be changed');
  await supabase.from('user_recall_stats').upsert({ user_id: userId, selected_level: level }, { onConflict: 'user_id' });
  invalidateUserCache(userId);
  return { success: true };
}

export async function handleGetLevel(userId) {
  const { data } = await supabase.from('user_recall_stats').select('selected_level').eq('user_id', userId).maybeSingle();
  const { data: admin } = await supabase.from('admin_master').select('admin_role').eq('admin_id', userId).eq('is_active', true).maybeSingle();
  return { selected_level: data?.selected_level || null, is_super_admin: admin?.admin_role === 'super_admin' };
}

export async function addXp(userId, amount, reason) {
  const { data: current } = await supabase.from('user_xp').select('total_xp, level').eq('user_id', userId).single();
  const newTotal = (current?.total_xp || 0) + amount;
  const newLevel = Math.floor(newTotal / 100) + 1;
  let rankTitle = 'Beginner';
  if (newTotal >= 10000) rankTitle = 'Master Biologist';
  else if (newTotal >= 6000) rankTitle = 'Scientist';
  else if (newTotal >= 3000) rankTitle = 'Biologist';
  else if (newTotal >= 1500) rankTitle = 'Scholar';
  else if (newTotal >= 500) rankTitle = 'Explorer';
  await supabase.from('user_xp').upsert({ user_id: userId, total_xp: newTotal, level: newLevel, rank_title: rankTitle }, { onConflict: 'user_id' });
  await supabase.from('xp_events').insert({ user_id: userId, event_type: reason, amount });
  if (current && current.level < newLevel) { await supabase.from('user_milestones').insert({ user_id: userId, milestone: `Level ${newLevel}` }); }
}

export async function updateTopicPerformance(userId, level, topic, percentage) {
  const { data: existing } = await supabase.from('user_topic_performance').select('id, attempt_count, avg_score').eq('user_id', userId).eq('level', level).eq('topic', topic).single();
  if (existing) {
    const newCount = existing.attempt_count + 1;
    const newAvg = Math.round(((existing.avg_score * existing.attempt_count) + percentage) / newCount);
    await supabase.from('user_topic_performance').update({ attempt_count: newCount, avg_score: newAvg, last_attempted_at: new Date().toISOString() }).eq('id', existing.id);
  } else {
    await supabase.from('user_topic_performance').insert({ user_id: userId, level, topic, attempt_count: 1, avg_score: percentage, last_attempted_at: new Date().toISOString() });
  }
}
