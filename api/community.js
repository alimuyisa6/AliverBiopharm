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

export default async function handler(req, res) {
  setCorsHeaders(res, req);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { path } = req.query;

  if (req.method === 'GET') {
    switch (path) {
      case 'activity': return getCommunityActivity(req, res);
      default: return res.status(400).json({ error: 'Invalid action' });
    }
  }
  return res.status(405).json({ error: 'Method not allowed' });
}

async function getCommunityActivity(req, res) {
  const { data: downloads } = await supabase.from('user_interactions').select('user_id, resource_id, created_at').eq('interaction_type', 'download').order('created_at', { ascending: false }).limit(10);
  const { data: views } = await supabase.from('user_interactions').select('user_id, resource_id, created_at').eq('interaction_type', 'view').order('created_at', { ascending: false }).limit(10);

  const activity = [];

  for (const d of (downloads || [])) {
    let resourceTitle = 'a resource';
    const { data: resource } = await supabase.from('biology_notes').select('title').eq('id', d.resource_id).maybeSingle();
    if (resource?.title) resourceTitle = resource.title;
    let userName = 'Someone';
    try {
      const { data: { user } } = await supabase.auth.admin.getUserById(d.user_id);
      if (user?.email) userName = user.email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    } catch {}
    activity.push({ type: 'download', message: `${userName} downloaded "${resourceTitle}"`, time: d.created_at });
  }

  for (const v of (views || [])) {
    let resourceTitle = 'a resource';
    const { data: resource } = await supabase.from('biology_notes').select('title').eq('id', v.resource_id).maybeSingle();
    if (resource?.title) resourceTitle = resource.title;
    let userName = 'Someone';
    try {
      const { data: { user } } = await supabase.auth.admin.getUserById(v.user_id);
      if (user?.email) userName = user.email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    } catch {}
    activity.push({ type: 'view', message: `${userName} viewed "${resourceTitle}"`, time: v.created_at });
  }

  activity.sort((a, b) => new Date(b.time) - new Date(a.time));
  return res.status(200).json(activity.slice(0, 15));
}
