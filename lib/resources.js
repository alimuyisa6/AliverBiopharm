 /* lib/resources.js */
import { supabase } from './core.js';
import {
  parseAndValidateBody,
  requireAuth,
  SecurityError
} from './security-middleware.js';
import { getUserCurriculumScope } from './curriculum.js';

export async function handler(req, res, path, ctx) {
  if (req.method === 'POST' && path === 'submit_resource') {
    requireAuth(ctx);

    const body = await parseAndValidateBody(req);
    return submitResource(body, res, ctx);
  }

  throw new SecurityError('Invalid action', 400);
}

async function submitResource(body, res, ctx) {
  const { payload } = body;

  if (!payload) throw new SecurityError('payload required', 400);

  const scope = await getUserCurriculumScope(ctx.userId);
  const groupId = scope?.active_group_id;

  if (!groupId) throw new SecurityError('Your curriculum context is not set.', 400);

  if (payload.unit_id) {
    const { data: unit } = await supabase
      .from('curriculum_units')
      .select('id, group_id')
      .eq('id', payload.unit_id)
      .eq('group_id', groupId)
      .eq('is_active', true)
      .maybeSingle();

    if (!unit) throw new SecurityError('Unit not found or not available in your programme', 400);
  }

  const submission = {
    title: payload.title,
    description: payload.description,
    author: payload.author || null,
    level: payload.level || null,
    category: payload.category || null,
    tag: payload.tag || null,
    section_type: payload.section_type || null,
    file_url: payload.file_url || null,
    file_size: payload.file_size || null,
    class_name: payload.class_name || null,
    unit_id: payload.unit_id || null,
    submitted_by: ctx.userId,
    status: 'pending'
  };

  const { error } = await supabase.from('resource_submissions').insert(submission);

  if (error) throw new SecurityError('Failed to submit resource', 500);

  return res.status(200).json({ success: true });
}
