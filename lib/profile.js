// lib/profile.js
import { supabase } from './core.js';
import { parseAndValidateBody, requireAuth, SecurityError } from './security-middleware.js';

export async function handler(req, res, path, ctx) {
  requireAuth(ctx);

  if (req.method === 'GET' && path === 'get_profile') {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', ctx.userId)
      .maybeSingle();
    if (error) throw new SecurityError('Failed to fetch profile', 500);
    return res.status(200).json(data || { role: 'student', track: null, class_name: null, onboarding_completed: false });
  }

  if (req.method === 'POST' && path === 'save_onboarding') {
    const body = await parseAndValidateBody(req);
    const { role, track, class_name } = body;
    if (!role || !track || !class_name) throw new SecurityError('role, track, and class_name are required', 400);
    if (!['student', 'teacher'].includes(role)) throw new SecurityError('Invalid role', 400);
    if (!['O-Level', 'A-Level', 'Pharmacy'].includes(track)) throw new SecurityError('Invalid track', 400);
    if (!class_name || typeof class_name !== 'string' || class_name.length > 100) throw new SecurityError('Invalid class_name', 400);

    const { data, error } = await supabase
      .from('user_profiles')
      .upsert({
        user_id: ctx.userId,
        role,
        track,
        class_name,
        onboarding_completed: true,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' })
      .select()
      .single();
    if (error) throw new SecurityError('Failed to save onboarding', 500);
    return res.status(200).json(data);
  }

  if (req.method === 'POST' && path === 'request_level_change') {
    const body = await parseAndValidateBody(req);
    const { requested_track, requested_class, reason } = body;
    if (!requested_track || !requested_class) throw new SecurityError('requested_track and requested_class are required', 400);

    const { data: existing } = await supabase
      .from('level_change_requests')
      .select('id, status, created_at')
      .eq('user_id', ctx.userId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (existing && existing.length > 0) {
      const last = existing[0];
      if (last.status === 'pending') throw new SecurityError('You already have a pending level change request', 400);
      if (last.status === 'approved') {
        const daysSince = (Date.now() - new Date(last.created_at).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSince < 30) throw new SecurityError('You can only request a level change every 30 days', 400);
      }
    }

    const { error } = await supabase
      .from('level_change_requests')
      .insert({
        user_id: ctx.userId,
        requested_track,
        requested_class,
        reason: reason || '',
        status: 'pending',
        created_at: new Date().toISOString()
      });
    if (error) throw new SecurityError('Failed to submit request', 500);
    return res.status(200).json({ success: true });
  }

  if (req.method === 'GET' && path === 'class_sequence') {
    const { track } = req.query;
    if (!track) throw new SecurityError('track required', 400);
    const { data, error } = await supabase
      .from('class_sequence')
      .select('class_name, sequence_order')
      .eq('track', track)
      .order('sequence_order', { ascending: true });
    if (error) throw new SecurityError('Failed to fetch class sequence', 500);
    return res.status(200).json(data || []);
  }

  if (req.method === 'GET' && path === 'pharmacy_programs') {
    const { data, error } = await supabase
      .from('pharmacy_programs')
      .select('id, program_name, description, icon, display_order')
      .eq('is_active', true)
      .order('display_order', { ascending: true });
    if (error) throw new SecurityError('Failed to fetch programs', 500);
    return res.status(200).json(data || []);
  }

  throw new SecurityError('Invalid path', 400);
}
