import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

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

function hashToken(token) { return crypto.createHash('sha256').update(token).digest('hex'); }

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

  if (req.method === 'GET') {
    switch (path) {
      case 'status': return getChallengeStatus(req, res, userId);
      default: return res.status(400).json({ error: 'Invalid action' });
    }
  }
  if (req.method === 'POST') {
    switch (path) {
      case 'submit': return submitChallenge(req, res, userId);
      default: return res.status(400).json({ error: 'Invalid action' });
    }
  }
  return res.status(405).json({ error: 'Method not allowed' });
}

async function getChallengeStatus(req, res, userId) {
  const { week_start } = req.query;
  if (!week_start) return res.status(400).json({ error: 'week_start required' });
  if (!userId) return res.status(200).json({ submitted: false, selected_option: null });
  const { data } = await supabase.from('user_interactions').select('metadata').eq('user_id', userId).eq('interaction_type', 'quiz_attempt').filter('metadata->>week_start', 'eq', week_start).maybeSingle();
  if (!data) return res.status(200).json({ submitted: false, selected_option: null });
  return res.status(200).json({ submitted: true, selected_option: data.metadata?.selected_option ?? null });
}

async function submitChallenge(req, res, userId) {
  if (!userId) return res.status(401).json({ error: 'Authentication required' });
  const { week_start, selected_option } = req.body;
  if (!week_start || selected_option === undefined) return res.status(400).json({ error: 'week_start and selected_option required' });
  const { data: existing } = await supabase.from('user_interactions').select('id').eq('user_id', userId).eq('interaction_type', 'quiz_attempt').filter('metadata->>week_start', 'eq', week_start).maybeSingle();
  if (existing) return res.status(200).json({ success: true, already_submitted: true });
  const { error } = await supabase.from('user_interactions').insert({ user_id: userId, interaction_type: 'quiz_attempt', metadata: { week_start, selected_option } });
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ success: true, already_submitted: false });
}
