 import { supabase } from './core.js';
import { requireAuth, SecurityError } from './security-middleware.js';
import { getUserCurriculumScope } from './curriculum.js';

const CONTENT_TYPES_WITH_UNIT = [
  'note',
  'quiz_batch',
  'flashcard_deck',
  'pdf_resource',
  'past_paper',
  'weekly_challenge',
  'content_collection',
  'video',
  'article',
];

export async function handler(req, res, path, ctx) {
  if (req.method === 'GET' && path === 'activity') {
    requireAuth(ctx);
    return getCommunityActivity(req, res, ctx);
  }
  throw new SecurityError('Method not allowed', 405);
}

async function getCommunityActivity(req, res, ctx) {
  const scope = await getUserCurriculumScope(ctx.userId);
  const activeGroupId = scope?.active_group_id;

  if (!activeGroupId) {
    return res.status(200).json([]);
  }

  const { data: units } = await supabase
    .from('curriculum_units')
    .select('id')
    .eq('group_id', activeGroupId)
    .eq('is_active', true);

  const unitIds = (units || []).map(u => u.id);
  if (!unitIds.length) {
    return res.status(200).json([]);
  }

  const authorisedContentIds = {};

  const contentPromises = CONTENT_TYPES_WITH_UNIT.map(async (type) => {
    let table;
    switch (type) {
      case 'note':               table = 'notes'; break;
      case 'quiz_batch':         table = 'quiz_batches'; break;
      case 'flashcard_deck':     table = 'flashcard_decks'; break;
      case 'pdf_resource':       table = 'pdf_resources'; break;
      case 'past_paper':         table = 'past_papers'; break;
      case 'weekly_challenge':   table = 'weekly_challenges'; break;
      case 'content_collection': table = 'content_collections'; break;
      case 'video':              table = 'videos'; break;
      case 'article':            table = 'articles'; break;
      default: return;
    }
    const { data } = await supabase
      .from(table)
      .select('id')
      .in('unit_id', unitIds);
    if (data) {
      authorisedContentIds[type] = new Set(data.map(item => item.id));
    }
  });

  await Promise.all(contentPromises);

  const [
    { data: reactions },
    { data: comments },
  ] = await Promise.all([
    supabase
      .from('content_reactions')
      .select('user_id, content_type, content_id, reaction_type, created_at')
      .order('created_at', { ascending: false })
      .limit(200),
    supabase
      .from('content_comments')
      .select('user_id, content_type, content_id, body, created_at')
      .eq('is_hidden', false)
      .order('created_at', { ascending: false })
      .limit(200),
  ]);

  const relevantUserIds = new Set();
  const activity = [];

  for (const r of (reactions || [])) {
    const scopeSet = authorisedContentIds[r.content_type];
    if (!scopeSet || !scopeSet.has(r.content_id)) continue;
    relevantUserIds.add(r.user_id);
    let title = 'a resource';
    if (r.content_type === 'note') {
      const { data: note } = await supabase
        .from('notes')
        .select('title')
        .eq('id', r.content_id)
        .maybeSingle();
      if (note) title = note.title;
    }
    activity.push({
      type: 'reaction',
      message: `{{${r.user_id}}} ${r.reaction_type}d "${title}"`,
      time: r.created_at,
      user_id: r.user_id,
    });
  }

  for (const c of (comments || [])) {
    const scopeSet = authorisedContentIds[c.content_type];
    if (!scopeSet || !scopeSet.has(c.content_id)) continue;
    relevantUserIds.add(c.user_id);
    let title = 'a resource';
    if (c.content_type === 'note') {
      const { data: note } = await supabase
        .from('notes')
        .select('title')
        .eq('id', c.content_id)
        .maybeSingle();
      if (note) title = note.title;
    }
    activity.push({
      type: 'comment',
      message: `{{${c.user_id}}} commented on "${title}": "${c.body.slice(0, 60)}..."`,
      time: c.created_at,
      user_id: c.user_id,
    });
  }

  const userNames = {};
  const userIdsArray = [...relevantUserIds];
  const userFetches = userIdsArray.map(async (uid) => {
    try {
      const { data: { user } } = await supabase.auth.admin.getUserById(uid);
      return { uid, name: user?.user_metadata?.full_name || 'Someone' };
    } catch {
      return { uid, name: 'Someone' };
    }
  });
  const results = await Promise.all(userFetches);
  results.forEach(({ uid, name }) => { userNames[uid] = name; });

  const resolved = activity.map(item => ({
    ...item,
    message: item.message.replace(/\{\{(.+?)\}\}/, (_, uid) => userNames[uid] || 'Someone'),
  }));

  resolved.sort((a, b) => new Date(b.time) - new Date(a.time));
  return res.status(200).json(resolved.slice(0, 15));
}
