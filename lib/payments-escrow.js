import { supabase, auditLog } from './core.js';
import {
  parseAndValidateBody,
  requireAuth,
  requireAdmin,
  SecurityError,
} from './security-middleware.js';
import { createNotification } from './notifications.js';

// Escrow protects both sides: a student's payment is held, not paid out to
// the tutor, until the session is confirmed by both parties (or an admin
// resolves a dispute). This is what makes the marketplace safe to pay into.

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
    case 'my_transactions':  requireAuth(ctx); return getMyTransactions(req, res, ctx);
    case 'detail':           requireAuth(ctx); return getTransactionDetail(req, res, ctx);
    case 'admin_disputes':   requireAdmin(ctx); return adminListDisputes(req, res);
    default: throw new SecurityError('Invalid action', 400);
  }
}

async function handlePost(path, body, req, res, ctx) {
  switch (path) {
    case 'create_hold':          requireAuth(ctx); return createEscrowHold(body, res, ctx);
    case 'confirm_completion':   requireAuth(ctx); return confirmSessionCompletion(body, res, ctx);
    case 'raise_dispute':        requireAuth(ctx); return raiseDispute(body, res, ctx);
    case 'admin_resolve_dispute':requireAdmin(ctx); return adminResolveDispute(body, res, ctx);
    default: throw new SecurityError('Invalid action', 400);
  }
}

const AUTO_RELEASE_DAYS = 3; // if neither party disputes, funds release automatically

async function createEscrowHold(body, res, ctx) {
  const { tutor_id, amount, currency, session_date, payment_reference } = body;
  if (!tutor_id || !amount || !currency || !payment_reference) {
    throw new SecurityError('tutor_id, amount, currency, and payment_reference required', 400);
  }
  if (amount <= 0) throw new SecurityError('amount must be positive', 400);
  if (tutor_id === ctx.userId) throw new SecurityError('Cannot book a session with yourself', 400);

  // The upstream payment (mobile money, card, etc.) must already exist and
  // be marked successful — this endpoint never moves real money itself,
  // it only records the escrow state on top of a confirmed payment.
  const { data: payment } = await supabase
    .from('momo_donations')
    .select('id, status, user_id, amount')
    .eq('id', payment_reference)
    .eq('user_id', ctx.userId)
    .maybeSingle();

  if (!payment) throw new SecurityError('Payment not found', 404);
  if (payment.status !== 'success') throw new SecurityError('Payment not completed', 400);

  const { data: existingHold } = await supabase
    .from('escrow_transactions')
    .select('id')
    .eq('payment_reference', payment_reference)
    .maybeSingle();
  if (existingHold) throw new SecurityError('This payment has already been used for an escrow hold', 409);

  const autoReleaseAt = new Date(Date.now() + AUTO_RELEASE_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: escrow } = await supabase
    .from('escrow_transactions')
    .insert({
      student_id: ctx.userId,
      tutor_id,
      amount,
      currency,
      session_date: session_date || null,
      payment_reference,
      status: 'held',
      student_confirmed: false,
      tutor_confirmed: false,
      auto_release_at: autoReleaseAt,
    })
    .select()
    .single();

  await createNotification(tutor_id, 'session_payment_held', { amount, currency });

  await auditLog({
    actorId: ctx.userId,
    action: 'create_escrow_hold',
    targetType: 'escrow_transaction',
    targetId: escrow.id,
    metadata: { amount, currency },
  });

  return res.status(200).json({ success: true, escrow_id: escrow.id, auto_release_at: autoReleaseAt });
}

async function confirmSessionCompletion(body, res, ctx) {
  const { escrow_id } = body;
  if (!escrow_id) throw new SecurityError('escrow_id required', 400);

  const { data: escrow } = await supabase
    .from('escrow_transactions')
    .select('*')
    .eq('id', escrow_id)
    .maybeSingle();
  if (!escrow) throw new SecurityError('Transaction not found', 404);
  if (escrow.status !== 'held') throw new SecurityError('Transaction is not in a confirmable state', 400);

  const isStudent = escrow.student_id === ctx.userId;
  const isTutor = escrow.tutor_id === ctx.userId;
  if (!isStudent && !isTutor) throw new SecurityError('Not authorized', 403);

  const updates = {};
  if (isStudent) updates.student_confirmed = true;
  if (isTutor) updates.tutor_confirmed = true;

  const bothConfirmed =
    (isStudent ? true : escrow.student_confirmed) &&
    (isTutor ? true : escrow.tutor_confirmed);

  if (bothConfirmed) {
    updates.status = 'released';
    updates.released_at = new Date().toISOString();
  }

  await supabase.from('escrow_transactions').update(updates).eq('id', escrow_id);

  if (bothConfirmed) {
    await createNotification(escrow.tutor_id, 'session_payment_released', { amount: escrow.amount, currency: escrow.currency });
    await createNotification(escrow.student_id, 'session_payment_released', { amount: escrow.amount, currency: escrow.currency });
  }

  await auditLog({
    actorId: ctx.userId,
    action: 'confirm_escrow_completion',
    targetType: 'escrow_transaction',
    targetId: escrow_id,
    metadata: { bothConfirmed },
  });

  return res.status(200).json({ success: true, released: !!bothConfirmed });
}

async function raiseDispute(body, res, ctx) {
  const { escrow_id, reason, details } = body;
  if (!escrow_id || !reason) throw new SecurityError('escrow_id and reason required', 400);

  const { data: escrow } = await supabase
    .from('escrow_transactions')
    .select('*')
    .eq('id', escrow_id)
    .maybeSingle();
  if (!escrow) throw new SecurityError('Transaction not found', 404);
  if (!['held'].includes(escrow.status)) throw new SecurityError('Transaction cannot be disputed in its current state', 400);

  const isParty = escrow.student_id === ctx.userId || escrow.tutor_id === ctx.userId;
  if (!isParty) throw new SecurityError('Not authorized', 403);

  await supabase.from('escrow_transactions').update({
    status: 'disputed',
    dispute_raised_by: ctx.userId,
    dispute_reason: reason,
    dispute_details: details || null,
    auto_release_at: null, // pause auto-release while disputed
  }).eq('id', escrow_id);

  const otherParty = escrow.student_id === ctx.userId ? escrow.tutor_id : escrow.student_id;
  await createNotification(otherParty, 'session_payment_disputed', { reason });

  await auditLog({
    actorId: ctx.userId,
    action: 'raise_escrow_dispute',
    targetType: 'escrow_transaction',
    targetId: escrow_id,
    metadata: { reason },
  });

  return res.status(200).json({ success: true });
}

async function getMyTransactions(req, res, ctx) {
  const { data } = await supabase
    .from('escrow_transactions')
    .select('*')
    .or(`student_id.eq.${ctx.userId},tutor_id.eq.${ctx.userId}`)
    .order('created_at', { ascending: false });
  return res.status(200).json(data || []);
}

async function getTransactionDetail(req, res, ctx) {
  const { escrow_id } = req.query;
  if (!escrow_id) throw new SecurityError('escrow_id required', 400);

  const { data: escrow } = await supabase
    .from('escrow_transactions')
    .select('*')
    .eq('id', escrow_id)
    .maybeSingle();
  if (!escrow) throw new SecurityError('Transaction not found', 404);
  if (escrow.student_id !== ctx.userId && escrow.tutor_id !== ctx.userId && !ctx.adminData) {
    throw new SecurityError('Not authorized', 403);
  }

  return res.status(200).json(escrow);
}

// ---- Admin ----

async function adminListDisputes(req, res) {
  const { data } = await supabase
    .from('escrow_transactions')
    .select('*')
    .eq('status', 'disputed')
    .order('created_at', { ascending: false });
  return res.status(200).json(data || []);
}

async function adminResolveDispute(body, res, ctx) {
  const { escrow_id, resolution, notes } = body;
  if (!escrow_id || !['release_to_tutor', 'refund_student', 'split'].includes(resolution)) {
    throw new SecurityError('escrow_id and valid resolution required', 400);
  }

  const { data: escrow } = await supabase
    .from('escrow_transactions')
    .select('*')
    .eq('id', escrow_id)
    .maybeSingle();
  if (!escrow) throw new SecurityError('Transaction not found', 404);
  if (escrow.status !== 'disputed') throw new SecurityError('Transaction is not disputed', 400);

  const statusMap = {
    release_to_tutor: 'released',
    refund_student: 'refunded',
    split: 'split_resolved',
  };

  await supabase.from('escrow_transactions').update({
    status: statusMap[resolution],
    dispute_resolution: resolution,
    dispute_resolution_notes: notes || null,
    resolved_by: ctx.userId,
    resolved_at: new Date().toISOString(),
  }).eq('id', escrow_id);

  await createNotification(escrow.student_id, 'dispute_resolved', { resolution });
  await createNotification(escrow.tutor_id, 'dispute_resolved', { resolution });

  await auditLog({
    actorId: ctx.userId,
    actorRole: ctx.adminData?.admin_role,
    action: 'resolve_escrow_dispute',
    targetType: 'escrow_transaction',
    targetId: escrow_id,
    metadata: { resolution },
  });

  return res.status(200).json({ success: true });
}
