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

async function getBlockedCounterparties(userId) {
  const { data } = await supabase
    .from('user_blocks')
    .select('blocker_id, blocked_user_id')
    .or(`blocker_id.eq.${userId},blocked_user_id.eq.${userId}`);

  const excluded = new Set();
  (data || []).forEach(row => {
    excluded.add(row.blocker_id === userId ? row.blocked_user_id : row.blocker_id);
  });
  return excluded;
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

  // Anyone the current user has blocked, or who has blocked the current
  // user, is excluded from the feed entirely — a block should mean you
  // stop seeing each other's activity, not just stop direct contact.
  const blockedCounterparties = await getBlockedCounterparties(ctx.userId);

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

  // Filter down to in-scope, non-blocked rows first, then batch-resolve
  // note titles in a single query instead of one query per row.
  const relevantReactions = (reactions || []).filter(r => {
    const scopeSet = authorisedContentIds[r.content_type];
    if (!scopeSet || !scopeSet.has(r.content_id)) return false;
    if (blockedCounterparties.has(r.user_id)) return false;
    return true;
  });

  const relevantComments = (comments || []).filter(c => {
    const scopeSet = authorisedContentIds[c.content_type];
    if (!scopeSet || !scopeSet.has(c.content_id)) return false;
    if (blockedCounterparties.has(c.user_id)) return false;
    return true;
  });

  const noteIds = new Set([
    ...relevantReactions.filter(r => r.content_type === 'note').map(r => r.content_id),
    ...relevantComments.filter(c => c.content_type === 'note').map(c => c.content_id),
  ]);

  const noteTitles = {};
  if (noteIds.size) {
    const { data: notes } = await supabase
      .from('notes')
      .select('id, title')
      .in('id', [...noteIds]);
    (notes || []).forEach(n => { noteTitles[n.id] = n.title; });
  }

  const relevantUserIds = new Set();
  const activity = [];

  for (const r of relevantReactions) {
    relevantUserIds.add(r.user_id);
    const title = r.content_type === 'note' ? (noteTitles[r.content_id] || 'a resource') : 'a resource';
    activity.push({
      type: 'reaction',
      message: `{{${r.user_id}}} ${r.reaction_type}d "${title}"`,
      time: r.created_at,
      user_id: r.user_id,
    });
  }

  for (const c of relevantComments) {
    relevantUserIds.add(c.user_id);
    const title = c.content_type === 'note' ? (noteTitles[c.content_id] || 'a resource') : 'a resource';
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
    message: item.message.replace(/\{\{(.+?)\}\}/g, (_, uid) => userNames[uid] || 'Someone'),
  }));

  resolved.sort((a, b) => new Date(b.time) - new Date(a.time));
  return res.status(200).json(resolved.slice(0, 15));
}
