 /* lib/premium.js */
import { supabase } from './core.js';
import {
  parseAndValidateBody,
  requireSuperAdmin,
  SecurityError
} from './security-middleware.js';
import { getUserCurriculumScope } from './curriculum.js';

const ABUSE_WINDOW_MS = 15 * 60 * 1000;
const ABUSE_THRESHOLD = 5;

const CONTENT_UNIT_QUERY = {
  unit: { table: 'curriculum_units', unitCol: 'id', groupIdCol: 'group_id' },
  block: { table: 'curriculum_unit_blocks', unitCol: 'unit_id', groupJoin: true },
  note: { table: 'notes', unitCol: 'unit_id', groupJoin: true },
  pdf: { table: 'pdf_resources', unitCol: 'unit_id', groupJoin: true },
  past_paper: { table: 'past_papers', unitCol: 'unit_id', groupJoin: true },
  article: { table: 'articles', unitCol: 'unit_id', groupJoin: true },
  video: { table: 'videos', unitCol: 'unit_id', groupJoin: true }
};

export async function handler(req, res, path, ctx) {
  if (req.method === 'GET') {
    return handleGet(path, req, res, ctx);
  }

  if (req.method === 'POST') {
    requireSuperAdmin(ctx);

    const body = await parseAndValidateBody(req);
    return handlePost(path, body, req, res, ctx);
  }

  throw new SecurityError('Method not allowed', 405);
}

async function handleGet(path, req, res, ctx) {
  switch (path) {
    case 'check':
      return checkAccess(req, res, ctx);
    case 'grants':
      requireSuperAdmin(ctx);
      return listGrants(req, res);
    case 'restrictions':
      requireSuperAdmin(ctx);
      return listRestrictions(req, res);
    default:
      throw new SecurityError('Invalid action', 400);
  }
}

async function handlePost(path, body, req, res, ctx) {
  switch (path) {
    case 'grant':
      return grantPremium(body, res, ctx);
    case 'revoke_grant':
      return revokeGrant(body, res, ctx);
    case 'restrict':
      return restrictContent(body, res, ctx);
    case 'remove_restriction':
      return removeRestriction(body, res, ctx);
    default:
      throw new SecurityError('Invalid action', 400);
  }
}

async function getUnitGroupId(contentType, contentId) {
  const mapping = CONTENT_UNIT_QUERY[contentType];

  if (!mapping) return null;

  if (contentType === 'unit') {
    const { data } = await supabase
      .from(mapping.table)
      .select(mapping.groupIdCol)
      .eq('id', contentId)
      .maybeSingle();

    return data?.group_id || null;
  }

  if (contentType === 'block') {
    const { data: block } = await supabase
      .from('curriculum_unit_blocks')
      .select('unit_id')
      .eq('id', contentId)
      .maybeSingle();

    if (!block?.unit_id) return null;

    const { data: unit } = await supabase
      .from('curriculum_units')
      .select('group_id')
      .eq('id', block.unit_id)
      .maybeSingle();

    return unit?.group_id || null;
  }

  const { data: record } = await supabase
    .from(mapping.table)
    .select(`${mapping.unitCol}, curriculum_units!inner(group_id)`)
    .eq('id', contentId)
    .maybeSingle();

  if (!record) return null;

  return record.curriculum_units?.group_id || null;
}

async function ensureContentInUserScope(ctx, contentType, contentId) {
  if (!ctx.authenticated || ctx.adminData) return;

  const scope = await getUserCurriculumScope(ctx.userId);

  if (!scope?.active_group_id) {
    throw new SecurityError('Your curriculum context is not set.', 403);
  }

  if (!CONTENT_UNIT_QUERY[contentType]) return;

  const contentGroupId = await getUnitGroupId(contentType, contentId);

  if (!contentGroupId) return;

  if (contentGroupId !== scope.active_group_id) {
    throw new SecurityError('This content is not available in your current curriculum.', 403);
  }
}

async function checkAccess(req, res, ctx) {
  const { content_type, content_id, access_type } = req.query;

  if (!content_type || !content_id) {
    throw new SecurityError('content_type and content_id required', 400);
  }

  if (!ctx.authenticated) {
    return res.status(200).json({ allowed: false, reason: 'unauthenticated' });
  }

  await ensureContentInUserScope(ctx, content_type, content_id);

  const { data: authUser } = await supabase.auth.admin.getUserById(ctx.userId);
  const email = authUser?.user?.email || null;

  let result;

  if (access_type === 'download') {
    result = await checkDownloadAccess(
      email,
      ctx.userId,
      content_type,
      content_id,
      req.query.is_premium === 'true'
    );
  } else {
    result = await checkContentAccess(
      email,
      ctx.userId,
      content_type,
      content_id,
      req.query.is_premium === 'true'
    );
  }

  if (!result.allowed && result.reason === 'premium_locked') {
    await recordAbuseProbe(ctx.userId, `premium_probe_${content_type}`);
  }

  return res.status(200).json(result);
}

export async function hasPremiumAccess(email, contentType, contentId) {
  if (!email || !contentId) return false;

  const { data } = await supabase
    .from('premium_grants')
    .select('id, expires_at')
    .eq('email', email.trim().toLowerCase())
    .eq('content_type', contentType)
    .eq('content_id', contentId)
    .maybeSingle();

  if (!data) return false;
  if (data.expires_at && new Date(data.expires_at) < new Date()) return false;

  return true;
}

export async function isRestricted(userId, contentType, contentId, restrictionType) {
  if (!userId) return false;

  const { data } = await supabase
    .from('content_restrictions')
    .select('id, expires_at, content_id')
    .eq('user_id', userId)
    .eq('content_type', contentType)
    .eq('restriction_type', restrictionType);

  const now = new Date();

  for (const row of data || []) {
    if (row.expires_at && new Date(row.expires_at) < now) continue;
    if (row.content_id === null || row.content_id === contentId) return true;
  }

  return false;
}

export async function checkUnitBlockAccess(userEmail, userId, unitId, blockNumber) {
  const { data: unit } = await supabase
    .from('curriculum_units')
    .select('id, is_premium, group_id')
    .eq('id', unitId)
    .maybeSingle();

  if (!unit) return { allowed: false, reason: 'unit_not_found' };

  const restricted = await isRestricted(userId, 'unit', unitId, 'view');

  if (restricted) return { allowed: false, reason: 'restricted' };

  if (unit.is_premium) {
    const granted = await hasPremiumAccess(userEmail, 'unit', unitId);

    if (!granted) {
      return { allowed: false, reason: 'premium_locked', scope: 'unit' };
    }
  }

  if (blockNumber !== undefined && blockNumber !== null) {
    const { data: block } = await supabase
      .from('curriculum_unit_blocks')
      .select('is_premium')
      .eq('unit_id', unitId)
      .eq('block_number', blockNumber)
      .maybeSingle();

    if (block?.is_premium) {
      const granted = await hasPremiumAccess(userEmail, 'block', unitId);

      if (!granted) {
        return { allowed: false, reason: 'premium_locked', scope: 'block' };
      }
    }
  }

  return { allowed: true };
}

export async function checkContentAccess(userEmail, userId, contentType, contentId, isPremium) {
  const restricted = await isRestricted(userId, contentType, contentId, 'view');

  if (restricted) return { allowed: false, reason: 'restricted' };

  if (isPremium) {
    const granted = await hasPremiumAccess(userEmail, contentType, contentId);

    if (!granted) return { allowed: false, reason: 'premium_locked' };
  }

  return { allowed: true };
}

export async function checkDownloadAccess(userEmail, userId, contentType, contentId, isPremium) {
  const restricted = await isRestricted(userId, contentType, contentId, 'download');

  if (restricted) return { allowed: false, reason: 'restricted' };

  if (isPremium) {
    const granted = await hasPremiumAccess(userEmail, contentType, contentId);

    if (!granted) return { allowed: false, reason: 'premium_locked' };
  }

  return { allowed: true };
}

export async function recordAbuseProbe(userId, flagType) {
  if (!userId) return;

  const cutoff = new Date(Date.now() - ABUSE_WINDOW_MS).toISOString();

  const { data: existing } = await supabase
    .from('abuse_flags')
    .select('id, count, window_start')
    .eq('user_id', userId)
    .eq('flag_type', flagType)
    .gte('window_start', cutoff)
    .order('window_start', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    const newCount = existing.count + 1;

    await supabase
      .from('abuse_flags')
      .update({ count: newCount })
      .eq('id', existing.id);

    if (newCount >= ABUSE_THRESHOLD) {
      await autoSuspend(userId, flagType, newCount);
    }

    return newCount;
  }

  await supabase.from('abuse_flags').insert({
    user_id: userId,
    flag_type: flagType,
    count: 1,
    window_start: new Date().toISOString()
  });

  return 1;
}

async function autoSuspend(userId, flagType, count) {
  const { data: existingRestriction } = await supabase
    .from('user_restrictions')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (existingRestriction) return;

  await supabase.from('user_restrictions').upsert({
    user_id: userId,
    restriction_type: 'suspended',
    lock_reason: `Automatically suspended for repeated attempts to access premium content without authorization (${flagType}, ${count} attempts).`,
    locked_at: new Date().toISOString(),
    is_permanent: false,
    updated_at: new Date().toISOString()
  }, { onConflict: 'user_id' });

  await supabase
    .from('user_sessions')
    .update({
      is_active: false,
      terminated_reason: 'auto_suspended_abuse',
      terminated_at: new Date().toISOString()
    })
    .eq('user_id', userId)
    .eq('is_active', true);

  await supabase.from('audit_log').insert({
    actor_id: null,
    actor_role: 'system',
    action: 'auto_suspend_abuse',
    target_type: 'user',
    target_id: userId,
    metadata: { flag_type: flagType, count }
  });
}

async function listGrants(req, res) {
  const { email } = req.query;

  let query = supabase
    .from('premium_grants')
    .select('*')
    .order('granted_at', { ascending: false });

  if (email) query = query.eq('email', email.trim().toLowerCase());

  const { data } = await query;

  return res.status(200).json(data || []);
}

async function listRestrictions(req, res) {
  const { user_id } = req.query;

  let query = supabase
    .from('content_restrictions')
    .select('*')
    .order('created_at', { ascending: false });

  if (user_id) query = query.eq('user_id', user_id);

  const { data } = await query;

  return res.status(200).json(data || []);
}

async function grantPremium(body, res, ctx) {
  const { email, content_type, content_id, expires_at, notes } = body;

  if (!email || !content_type || !content_id) {
    throw new SecurityError('email, content_type, content_id required', 400);
  }

  if (!['unit', 'block', 'pdf', 'note', 'past_paper', 'article'].includes(content_type)) {
    throw new SecurityError('Invalid content_type', 400);
  }

  const { data } = await supabase
    .from('premium_grants')
    .insert({
      email: email.trim().toLowerCase(),
      content_type,
      content_id,
      granted_by: ctx.userId,
      expires_at: expires_at || null,
      notes: notes || null
    })
    .select()
    .single();

  await supabase.from('audit_log').insert({
    actor_id: ctx.userId,
    actor_role: ctx.adminData?.admin_role,
    action: 'grant_premium',
    target_type: content_type,
    target_id: content_id,
    metadata: { email: email.trim().toLowerCase() }
  });

  return res.status(200).json({ success: true, grant: data });
}

async function revokeGrant(body, res, ctx) {
  const { id } = body;

  if (!id) throw new SecurityError('id required', 400);

  await supabase.from('premium_grants').delete().eq('id', id);

  await supabase.from('audit_log').insert({
    actor_id: ctx.userId,
    actor_role: ctx.adminData?.admin_role,
    action: 'revoke_premium',
    target_type: 'premium_grant',
    target_id: id
  });

  return res.status(200).json({ success: true });
}

async function restrictContent(body, res, ctx) {
  const { user_id, content_type, content_id, restriction_type, reason, expires_at } = body;

  if (!user_id || !content_type || !restriction_type) {
    throw new SecurityError('user_id, content_type, restriction_type required', 400);
  }

  if (!['view', 'download'].includes(restriction_type)) {
    throw new SecurityError('Invalid restriction_type', 400);
  }

  const { data } = await supabase
    .from('content_restrictions')
    .insert({
      user_id,
      content_type,
      content_id: content_id || null,
      restriction_type,
      reason: reason || null,
      restricted_by: ctx.userId,
      expires_at: expires_at || null
    })
    .select()
    .single();

  await supabase.from('audit_log').insert({
    actor_id: ctx.userId,
    actor_role: ctx.adminData?.admin_role,
    action: 'restrict_content',
    target_type: content_type,
    target_id: content_id || 'all',
    metadata: { user_id, restriction_type, reason: reason || null }
  });

  return res.status(200).json({ success: true, restriction: data });
}

async function removeRestriction(body, res, ctx) {
  const { id } = body;

  if (!id) throw new SecurityError('id required', 400);

  await supabase.from('content_restrictions').delete().eq('id', id);

  await supabase.from('audit_log').insert({
    actor_id: ctx.userId,
    actor_role: ctx.adminData?.admin_role,
    action: 'remove_content_restriction',
    target_type: 'content_restriction',
    target_id: id
  });

  return res.status(200).json({ success: true });
}
