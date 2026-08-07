 import { supabase } from './core.js';
import {
  parseAndValidateBody,
  requireAdmin,
  SecurityError,
} from './security-middleware.js';

export async function handler(req, res, path, ctx) {
  if (req.method === 'GET') {
    return handleGet(path, req, res, ctx);
  }
  if (req.method === 'POST') {
    requireAdmin(ctx);
    const body = await parseAndValidateBody(req);
    return handlePost(path, body, res, ctx);
  }
  throw new SecurityError('Method not allowed', 405);
}

async function handleGet(path, req, res, ctx) {
  switch (path) {
    case 'get_all_site_sections': return getAllSiteSections(req, res, ctx);
    case 'get_section_headings':  return getSectionHeadings(req, res, ctx);
    case 'get_info_section':      return getInfoSection(req, res, ctx);
    case 'get_info_sections_list':return getInfoSectionsList(req, res, ctx);
    default: throw new SecurityError('Invalid action', 400);
  }
}

async function handlePost(path, body, res, ctx) {
  switch (path) {
    case 'update_site_section':    return updateSiteSection(body, res);
    case 'update_section_headings':return updateSectionHeadings(body, res);
    case 'update_info_section':    return updateInfoSection(body, res);
    default: throw new SecurityError('Invalid action', 400);
  }
}

async function resolveEffectiveLevelId(req, ctx, providedLevelId) {
  if (providedLevelId) {
    const { data: level } = await supabase
      .from('curriculum_levels')
      .select('id')
      .eq('id', providedLevelId)
      .maybeSingle();
    if (!level) throw new SecurityError('Invalid curriculum level', 400);
    return level.id;
  }

  if (ctx.authenticated && ctx.userId) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('active_level_id')
      .eq('user_id', ctx.userId)
      .maybeSingle();
    if (profile?.active_level_id) {
      const { data: level } = await supabase
        .from('curriculum_levels')
        .select('id')
        .eq('id', profile.active_level_id)
        .maybeSingle();
      if (level) return level.id;
    }
  }

  const { data: firstLevel } = await supabase
    .from('curriculum_levels')
    .select('id')
    .order('display_order', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!firstLevel) throw new SecurityError('No curriculum levels found', 500);
  return firstLevel.id;
}

async function getAllSiteSections(req, res, ctx) {
  const levelId = await resolveEffectiveLevelId(req, ctx);
  const { data, error } = await supabase
    .from('platform_sections')
    .select('section_key, content')
    .eq('level_id', levelId)
    .eq('is_active', true);

  if (error) throw new SecurityError('Failed to fetch site sections', 500);

  const result = {};
  (data || []).forEach(row => {
    result[row.section_key] = row.content;
  });
  return res.status(200).json(result);
}

async function getSectionHeadings(req, res, ctx) {
  const levelId = await resolveEffectiveLevelId(req, ctx);
  const { data, error } = await supabase
    .from('platform_sections')
    .select('content')
    .eq('level_id', levelId)
    .eq('section_key', 'section_headings')
    .eq('is_active', true)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') throw new SecurityError('Failed to fetch section headings', 500);
  return res.status(200).json(data?.content || {});
}

async function getInfoSection(req, res, ctx) {
  const { section } = req.query;
  if (!section) throw new SecurityError('Section name required', 400);

  const levelId = await resolveEffectiveLevelId(req, ctx);
  const { data, error } = await supabase
    .from('platform_sections')
    .select('section_key, content')
    .eq('level_id', levelId)
    .eq('section_key', section)
    .eq('is_active', true)
    .maybeSingle();

  if (error || !data) throw new SecurityError('Section not found', 404);
  return res.status(200).json({ section: data.section_key, ...data.content });
}

async function getInfoSectionsList(req, res, ctx) {
  const levelId = await resolveEffectiveLevelId(req, ctx);
  const { data, error } = await supabase
    .from('platform_sections')
    .select('section_key, content')
    .eq('level_id', levelId)
    .eq('is_active', true)
    .filter('content->>is_info_section', 'eq', 'true')
    .order('content->>sort_order', { ascending: true });

  if (error) throw new SecurityError('Failed to fetch info sections', 500);

  const sections = (data || []).map(row => ({
    slug: row.section_key,
    title: row.content.title || row.section_key,
    short_description: row.content.short_description || row.content.description || '',
    icon: row.content.icon || 'fa-file-lines',
    category: row.content.category || 'general',
    sort_order: row.content.sort_order || 0,
  }));

  return res.status(200).json(sections);
}

async function updateSiteSection(body, res) {
  const { section, data: sectionData, level_id } = body;
  if (!section) throw new SecurityError('Section name required', 400);

  const effectiveLevel = level_id || await resolveDefaultLevelId();
  const { data: level } = await supabase
    .from('curriculum_levels')
    .select('id')
    .eq('id', effectiveLevel)
    .maybeSingle();
  if (!level) throw new SecurityError('Invalid level', 400);

  const { data: existing } = await supabase
    .from('platform_sections')
    .select('id')
    .eq('level_id', effectiveLevel)
    .eq('section_key', section)
    .maybeSingle();

  if (existing) {
    await supabase
      .from('platform_sections')
      .update({ content: sectionData, updated_at: new Date().toISOString() })
      .eq('id', existing.id);
  } else {
    await supabase
      .from('platform_sections')
      .insert({
        level_id: effectiveLevel,
        section_key: section,
        content: sectionData,
        is_active: true,
      });
  }

  return res.status(200).json({ success: true });
}

async function updateSectionHeadings(body, res) {
  const { headings, level_id } = body;
  if (!headings) throw new SecurityError('Headings required', 400);

  const effectiveLevel = level_id || await resolveDefaultLevelId();
  const { data: level } = await supabase
    .from('curriculum_levels')
    .select('id')
    .eq('id', effectiveLevel)
    .maybeSingle();
  if (!level) throw new SecurityError('Invalid level', 400);

  const { data: existing } = await supabase
    .from('platform_sections')
    .select('id')
    .eq('level_id', effectiveLevel)
    .eq('section_key', 'section_headings')
    .maybeSingle();

  if (existing) {
    await supabase
      .from('platform_sections')
      .update({ content: headings, updated_at: new Date().toISOString() })
      .eq('id', existing.id);
  } else {
    await supabase
      .from('platform_sections')
      .insert({
        level_id: effectiveLevel,
        section_key: 'section_headings',
        content: headings,
        is_active: true,
      });
  }

  return res.status(200).json({ success: true });
}

async function updateInfoSection(body, res) {
  const {
    section,
    title,
    short_description,
    description,
    icon,
    category,
    content,
    sort_order,
    level_id,
  } = body;

  if (!section) throw new SecurityError('Section name required', 400);

  const effectiveLevel = level_id || await resolveDefaultLevelId();
  const { data: level } = await supabase
    .from('curriculum_levels')
    .select('id')
    .eq('id', effectiveLevel)
    .maybeSingle();
  if (!level) throw new SecurityError('Invalid level', 400);

  const sectionContent = {
    is_info_section: true,
    title: title || section,
    short_description: short_description || '',
    description: description || '',
    icon: icon || 'fa-file-lines',
    category: category || 'general',
    content: content || [],
    sort_order: sort_order || 0,
  };

  const { data: existing } = await supabase
    .from('platform_sections')
    .select('id')
    .eq('level_id', effectiveLevel)
    .eq('section_key', section)
    .maybeSingle();

  if (existing) {
    await supabase
      .from('platform_sections')
      .update({ content: sectionContent, updated_at: new Date().toISOString() })
      .eq('id', existing.id);
  } else {
    await supabase
      .from('platform_sections')
      .insert({
        level_id: effectiveLevel,
        section_key: section,
        content: sectionContent,
        is_active: true,
      });
  }

  return res.status(200).json({ success: true });
}

async function resolveDefaultLevelId() {
  const { data: firstLevel } = await supabase
    .from('curriculum_levels')
    .select('id')
    .order('display_order', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!firstLevel) throw new SecurityError('No curriculum levels found', 500);
  return firstLevel.id;
}
