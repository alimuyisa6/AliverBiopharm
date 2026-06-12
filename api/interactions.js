import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function setCorsHeaders(res, req) {
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'https://aliverbiopharm.com').split(',').map(o => o.trim());
  const requestOrigin = req.headers.origin || '';
  const corsOrigin = allowedOrigins.includes(requestOrigin) ? requestOrigin : allowedOrigins[0];
  res.setHeader('Access-Control-Allow-Origin', corsOrigin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-CSRF-Token, Cookie');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Cache-Control', 'no-store, must-revalidate');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
}

function parseCookies(req) {
  const cookieHeader = req.headers.cookie || '';
  return Object.fromEntries(cookieHeader.split(';').map(c => {
    const [k, ...v] = c.trim().split('=');
    return [k.trim(), decodeURIComponent(v.join('='))];
  }));
}

function hashToken(token) { return require('crypto').createHash('sha256').update(token).digest('hex'); }

async function validateSession(token) {
  if (!token || token.length < 20) return null;
  const hashedToken = hashToken(token);
  const { data, error } = await supabase.from('user_sessions').select('user_id, expires_at, is_active').eq('session_token_hash', hashedToken).eq('is_active', true).single();
  if (error || !data) return null;
  if (new Date(data.expires_at) < new Date()) {
    await supabase.from('user_sessions').update({ is_active: false }).eq('session_token_hash', hashedToken);
    return null;
  }
  return data;
}

export default async function handler(req, res) {
  setCorsHeaders(res, req);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { path } = req.query;
  const cookies = parseCookies(req);
  const token = cookies.session || '';
  let userId = null;
  if (token) {
    const session = await validateSession(token);
    if (session) userId = session.user_id;
  }

  if (!userId && path !== 'get_public_stats') return res.status(401).json({ error: 'Authentication required' });

  if (req.method === 'POST') {
    switch (path) {
      case 'toggle_favorite': return toggleFavorite(req, res, userId);
      case 'record_view': return recordView(req, res, userId);
      case 'record_download': return recordDownload(req, res, userId);
      case 'record_daily_visit': return recordDailyVisit(req, res, userId);
      case 'submit_rating': return submitRating(req, res, userId);
      case 'like_resource': return likeResource(req, res, userId);
      case 'comment_resource': return commentResource(req, res, userId);
      case 'submit_mood': return submitMood(req, res, userId);
      default: return res.status(400).json({ error: 'Invalid action' });
    }
  }
  if (req.method === 'GET') {
    switch (path) {
      case 'get_resource_interactions': return getResourceInteractions(req, res);
      case 'get_user_favorites': return getUserFavorites(req, res, userId);
      case 'get_recent_views': return getRecentViews(req, res, userId);
      case 'get_user_ratings': return getUserRatings(req, res, userId);
      case 'get_user_achievements': return getUserAchievements(req, res, userId);
      case 'get_user_streak': return getUserStreak(req, res, userId);
      case 'get_public_stats': return getPublicStats(req, res);
      default: return res.status(400).json({ error: 'Invalid action' });
    }
  }
  res.status(405).json({ error: 'Method not allowed' });
}

async function toggleFavorite(req, res, userId) {
  const { resource_id } = req.body;
  const { data: existing } = await supabase.from('user_interactions').select('id').eq('user_id', userId).eq('resource_id', resource_id).eq('interaction_type', 'favorite').maybeSingle();
  if (existing) {
    await supabase.from('user_interactions').delete().eq('id', existing.id);
    return res.status(200).json({ favorited: false });
  } else {
    await supabase.from('user_interactions').insert({ user_id: userId, resource_id, interaction_type: 'favorite' });
    return res.status(200).json({ favorited: true });
  }
}

async function recordView(req, res, userId) {
  const { resource_id } = req.body;
  await supabase.from('user_interactions').insert({ user_id: userId, resource_id, interaction_type: 'view' });
  return res.status(200).json({ success: true });
}

async function recordDownload(req, res, userId) {
  const { resource_id } = req.body;
  await supabase.from('user_interactions').insert({ user_id: userId, resource_id, interaction_type: 'download' });
  return res.status(200).json({ success: true });
}

async function recordDailyVisit(req, res, userId) {
  const today = new Date().toISOString().slice(0, 10);
  const { data: existing } = await supabase.from('user_interactions').select('id').eq('user_id', userId).eq('interaction_type', 'daily_visit').gte('created_at', `${today}T00:00:00Z`).lte('created_at', `${today}T23:59:59Z`).limit(1);
  if (!existing || existing.length === 0) {
    await supabase.from('user_interactions').insert({ user_id: userId, interaction_type: 'daily_visit' });
  }
  return res.status(200).json({ success: true });
}

async function submitRating(req, res, userId) {
  const { resource_id, rating } = req.body;
  const { data: existing } = await supabase.from('user_interactions').select('id').eq('user_id', userId).eq('resource_id', resource_id).eq('interaction_type', 'rating').maybeSingle();
  if (existing) {
    await supabase.from('user_interactions').update({ value: rating, created_at: new Date().toISOString() }).eq('id', existing.id);
  } else {
    await supabase.from('user_interactions').insert({ user_id: userId, resource_id, interaction_type: 'rating', value: rating });
  }
  return res.status(200).json({ success: true });
}

async function likeResource(req, res, userId) {
  const { resource_id } = req.body;
  const { data: existing } = await supabase.from('user_interactions').select('id').eq('user_id', userId).eq('resource_id', resource_id).eq('interaction_type', 'favorite').maybeSingle();
  if (existing) {
    await supabase.from('user_interactions').delete().eq('id', existing.id);
  } else {
    await supabase.from('user_interactions').insert({ user_id: userId, interaction_type: 'favorite', resource_id });
  }
  const { count } = await supabase.from('user_interactions').select('id', { count: 'exact', head: true }).eq('resource_id', resource_id).eq('interaction_type', 'favorite');
  return res.status(200).json({ liked: !existing, like_count: count || 0 });
}

async function commentResource(req, res, userId) {
  const { resource_id, comment } = req.body;
  await supabase.from('user_interactions').insert({ user_id: userId, interaction_type: 'review', resource_id, metadata: { comment } });
  return res.status(200).json({ success: true });
}

async function submitMood(req, res, userId) {
  const { mood, message } = req.body;
  await supabase.from('user_interactions').insert({ user_id: userId, interaction_type: 'mood', resource_id: null, metadata: { mood, message: message || '' } });
  return res.status(200).json({ success: true });
}

async function getResourceInteractions(req, res) {
  const { resource_id } = req.query;
  const { count: likeCount } = await supabase.from('user_interactions').select('id', { count: 'exact', head: true }).eq('resource_id', resource_id).eq('interaction_type', 'favorite');
  const { data: comments } = await supabase.from('user_interactions').select('metadata, created_at, user_id').eq('resource_id', resource_id).eq('interaction_type', 'review').order('created_at', { ascending: false }).limit(20);
  const commentList = [];
  if (comments) {
    for (const c of comments) {
      const { data: { user } } = await supabase.auth.admin.getUserById(c.user_id);
      commentList.push({ comment: c.metadata?.comment || '', user_name: user?.email ? user.email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, x => x.toUpperCase()) : 'User', created_at: c.created_at });
    }
  }
  return res.status(200).json({ like_count: likeCount || 0, comments: commentList });
}

async function getUserFavorites(req, res, userId) {
  const { data, error } = await supabase.from('user_interactions').select('resource_id').eq('user_id', userId).eq('interaction_type', 'favorite').order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  const favorites = [];
  for (const f of (data || [])) {
    const { data: resource } = await supabase.from('biology_notes').select('title').eq('id', f.resource_id).maybeSingle();
    favorites.push({ resource_id: f.resource_id, title: resource?.title || 'Unknown' });
  }
  return res.status(200).json(favorites);
}

async function getRecentViews(req, res, userId) {
  const limit = parseInt(req.query.limit) || 5;
  const { data, error } = await supabase.from('user_interactions').select('resource_id, created_at').eq('user_id', userId).eq('interaction_type', 'view').order('created_at', { ascending: false }).limit(limit);
  if (error) return res.status(500).json({ error: error.message });
  const views = [];
  for (const v of (data || [])) {
    const { data: resource } = await supabase.from('biology_notes').select('title').eq('id', v.resource_id).maybeSingle();
    views.push({ resource_id: v.resource_id, title: resource?.title || 'Unknown', created_at: v.created_at });
  }
  return res.status(200).json(views);
}

async function getUserRatings(req, res, userId) {
  const { data, error } = await supabase.from('user_interactions').select('resource_id, value').eq('user_id', userId).eq('interaction_type', 'rating');
  if (error) return res.status(500).json({ error: error.message });
  const userRatings = {};
  (data || []).forEach(r => { userRatings[r.resource_id] = r.value; });
  return res.status(200).json(userRatings);
}

async function getUserAchievements(req, res, userId) {
  const { data, error } = await supabase.from('user_interactions').select('metadata').eq('user_id', userId).eq('interaction_type', 'achievement');
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json((data || []).map(d => ({ badge: d.metadata?.badge || 'Unknown' })));
}

async function getUserStreak(req, res, userId) {
  const { data, error } = await supabase.from('user_interactions').select('created_at').eq('user_id', userId).eq('interaction_type', 'daily_visit').order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  const dates = (data || []).map(d => new Date(d.created_at).toISOString().slice(0, 10));
  let streak = 0;
  const today = new Date().toISOString().slice(0, 10);
  let checkDate = today;
  const dateSet = new Set(dates);
  if (!dateSet.has(checkDate)) {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    if (!dateSet.has(yesterday)) return res.status(200).json({ count: 0 });
    checkDate = yesterday;
  }
  while (dateSet.has(checkDate)) {
    streak++;
    const d = new Date(checkDate);
    d.setDate(d.getDate() - 1);
    checkDate = d.toISOString().slice(0, 10);
  }
  return res.status(200).json({ count: streak });
}

async function getPublicStats(req, res) {
  try {
    const [resCount, downCount, quizCount, resourcesUsers, authUsers] = await Promise.all([
      supabase.from('biology_notes').select('id', { count: 'exact', head: true }),
      supabase.from('user_interactions').select('id', { count: 'exact', head: true }).eq('interaction_type', 'download'),
      supabase.from('user_quiz_activity').select('id', { count: 'exact', head: true }),
      supabase.from('user_interactions').select('user_id').eq('interaction_type', 'download'),
      supabase.auth.admin.listUsers()
    ]);
    const uniqueUsers = new Set();
    if (resourcesUsers.data) {
      resourcesUsers.data.forEach(item => { if (item.user_id) uniqueUsers.add(item.user_id); });
    }
    const totalRegisteredUsers = authUsers.data?.users?.length || 0;
    const result = {
      resources_count: resCount.count || 0,
      downloads_count: downCount.count || 0,
      quiz_attempts: quizCount.count || 0,
      users_count: totalRegisteredUsers
    };
    return res.status(200).json(result);
  } catch (err) {
    return res.status(200).json({ resources_count: 0, downloads_count: 0, quiz_attempts: 0, users_count: 0 });
  }
}
