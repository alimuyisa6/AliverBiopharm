 import { supabase } from './core.js';
import { SecurityError } from './security-middleware.js';

export async function handler(req, res, path, ctx) {
  if (req.method === 'GET' && path === 'activity') return getCommunityActivity(req, res);
  throw new SecurityError('Method not allowed', 405);
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
    try { const { data: { user } } = await supabase.auth.admin.getUserById(d.user_id); if (user?.email) userName = user.email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()); } catch {}
    activity.push({ type: 'download', message: `${userName} downloaded "${resourceTitle}"`, time: d.created_at });
  }
  for (const v of (views || [])) {
    let resourceTitle = 'a resource';
    const { data: resource } = await supabase.from('biology_notes').select('title').eq('id', v.resource_id).maybeSingle();
    if (resource?.title) resourceTitle = resource.title;
    let userName = 'Someone';
    try { const { data: { user } } = await supabase.auth.admin.getUserById(v.user_id); if (user?.email) userName = user.email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()); } catch {}
    activity.push({ type: 'view', message: `${userName} viewed "${resourceTitle}"`, time: v.created_at });
  }
  activity.sort((a, b) => new Date(b.time) - new Date(a.time));
  return res.status(200).json(activity.slice(0, 15));
}
