import { supabase } from './core.js';
import { requireAuth, SecurityError } from './security-middleware.js';
import { getUserCurriculumScope } from './curriculum.js';

export async function handler(req, res, path, ctx) {
  try {
    requireAuth(ctx);
    if (req.method !== 'GET') throw new SecurityError('Method not allowed', 405);
    const scope = await getUserCurriculumScope(ctx.userId);
    const unitIds = [];
    if (scope?.active_group_id) {
      const { data: units } = await supabase.from('curriculum_units').select('id').eq('group_id', scope.active_group_id).eq('is_active', true);
      unitIds.push(...(units || []).map(u => u.id));
    }
    const { data } = await supabase.from('user_weak_concepts_v2').select('concept, incorrect_attempts, last_incorrect_at, unit_id, resolved').eq('user_id', ctx.userId).in('unit_id', unitIds).eq('resolved', false).order('last_incorrect_at', { ascending: false }).limit(50);
    return res.status(200).json(data || []);
  } catch (err) {
    console.error(`[weakAreas:${path}]`, err);
    if (err instanceof SecurityError) throw err;
    throw new SecurityError('An unexpected error occurred', 500);
  }
}
