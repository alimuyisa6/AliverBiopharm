// /lib/weekly-challenge.js
import { supabase, parseCookies, hashToken, validateSession } from './core.js';

async function parseBody(req) { const chunks = []; for await (const chunk of req) chunks.push(chunk); return JSON.parse(Buffer.concat(chunks).toString()); }

export async function handler(req, res, path, ctx) {
  const { userId, ip } = ctx;

  if (req.method === 'GET' && path === 'status') return getChallengeStatus(req, res, userId);
  if (req.method === 'POST' && path === 'submit') {
    if (!userId) return res.status(401).json({ error: 'Authentication required' });
    const body = await parseBody(req);
    return submitChallenge(body, res, userId);
  }
  return res.status(405).json({ error: 'Method not allowed' });
}

async function getChallengeStatus(req, res, userId) {
  const { week_start } = req.query;
  if (!week_start) return res.status(400).json({ error: 'week_start required' });
  if (!userId) return res.status(200).json({ submitted: false, selected_option: null });
  const { data } = await supabase.from('user_interactions').select('metadata').eq('user_id', userId).eq('interaction_type', 'quiz_attempt').filter('metadata->>week_start', 'eq', week_start).maybeSingle();
  if (!data) return res.status(200).json({ submitted: false, selected_option: null });
  return res.status(200).json({ submitted: true, selected_option: data.metadata?.selected_option ?? null });
}

async function submitChallenge(body, res, userId) {
  if (!userId) return res.status(401).json({ error: 'Authentication required' });
  const { week_start, selected_option } = body;
  if (!week_start || selected_option === undefined) return res.status(400).json({ error: 'week_start and selected_option required' });
  const { data: existing } = await supabase.from('user_interactions').select('id').eq('user_id', userId).eq('interaction_type', 'quiz_attempt').filter('metadata->>week_start', 'eq', week_start).maybeSingle();
  if (existing) return res.status(200).json({ success: true, already_submitted: true });
  const { error } = await supabase.from('user_interactions').insert({ user_id: userId, interaction_type: 'quiz_attempt', metadata: { week_start, selected_option } });
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ success: true, already_submitted: false });
}
