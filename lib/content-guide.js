 import { supabase } from './core.js';
import {
  parseAndValidateBody,
  requireAdmin,
  SecurityError,
} from './security-middleware.js';

export async function handler(req, res, path, ctx) {
  if (req.method === 'GET' && path === 'image') {
    return getContentGuideImage(req, res, ctx);
  }
  if (req.method === 'GET' && path === 'images') {
    return getContentGuideImages(req, res, ctx);
  }
  if (req.method === 'POST' && path === 'image') {
    requireAdmin(ctx);
    const body = await parseAndValidateBody(req);
    return updateContentGuideImage(body, res);
  }
  if (req.method === 'DELETE' && path === 'image') {
    requireAdmin(ctx);
    const body = await parseAndValidateBody(req);
    return deleteContentGuideImage(body, res);
  }
  throw new SecurityError('Invalid action', 400);
}

async function getContentGuideImage(req, res, ctx) {
  const { level, class_name } = req.query;

  if (!level) throw new SecurityError('level is required', 400);

  const { data: curriculumLevel } = await supabase
    .from('curriculum_levels')
    .select('id, display_name')
    .eq('display_name', level)
    .maybeSingle();

  if (!curriculumLevel) throw new SecurityError('Invalid curriculum level', 400);

  if (class_name) {
    const { data: group } = await supabase
      .from('curriculum_groups')
      .select('id')
      .eq('level_id', curriculumLevel.id)
      .eq('name', class_name)
      .eq('is_active', true)
      .maybeSingle();

    if (!group) throw new SecurityError('Invalid class/programme for the given level', 400);
  }

  let query = supabase
    .from('content_guide_images')
    .select('*')
    .eq('level', level)
    .eq('is_active', true);

  if (class_name) {
    query = query.eq('class_name', class_name);
  }

  const { data, error } = await query;

  if (error) throw new SecurityError('Failed to fetch content guide image', 500);

  let image = data?.[0] || null;

  if (!image && class_name) {
    const { data: fallback } = await supabase
      .from('content_guide_images')
      .select('*')
      .eq('level', level)
      .is('class_name', null)
      .eq('is_active', true)
      .maybeSingle();

    if (fallback) image = fallback;
  }

  return res.status(200).json(image);
}

async function getContentGuideImages(req, res, ctx) {
  const { data, error } = await supabase
    .from('content_guide_images')
    .select('*')
    .eq('is_active', true)
    .order('level', { ascending: true })
    .order('class_name', { ascending: true });

  if (error) throw new SecurityError('Failed to fetch content guide images', 500);

  return res.status(200).json({ images: data || [] });
}

async function updateContentGuideImage(body, res) {
  const { level, class_name, image_url, fallback_color, alt_text } = body;

  if (!level) throw new SecurityError('level is required', 400);
  if (!image_url) throw new SecurityError('image_url is required', 400);

  const { data: curriculumLevel } = await supabase
    .from('curriculum_levels')
    .select('id, display_name')
    .eq('display_name', level)
    .maybeSingle();

  if (!curriculumLevel) throw new SecurityError('Invalid curriculum level', 400);

  if (class_name) {
    const { data: group } = await supabase
      .from('curriculum_groups')
      .select('id')
      .eq('level_id', curriculumLevel.id)
      .eq('name', class_name)
      .eq('is_active', true)
      .maybeSingle();

    if (!group) throw new SecurityError('Invalid class/programme for the given level', 400);
  }

  const { data, error } = await supabase
    .from('content_guide_images')
    .upsert(
      {
        level,
        class_name: class_name || null,
        image_url,
        fallback_color: fallback_color || '#0a7e7e',
        alt_text: alt_text || `${level} ${class_name || ''} guide`,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'level, class_name' }
    )
    .select()
    .single();

  if (error) throw new SecurityError('Failed to update content guide image', 500);

  return res.status(200).json({ success: true, image: data });
}

async function deleteContentGuideImage(body, res) {
  const { level, class_name } = body;

  if (!level) throw new SecurityError('level is required', 400);

  const { data: curriculumLevel } = await supabase
    .from('curriculum_levels')
    .select('id, display_name')
    .eq('display_name', level)
    .maybeSingle();

  if (!curriculumLevel) throw new SecurityError('Invalid curriculum level', 400);

  let query = supabase
    .from('content_guide_images')
    .delete()
    .eq('level', level);

  if (class_name !== undefined) {
    if (class_name === null) {
      query = query.is('class_name', null);
    } else {
      const { data: group } = await supabase
        .from('curriculum_groups')
        .select('id')
        .eq('level_id', curriculumLevel.id)
        .eq('name', class_name)
        .eq('is_active', true)
        .maybeSingle();

      if (!group) throw new SecurityError('Invalid class/programme for the given level', 400);
      query = query.eq('class_name', class_name);
    }
  }

  const { error } = await query;

  if (error) throw new SecurityError('Failed to delete content guide image', 500);

  return res.status(200).json({ success: true });
}
