 import { supabase } from './core.js';
import { parseAndValidateBody, SecurityError } from './security-middleware.js';

export async function handler(req, res, path, ctx) {
  if (req.method === 'GET') {
    switch (path) {
      case 'get_all_site_sections': return getAllSiteSections(req, res, ctx);
      case 'get_section_headings': return getSectionHeadings(req, res);
      case 'get_info_section': return getInfoSection(req, res);
      case 'get_info_sections_list': return getInfoSectionsList(req, res);
      default: throw new SecurityError('Invalid action', 400);
    }
  }
  if (req.method === 'POST') {
    if (!ctx.adminData) throw new SecurityError('Admin required', 403);
    const body = await parseAndValidateBody(req);
    switch (path) {
      case 'update_site_section': return updateSiteSection(body, res);
      case 'update_section_headings': return updateSectionHeadings(body, res);
      case 'update_info_section': return updateInfoSection(body, res);
      default: throw new SecurityError('Invalid action', 400);
    }
  }
  throw new SecurityError('Method not allowed', 405);
}

async function getAllSiteSections(req, res, ctx) {
  const { data, error } = await supabase
    .from('site_sections')
    .select('section, data')
    .eq('is_active', true);
  if (error) throw new SecurityError('Failed to fetch site sections', 500);
  const result = {};
  (data || []).forEach(row => { result[row.section] = row.data; });
  return res.status(200).json(result);
}

async function getSectionHeadings(req, res) {
  const { data, error } = await supabase
    .from('site_sections')
    .select('data')
    .eq('section', 'section_headings')
    .single();
  if (error && error.code !== 'PGRST116') throw new SecurityError('Failed to fetch section headings', 500);
  return res.status(200).json(data?.data || {});
}

async function getInfoSection(req, res) {
  const { section } = req.query;
  if (!section) throw new SecurityError('Section name required', 400);

  const { data, error } = await supabase
    .from('site_sections')
    .select('section, data')
    .eq('section', section)
    .eq('is_active', true)
    .single();

  if (error || !data) throw new SecurityError('Section not found', 404);
  return res.status(200).json({ section: data.section, ...data.data });
}

async function getInfoSectionsList(req, res) {
  const { data, error } = await supabase
    .from('site_sections')
    .select('section, data')
    .eq('is_active', true)
    .not('section', 'eq', 'section_headings')
    .order('data->>sort_order', { ascending: true });

  if (error) throw new SecurityError('Failed to fetch info sections', 500);

  const sections = (data || []).map(row => ({
    slug: row.section,
    title: row.data.title || row.section,
    short_description: row.data.short_description || row.data.description || '',
    icon: row.data.icon || 'fa-file-lines',
    category: row.data.category || 'general',
    sort_order: row.data.sort_order || 0
  }));

  return res.status(200).json(sections);
}

async function updateSiteSection(body, res) {
  const { section, data } = body;
  if (!section) throw new SecurityError('Section name required', 400);
  const { data: existing } = await supabase
    .from('site_sections')
    .select('id')
    .eq('section', section)
    .maybeSingle();
  if (existing) {
    await supabase.from('site_sections').update({ data }).eq('section', section);
  } else {
    await supabase.from('site_sections').insert({ section, data, is_active: true });
  }
  return res.status(200).json({ success: true });
}

async function updateSectionHeadings(body, res) {
  const { headings } = body;
  if (!headings) throw new SecurityError('Headings required', 400);
  const { data: existing } = await supabase
    .from('site_sections')
    .select('id')
    .eq('section', 'section_headings')
    .maybeSingle();
  if (existing) {
    await supabase.from('site_sections').update({ data: headings }).eq('section', 'section_headings');
  } else {
    await supabase.from('site_sections').insert({ section: 'section_headings', data: headings, is_active: true });
  }
  return res.status(200).json({ success: true });
}

async function updateInfoSection(body, res) {
  const { section, title, short_description, description, icon, category, content, sort_order } = body;
  if (!section) throw new SecurityError('Section name required', 400);

  const data = {
    title: title || section,
    short_description: short_description || '',
    description: description || '',
    icon: icon || 'fa-file-lines',
    category: category || 'general',
    content: content || [],
    sort_order: sort_order || 0
  };

  const { data: existing } = await supabase
    .from('site_sections')
    .select('id')
    .eq('section', section)
    .maybeSingle();

  if (existing) {
    await supabase.from('site_sections').update({ data }).eq('section', section);
  } else {
    await supabase.from('site_sections').insert({ section, data, is_active: true });
  }

  return res.status(200).json({ success: true });
}
