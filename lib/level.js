 import { supabase } from './core.js';
import { parseAndValidateBody, requireAdmin, SecurityError } from './security-middleware.js';

export async function handler(req, res, path, ctx) {
  if (req.method === 'GET' && path === 'config') {
    const { level } = req.query;
    if (!level) throw new SecurityError('level required', 400);
    const { data } = await supabase.from('level_ui_config').select('*').eq('level', level).maybeSingle();
    return res.status(200).json(data || null);
  }

  if (req.method === 'POST' && path === 'update_config') {
    requireAdmin(ctx);
    const body = await parseAndValidateBody(req);
    const { level, ...config } = body;
    if (!level) throw new SecurityError('level required', 400);
    await supabase.from('level_ui_config').upsert({
      level,
      ...config,
      updated_at: new Date().toISOString()
    }, { onConflict: 'level' });
    return res.status(200).json({ success: true });
  }

  throw new SecurityError('Invalid action', 400);
}
