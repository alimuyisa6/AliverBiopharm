 import { supabase } from './core.js';
import { SecurityError } from './security-middleware.js';

export async function handler(req, res, path, ctx) {
  if (req.method === 'GET' && path === 'activity') return getCommunityActivity(req, res);
  throw new SecurityError('Method not allowed', 405);
}

async function getCommunityActivity(req, res) {
  const [{ data: reactions }, { data: comments }] = await Promise.all([
    supabase.from('content_reactions').select('user_id, content_type, content_id, reaction_type, created_at').order('created_at', { ascending: false }).limit(20),
    supabase.from('content_comments').select('user_id, content_type, content_id, body, created_at').eq('is_hidden', false).order('created_at', { ascending: false }).limit(20)
  ]);

  const activity = [];
  for (const r of reactions || []) {
    let title = 'a resource';
    if (r.content_type === 'note') {
      const { data: note } = await supabase.from('notes').select('title').eq('id', r.content_id).maybeSingle();
      if (note) title = note.title;
    }
    const { data: { user } } = await supabase.auth.admin.getUserById(r.user_id);
    activity.push({ type: 'reaction', message: `${user?.user_metadata?.full_name || 'Someone'} ${r.reaction_type}d "${title}"`, time: r.created_at });
  }
  for (const c of comments || []) {
    let title = 'a resource';
    if (c.content_type === 'note') {
      const { data: note } = await supabase.from('notes').select('title').eq('id', c.content_id).maybeSingle();
      if (note) title = note.title;
    }
    const { data: { user } } = await supabase.auth.admin.getUserById(c.user_id);
    activity.push({ type: 'comment', message: `${user?.user_metadata?.full_name || 'Someone'} commented on "${title}": "${c.body.slice(0, 60)}..."`, time: c.created_at });
  }

  activity.sort((a, b) => new Date(b.time) - new Date(a.time));
  return res.status(200).json(activity.slice(0, 15));
}
