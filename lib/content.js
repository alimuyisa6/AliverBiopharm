/* lib/content.js */
import { supabase, getClientIp } from './core.js';
import {
  parseAndValidateBody,
  requireAuth,
  SecurityError
} from './security-middleware.js';
import {
  resolveBreadcrumb,
  resolveUnitTitle,
  getUserCurriculumScope
} from './curriculum.js';
import { checkContentAccess, recordAbuseProbe } from './premium.js';

const LOCKED_PREVIEW_FIELDS = {
  note: ['id', 'slug', 'title', 'unit_id', 'is_premium', 'category', 'tag', 'section_type', 'read_time', 'word_count', 'author', 'display_order', 'created_at', 'updated_at'],
  article: ['id', 'slug', 'title', 'excerpt', 'featured_image_url', 'category', 'tags', 'author_name', 'is_featured', 'is_premium', 'read_time_minutes', 'view_count', 'published_at', 'unit_id', 'created_at', 'updated_at'],
  video: ['id', 'slug', 'title', 'description', 'provider', 'thumbnail_url', 'duration_seconds', 'is_premium', 'is_active', 'view_count', 'unit_id', 'display_order', 'created_at', 'updated_at']
};

const VALID_CONTENT_TYPES = new Set(['note', 'article', 'video']);

function assertValidContentType(contentType) {
  if (!VALID_CONTENT_TYPES.has(contentType)) {
    throw new SecurityError('Invalid content_type', 400);
  }
}

function previewOnlyFields(type, item) {
  const allowed = LOCKED_PREVIEW_FIELDS[type] || ['id', 'slug', 'title', 'unit_id', 'is_premium'];
  const clean = {};

  for (const field of allowed) {
    if (field in item) clean[field] = item[field];
  }

  return clean;
}

export async function handler(req, res, path, ctx) {
  if (req.method === 'GET') {
    return handleGet(path, req, res, ctx);
  }

  if (req.method === 'POST') {
    requireAuth(ctx);

    const body = await parseAndValidateBody(req);
    return handlePost(path, body, req, res, ctx);
  }

  throw new SecurityError('Method not allowed', 405);
}

async function handleGet(path, req, res, ctx) {
  switch (path) {
    case 'detail':
      return getContentDetail(req, res, ctx);
    case 'links':
      return getInternalLinks(req, res, ctx);
    case 'related':
      return getRelatedContent(req, res, ctx);
    case 'collections':
      return listCollections(req, res);
    case 'collection':
      return getCollection(req, res);
    default:
      throw new SecurityError('Invalid action', 400);
  }
}

async function handlePost(path, body, req, res, ctx) {
  switch (path) {
    case 'toggle_bookmark':
      return toggleBookmark(body, res, ctx);
    case 'rate':
      return rateContent(body, res, ctx);
    case 'view':
      return recordView(body, res, ctx, req);
    default:
      throw new SecurityError('Invalid action', 400);
  }
}

async function getContentDetail(req, res, ctx) {
  const { type, id, slug } = req.query;

  if (!type) throw new SecurityError('type required', 400);
  if (!id && !slug) throw new SecurityError('id or slug required', 400);

  assertValidContentType(type);

  let content;

  if (type === 'note') {
    const commonSelect = '*, curriculum_units(name, curriculum_groups(name, level_id))';

    content = id
      ? await supabase.from('notes').select(commonSelect).eq('id', id).eq('is_active', true).maybeSingle()
      : await supabase.from('notes').select(commonSelect).eq('slug', slug).eq('is_active', true).maybeSingle();
  }

  if (type === 'article') {
    content = id
      ? await supabase.from('articles').select('*').eq('id', id).eq('status', 'published').maybeSingle()
      : await supabase.from('articles').select('*').eq('slug', slug).eq('status', 'published').maybeSingle();
  }

  if (type === 'video') {
    content = id
      ? await supabase.from('videos').select('*').eq('id', id).eq('is_active', true).maybeSingle()
      : await supabase.from('videos').select('*').eq('slug', slug).eq('is_active', true).maybeSingle();
  }

  if (!content?.data) throw new SecurityError('Content not found', 404);

  const item = content.data;
  const unitId = item.unit_id || null;
  const isPremium = item.is_premium || false;

  if (ctx.authenticated && unitId) {
    const scope = await getUserCurriculumScope(ctx.userId);

    if (scope?.active_group_id) {
      const { data: allowedUnits } = await supabase
        .from('curriculum_units')
        .select('id')
        .eq('group_id', scope.active_group_id)
        .eq('is_active', true);

      const allowedIds = new Set((allowedUnits || []).map((unit) => unit.id));

      if (!allowedIds.has(unitId)) {
        throw new SecurityError('Content not available in your curriculum context', 403);
      }
    }
  }

  let access = { allowed: true };

  if (ctx.authenticated) {
    const { data: authUser } = await supabase.auth.admin.getUserById(ctx.userId);
    access = await checkContentAccess(authUser?.user?.email || null, ctx.userId, type, item.id, isPremium);
  } else if (isPremium) {
    access = { allowed: false, reason: 'premium_locked' };
  }

  const breadcrumb = unitId ? await resolveBreadcrumb(unitId) : [];
  const unitTitle = unitId ? await resolveUnitTitle(unitId) : null;

  if (!access.allowed) {
    if (access.reason === 'premium_locked' && ctx.authenticated) {
      await recordAbuseProbe(ctx.userId, `premium_probe_${type}`);
    }

    return res.status(200).json({
      ...previewOnlyFields(type, item),
      type,
      locked: true,
      access,
      breadcrumb,
      unit_title: unitTitle
    });
  }

  return res.status(200).json({
    ...item,
    type,
    access,
    breadcrumb,
    unit_title: unitTitle
  });
}

async function getInternalLinks(req, res, ctx) {
  const { type, id } = req.query;

  if (!type || !id) throw new SecurityError('type and id required', 400);

  const { data: links } = await supabase
    .from('content_links')
    .select('link_text, target_reference_id, content_references!inner(slug, path, title, content_type)')
    .eq('source_type', type)
    .eq('source_id', id)
    .order('position');

  return res.status(200).json(
    (links || []).map((link) => ({
      text: link.link_text,
      slug: link.content_references.slug,
      path: link.content_references.path,
      title: link.content_references.title,
      type: link.content_references.content_type
    }))
  );
}

async function getRelatedContent(req, res, ctx) {
  const { type, id } = req.query;

  if (!type || !id) throw new SecurityError('type and id required', 400);

  const { data: reference } = await supabase
    .from('content_references')
    .select('id')
    .eq('content_type', type)
    .eq('content_id', id)
    .maybeSingle();

  if (reference) {
    const { data: explicit } = await supabase
      .from('related_content')
      .select('relationship_type, target_reference_id, content_references!inner(slug, path, title, content_type)')
      .eq('source_reference_id', reference.id)
      .order('relevance_score', { ascending: false })
      .limit(5);

    if (explicit?.length) {
      return res.status(200).json(
        explicit.map((item) => ({
          relationship: item.relationship_type,
          slug: item.content_references.slug,
          path: item.content_references.path,
          title: item.content_references.title,
          type: item.content_references.content_type
        }))
      );
    }
  }

  if (type === 'note') {
    const { data: note } = await supabase
      .from('notes')
      .select('unit_id')
      .eq('id', id)
      .maybeSingle();

    if (note?.unit_id) {
      const { data: sameUnit } = await supabase
        .from('notes')
        .select('id, slug, title')
        .eq('unit_id', note.unit_id)
        .eq('is_active', true)
        .neq('id', id)
        .order('display_order')
        .limit(5);

      return res.status(200).json(
        (sameUnit || []).map((item) => ({
          relationship: 'related',
          slug: item.slug,
          path: `/notes/${item.slug}`,
          title: item.title,
          type: 'note'
        }))
      );
    }
  }

  return res.status(200).json([]);
}

async function toggleBookmark(body, res, ctx) {
  const { content_type, content_id } = body;

  if (!content_type || !content_id) {
    throw new SecurityError('content_type and content_id required', 400);
  }

  assertValidContentType(content_type);

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

  await supabase.from('content_reactions').insert({
    user_id: ctx.userId,
    content_type,
    content_id,
    reaction_type: 'bookmark'
  });

  return res.status(200).json({ bookmarked: true });
}

async function rateContent(body, res, ctx) {
  const { content_type, content_id, rating, difficulty_rating } = body;

  if (!content_type || !content_id || rating === undefined) {
    throw new SecurityError('content_type, content_id, rating required', 400);
  }

  assertValidContentType(content_type);

  if (typeof rating !== 'number' || rating < 1 || rating > 5) {
    throw new SecurityError('rating must be a number between 1 and 5', 400);
  }

  await supabase.from('content_ratings').upsert({
    user_id: ctx.userId,
    content_type,
    content_id,
    rating,
    difficulty_rating,
    updated_at: new Date().toISOString()
  }, { onConflict: 'user_id,content_type,content_id' });

  return res.status(200).json({ success: true });
}

async function recordView(body, res, ctx, req) {
  const { content_type, content_id } = body;

  if (!content_type || !content_id) {
    throw new SecurityError('content_type and content_id required', 400);
  }

  assertValidContentType(content_type);

  await supabase.from('content_views').insert({
    content_type,
    content_id,
    user_id: ctx.userId || null,
    ip_address: getClientIp(req),
    created_at: new Date().toISOString()
  });

  return res.status(200).json({ success: true });
}

async function listCollections(req, res) {
  const { data } = await supabase
    .from('content_collections')
    .select('*')
    .eq('is_public', true)
    .order('created_at', { ascending: false });

  return res.status(200).json(data || []);
}

async function getCollection(req, res) {
  const { slug } = req.query;

  if (!slug) throw new SecurityError('slug required', 400);

  const { data: collection } = await supabase
    .from('content_collections')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();

  if (!collection) throw new SecurityError('Collection not found', 404);

  const { data: items } = await supabase
    .from('collection_items')
    .select('position, reference_id, content_references(slug, path, title, content_type)')
    .eq('collection_id', collection.id)
    .order('position');

  return res.status(200).json({
    ...collection,
    items: items || []
  });
}
