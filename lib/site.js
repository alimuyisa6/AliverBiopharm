// /lib/site.js
import { supabase, parseCookies, hashToken, validateSession, isAdmin } from './core.js';

async function parseBody(req) { const chunks = []; for await (const chunk of req) chunks.push(chunk); return JSON.parse(Buffer.concat(chunks).toString()); }

export async function handler(req, res, path, ctx) {
  const { userId, adminData, ip } = ctx;

  if (req.method === 'GET') {
    switch (path) {
      case 'get_all_site_sections': return getAllSiteSections(req, res, userId);
      case 'get_section_headings': return getSectionHeadings(req, res);
      default: return res.status(400).json({ error: 'Invalid action' });
    }
  }
  if (req.method === 'POST') {
    if (!adminData) return res.status(403).json({ error: 'Admin required' });
    const body = await parseBody(req);
    switch (path) {
      case 'update_site_section': return updateSiteSection(body, res);
      case 'update_section_headings': return updateSectionHeadings(body, res);
      default: return res.status(400).json({ error: 'Invalid action' });
    }
  }
  return res.status(405).json({ error: 'Method not allowed' });
}

async function getAllSiteSections(req, res, userId) {
  const { data, error } = await supabase.from('site_sections').select('section, data');
  if (error) return res.status(500).json({ error: error.message });
  const result = {};
  (data || []).forEach(row => { result[row.section] = row.data; });
  return res.status(200).json(result);
}

async function getSectionHeadings(req, res) {
  const { data, error } = await supabase.from('site_sections').select('data').eq('section', 'section_headings').single();
  if (error && error.code !== 'PGRST116') return res.status(500).json({ error: error.message });
  return res.status(200).json(data?.data || {});
}

async function updateSiteSection(body, res) {
  const { section, data } = body;
  if (!section) return res.status(400).json({ error: 'Section name required' });
  const { data: existing } = await supabase.from('site_sections').select('id').eq('section', section).maybeSingle();
  if (existing) {
    await supabase.from('site_sections').update({ data }).eq('section', section);
  } else {
    await supabase.from('site_sections').insert({ section, data });
  }
  return res.status(200).json({ success: true });
}

async function updateSectionHeadings(body, res) {
  const { headings } = body;
  if (!headings) return res.status(400).json({ error: 'Headings required' });
  const { data: existing } = await supabase.from('site_sections').select('id').eq('section', 'section_headings').maybeSingle();
  if (existing) {
    await supabase.from('site_sections').update({ data: headings }).eq('section', 'section_headings');
  } else {
    await supabase.from('site_sections').insert({ section: 'section_headings', data: headings });
  }
  return res.status(200).json({ success: true });
}
