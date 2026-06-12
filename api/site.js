import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

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

async function isAdmin(userId, ip) {
  if (!userId) return null;
  const { data } = await supabase.from('admin_master').select('admin_role').eq('admin_id', userId).eq('is_active', true).maybeSingle();
  return data;
}

export default async function handler(req, res) {
  setCorsHeaders(res, req);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { path } = req.query;
  const cookies = parseCookies(req);
  const token = cookies.session || '';
  let userId = null;
  let adminData = null;
  if (token) {
    const session = await validateSession(token);
    if (session) userId = session.user_id;
    adminData = await isAdmin(userId, req.headers['x-forwarded-for'] || 'unknown');
  }

  if (req.method === 'GET') {
    switch (path) {
      case 'get_all_site_sections': return getAllSiteSections(req, res, userId);
      case 'get_section_headings': return getSectionHeadings(req, res);
      default: return res.status(400).json({ error: 'Invalid action' });
    }
  }
  if (req.method === 'POST') {
    if (!adminData) return res.status(403).json({ error: 'Admin required' });
    switch (path) {
      case 'update_site_section': return updateSiteSection(req, res);
      case 'update_section_headings': return updateSectionHeadings(req, res);
      default: return res.status(400).json({ error: 'Invalid action' });
    }
  }
  res.status(405).json({ error: 'Method not allowed' });
}

async function getAllSiteSections(req, res, userId) {
  const { data, error } = await supabase.from('site_sections').select('section, data');
  if (error) return res.status(500).json({ error: error.message });
  const result = {};
  (data || []).forEach(row => { result[row.section] = row.data; });
  return res.status(200).json(result);
}

async function getSectionHeadings(req, res) {
  const { data, error } = await supabase.from('site_sections').select('data').eq('section', 'section_headings').single();
  if (error && error.code !== 'PGRST116') return res.status(500).json({ error: error.message });
  return res.status(200).json(data?.data || {});
}

async function updateSiteSection(req, res) {
  const { section, data } = req.body;
  if (!section) return res.status(400).json({ error: 'Section name required' });
  const { data: existing } = await supabase.from('site_sections').select('id').eq('section', section).maybeSingle();
  if (existing) {
    await supabase.from('site_sections').update({ data }).eq('section', section);
  } else {
    await supabase.from('site_sections').insert({ section, data });
  }
  return res.status(200).json({ success: true });
}

async function updateSectionHeadings(req, res) {
  const { headings } = req.body;
  if (!headings) return res.status(400).json({ error: 'Headings required' });
  const { data: existing } = await supabase.from('site_sections').select('id').eq('section', 'section_headings').maybeSingle();
  if (existing) {
    await supabase.from('site_sections').update({ data: headings }).eq('section', 'section_headings');
  } else {
    await supabase.from('site_sections').insert({ section: 'section_headings', data: headings });
  }
  return res.status(200).json({ success: true });
}
