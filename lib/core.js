import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import https from 'https';

export const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

export const supabaseAdmin = supabase;

export const supabaseAnon = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

export function setCorsHeaders(res, req) {
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'https://aliverbiopharm.com')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const requestOrigin = req.headers.origin || '';

  if (!requestOrigin) {
    res.setHeader('Vary', 'Origin');
    return;
  }

  if (allowedOrigins.includes(requestOrigin)) {
    res.setHeader('Access-Control-Allow-Origin', requestOrigin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
  }
}

export function parseCookies(req) {
  const cookieHeader = req.headers.cookie || '';

  if (!cookieHeader.trim()) return {};

  const cookies = {};

  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');

    if (idx === -1) continue;

    const key = part.slice(0, idx).trim();
    const rawValue = part.slice(idx + 1).trim();

    if (!key) continue;

    try {
      cookies[key] = decodeURIComponent(rawValue);
    } catch {
      cookies[key] = rawValue;
    }
  }

  return cookies;
}

export function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

export function generateSessionToken() {
  return crypto.randomBytes(48).toString('base64url');
}

export function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];

  if (forwarded) {
    const first = forwarded.split(',')[0].trim();
    if (first) return first;
  }

  const realIp = req.headers['x-real-ip'];
  if (realIp) return realIp.trim();

  const socketIp = req.socket?.remoteAddress || req.connection?.remoteAddress || '';

  if (socketIp) return socketIp.replace(/^::ffff:/, '');

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
    formData.append('secret', process.env.TURNSTILE_SECRET_KEY || '');
    formData.append('response', token);

    if (ip && ip !== 'unknown') {
      formData.append('remoteip', ip);
    }

    const result = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formData
    });

    const outcome = await result.json();
    return outcome.success === true;
  } catch {
    return false;
  }
}

async function findSessionRowByToken(hashedToken, selectCols) {
  if (!hashedToken) return null;

  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from('user_sessions')
    .select(selectCols)
    .or(`session_token_hash.eq.${hashedToken},and(prev_session_token_hash.eq.${hashedToken},prev_token_grace_until.gt.${nowIso})`)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[findSessionRowByToken]', error.message);
    return null;
  }

  if (!data || data.is_active !== true) return null;

  return data;
}

export async function validateSession(token) {
  if (!token || typeof token !== 'string' || token.length < 20) return null;

  const hashedToken = hashToken(token);

  const data = await findSessionRowByToken(
    hashedToken,
    'user_id, expires_at, is_active, fingerprint, created_at, session_token_hash, prev_session_token_hash, prev_token_grace_until'
  );

  if (!data) return null;

  if (data.expires_at && new Date(data.expires_at).getTime() <= Date.now()) {
    try {
      await supabase
        .from('user_sessions')
        .update({ is_active: false, terminated_reason: 'expired' })
        .or(`session_token_hash.eq.${hashedToken},prev_session_token_hash.eq.${hashedToken}`);
    } catch {}

    return null;
  }

  return data;
}

export async function isAdmin(userId, ip) {
  if (!userId) return null;

  const { data } = await supabase
    .from('admin_master')
    .select('admin_role, permissions, is_active, is_locked, ip_whitelist, id, admin_id, admin_email, mfa_enabled, mfa_secret, passkey_enabled')
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

export function normalizeString(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, '');
}

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

  return patterns.some((pattern) => pattern.test(sentence));
}

export function containsExactPhrase(sentence, phrase) {
  return String(sentence).toLowerCase().includes(String(phrase).toLowerCase().trim());
}

export function levenshteinDistance(a, b) {
  const left = String(a || '');
  const right = String(b || '');

  if (left === right) return 0;

  if (!left.length) return right.length;
  if (!right.length) return left.length;

  const matrix = Array.from({ length: right.length + 1 }, () => Array(left.length + 1).fill(0));

  for (let i = 0; i <= left.length; i += 1) matrix[0][i] = i;
  for (let j = 0; j <= right.length; j += 1) matrix[j][0] = j;

  for (let j = 1; j <= right.length; j += 1) {
    for (let i = 1; i <= left.length; i += 1) {
      const indicator = left[i - 1] === right[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + indicator
      );
    }
  }

  return matrix[right.length][left.length];
}

export function calculateRecallStrength(userAnswer, correctAnswer, alternateAnswers, commonMistakes) {
  const normalizedAnswer = normalizeString(userAnswer);

  if (!normalizedAnswer) {
    return { strength: 'developing', matched: correctAnswer, xp: 3 };
  }

  const acceptedAnswers = [
    { term: correctAnswer, explanation: null, isPrimary: true },
    ...(Array.isArray(alternateAnswers) ? alternateAnswers : []).map((item) => ({
      term: typeof item === 'string' ? item : item.term,
      explanation: typeof item === 'object' ? item.explanation || null : null,
      isPrimary: false
    }))
  ];

  for (const item of acceptedAnswers) {
    if (!item.term) continue;

    const concept = item.term;
    const normalizedConcept = normalizeString(concept);

    if (!normalizedConcept) continue;

    if (normalizedAnswer === normalizedConcept) {
      return { strength: 'excellent', matched: concept, xp: 10, explanation: item.explanation, isPrimary: item.isPrimary };
    }

    if (!concept.includes(' ')) {
      if (containsConcept(userAnswer, concept) && !isNegatedConcept(userAnswer, concept)) {
        return { strength: 'excellent', matched: concept, xp: 10, explanation: item.explanation, isPrimary: item.isPrimary };
      }
    } else if (containsExactPhrase(userAnswer, concept)) {
      return { strength: 'excellent', matched: concept, xp: 10, explanation: item.explanation, isPrimary: item.isPrimary };
    }
  }

  for (const mistake of (Array.isArray(commonMistakes) ? commonMistakes : [])) {
    const mistakeTerm = typeof mistake === 'string' ? mistake : mistake.term;

    if (!mistakeTerm) continue;

    if (containsConcept(userAnswer, mistakeTerm) && !isNegatedConcept(userAnswer, mistakeTerm)) {
      return {
        strength: 'developing',
        matched: mistakeTerm,
        xp: 3,
        isCommonMistake: true,
        mistakeExplanation: typeof mistake === 'object' ? mistake.explanation : null
      };
    }
  }

  for (const item of acceptedAnswers) {
    if (!item.term) continue;

    const concept = item.term;
    const normalizedConcept = normalizeString(concept);

    if (!normalizedConcept || normalizedConcept.length < 5) continue;

    const distance = levenshteinDistance(normalizedAnswer, normalizedConcept);
    const maxLen = Math.max(normalizedAnswer.length, normalizedConcept.length);

    if (maxLen === 0) continue;

    const similarity = 1 - distance / maxLen;

    if (similarity >= 0.85) {
      return {
        strength: 'strong',
        matched: concept,
        xp: 7,
        explanation: item.explanation,
        isPrimary: item.isPrimary,
        note: `The expected term is "${concept}". Your spelling variation was accepted.`
      };
    }
  }

  return { strength: 'developing', matched: correctAnswer, xp: 3 };
}

export function computeRecallLevel(totalXp) {
  return Math.floor((Number(totalXp) || 0) / 100) + 1;
}

export function computeXpProgress(totalXp) {
  const xp = Number(totalXp) || 0;
  const level = computeRecallLevel(xp);
  const xpIntoLevel = xp % 100;
  const xpToNext = 100 - xpIntoLevel;

  return {
    level,
    xpIntoLevel,
    xpToNext,
    progressPercent: xpIntoLevel
  };
}

export function computeRankTitle(totalXp) {
  const xp = Number(totalXp) || 0;

  if (xp >= 10000) return 'Master Biologist';
  if (xp >= 6000) return 'Scientist';
  if (xp >= 3000) return 'Biologist';
  if (xp >= 1500) return 'Scholar';
  if (xp >= 500) return 'Explorer';

  return 'Beginner';
}

export function formatTimeServer(seconds) {
  const total = Number(seconds) || 0;

  if (total <= 0) return '0s';

  const mins = Math.floor(total / 60);
  const secs = total % 60;

  if (mins > 0) return `${mins}m ${secs}s`;

  return `${secs}s`;
}

export function computeSessionReport(userAnswers, totalQuestions) {
  const answers = Array.isArray(userAnswers) ? userAnswers : [];
  const total = Math.max(0, Number(totalQuestions) || 0);

  const excellent = answers.filter((item) => item?.strength === 'excellent').length;
  const strong = answers.filter((item) => item?.strength === 'strong').length;
  const developing = answers.filter((item) => item?.strength === 'developing').length;

  const masteryScore = total > 0
    ? Math.round(((excellent * 100 + strong * 70) / (total * 100)) * 100)
    : 0;

  const totalTime = answers.reduce((sum, item) => sum + (Number(item?.time_taken_seconds) || 0), 0);
  const avgTime = answers.length > 0 ? Math.round(totalTime / answers.length) : 0;

  const topicCounts = {};

  for (const answer of answers) {
    if (!answer?.topic) continue;
    topicCounts[answer.topic] = (topicCounts[answer.topic] || 0) + 1;
  }

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

export const cache = new Map();

export function getCached(key) {
  const entry = cache.get(key);

  if (entry && Date.now() < entry.expires) {
    return entry.value;
  }

  cache.delete(key);
  return null;
}

export function setCached(key, value, ttl = 30000) {
  cache.set(key, { value, expires: Date.now() + ttl });

  if (cache.size > 500) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].expires - b[1].expires)[0];

    if (oldest) {
      cache.delete(oldest[0]);
    }
  }
}

export function invalidateUserCache(userId) {
  cache.delete(`stats:${userId}`);
  cache.delete(`dashboard:${userId}`);
}

export async function addXp(userId, amount, reason, source, metadata, unitId, groupId, levelId) {
  const { data, error } = await supabase.rpc('atomic_add_xp', {
    p_user_id: userId,
    p_amount: Math.trunc(Number(amount) || 0),
    p_reason: reason || 'unknown',
    p_source: source || 'unknown',
    p_metadata: metadata || {},
    p_unit_id: unitId || null,
    p_group_id: groupId || null,
    p_level_id: levelId || null
  });

  if (error) {
    console.error('[addXp]', error.message);
    throw new Error('Failed to add XP');
  }

  return Number(data) || 0;
}

export async function getPlatformStats(userId) {
  const { data } = await supabase
    .from('user_platform_stats')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  return data || {
    total_xp: 0,
    platform_level: 1,
    current_streak: 0,
    longest_streak: 0,
    last_activity_date: null
  };
}

export async function recordPlatformActivity(userId) {
  const { data, error } = await supabase.rpc('atomic_record_activity', {
    p_user_id: userId
  });

  if (error) {
    console.error('[recordPlatformActivity]', error.message);
    throw new Error('Failed to record platform activity');
  }

  return data || {};
}

export async function updateTopicXp(userId, unitId, topic, xpDelta) {
  const { data, error } = await supabase.rpc('atomic_upsert_topic_xp', {
    p_user_id: userId,
    p_unit_id: unitId,
    p_topic: topic,
    p_xp_delta: Math.trunc(Number(xpDelta) || 0)
  });

  if (error) {
    console.error('[updateTopicXp]', error.message);
    throw new Error('Failed to update topic XP');
  }

  return { xp: Number(data) || 0 };
}

export async function updateDailyChallengeProgress(userId, groupId, requirementType, amount) {
  if (!groupId || !amount) return null;

  const { data, error } = await supabase.rpc('atomic_complete_daily_challenge', {
    p_user_id: userId,
    p_group_id: groupId,
    p_requirement_type: requirementType,
    p_amount: Math.trunc(Number(amount) || 0)
  });

  if (error) {
    console.error('[updateDailyChallengeProgress]', error.message);
    return null;
  }

  return data || null;
}

export async function recordWeakConcept(userId, source, unitId, groupId, levelId, concept, isCorrect, questionId) {
  if (!concept) return;

  const { data: existing } = await supabase
    .from('user_weak_concepts_v2')
    .select('id, total_attempts, incorrect_attempts, resolved')
    .eq('user_id', userId)
    .eq('concept', concept)
    .eq('unit_id', unitId)
    .maybeSingle();

  if (existing) {
    const totalAttempts = (existing.total_attempts || 0) + 1;
    const incorrectAttempts = isCorrect
      ? existing.incorrect_attempts || 0
      : (existing.incorrect_attempts || 0) + 1;

    await supabase
      .from('user_weak_concepts_v2')
      .update({
        total_attempts: totalAttempts,
        incorrect_attempts: incorrectAttempts,
        last_incorrect_at: isCorrect ? existing.last_incorrect_at : new Date().toISOString(),
        last_correct_at: isCorrect ? new Date().toISOString() : existing.last_correct_at,
        resolved: isCorrect ? true : existing.resolved,
        updated_at: new Date().toISOString()
      })
      .eq('id', existing.id);
  } else {
    await supabase
      .from('user_weak_concepts_v2')
      .insert({
        user_id: userId,
        source,
        level_id: levelId || null,
        group_id: groupId || null,
        unit_id: unitId || null,
        concept,
        question_id: questionId || null,
        total_attempts: 1,
        incorrect_attempts: isCorrect ? 0 : 1,
        last_incorrect_at: isCorrect ? null : new Date().toISOString(),
        last_correct_at: isCorrect ? new Date().toISOString() : null,
        resolved: isCorrect,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
  }
}

export async function updateSpacedRepetition(userId, questionId, level, topic, strength) {
  const SM2_MIN_EASE = 1.3;
  const quality = strength === 'excellent' ? 5 : strength === 'strong' ? 4 : 2;

  const { data: existing } = await supabase
    .from('user_spaced_repetition')
    .select('ease_factor, interval_days, repetitions')
    .eq('user_id', userId)
    .eq('question_id', questionId)
    .maybeSingle();

  let easeFactor = Number(existing?.ease_factor ?? 2.5);
  let repetitions = Number(existing?.repetitions ?? 0);
  let intervalDays = Number(existing?.interval_days ?? 1);

  if (quality < 3) {
    repetitions = 0;
    intervalDays = 1;
  } else {
    if (repetitions === 0) {
      intervalDays = 1;
    } else if (repetitions === 1) {
      intervalDays = 6;
    } else {
      intervalDays = Math.max(1, Math.round(intervalDays * easeFactor));
    }

    repetitions += 1;
  }

  easeFactor = Math.max(
    SM2_MIN_EASE,
    easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  );

  const nextReviewDate = new Date(Date.now() + intervalDays * 86400000).toISOString();

  await supabase
    .from('user_spaced_repetition')
    .upsert(
      {
        user_id: userId,
        question_id: questionId,
        level,
        topic: topic || null,
        ease_factor: easeFactor,
        interval_days: intervalDays,
        repetitions,
        next_review_date: nextReviewDate,
        last_reviewed_at: new Date().toISOString()
      },
      { onConflict: 'user_id,question_id' }
    );

  return {
    ease_factor: easeFactor,
    interval_days: intervalDays,
    repetitions,
    next_review_date: nextReviewDate
  };
}

export async function checkAndAwardAchievements(userId, stats) {
  const { data: allAchievements } = await supabase
    .from('achievements')
    .select('id, name, icon, description, requirement_type, requirement_value');

  if (!allAchievements?.length) return [];

  const { data: earned } = await supabase
    .from('user_achievements')
    .select('achievement_id')
    .eq('user_id', userId);

  const earnedIds = new Set((earned || []).map((item) => item.achievement_id));

  const statsMap = {
    total_xp: stats?.total_xp || 0,
    current_streak: stats?.current_streak || 0,
    longest_streak: stats?.longest_streak || 0,
    total_sessions: stats?.total_sessions || 0,
    total_questions: stats?.total_questions || 0,
    excellent_count: stats?.excellent_count || 0,
    strong_count: stats?.strong_count || 0
  };

  const newlyEarned = [];

  for (const achievement of allAchievements) {
    if (earnedIds.has(achievement.id)) continue;

    const currentValue = statsMap[achievement.requirement_type];

    if (currentValue !== undefined && Number(currentValue) >= Number(achievement.requirement_value)) {
      await supabase.rpc('atomic_award_achievement', {
        p_user_id: userId,
        p_achievement_id: achievement.id
      });

      newlyEarned.push(achievement);
    }
  }

  return newlyEarned;
}

export async function getPlatformLeaderboard(levelId, limit) {
  const lim = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 50);

  let query = supabase
    .from('user_platform_stats')
    .select('user_id, total_xp, current_streak, platform_level')
    .order('total_xp', { ascending: false })
    .limit(lim);

  if (levelId) {
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('user_id')
      .eq('active_level_id', levelId);

    const userIds = (profiles || []).map((profile) => profile.user_id);

    if (!userIds.length) return [];

    query = query.in('user_id', userIds);
  }

  const { data, error } = await query;

  if (error || !data?.length) return [];

  const userIds = data.map((row) => row.user_id);

  const { data: authUsers } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000
  });

  const userMap = new Map();

  for (const user of authUsers?.users || []) {
    userMap.set(user.id, user.user_metadata?.full_name || null);
  }

  return data
    .map((row) => ({
      user_id: row.user_id,
      display_name: userMap.get(row.user_id) || 'Anonymous Learner',
      total_xp: row.total_xp || 0,
      rank_title: computeRankTitle(row.total_xp || 0),
      platform_level: row.platform_level || computeRecallLevel(row.total_xp || 0),
      recall_level: row.platform_level || computeRecallLevel(row.total_xp || 0),
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

  if (levelId) {
    query = query.eq('level_id', levelId);
  }

  if (unitId) {
    query = query.or(`unit_id.eq.${unitId},unit_id.is.null`);
  } else {
    query = query.is('unit_id', null);
  }

  const { data } = await query;

  if (!data?.length) return null;

  return data[Math.floor(Math.random() * data.length)];
}

export async function getDueReviewQuestions(userId, limit) {
  const lim = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 50);

  const { data } = await supabase
    .from('user_spaced_repetition')
    .select('question_id, level, topic, next_review_date, repetitions')
    .eq('user_id', userId)
    .lte('next_review_date', new Date().toISOString())
    .order('next_review_date', { ascending: true })
    .limit(lim);

  return data || [];
}

export function computeStreak(lastSessionDate, currentStreak) {
  const today = new Date().toISOString().slice(0, 10);

  if (!lastSessionDate) return { streak: 1, isNewDay: true };

  if (lastSessionDate === today) {
    return { streak: Number(currentStreak) || 1, isNewDay: false };
  }

  const last = new Date(`${lastSessionDate}T00:00:00Z`);
  const now = new Date(`${today}T00:00:00Z`);
  const diffDays = Math.round((now - last) / 86400000);

  if (diffDays <= 1) {
    return { streak: (Number(currentStreak) || 0) + 1, isNewDay: true };
  }

  return { streak: 1, isNewDay: true };
}

export function getUserClient(userId) {
  if (!userId) return supabaseAnon;

  const token = signSupabaseJwt(userId);

  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`
      }
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

function signSupabaseJwt(userId) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);

  const payload = {
    sub: userId,
    role: 'authenticated',
    aud: 'authenticated',
    iat: now,
    exp: now + 900
  };

  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const signature = crypto
    .createHmac('sha256', process.env.SUPABASE_JWT_SECRET || '')
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

export async function getUserProfileName(userId) {
  if (!userId) return null;

  try {
    const { data } = await supabase.auth.admin.getUserById(userId);

    return data?.user?.user_metadata?.full_name || null;
  } catch {
    return null;
  }
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
  } catch {}
}

export function generateCsrfToken(secret, fingerprint) {
  const windowSize = 15 * 60 * 1000;
  const timestamp = Math.floor(Date.now() / windowSize) * windowSize;
  const combined = fingerprint ? `${secret}:${fingerprint}` : secret;
  const hmac = crypto.createHmac('sha256', combined).update(String(timestamp)).digest('hex');

  return `${timestamp}.${hmac}`;
}

export function verifyCsrf(req, secret, userId, fingerprint) {
  const token = req.headers['x-csrf-token'];

  if (!token || !secret) throw new Error('Invalid CSRF token');

  const parts = String(token).split('.');

  if (parts.length !== 2) throw new Error('Invalid CSRF token');

  const timestamp = Number(parts[0]);
  const providedHmac = parts[1];

  if (!Number.isSafeInteger(timestamp)) throw new Error('Invalid CSRF token');

  const windowSize = 15 * 60 * 1000;
  const currentWindow = Math.floor(Date.now() / windowSize) * windowSize;
  const allowedWindows = [currentWindow, currentWindow - windowSize];

  if (!allowedWindows.includes(timestamp)) throw new Error('Invalid CSRF token');

  const combined = fingerprint ? `${secret}:${fingerprint}` : secret;
  const expectedHmac = crypto.createHmac('sha256', combined).update(String(timestamp)).digest('hex');

  const providedBuffer = Buffer.from(providedHmac, 'utf8');
  const expectedBuffer = Buffer.from(expectedHmac, 'utf8');

  if (providedBuffer.length !== expectedBuffer.length) throw new Error('Invalid CSRF token');

  if (!crypto.timingSafeEqual(providedBuffer, expectedBuffer)) throw new Error('Invalid CSRF token');

  return true;
}

export function generateTotpSecret() {
  const bytes = crypto.randomBytes(20);
  let bits = '';

  for (const byte of bytes) {
    bits += byte.toString(2).padStart(8, '0');
  }

  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let secret = '';

  for (let i = 0; i + 5 <= bits.length; i += 5) {
    secret += alphabet[parseInt(bits.substring(i, i + 5), 2)];
  }

  return secret;
}

function base32Decode(base32) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const clean = String(base32).replace(/=+$/, '').toUpperCase();
  let bits = '';

  for (const char of clean) {
    const val = alphabet.indexOf(char);

    if (val === -1) continue;

    bits += val.toString(2).padStart(5, '0');
  }

  const bytes = [];

  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.substring(i, i + 8), 2));
  }

  return Buffer.from(bytes);
}

function totpAt(secretBase32, timeStep) {
  const key = base32Decode(secretBase32);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(timeStep));

  const hmac = crypto.createHmac('sha1', key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return String(code % 1000000).padStart(6, '0');
}

export function verifyTotp(secretBase32, userCode) {
  if (!secretBase32 || !userCode || !/^\d{6}$/.test(userCode)) return false;

  const step = Math.floor(Date.now() / 1000 / 30);

  for (const drift of [0, -1, 1]) {
    const expected = totpAt(secretBase32, step + drift);

    if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(userCode))) {
      return true;
    }
  }

  return false;
}

export function totpProvisioningUri(secretBase32, email, issuer = 'AliverBiopharm') {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email)}?secret=${secretBase32}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

export function checkPasswordBreached(password) {
  return new Promise((resolve) => {
    try {
      const sha1 = crypto.createHash('sha1').update(password).digest('hex').toUpperCase();
      const prefix = sha1.substring(0, 5);
      const suffix = sha1.substring(5);

      const req = https.get(`https://api.pwnedpasswords.com/range/${prefix}`, {
        timeout: 2500,
        headers: {
          'User-Agent': 'AliverBiopharm-Security-Check'
        }
      }, (res) => {
        let body = '';

        res.on('data', (chunk) => {
          body += chunk;
        });

        res.on('end', () => {
          const lines = body.split('\n');
          const match = lines.find((line) => line.split(':')[0] === suffix);

          resolve(match ? {
            breached: true,
            count: parseInt(match.split(':')[1] || '0', 10)
          } : {
            breached: false
          });
        });
      });

      req.on('error', () => resolve({ breached: false, checkFailed: true }));
      req.on('timeout', () => {
        req.destroy();
        resolve({ breached: false, checkFailed: true });
      });
    } catch {
      resolve({ breached: false, checkFailed: true });
    }
  });
}

export async function isTeacherApproved(userId) {
  if (!userId) return false;

  const { data } = await supabase
    .from('user_profiles')
    .select('role, is_approved_teacher, approved_track')
    .eq('user_id', userId)
    .maybeSingle();

  if (!data || data.role !== 'teacher') return false;

  return data.is_approved_teacher === true;
}

export function maskEmail(email) {
  if (!email || typeof email !== 'string') return 'unknown';

  const [local, domain] = email.split('@');

  if (!domain) return 'invalid';

  const maskedLocal = local.length <= 2
    ? `${local[0] || ''}*`
    : `${local[0]}${'*'.repeat(Math.min(local.length - 2, 6))}${local[local.length - 1]}`;

  return `${maskedLocal}@${domain}`;
}

export function computeAccuracy(excellentCount, strongCount, totalQuestions) {
  if (!totalQuestions) return 0;

  return Math.round(
    ((Number(excellentCount) || 0) * 100 + (Number(strongCount) || 0) * 70) /
    (Number(totalQuestions) * 100) * 100
  );
}
export async function updateUserRecords(userId, { score, timeTakenSeconds, isPerfect }) {
  const { data: existing } = await supabase
    .from('user_records')
    .select('highest_score, fastest_completion, perfect_blocks')
    .eq('user_id', userId)
    .maybeSingle();

  const highestScore = Math.max(existing?.highest_score || 0, score || 0);
  let fastestCompletion = existing?.fastest_completion || 0;

  if (timeTakenSeconds && (fastestCompletion === 0 || timeTakenSeconds < fastestCompletion)) {
    fastestCompletion = timeTakenSeconds;
  }

  const perfectBlocks = (existing?.perfect_blocks || 0) + (isPerfect ? 1 : 0);

  await supabase
    .from('user_records')
    .upsert({
      user_id: userId,
      highest_score: highestScore,
      fastest_completion: fastestCompletion,
      perfect_blocks: perfectBlocks
    }, { onConflict: 'user_id' });

  return {
    highest_score: highestScore,
    fastest_completion: fastestCompletion,
    perfect_blocks: perfectBlocks
  };
}
