 import { supabase } from './core.js';
import { parseAndValidateBody, requireAuth, SecurityError } from './security-middleware.js';

export async function handler(req, res, path, ctx) {
  if (req.method === 'GET' && path === 'status') return getChallengeStatus(req, res, ctx);
  if (req.method === 'POST' && path === 'submit') {
    requireAuth(ctx);
    const body = await parseAndValidateBody(req);
    return submitChallenge(body, res, ctx);
  }
  throw new SecurityError('Method not allowed', 405);
}

async function getChallengeStatus(req, res, ctx) {
  const { week_start } = req.query;
  if (!week_start) throw new SecurityError('week_start required', 400);
  if (!ctx.userId) return res.status(200).json({ submitted: false, selected_option: null });
  const { data } = await supabase.from('user_interactions').select('metadata').eq('user_id', ctx.userId).eq('interaction_type', 'quiz_attempt').filter('metadata->>week_start', 'eq', week_start).maybeSingle();
  if (!data) return res.status(200).json({ submitted: false, selected_option: null });
  return res.status(200).json({ submitted: true, selected_option: data.metadata?.selected_option ?? null });
}

async function submitChallenge(body, res, ctx) {
  const { week_start, selected_option } = body;
  if (!week_start || selected_option === undefined) throw new SecurityError('week_start and selected_option required', 400);
  const { data: existing } = await supabase.from('user_interactions').select('id').eq('user_id', ctx.userId).eq('interaction_type', 'quiz_attempt').filter('metadata->>week_start', 'eq', week_start).maybeSingle();
  if (existing) return res.status(200).json({ success: true, already_submitted: true });
  const { error } = await supabase.from('user_interactions').insert({ user_id: ctx.userId, interaction_type: 'quiz_attempt', metadata: { week_start, selected_option } });
  if (error) throw new SecurityError('Failed to submit challenge', 500);
  return res.status(200).json({ success: true, already_submitted: false });
}
