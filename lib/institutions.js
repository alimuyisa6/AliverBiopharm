 import { supabase, getUserProfileName, auditLog } from './core.js';
import {
  parseAndValidateBody,
  requireAuth,
  requireAdmin,
  SecurityError,
} from './security-middleware.js';
import { createNotification } from './notifications.js';

// Institution types we support. Keep this open-ended enough to cover
// secondary schools, colleges, and universities in any country's system.
const INSTITUTION_TYPES = ['secondary_school', 'college', 'university', 'training_center'];

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
    case 'list':                 return listInstitutions(req, res);
    case 'detail':                return getInstitutionDetail(req, res);
    case 'my_institutions':       requireAuth(ctx); return getMyInstitutions(req, res, ctx);
    case 'my_affiliations':       requireAuth(ctx); return getMyAffiliations(req, res, ctx);
    case 'admin_list':            requireAdmin(ctx); return adminListInstitutions(req, res);
    case 'admin_pending_affiliations': requireAdmin(ctx); return adminPendingAffiliations(req, res);
    default: throw new SecurityError('Invalid action', 400);
  }
}

async function handlePost(path, body, req, res, ctx) {
  switch (path) {
    case 'create':                requireAuth(ctx); return createInstitution(body, res, ctx);
    case 'update':                requireAuth(ctx); return updateInstitution(body, res, ctx);
    case 'request_affiliation':   requireAuth(ctx); return requestAffiliation(body, res, ctx);
    case 'revoke_affiliation':    requireAuth(ctx); return revokeAffiliation(body, res, ctx);
    case 'admin_verify_institution':  requireAdmin(ctx); return adminVerifyInstitution(body, res, ctx);
    case 'admin_verify_affiliation':  requireAdmin(ctx); return adminVerifyAffiliation(body, res, ctx);
    default: throw new SecurityError('Invalid action', 400);
  }
}

// ---- Public / authenticated reads ----

async function listInstitutions(req, res) {
  const { type, country, search, limit = 30, offset = 0 } = req.query;

  let query = supabase
    .from('institutions')
    .select('id, name, type, country, region, city, website, logo_url, verification_status, student_count_estimate')
    .eq('verification_status', 'verified')
    .order('name', { ascending: true })
    .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

  if (type) {
    if (!INSTITUTION_TYPES.includes(type)) throw new SecurityError('Invalid type', 400);
    query = query.eq('type', type);
  }
  if (country) query = query.eq('country', country);
  if (search) query = query.ilike('name', `%${search.replace(/[%_]/g, '')}%`);

  const { data } = await query;
  return res.status(200).json(data || []);
}

async function getInstitutionDetail(req, res) {
  const { institution_id } = req.query;
  if (!institution_id) throw new SecurityError('institution_id required', 400);

  const { data: institution } = await supabase
    .from('institutions')
    .select('id, name, type, country, region, city, website, logo_url, description, verification_status, student_count_estimate')
    .eq('id', institution_id)
    .eq('verification_status', 'verified')
    .maybeSingle();

  if (!institution) throw new SecurityError('Institution not found', 404);

  // Only expose the count of verified affiliates, never PII, on a public read.
  const { count: verifiedTutorCount } = await supabase
    .from('institution_affiliations')
    .select('id', { count: 'exact', head: true })
    .eq('institution_id', institution_id)
    .eq('affiliation_status', 'verified')
    .eq('role', 'tutor');

  return res.status(200).json({ ...institution, verified_tutor_count: verifiedTutorCount || 0 });
}

async function getMyInstitutions(req, res, ctx) {
  const { data } = await supabase
    .from('institutions')
    .select('*')
    .eq('created_by', ctx.userId)
    .order('created_at', { ascending: false });
  return res.status(200).json(data || []);
}

async function getMyAffiliations(req, res, ctx) {
  const { data } = await supabase
    .from('institution_affiliations')
    .select('*, institutions(name, type, country)')
    .eq('user_id', ctx.userId)
    .order('created_at', { ascending: false });
  return res.status(200).json(data || []);
}

// ---- Institution lifecycle ----

async function createInstitution(body, res, ctx) {
  const { name, type, country, region, city, website, description } = body;
  if (!name || !type || !country) throw new SecurityError('name, type, and country required', 400);
  if (!INSTITUTION_TYPES.includes(type)) throw new SecurityError('Invalid institution type', 400);

  // Prevent duplicate submissions for the same name+country combo.
  const { data: dupe } = await supabase
    .from('institutions')
    .select('id')
    .ilike('name', name)
    .eq('country', country)
    .maybeSingle();
  if (dupe) throw new SecurityError('An institution with this name already exists for this country', 409);

  const { data: institution } = await supabase
    .from('institutions')
    .insert({
      name,
      type,
      country,
      region: region || null,
      city: city || null,
      website: website || null,
      description: description || null,
      verification_status: 'pending',
      created_by: ctx.userId,
    })
    .select()
    .single();

  await auditLog({
    actorId: ctx.userId,
    action: 'create_institution',
    targetType: 'institution',
    targetId: institution.id,
  });

  return res.status(200).json({ success: true, institution_id: institution.id });
}

async function updateInstitution(body, res, ctx) {
  const { institution_id, website, description, city, region } = body;
  if (!institution_id) throw new SecurityError('institution_id required', 400);

  const { data: institution } = await supabase
    .from('institutions')
    .select('id, created_by')
    .eq('id', institution_id)
    .maybeSingle();

  if (!institution) throw new SecurityError('Institution not found', 404);
  if (institution.created_by !== ctx.userId && !ctx.adminData) {
    throw new SecurityError('Not authorized to edit this institution', 403);
  }

  const updates = {};
  if (website !== undefined) updates.website = website;
  if (description !== undefined) updates.description = description;
  if (city !== undefined) updates.city = city;
  if (region !== undefined) updates.region = region;
  if (Object.keys(updates).length === 0) throw new SecurityError('No updates provided', 400);

  await supabase.from('institutions').update(updates).eq('id', institution_id);

  await auditLog({
    actorId: ctx.userId,
    action: 'update_institution',
    targetType: 'institution',
    targetId: institution_id,
    metadata: updates,
  });

  return res.status(200).json({ success: true });
}

// ---- Affiliation (student/tutor <-> institution), verification-gated ----
// Affiliation claims are never trusted at face value. A user claiming to
// belong to an institution stays "pending" until an admin (or, in future,
// an automated domain-email check) verifies it. Nothing downstream should
// treat an unverified affiliation as real.

async function requestAffiliation(body, res, ctx) {
  const { institution_id, role, proof_file_id } = body;
  if (!institution_id || !role) throw new SecurityError('institution_id and role required', 400);
  if (!['student', 'tutor', 'staff'].includes(role)) throw new SecurityError('Invalid role', 400);

  const { data: institution } = await supabase
    .from('institutions')
    .select('id, verification_status')
    .eq('id', institution_id)
    .maybeSingle();
  if (!institution || institution.verification_status !== 'verified') {
    throw new SecurityError('Institution not found or not verified', 404);
  }

  if (proof_file_id) {
    const { data: file } = await supabase
      .from('user_files')
      .select('id')
      .eq('id', proof_file_id)
      .eq('user_id', ctx.userId)
      .eq('is_active', true)
      .maybeSingle();
    if (!file) throw new SecurityError('Proof file not found', 404);
  }

  const { data: existing } = await supabase
    .from('institution_affiliations')
    .select('id, affiliation_status')
    .eq('institution_id', institution_id)
    .eq('user_id', ctx.userId)
    .maybeSingle();

  if (existing) {
    if (existing.affiliation_status === 'verified') {
      throw new SecurityError('Already verified with this institution', 409);
    }
    await supabase.from('institution_affiliations').update({
      role,
      proof_file_id: proof_file_id || null,
      affiliation_status: 'pending',
      requested_at: new Date().toISOString(),
    }).eq('id', existing.id);
    return res.status(200).json({ success: true, affiliation_id: existing.id });
  }

  const { data: affiliation } = await supabase
    .from('institution_affiliations')
    .insert({
      institution_id,
      user_id: ctx.userId,
      role,
      proof_file_id: proof_file_id || null,
      affiliation_status: 'pending',
    })
    .select()
    .single();

  await auditLog({
    actorId: ctx.userId,
    action: 'request_institution_affiliation',
    targetType: 'institution_affiliation',
    targetId: affiliation.id,
  });

  return res.status(200).json({ success: true, affiliation_id: affiliation.id });
}

async function revokeAffiliation(body, res, ctx) {
  const { affiliation_id } = body;
  if (!affiliation_id) throw new SecurityError('affiliation_id required', 400);

  const { data: affiliation } = await supabase
    .from('institution_affiliations')
    .select('id, user_id')
    .eq('id', affiliation_id)
    .maybeSingle();

  if (!affiliation) throw new SecurityError('Affiliation not found', 404);
  if (affiliation.user_id !== ctx.userId && !ctx.adminData) {
    throw new SecurityError('Not authorized', 403);
  }

  await supabase.from('institution_affiliations').delete().eq('id', affiliation_id);

  await auditLog({
    actorId: ctx.userId,
    action: 'revoke_institution_affiliation',
    targetType: 'institution_affiliation',
    targetId: affiliation_id,
  });

  return res.status(200).json({ success: true });
}

// ---- Admin ----

async function adminListInstitutions(req, res) {
  const { status } = req.query;
  let query = supabase.from('institutions').select('*').order('created_at', { ascending: false });
  if (status) query = query.eq('verification_status', status);
  const { data } = await query;
  return res.status(200).json(data || []);
}

async function adminPendingAffiliations(req, res) {
  const { data } = await supabase
    .from('institution_affiliations')
    .select('*, institutions(name), user_profiles!institution_affiliations_user_id_fkey(display_name)')
    .eq('affiliation_status', 'pending')
    .order('requested_at', { ascending: true });
  return res.status(200).json(data || []);
}

async function adminVerifyInstitution(body, res, ctx) {
  const { institution_id, action, rejection_reason } = body;
  if (!institution_id || !['approve', 'reject'].includes(action)) {
    throw new SecurityError('institution_id and valid action required', 400);
  }

  const { data: institution } = await supabase
    .from('institutions')
    .select('id, created_by, name')
    .eq('id', institution_id)
    .maybeSingle();
  if (!institution) throw new SecurityError('Institution not found', 404);

  await supabase.from('institutions').update({
    verification_status: action === 'approve' ? 'verified' : 'rejected',
    rejection_reason: action === 'reject' ? (rejection_reason || null) : null,
    reviewed_by: ctx.userId,
    reviewed_at: new Date().toISOString(),
  }).eq('id', institution_id);

  await createNotification(institution.created_by, action === 'approve' ? 'institution_verified' : 'institution_rejected', {
    institution_name: institution.name,
    reason: rejection_reason || '',
  });

  await auditLog({
    actorId: ctx.userId,
    actorRole: ctx.adminData?.admin_role,
    action: action === 'approve' ? 'verify_institution_approved' : 'verify_institution_rejected',
    targetType: 'institution',
    targetId: institution_id,
  });

  return res.status(200).json({ success: true });
}

async function adminVerifyAffiliation(body, res, ctx) {
  const { affiliation_id, action, rejection_reason } = body;
  if (!affiliation_id || !['approve', 'reject'].includes(action)) {
    throw new SecurityError('affiliation_id and valid action required', 400);
  }

  const { data: affiliation } = await supabase
    .from('institution_affiliations')
    .select('id, user_id, institutions(name)')
    .eq('id', affiliation_id)
    .maybeSingle();
  if (!affiliation) throw new SecurityError('Affiliation not found', 404);

  await supabase.from('institution_affiliations').update({
    affiliation_status: action === 'approve' ? 'verified' : 'rejected',
    rejection_reason: action === 'reject' ? (rejection_reason || null) : null,
    reviewed_by: ctx.userId,
    reviewed_at: new Date().toISOString(),
  }).eq('id', affiliation_id);

  await createNotification(affiliation.user_id, action === 'approve' ? 'affiliation_verified' : 'affiliation_rejected', {
    institution_name: affiliation.institutions?.name || '',
    reason: rejection_reason || '',
  });

  await auditLog({
    actorId: ctx.userId,
    actorRole: ctx.adminData?.admin_role,
    action: action === 'approve' ? 'verify_affiliation_approved' : 'verify_affiliation_rejected',
    targetType: 'institution_affiliation',
    targetId: affiliation_id,
  });

  return res.status(200).json({ success: true });
}
