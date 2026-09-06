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

// Full field allowlist for unlocked content — never spread a raw DB row into a response.
const FULL_CONTENT_FIELDS = {
  note: [...LOCKED_PREVIEW_FIELDS.note, 'content', 'content_preview', 'toc', 'cover_image_url', 'file_url', 'metadata'],
  article: [...LOCKED_PREVIEW_FIELDS.article, 'content'],
  video: [...LOCKED_PREVIEW_FIELDS.video, 'video_url', 'embed_url', 'transcript']
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

function fullContentFields(type, item) {
  const allowed = FULL_CONTENT_FIELDS[type];

  if (!allowed) return item;

  const clean = {};

  for (const field of allowed) {
    if (field in item) clean[field] = item[field];
  }

  return clean;
}

// Shared gate for any endpoint that surfaces links/metadata pointing at other
// content items (getInternalLinks, getRelatedContent). A premium item must
// never appear in these responses to a user who isn't entitled to see it —
// otherwise the "locked" content is discoverable through a side door even
// though getContentDetail correctly blocks direct access to it.
async function filterAccessibleReferences(rows, getRef, ctx) {
  if (!rows || !rows.length) return [];

  let userEmail = null;

  if (ctx.authenticated) {
    const { data: authUser } = await supabase.auth.admin.getUserById(ctx.userId);
    userEmail = authUser?.user?.email || null;
  }

  const results = [];

  for (const row of rows) {
    const ref = getRef(row);

    if (!ref) continue;
    if (!ref.is_premium) {
      results.push(row);
      continue;
    }

    if (!ctx.authenticated) continue;

    const access = await checkContentAccess(userEmail, ctx.userId, ref.content_type, ref.target_reference_id || ref.id, true);

    if (access.allowed) results.push(row);
  }

  return results;
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
    case 'resolve':
      return resolveNavigationToken(req, res, ctx);
    case 'links':
      return getInternalLinks(req, res, ctx);
    case 'related':
      return getRelatedContent(req, res, ctx);
    case 'collections':
      return listCollections(req, res);
    case 'collection':
      return getCollection(req, res, ctx);
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

// Resolves an opaque /c/:token to actual content + authorization, exactly as
// laid out in the navigation design: token -> content_references row ->
// content_type/content_id -> the same detail+access logic getContentDetail
// already uses. The frontend never sees content_type/content_id/slug for
// anything it hasn't been granted access to.
async function resolveNavigationToken(req, res, ctx) {
  const { token } = req.query;

  if (!token || typeof token !== 'string' || !/^[A-Za-z0-9_-]{6,32}$/.test(token)) {
    throw new SecurityError('Invalid token', 400);
  }

  const { data: reference } = await supabase
    .from('content_references')
    .select('content_type, content_id, is_active')
    .eq('navigation_token', token)
    .maybeSingle();

  if (!reference || !reference.is_active) throw new SecurityError('Content not found', 404);

  return getContentDetail(req, res, ctx, { type: reference.content_type, id: reference.content_id });
}

async function getContentDetail(req, res, ctx, override) {
  const type = override?.type || req.query.type;
  const id = override?.id || req.query.id;
  const slug = override?.slug || req.query.slug;

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
    ...fullContentFields(type, item),
    type,
    access,
    breadcrumb,
    unit_title: unitTitle
  });
}

async function getInternalLinks(req, res, ctx) {
  const { type, id } = req.query;

  if (!type || !id) throw new SecurityError('type and id required', 400);
  assertValidContentType(type);

  const { data: links } = await supabase
    .from('content_links')
    .select('link_text, target_reference_id, content_references!inner(id, slug, path, title, content_type, content_id, navigation_token, is_premium)')
    .eq('source_type', type)
    .eq('source_id', id)
    .order('position');

  const visible = await filterAccessibleReferences(links || [], (link) => link.content_references, ctx);

  return res.status(200).json(
    visible.map((link) => ({
      text: link.link_text,
      navigation_path: `/c/${link.content_references.navigation_token}`,
      title: link.content_references.title
    }))
  );
}

async function getRelatedContent(req, res, ctx) {
  const { type, id } = req.query;

  if (!type || !id) throw new SecurityError('type and id required', 400);
  assertValidContentType(type);

  const { data: reference } = await supabase
    .from('content_references')
    .select('id')
    .eq('content_type', type)
    .eq('content_id', id)
    .maybeSingle();

  if (reference) {
    const { data: explicit } = await supabase
      .from('related_content')
      .select('relationship_type, target_reference_id, content_references!inner(id, slug, path, title, content_type, content_id, navigation_token, is_premium)')
      .eq('source_reference_id', reference.id)
      .order('relevance_score', { ascending: false })
      .limit(5);

    if (explicit?.length) {
      const visible = await filterAccessibleReferences(explicit, (item) => item.content_references, ctx);

      return res.status(200).json(
        visible.map((item) => ({
          relationship: item.relationship_type,
          navigation_path: `/c/${item.content_references.navigation_token}`,
          title: item.content_references.title
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
        .select('id, title, is_premium, content_references!inner(navigation_token)')
        .eq('unit_id', note.unit_id)
        .eq('is_active', true)
        .neq('id', id)
        .order('display_order')
        .limit(5);

      const visible = await filterAccessibleReferences(
        (sameUnit || []).map((item) => ({ ...item, content_references: { content_type: 'note', content_id: item.id, is_premium: item.is_premium, navigation_token: item.content_references?.navigation_token } })),
        (item) => item.content_references,
        ctx
      );

      return res.status(200).json(
        visible
          .filter((item) => item.content_references?.navigation_token)
          .map((item) => ({
            relationship: 'related',
            navigation_path: `/c/${item.content_references.navigation_token}`,
            title: item.title
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

async function getCollection(req, res, ctx) {
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
    .select('position, reference_id, content_references(id, slug, path, title, content_type, content_id, navigation_token, is_premium)')
    .eq('collection_id', collection.id)
    .order('position');

  const visible = await filterAccessibleReferences(items || [], (item) => item.content_references, ctx);

  return res.status(200).json({
    ...collection,
    items: visible.map((item) => ({
      position: item.position,
      navigation_path: `/c/${item.content_references.navigation_token}`,
      title: item.content_references.title
    }))
  });
}
