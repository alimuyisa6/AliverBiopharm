import { supabase } from './core.js';
import {
  parseAndValidateBody,
  requireAuth,
  requireAdmin,
  SecurityError,
} from './security-middleware.js';
import { getUserCurriculumScope } from './curriculum.js';
import { checkContentAccess, checkDownloadAccess } from './premium.js';

export async function handler(req, res, path, ctx) {
  if (req.method === 'GET') {
    requireAuth(ctx);
    switch (path) {
      case 'list':   return listArticles(req, res, ctx);
      case 'detail': return getArticle(req, res, ctx);
      default: throw new SecurityError('Invalid action', 400);
    }
  }

  if (req.method === 'POST') {
    const body = await parseAndValidateBody(req);
    if (['create', 'update', 'delete'].includes(path)) {
      requireAdmin(ctx);
    } else {
      requireAuth(ctx);
    }
    switch (path) {
      case 'create': return createArticle(body, res, ctx);
      case 'update': return updateArticle(body, res, ctx);
      case 'delete': return deleteArticle(body, res, ctx);
      default: throw new SecurityError('Invalid action', 400);
    }
  }
  throw new SecurityError('Method not allowed', 405);
}

// ---------- helpers ----------

async function getActiveUnitIds(ctx) {
  if (ctx.adminData) return null;
  const scope = await getUserCurriculumScope(ctx.userId);
  if (!scope || !scope.active_group_id) return [];
  const { data: units } = await supabase
    .from('curriculum_units')
    .select('id')
    .eq('group_id', scope.active_group_id)
    .eq('is_active', true);
  return (units || []).map(u => u.id);
}

function validateUnitAccess(allowedUnitIds, unitId) {
  if (allowedUnitIds !== null && !allowedUnitIds.includes(unitId)) {
    throw new SecurityError('Article not available in your curriculum', 403);
  }
}

async function filterByScope(query, allowedUnitIds) {
  if (allowedUnitIds !== null) {
    return query.in('unit_id', allowedUnitIds);
  }
  return query;
}

// ---------- endpoints ----------

async function listArticles(req, res, ctx) {
  const allowedUnitIds = await getActiveUnitIds(ctx);
  if (allowedUnitIds !== null && allowedUnitIds.length === 0) {
    return res.status(200).json([]);
  }

  const { unit_id, status = 'published', search, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let query = supabase
    .from('articles')
    .select('id, slug, title, excerpt, author, published_at, unit_id, is_premium', { count: 'exact' })
    .eq('status', status)
    .order('published_at', { ascending: false })
    .range(offset, offset + parseInt(limit) - 1);

  if (unit_id) {
    validateUnitAccess(allowedUnitIds, unit_id);
    query = query.eq('unit_id', unit_id);
  } else {
    query = await filterByScope(query, allowedUnitIds);
  }

  if (search) {
    query = query.or(`title.ilike.%${search}%,excerpt.ilike.%${search}%`);
  }

  const { data, error, count } = await query;
  if (error) throw new SecurityError('Failed to fetch articles', 500);

  return res.status(200).json({
    articles: data || [],
    total: count || 0,
    page: parseInt(page),
    limit: parseInt(limit),
    total_pages: Math.ceil((count || 0) / parseInt(limit)),
  });
}

async function getArticle(req, res, ctx) {
  const { id, slug } = req.query;
  if (!id && !slug) throw new SecurityError('id or slug required', 400);

  let query = supabase.from('articles').select('*');
  if (id) query = query.eq('id', id);
  else query = query.eq('slug', slug);

  const { data: article, error } = await query.maybeSingle();
  if (error || !article) throw new SecurityError('Article not found', 404);

  if (article.status !== 'published' && !ctx.adminData) {
    throw new SecurityError('Article not available', 404);
  }

  const allowedUnitIds = await getActiveUnitIds(ctx);
  if (article.unit_id) {
    validateUnitAccess(allowedUnitIds, article.unit_id);
  }

  const email = (await supabase.auth.admin.getUserById(ctx.userId)).data?.user?.email || null;
  const access = await checkContentAccess(email, ctx.userId, 'article', article.id, article.is_premium);
  if (!access.allowed) {
    return res.status(200).json({ locked: true, reason: access.reason, title: article.title, id: article.id });
  }

  return res.status(200).json(article);
}

async function createArticle(body, res, ctx) {
  const { title, slug, excerpt, content, unit_id, author, is_premium, status } = body;
  if (!title || !slug || !unit_id) throw new SecurityError('title, slug, unit_id required', 400);

  const { data: unit } = await supabase
    .from('curriculum_units')
    .select('id')
    .eq('id', unit_id)
    .maybeSingle();
  if (!unit) throw new SecurityError('Invalid curriculum unit', 400);

  const { data, error } = await supabase
    .from('articles')
    .insert({
      title,
      slug,
      excerpt: excerpt || '',
      content: content || '',
      unit_id,
      author: author || null,
      is_premium: !!is_premium,
      status: status || 'published',
      published_at: status === 'published' ? new Date().toISOString() : null,
    })
    .select()
    .single();

  if (error) throw new SecurityError('Failed to create article', 500);
  return res.status(200).json({ success: true, article: data });
}

async function updateArticle(body, res, ctx) {
  const { id, ...updates } = body;
  if (!id) throw new SecurityError('id required', 400);

  if (updates.unit_id) {
    const { data: unit } = await supabase
      .from('curriculum_units')
      .select('id')
      .eq('id', updates.unit_id)
      .maybeSingle();
    if (!unit) throw new SecurityError('Invalid curriculum unit', 400);
  }

  if (updates.status === 'published' && !updates.published_at) {
    updates.published_at = new Date().toISOString();
  }

  updates.updated_at = new Date().toISOString();
  const { error } = await supabase.from('articles').update(updates).eq('id', id);
  if (error) throw new SecurityError('Failed to update article', 500);
  return res.status(200).json({ success: true });
}

async function deleteArticle(body, res, ctx) {
  const { id } = body;
  if (!id) throw new SecurityError('id required', 400);
  await supabase.from('articles').update({ status: 'archived' }).eq('id', id);
  return res.status(200).json({ success: true });
}
