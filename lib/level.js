 import { supabase } from './core.js';
import {
  parseAndValidateBody,
  requireAdmin,
  SecurityError,
} from './security-middleware.js';

export async function handler(req, res, path, ctx) {
  if (req.method === 'GET' && path === 'config') {
    return getLevelUiConfig(req, res);
  }

  if (req.method === 'POST' && path === 'update_config') {
    requireAdmin(ctx);
    const body = await parseAndValidateBody(req);
    return updateLevelUiConfig(body, res);
  }

  throw new SecurityError('Invalid action', 400);
}

async function resolveLevelId(levelId) {
  const { data: level, error } = await supabase
    .from('curriculum_levels')
    .select('id')
    .eq('id', levelId)
    .maybeSingle();

  if (error || !level) throw new SecurityError('Invalid curriculum level', 400);
  return level.id;
}

async function getLevelUiConfig(req, res) {
  const { level_id } = req.query;
  if (!level_id) throw new SecurityError('level_id required', 400);

  await resolveLevelId(level_id);

  const { data } = await supabase
    .from('level_ui_config')
    .select('*')
    .eq('level_id', level_id)
    .maybeSingle();

  return res.status(200).json(data || null);
}

async function updateLevelUiConfig(body, res) {
  const { level_id, ...config } = body;
  if (!level_id) throw new SecurityError('level_id required', 400);

  await resolveLevelId(level_id);

  const { data: existing } = await supabase
    .from('level_ui_config')
    .select('*')
    .eq('level_id', level_id)
    .maybeSingle();

  const merged = {
    theme: config.theme ?? existing?.theme ?? {},
    navigation: config.navigation ?? existing?.navigation ?? {},
    search_config: config.search_config ?? existing?.search_config ?? {},
    branding: config.branding ?? existing?.branding ?? {},
    features: config.features ?? existing?.features ?? {},
  };

  const { error } = await supabase
    .from('level_ui_config')
    .upsert(
      {
        level_id,
        ...merged,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'level_id' }
    );

  if (error) throw new SecurityError('Failed to update UI config', 500);
  return res.status(200).json({ success: true });
}
