 /* lib/trust-safety.js */
import { supabase, auditLog } from './core.js';
import {
  parseAndValidateBody,
  requireAuth,
  requireAdmin,
  SecurityError
} from './security-middleware.js';
import { createNotification } from './notifications.js';

const REPORT_REASONS = [
  'inappropriate_contact',
  'harassment',
  'safety_concern',
  'fraud_or_scam',
  'fake_credentials',
  'no_show',
  'other'
];

const VERIFICATION_TIERS = ['unverified', 'identity_verified', 'background_checked', 'premium_verified'];

export async function handler(req, res, path, ctx) {
  if (req.method === 'GET') {
    return handleGet(path, req, res, ctx);
  }

  if (req.method === 'POST') {
    const body = await parseAndValidateBody(req);
    return handlePost(path, body, req, res, ctx);
  }

  throw new SecurityError('Method not allowed', 405);
}

async function handleGet(path, req, res, ctx) {
  switch (path) {
    case 'reviews':
      return listReviews(req, res);
    case 'my_blocked':
      requireAuth(ctx);
      return listBlocked(req, res, ctx);
    case 'my_minor_status':
      requireAuth(ctx);
      return getMyMinorStatus(req, res, ctx);
    case 'admin_reports':
      requireAdmin(ctx);
      return adminListReports(req, res);
    default:
      throw new SecurityError('Invalid action', 400);
  }
}

async function handlePost(path, body, req, res, ctx) {
  switch (path) {
    case 'submit_review':
      requireAuth(ctx);
      return submitReview(body, res, ctx);
    case 'report_user':
      requireAuth(ctx);
      return reportUser(body, res, ctx);
    case 'block_user':
      requireAuth(ctx);
      return blockUser(body, res, ctx);
    case 'unblock_user':
      requireAuth(ctx);
      return unblockUser(body, res, ctx);
    case 'record_parental_consent':
      requireAuth(ctx);
      return recordParentalConsent(body, res, ctx);
    case 'admin_resolve_report':
      requireAdmin(ctx);
      return adminResolveReport(body, res, ctx);
    case 'admin_set_verification_tier':
      requireAdmin(ctx);
      return adminSetVerificationTier(body, res, ctx);
    default:
      throw new SecurityError('Invalid action', 400);
  }
}

export async function isMinorSafetyBlocked(userId) {
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('is_minor')
    .eq('user_id', userId)
    .maybeSingle();

  if (!profile?.is_minor) return false;

  const { data: consent } = await supabase
    .from('parental_consents')
    .select('id, consent_status')
    .eq('minor_user_id', userId)
    .eq('consent_status', 'verified')
    .maybeSingle();

  return !consent;
}

async function getMyMinorStatus(req, res, ctx) {
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('is_minor')
    .eq('user_id', ctx.userId)
    .maybeSingle();

  if (!profile?.is_minor) {
    return res.status(200).json({ is_minor: false, gated: false });
  }

  const { data: consent } = await supabase
    .from('parental_consents')
    .select('consent_status, guardian_name, created_at')
    .eq('minor_user_id', ctx.userId)
    .order('created_at', { ascending: false })
    .maybeSingle();

  return res.status(200).json({
    is_minor: true,
    gated: consent?.consent_status !== 'verified',
    consent_status: consent?.consent_status || 'none'
  });
}

async function recordParentalConsent(body, res, ctx) {
  const { guardian_name, guardian_email, guardian_relationship } = body;

  if (!guardian_name || !guardian_email) {
    throw new SecurityError('guardian_name and guardian_email required', 400);
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('is_minor')
    .eq('user_id', ctx.userId)
    .maybeSingle();

  if (!profile?.is_minor) {
    throw new SecurityError('Parental consent only applies to minor accounts', 400);
  }

  const { data: consent } = await supabase
    .from('parental_consents')
    .insert({
      minor_user_id: ctx.userId,
      guardian_name,
      guardian_email,
      guardian_relationship: guardian_relationship || null,
      consent_status: 'pending'
    })
    .select()
    .single();

  await auditLog({
    actorId: ctx.userId,
    action: 'record_parental_consent_request',
    targetType: 'parental_consent',
    targetId: consent.id
  });

  return res.status(200).json({
    success: true,
    consent_id: consent.id,
    status: 'pending'
  });
}

async function submitReview(body, res, ctx) {
  const { tutor_id, rating, comment } = body;

  if (!tutor_id || !rating) {
    throw new SecurityError('tutor_id and rating required', 400);
  }

  if (rating < 1 || rating > 5) {
    throw new SecurityError('rating must be between 1 and 5', 400);
  }

  if (comment && comment.length > 2000) {
    throw new SecurityError('comment too long', 400);
  }

  const { data: eligibleRequest } = await supabase
    .from('tutor_contact_requests')
    .select('id')
    .eq('tutor_id', tutor_id)
    .eq('requester_id', ctx.userId)
    .eq('status', 'accepted')
    .maybeSingle();

  if (!eligibleRequest) {
    throw new SecurityError('You can only review a tutor after an accepted session', 403);
  }

  const { data: existing } = await supabase
    .from('tutor_reviews')
    .select('id')
    .eq('tutor_id', tutor_id)
    .eq('reviewer_id', ctx.userId)
    .maybeSingle();

  if (existing) throw new SecurityError('You already reviewed this tutor', 409);

  const { data: review } = await supabase
    .from('tutor_reviews')
    .insert({
      tutor_id,
      reviewer_id: ctx.userId,
      rating,
      comment: comment || null,
      status: 'published'
    })
    .select()
    .single();

  await createNotification(tutor_id, 'new_review', { rating });

  await auditLog({
    actorId: ctx.userId,
    action: 'submit_tutor_review',
    targetType: 'tutor_review',
    targetId: review.id
  });

  return res.status(200).json({ success: true, review_id: review.id });
}

async function listReviews(req, res) {
  const { tutor_id, limit = 20, offset = 0 } = req.query;

  if (!tutor_id) throw new SecurityError('tutor_id required', 400);

  const { data } = await supabase
    .from('tutor_reviews')
    .select('id, rating, comment, created_at')
    .eq('tutor_id', tutor_id)
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

  return res.status(200).json(data || []);
}

async function reportUser(body, res, ctx) {
  const { reported_user_id, reason, details } = body;

  if (!reported_user_id || !reason) {
    throw new SecurityError('reported_user_id and reason required', 400);
  }

  if (!REPORT_REASONS.includes(reason)) {
    throw new SecurityError('Invalid reason', 400);
  }

  if (reported_user_id === ctx.userId) {
    throw new SecurityError('Cannot report yourself', 400);
  }

  const urgent = ['safety_concern', 'harassment'].includes(reason);

  const { data: report } = await supabase
    .from('user_reports')
    .insert({
      reporter_id: ctx.userId,
      reported_user_id,
      reason,
      details: details || null,
      status: 'open',
      priority: urgent ? 'urgent' : 'normal'
    })
    .select()
    .single();

  await auditLog({
    actorId: ctx.userId,
    action: 'report_user',
    targetType: 'user_report',
    targetId: report.id,
    metadata: { reported_user_id, reason, urgent }
  });

  return res.status(200).json({ success: true, report_id: report.id });
}

async function blockUser(body, res, ctx) {
  const { blocked_user_id } = body;

  if (!blocked_user_id) throw new SecurityError('blocked_user_id required', 400);
  if (blocked_user_id === ctx.userId) throw new SecurityError('Cannot block yourself', 400);

  await supabase.from('user_blocks').upsert({
    blocker_id: ctx.userId,
    blocked_user_id,
    created_at: new Date().toISOString()
  }, { onConflict: 'blocker_id,blocked_user_id' });

  return res.status(200).json({ success: true });
}

async function unblockUser(body, res, ctx) {
  const { blocked_user_id } = body;

  if (!blocked_user_id) throw new SecurityError('blocked_user_id required', 400);

  await supabase
    .from('user_blocks')
    .delete()
    .eq('blocker_id', ctx.userId)
    .eq('blocked_user_id', blocked_user_id);

  return res.status(200).json({ success: true });
}

async function listBlocked(req, res, ctx) {
  const { data } = await supabase
    .from('user_blocks')
    .select('blocked_user_id, created_at')
    .eq('blocker_id', ctx.userId)
    .order('created_at', { ascending: false });

  return res.status(200).json(data || []);
}

export async function areMutuallyUnblocked(userIdA, userIdB) {
  const { data } = await supabase
    .from('user_blocks')
    .select('id')
    .or(`and(blocker_id.eq.${userIdA},blocked_user_id.eq.${userIdB}),and(blocker_id.eq.${userIdB},blocked_user_id.eq.${userIdA})`)
    .maybeSingle();

  return !data;
}

async function adminListReports(req, res) {
  const { status, priority } = req.query;

  let query = supabase
    .from('user_reports')
    .select('*')
    .order('created_at', { ascending: false });

  if (status) query = query.eq('status', status);
  if (priority) query = query.eq('priority', priority);

  const { data } = await query;

  return res.status(200).json(data || []);
}

async function adminResolveReport(body, res, ctx) {
  const { report_id, resolution, action_taken } = body;

  if (!report_id || !resolution) {
    throw new SecurityError('report_id and resolution required', 400);
  }

  if (!['dismissed', 'actioned'].includes(resolution)) {
    throw new SecurityError('Invalid resolution', 400);
  }

  const { data: report } = await supabase
    .from('user_reports')
    .select('id, reported_user_id')
    .eq('id', report_id)
    .maybeSingle();

  if (!report) throw new SecurityError('Report not found', 404);

  await supabase
    .from('user_reports')
    .update({
      status: 'resolved',
      resolution,
      action_taken: action_taken || null,
      resolved_by: ctx.userId,
      resolved_at: new Date().toISOString()
    })
    .eq('id', report_id);

  if (resolution === 'actioned' && action_taken === 'suspend') {
    await supabase
      .from('user_profiles')
      .update({ account_status: 'suspended' })
      .eq('user_id', report.reported_user_id);

    await createNotification(report.reported_user_id, 'account_suspended', {});
  }

  await auditLog({
    actorId: ctx.userId,
    actorRole: ctx.adminData?.admin_role,
    action: 'resolve_user_report',
    targetType: 'user_report',
    targetId: report_id,
    metadata: { resolution, action_taken }
  });

  return res.status(200).json({ success: true });
}

async function adminSetVerificationTier(body, res, ctx) {
  const { profile_id, tier } = body;

  if (!profile_id || !tier) {
    throw new SecurityError('profile_id and tier required', 400);
  }

  if (!VERIFICATION_TIERS.includes(tier)) {
    throw new SecurityError('Invalid tier', 400);
  }

  const { data: profile } = await supabase
    .from('tutor_profiles')
    .select('id, user_id')
    .eq('id', profile_id)
    .maybeSingle();

  if (!profile) throw new SecurityError('Tutor profile not found', 404);

  await supabase
    .from('tutor_profiles')
    .update({ verification_tier: tier })
    .eq('id', profile_id);

  await createNotification(profile.user_id, 'verification_tier_updated', { tier });

  await auditLog({
    actorId: ctx.userId,
    actorRole: ctx.adminData?.admin_role,
    action: 'set_verification_tier',
    targetType: 'tutor_profile',
    targetId: profile_id,
    metadata: { tier }
  });

  return res.status(200).json({ success: true });
}
