/* lib/subscriptions.js */
import { supabase, auditLog } from './core.js';
import {
  parseAndValidateBody,
  requireAuth,
  requireAdmin,
  SecurityError,
} from './security-middleware.js';
import { createNotification } from './notifications.js';

const INSTANT_PAYMENT_STATUSES = ['success', 'completed'];

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
    case 'plans':                return listPlans(req, res, ctx);
    case 'my_subscription':      requireAuth(ctx); return getMySubscription(req, res, ctx);
    case 'check_premium':        requireAuth(ctx); return checkPremiumStatus(req, res, ctx);
    case 'admin_subscriptions':  requireAdmin(ctx); return adminListSubscriptions(req, res);
    case 'admin_verifications':  requireAdmin(ctx); return adminListVerifications(req, res);
    default: throw new SecurityError('Invalid action', 400);
  }
}

async function handlePost(path, body, req, res, ctx) {
  switch (path) {
    case 'subscribe':            requireAuth(ctx); return subscribe(body, res, ctx);
    case 'cancel':                requireAuth(ctx); return cancelSubscription(body, res, ctx);
    case 'admin_verify_payment':  requireAdmin(ctx); return adminVerifyPayment(body, res, ctx);
    case 'admin_run_expiry_sweep':requireAdmin(ctx); return adminRunExpirySweep(res, ctx);
    default: throw new SecurityError('Invalid action', 400);
  }
}

// ---- Public / user-facing ----

async function listPlans(req, res, ctx) {
  let query = supabase
    .from('subscription_plans')
    .select('*')
    .order('display_order', { ascending: true });

  if (!ctx.adminData) query = query.eq('is_active', true);

  const { data } = await query;
  return res.status(200).json(data || []);
}

async function getMySubscription(req, res, ctx) {
  const { data } = await supabase
    .from('user_subscriptions')
    .select(`
      *,
      subscription_plans (
        name, slug, description, price_amount, currency, duration_days, features
      )
    `)
    .eq('user_id', ctx.userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return res.status(200).json(data || null);
}

async function checkPremiumStatus(req, res, ctx) {
  const status = await hasActiveSubscription(ctx.userId);
  return res.status(200).json(status);
}

// Exported so other modules (e.g. lib/premium.js) can gate content on it.
export async function hasActiveSubscription(userId) {
  if (!userId) return { has_premium: false };

  const { data } = await supabase
    .from('user_subscriptions')
    .select(`
      id, status, expires_at,
      subscription_plans ( name, slug, features )
    `)
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('expires_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return { has_premium: false };

  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return { has_premium: false };
  }

  return {
    has_premium: true,
    subscription_id: data.id,
    plan: data.subscription_plans,
    expires_at: data.expires_at,
  };
}

async function subscribe(body, res, ctx) {
  const { plan_id, payment_id } = body;
  if (!plan_id || !payment_id) throw new SecurityError('plan_id and payment_id required', 400);

  const { data: plan } = await supabase
    .from('subscription_plans')
    .select('*')
    .eq('id', plan_id)
    .eq('is_active', true)
    .maybeSingle();
  if (!plan) throw new SecurityError('Plan not found or inactive', 404);

  const { data: payment } = await supabase
    .from('momo_donations')
    .select('id, payment_type, status, amount, user_id')
    .eq('id', payment_id)
    .eq('user_id', ctx.userId)
    .maybeSingle();
  if (!payment) throw new SecurityError('Payment not found', 404);
  if (payment.payment_type !== 'subscription') throw new SecurityError('Invalid payment type', 400);
  if (payment.status === 'failed') throw new SecurityError('Payment failed', 400);

  const { data: existingForPayment } = await supabase
    .from('user_subscriptions')
    .select('id')
    .eq('payment_id', payment_id)
    .maybeSingle();
  if (existingForPayment) throw new SecurityError('This payment has already been used for a subscription', 409);

  const { data: activeExisting } = await supabase
    .from('user_subscriptions')
    .select('id')
    .eq('user_id', ctx.userId)
    .eq('status', 'active')
    .maybeSingle();
  if (activeExisting) throw new SecurityError('You already have an active subscription', 409);

  const instant = INSTANT_PAYMENT_STATUSES.includes(payment.status);
  const now = new Date();

  const subscriptionPayload = {
    user_id: ctx.userId,
    plan_id: plan.id,
    payment_id,
    auto_renew: false,
  };

  if (instant) {
    subscriptionPayload.status = 'active';
    subscriptionPayload.starts_at = now.toISOString();
    subscriptionPayload.expires_at = new Date(now.getTime() + plan.duration_days * 24 * 60 * 60 * 1000).toISOString();
  } else {
    subscriptionPayload.status = 'awaiting_verification';
  }

  const { data: subscription } = await supabase
    .from('user_subscriptions')
    .insert(subscriptionPayload)
    .select()
    .single();

  if (!instant) {
    await supabase.from('payment_verifications').insert({
      payment_id,
      status: 'pending',
    });
  } else {
    await createNotification(ctx.userId, 'subscription_activated', {
      plan_name: plan.name,
      expires_at: subscriptionPayload.expires_at,
    });
  }

  await auditLog({
    actorId: ctx.userId,
    action: instant ? 'subscribe_instant' : 'subscribe_pending_verification',
    targetType: 'user_subscription',
    targetId: subscription.id,
    metadata: { plan_id: plan.id, payment_id },
  });

  return res.status(200).json({ success: true, subscription });
}

async function cancelSubscription(body, res, ctx) {
  const { subscription_id } = body;
  if (!subscription_id) throw new SecurityError('subscription_id required', 400);

  const { data: subscription } = await supabase
    .from('user_subscriptions')
    .select('*')
    .eq('id', subscription_id)
    .maybeSingle();
  if (!subscription) throw new SecurityError('Subscription not found', 404);

  if (subscription.user_id !== ctx.userId && !ctx.adminData) {
    throw new SecurityError('Not authorized', 403);
  }
  if (!['active', 'awaiting_verification', 'pending'].includes(subscription.status)) {
    throw new SecurityError('Subscription cannot be cancelled in its current state', 400);
  }

  await supabase.from('user_subscriptions').update({
    status: 'cancelled',
    cancelled_at: new Date().toISOString(),
    auto_renew: false,
    updated_at: new Date().toISOString(),
  }).eq('id', subscription_id);

  await auditLog({
    actorId: ctx.userId,
    actorRole: ctx.adminData?.admin_role,
    action: 'cancel_subscription',
    targetType: 'user_subscription',
    targetId: subscription_id,
  });

  return res.status(200).json({ success: true });
}

// ---- Admin ----

async function adminListSubscriptions(req, res) {
  const { status, plan_id, user_id } = req.query;
  let query = supabase
    .from('user_subscriptions')
    .select(`*, subscription_plans ( name, slug )`)
    .order('created_at', { ascending: false });

  if (status) query = query.eq('status', status);
  if (plan_id) query = query.eq('plan_id', plan_id);
  if (user_id) query = query.eq('user_id', user_id);

  const { data } = await query;
  return res.status(200).json(data || []);
}

async function adminListVerifications(req, res) {
  const { status } = req.query;
  let query = supabase
    .from('payment_verifications')
    .select('*')
    .order('created_at', { ascending: false });

  if (status) query = query.eq('status', status);
  else query = query.in('status', ['pending', 'awaiting_proof', 'under_review']);

  const { data } = await query;
  return res.status(200).json(data || []);
}

async function adminVerifyPayment(body, res, ctx) {
  const { verification_id, action, review_notes, verified_amount } = body;
  if (!verification_id || !['approve', 'reject'].includes(action)) {
    throw new SecurityError('verification_id and action (approve/reject) required', 400);
  }

  const { data: verification } = await supabase
    .from('payment_verifications')
    .select('*')
    .eq('id', verification_id)
    .maybeSingle();
  if (!verification) throw new SecurityError('Verification not found', 404);

  const { data: subscription } = await supabase
    .from('user_subscriptions')
    .select('*, subscription_plans ( name, duration_days )')
    .eq('payment_id', verification.payment_id)
    .maybeSingle();
  if (!subscription) throw new SecurityError('No subscription linked to this payment', 404);

  if (action === 'approve') {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + subscription.subscription_plans.duration_days * 24 * 60 * 60 * 1000).toISOString();

    await supabase.from('payment_verifications').update({
      status: 'approved',
      reviewed_by: ctx.userId,
      reviewed_at: now.toISOString(),
      verified_amount: verified_amount || null,
      review_notes: review_notes || null,
    }).eq('id', verification_id);

    await supabase.from('momo_donations').update({
      status: 'success',
      verified_by: ctx.userId,
      verified_at: now.toISOString(),
    }).eq('id', verification.payment_id);

    await supabase.from('user_subscriptions').update({
      status: 'active',
      starts_at: now.toISOString(),
      expires_at: expiresAt,
      updated_at: now.toISOString(),
    }).eq('id', subscription.id);

    await createNotification(subscription.user_id, 'subscription_activated', {
      plan_name: subscription.subscription_plans.name,
      expires_at: expiresAt,
    });
  } else {
    await supabase.from('payment_verifications').update({
      status: 'rejected',
      reviewed_by: ctx.userId,
      reviewed_at: new Date().toISOString(),
      discrepancy_reason: review_notes || null,
      review_notes: review_notes || null,
    }).eq('id', verification_id);

    await supabase.from('user_subscriptions').update({
      status: 'payment_failed',
      updated_at: new Date().toISOString(),
    }).eq('id', subscription.id);

    await createNotification(subscription.user_id, 'subscription_payment_rejected', {
      reason: review_notes || '',
    });
  }

  await auditLog({
    actorId: ctx.userId,
    actorRole: ctx.adminData?.admin_role,
    action: action === 'approve' ? 'approve_subscription_payment' : 'reject_subscription_payment',
    targetType: 'payment_verification',
    targetId: verification_id,
    metadata: { subscription_id: subscription.id },
  });

  return res.status(200).json({ success: true });
}

async function adminRunExpirySweep(res, ctx) {
  const { data, error } = await supabase.rpc('expire_user_subscriptions');
  if (error) throw new SecurityError('Expiry sweep failed', 500);

  await auditLog({
    actorId: ctx.userId,
    actorRole: ctx.adminData?.admin_role,
    action: 'run_subscription_expiry_sweep',
    targetType: 'user_subscription',
    targetId: 'bulk',
    metadata: { expired_count: data },
  });

  return res.status(200).json({ success: true, expired_count: data });
}
