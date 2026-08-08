 import { supabase } from './core.js';
import {
  parseAndValidateBody,
  requireAuth,
  requireAdmin,
  SecurityError,
} from './security-middleware.js';
import { getUserCurriculumScope } from './curriculum.js';
import { checkContentAccess, checkDownloadAccess, recordAbuseProbe } from './premium.js';

export async function handler(req, res, path, ctx) {
  if (req.method === 'GET') {
    requireAuth(ctx);
    switch (path) {
      case 'list':       return listPdfs(req, res, ctx);
      case 'detail':     return getPdf(req, res, ctx);
      case 'download_url': return getDownloadUrl(req, res, ctx);
      default: throw new SecurityError('Invalid action', 400);
    }
  }

  if (req.method === 'POST') {
    const body = await parseAndValidateBody(req);
    switch (path) {
      case 'create':     requireAdmin(ctx); return createPdf(body, res, ctx);
      case 'update':     requireAdmin(ctx); return updatePdf(body, res, ctx);
      case 'delete':     requireAdmin(ctx); return deletePdf(body, res, ctx);
      case 'track_preview': requireAuth(ctx); return trackPreview(body, res, ctx);
      default: throw new SecurityError('Invalid action', 400);
    }
  }
  throw new SecurityError('Method not allowed', 405);
}

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
    throw new SecurityError('PDF not available in your curriculum', 403);
  }
}

async function filterByScope(query, allowedUnitIds) {
  if (allowedUnitIds !== null) {
    return query.in('unit_id', allowedUnitIds);
  }
  return query;
}

async function getUserEmail(ctx) {
  const { data } = await supabase.auth.admin.getUserById(ctx.userId);
  return data?.user?.email || null;
}

async function listPdfs(req, res, ctx) {
  const allowedUnitIds = await getActiveUnitIds(ctx);
  if (allowedUnitIds !== null && allowedUnitIds.length === 0) {
    return res.status(200).json([]);
  }

  const { unit_id, search, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let query = supabase
    .from('pdf_resources')
    .select('id, title, unit_id, author, file_size, is_premium, preview_count, download_count, created_at', { count: 'exact' })
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .range(offset, offset + parseInt(limit) - 1);

  if (unit_id) {
    validateUnitAccess(allowedUnitIds, unit_id);
    query = query.eq('unit_id', unit_id);
  } else {
    query = await filterByScope(query, allowedUnitIds);
  }

  if (search) {
    query = query.ilike('title', `%${search}%`);
  }

  const { data, error, count } = await query;
  if (error) throw new SecurityError('Failed to fetch PDFs', 500);

  return res.status(200).json({
    pdfs: data || [],
    total: count || 0,
    page: parseInt(page),
    limit: parseInt(limit),
    total_pages: Math.ceil((count || 0) / parseInt(limit)),
  });
}

async function getPdf(req, res, ctx) {
  const { id } = req.query;
  if (!id) throw new SecurityError('id required', 400);

  const { data: pdf, error } = await supabase
    .from('pdf_resources')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error || !pdf) throw new SecurityError('PDF not found', 404);

  const allowedUnitIds = await getActiveUnitIds(ctx);
  validateUnitAccess(allowedUnitIds, pdf.unit_id);

  const email = await getUserEmail(ctx);
  const access = await checkContentAccess(email, ctx.userId, 'pdf', pdf.id, pdf.is_premium || false);
  if (!access.allowed) {
    if (access.reason === 'premium_locked') await recordAbuseProbe(ctx.userId, 'premium_probe_pdf');
    return res.status(200).json({
      locked: true,
      reason: access.reason,
      id: pdf.id,
      title: pdf.title,
      unit_id: pdf.unit_id,
      is_premium: pdf.is_premium || false,
    });
  }

  const { file_url, ...pdfWithoutUrl } = pdf;
  return res.status(200).json(pdf);
}

async function getDownloadUrl(req, res, ctx) {
  const { id } = req.query;
  if (!id) throw new SecurityError('id required', 400);

  const { data: pdf, error } = await supabase
    .from('pdf_resources')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error || !pdf) throw new SecurityError('PDF not found', 404);

  const allowedUnitIds = await getActiveUnitIds(ctx);
  validateUnitAccess(allowedUnitIds, pdf.unit_id);

  const email = await getUserEmail(ctx);
  const access = await checkDownloadAccess(email, ctx.userId, 'pdf', pdf.id, pdf.is_premium || false);
  if (!access.allowed) {
    if (access.reason === 'premium_locked') await recordAbuseProbe(ctx.userId, 'premium_probe_pdf');
    throw new SecurityError(access.reason === 'premium_locked' ? 'Premium required' : 'Access denied', 403);
  }

  await supabase
    .from('pdf_resources')
    .update({ download_count: (pdf.download_count || 0) + 1 })
    .eq('id', id);

  const url = pdf.file_url;
  return res.status(200).json({ url });
}

async function createPdf(body, res, ctx) {
  const { title, unit_id, file_url, file_size, author, is_premium } = body;
  if (!title || !unit_id || !file_url) throw new SecurityError('title, unit_id, file_url required', 400);

  const { data: unit } = await supabase
    .from('curriculum_units')
    .select('id')
    .eq('id', unit_id)
    .maybeSingle();
  if (!unit) throw new SecurityError('Invalid curriculum unit', 400);

  const { data, error } = await supabase
    .from('pdf_resources')
    .insert({
      title,
      unit_id,
      file_url,
      file_size: file_size || null,
      author: author || null,
      is_active: true,
      is_premium: !!is_premium,
      created_by: ctx.userId,
    })
    .select()
    .single();

  if (error) throw new SecurityError('Failed to create PDF', 500);
  return res.status(200).json({ success: true, pdf: data });
}

async function updatePdf(body, res, ctx) {
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

  updates.updated_at = new Date().toISOString();
  const { error } = await supabase.from('pdf_resources').update(updates).eq('id', id);
  if (error) throw new SecurityError('Failed to update PDF', 500);
  return res.status(200).json({ success: true });
}

async function deletePdf(body, res, ctx) {
  const { id } = body;
  if (!id) throw new SecurityError('id required', 400);
  await supabase.from('pdf_resources').update({ is_active: false }).eq('id', id);
  return res.status(200).json({ success: true });
}

async function trackPreview(body, res, ctx) {
  const { pdf_id } = body;
  if (!pdf_id) throw new SecurityError('pdf_id required', 400);

  const { data: pdf } = await supabase.from('pdf_resources').select('unit_id, preview_count').eq('id', pdf_id).maybeSingle();
  if (!pdf) throw new SecurityError('PDF not found', 404);

  const allowedUnitIds = await getActiveUnitIds(ctx);
  validateUnitAccess(allowedUnitIds, pdf.unit_id);

  await supabase.from('pdf_resources').update({ preview_count: (pdf.preview_count || 0) + 1 }).eq('id', pdf_id);
  return res.status(200).json({ success: true });
}
