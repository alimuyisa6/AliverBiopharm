import { supabase, getClientIp } from './core.js';
import { parseAndValidateBody, requireAuth, SecurityError } from './security-middleware.js';
import { resolveBreadcrumb, resolveUnitTitle } from './curriculum.js';
import { checkContentAccess } from './premium.js';

export async function handler(req, res, path, ctx) {
  if (req.method === 'GET') {
    switch (path) {
      case 'detail': return getContentDetail(req, res, ctx);
      case 'links': return getInternalLinks(req, res);
      case 'related': return getRelatedContent(req, res);
      case 'collections': return listCollections(req, res);
      case 'collection': return getCollection(req, res);
      default: throw new SecurityError('Invalid action', 400);
    }
  }
  if (req.method === 'POST') {
    requireAuth(ctx);
    const body = await parseAndValidateBody(req);
    switch (path) {
      case 'toggle_bookmark': return toggleBookmark(body, res, ctx);
      case 'rate': return rateContent(body, res, ctx);
      case 'view': return recordView(body, res, ctx, req);
      default: throw new SecurityError('Invalid action', 400);
    }
  }
  throw new SecurityError('Method not allowed', 405);
}

async function getContentDetail(req, res, ctx) {
  const { type, id, slug } = req.query;
  if (!type) throw new SecurityError('type required', 400);
  if (!id && !slug) throw new SecurityError('id or slug required', 400);

  let content = null;
  const commonSelect = (type === 'note') ? '*, curriculum_units(name, curriculum_groups(name, level_id))' : '*';

  switch (type) {
    case 'note':
      if (id) content = await supabase.from('notes').select(commonSelect).eq('id', id).eq('is_active', true).maybeSingle();
      else content = await supabase.from('notes').select(commonSelect).eq('slug', slug).eq('is_active', true).maybeSingle();
      break;
    case 'article':
      if (id) content = await supabase.from('articles').select('*').eq('id', id).eq('status', 'published').maybeSingle();
      else content = await supabase.from('articles').select('*').eq('slug', slug).eq('status', 'published').maybeSingle();
      break;
    case 'video':
      if (id) content = await supabase.from('videos').select('*').eq('id', id).eq('is_active', true).maybeSingle();
      else content = await supabase.from('videos').select('*').eq('slug', slug).eq('is_active', true).maybeSingle();
      break;
    default:
      throw new SecurityError('Unsupported content type', 400);
  }

  if (!content?.data) throw new SecurityError('Content not found', 404);
  const item = content.data;

  const unitId = item.unit_id || null;
  const isPremium = item.is_premium || false;
  let access = { allowed: true };

  if (ctx.authenticated) {
    const { data: { user } } = await supabase.auth.admin.getUserById(ctx.userId);
    access = await checkContentAccess(user?.email || null, ctx.userId, type, item.id, isPremium);
  } else if (isPremium) {
    access = { allowed: false, reason: 'premium_locked' };
  }

  const breadcrumb = unitId ? await resolveBreadcrumb(unitId) : [];
  const unitTitle = unitId ? await resolveUnitTitle(unitId) : null;

  const [engagement, reactions, userReactions] = await Promise.all([
    supabase.from('content_engagement_summary').select('*').eq('content_type', type).eq('content_id', item.id.toString()).maybeSingle(),
    supabase.from('content_reactions').select('reaction_type, user_id').eq('content_type', type).eq('content_id', item.id.toString()),
    ctx.authenticated
      ? supabase.from('content_reactions').select('reaction_type').eq('content_type', type).eq('content_id', item.id.toString()).eq('user_id', ctx.userId)
      : Promise.resolve({ data: [] })
  ]);

  const reactionCounts = {};
  for (const r of reactions?.data || []) reactionCounts[r.reaction_type] = (reactionCounts[r.reaction_type] || 0) + 1;
  const userReactionList = (userReactions?.data || []).map(r => r.reaction_type);

  return res.status(200).json({
    ...item,
    type,
    access,
    breadcrumb,
    unit_title: unitTitle,
    engagement: engagement?.data || {},
    reactions: { counts: reactionCounts, user: userReactionList }
  });
}

async function getInternalLinks(req, res) {
  const { type, id } = req.query;
  if (!type || !id) throw new SecurityError('type and id required', 400);

  const { data: links } = await supabase
    .from('content_links')
    .select('link_text, target_reference_id, content_references!inner(slug, path, title, content_type)')
    .eq('source_type', type)
    .eq('source_id', id)
    .order('position');

  return res.status(200).json((links || []).map(l => ({
    text: l.link_text,
    slug: l.content_references.slug,
    path: l.content_references.path,
    title: l.content_references.title,
    type: l.content_references.content_type
  })));
}

async function getRelatedContent(req, res) {
  const { type, id } = req.query;
  if (!type || !id) throw new SecurityError('type and id required', 400);

  const { data: ref } = await supabase
    .from('content_references')
    .select('id')
    .eq('content_type', type)
    .eq('content_id', id)
    .maybeSingle();

  if (ref) {
    const { data: explicit } = await supabase
      .from('related_content')
      .select('relationship_type, target_reference_id, content_references!inner(slug, path, title, content_type)')
      .eq('source_reference_id', ref.id)
      .order('relevance_score', { ascending: false })
      .limit(5);
    if (explicit?.length) {
      return res.status(200).json(explicit.map(r => ({
        relationship: r.relationship_type,
        slug: r.content_references.slug,
        path: r.content_references.path,
        title: r.content_references.title,
        type: r.content_references.content_type
      })));
    }
  }

  if (type === 'note') {
    const { data: note } = await supabase.from('notes').select('unit_id').eq('id', id).maybeSingle();
    if (note?.unit_id) {
      const { data: sameUnit } = await supabase
        .from('notes')
        .select('id, slug, title')
        .eq('unit_id', note.unit_id)
        .eq('is_active', true)
        .neq('id', id)
        .order('display_order')
        .limit(5);
      return res.status(200).json((sameUnit || []).map(n => ({
        relationship: 'related',
        slug: n.slug,
        path: `/notes/${n.slug}`,
        title: n.title,
        type: 'note'
      })));
    }
  }

  return res.status(200).json([]);
}

async function toggleBookmark(body, res, ctx) {
  const { content_type, content_id } = body;
  if (!content_type || !content_id) throw new SecurityError('content_type and content_id required', 400);

  const { data: existing } = await supabase
    .from('content_reactions')
    .select('id')
    .eq('user_id', ctx.userId)
    .eq('content_type', content_type)
    .eq('content_id', content_id)
    .eq('reaction_type', 'bookmark')
    .maybeSingle();

  if (existing) {
    await supabase.from('content_reactions').delete().eq('id', existing.id);
    return res.status(200).json({ bookmarked: false });
  }
  await supabase.from('content_reactions').insert({ user_id: ctx.userId, content_type, content_id, reaction_type: 'bookmark' });
  return res.status(200).json({ bookmarked: true });
}

async function rateContent(body, res, ctx) {
  const { content_type, content_id, rating, difficulty_rating } = body;
  if (!content_type || !content_id || rating === undefined) throw new SecurityError('content_type, content_id, rating required', 400);
  await supabase.from('content_ratings').upsert({
    user_id: ctx.userId, content_type, content_id, rating, difficulty_rating, updated_at: new Date().toISOString()
  }, { onConflict: 'user_id,content_type,content_id' });
  return res.status(200).json({ success: true });
}

async function recordView(body, res, ctx, req) {
  const { content_type, content_id } = body;
  if (!content_type || !content_id) throw new SecurityError('content_type and content_id required', 400);
  await supabase.from('content_views').insert({
    content_type, content_id, user_id: ctx.userId || null, ip_address: getClientIp(req), created_at: new Date().toISOString()
  });
  return res.status(200).json({ success: true });
}

async function listCollections(req, res) {
  const { data } = await supabase.from('content_collections').select('*').eq('is_public', true).order('created_at', { ascending: false });
  return res.status(200).json(data || []);
}

async function getCollection(req, res) {
  const { slug } = req.query;
  if (!slug) throw new SecurityError('slug required', 400);
  const { data: collection } = await supabase.from('content_collections').select('*').eq('slug', slug).maybeSingle();
  if (!collection) throw new SecurityError('Collection not found', 404);
  const { data: items } = await supabase
    .from('collection_items')
    .select('position, reference_id, content_references(slug, path, title, content_type)')
    .eq('collection_id', collection.id)
    .order('position');
  return res.status(200).json({ ...collection, items: items || [] });
}
