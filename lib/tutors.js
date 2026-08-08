 import { supabase, getUserProfileName, auditLog } from './core.js';
import {
  parseAndValidateBody,
  requireAuth,
  requireAdmin,
  SecurityError,
} from './security-middleware.js';
import { createNotification } from './notifications.js';
import { getUserCurriculumScope } from './curriculum.js';
import { isMinorSafetyBlocked } from './trust-safety.js';

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
    case 'list':                requireAuth(ctx); return listTutors(req, res, ctx);
    case 'detail':              requireAuth(ctx); return getTutorDetail(req, res, ctx);
    case 'search':              requireAuth(ctx); return searchTutors(req, res, ctx);
    case 'my_profile':          requireAuth(ctx); return getMyProfile(req, res, ctx);
    case 'my_employment':       requireAuth(ctx); return getMyEmployment(req, res, ctx);
    case 'my_verifications':    requireAuth(ctx); return getMyVerifications(req, res, ctx);
    case 'my_contact_requests': requireAuth(ctx); return getMyContactRequests(req, res, ctx);
    case 'admin_profiles':      requireAdmin(ctx); return adminListProfiles(req, res);
    case 'admin_verifications': requireAdmin(ctx); return adminListVerifications(req, res);
    default: throw new SecurityError('Invalid action', 400);
  }
}

async function handlePost(path, body, req, res, ctx) {
  switch (path) {
    case 'create_profile':      requireAuth(ctx); return createOrUpdateProfile(body, res, ctx);
    case 'update_employment':   requireAuth(ctx); return updateEmployment(body, res, ctx);
    case 'upload_verification': requireAuth(ctx); return uploadVerification(body, res, ctx);
    case 'activate_listing':    requireAuth(ctx); return activateListing(body, res, ctx);
    case 'contact':             requireAuth(ctx); return sendContactRequest(body, res, ctx);
    case 'respond_contact':     requireAuth(ctx); return respondContactRequest(body, res, ctx);
    case 'admin_verify':        requireAdmin(ctx); return adminVerifyDocument(body, res, ctx);
    case 'admin_manage_profile':requireAdmin(ctx); return adminManageProfile(body, res, ctx);
    default: throw new SecurityError('Invalid action', 400);
  }
}

async function getCurriculumUnitScopeForTutors(ctx) {
  const scope = await getUserCurriculumScope(ctx.userId);
  if (!scope || !scope.active_group_id) return [];
  const { data: units } = await supabase
    .from('curriculum_units')
    .select('id')
    .eq('group_id', scope.active_group_id)
    .eq('is_active', true);
  return (units || []).map(u => u.id);
}

async function listTutors(req, res, ctx) {
  const { unit_id, country, district, teaching_mode, search, limit = 20, offset = 0 } = req.query;

  const allowedUnitIds = await getCurriculumUnitScopeForTutors(ctx);
  if (!allowedUnitIds.length) return res.status(200).json([]);

  let query = supabase
    .from('tutor_profiles')
    .select('id, display_name, headline, bio, years_experience, country, district, teaching_mode, languages, hourly_rate, profile_views, search_vector')
    .eq('listing_status', 'active')
    .eq('profile_visibility', true)
    .order('featured_until', { ascending: false, nullsLast: true })
    .order('profile_views', { ascending: false })
    .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

  if (unit_id) {
    if (!allowedUnitIds.includes(unit_id)) return res.status(200).json([]);
    const { data: profileIds } = await supabase
      .from('tutor_profile_units')
      .select('profile_id')
      .eq('unit_id', unit_id);
    const ids = (profileIds || []).map(p => p.profile_id);
    if (!ids.length) return res.status(200).json([]);
    query = query.in('id', ids);
  } else {
    const { data: profileIds } = await supabase
      .from('tutor_profile_units')
      .select('profile_id')
      .in('unit_id', allowedUnitIds);
    const ids = [...new Set((profileIds || []).map(p => p.profile_id))];
    if (!ids.length) return res.status(200).json([]);
    query = query.in('id', ids);
  }

  if (country) query = query.eq('country', country);
  if (district) query = query.eq('district', district);
  if (teaching_mode) query = query.eq('teaching_mode', teaching_mode);

  if (search) {
    const tsquery = search
      .replace(/[^a-zA-Z0-9 ]/g, '')
      .split(' ')
      .filter(w => w)
      .map(w => `${w}:*`)
      .join(' & ');
    if (tsquery) query = query.textSearch('search_vector', tsquery);
  }

  const { data } = await query;
  return res.status(200).json(data || []);
}

async function getTutorDetail(req, res, ctx) {
  const { profile_id, user_id } = req.query;
  if (!profile_id && !user_id) throw new SecurityError('profile_id or user_id required', 400);

  const allowedUnitIds = await getCurriculumUnitScopeForTutors(ctx);
  if (!allowedUnitIds.length) throw new SecurityError('No curriculum context', 400);

  let profileQuery = supabase
    .from('tutor_profiles')
    .select('id, display_name, headline, bio, years_experience, country, district, teaching_mode, languages, hourly_rate, verification_status, profile_views')
    .eq('listing_status', 'active')
    .eq('profile_visibility', true);

  if (profile_id) profileQuery = profileQuery.eq('id', profile_id);
  else profileQuery = profileQuery.eq('user_id', user_id);

  const { data: profile } = await profileQuery.maybeSingle();
  if (!profile) throw new SecurityError('Profile not found', 404);

  const { data: units } = await supabase
    .from('tutor_profile_units')
    .select('unit_id')
    .eq('profile_id', profile.id);

  const tutorUnitIds = (units || []).map(u => u.unit_id);
  const hasSharedUnit = tutorUnitIds.some(uid => allowedUnitIds.includes(uid));
  if (!hasSharedUnit) throw new SecurityError('Profile not available in your curriculum', 403);

  const [{ data: employment }, { data: verifications }] = await Promise.all([
    supabase.from('tutor_employment').select('institution, role, start_date, end_date, currently_working, description').eq('profile_id', profile.id).order('start_date', { ascending: false }),
    supabase.from('tutor_verification_checks').select('verification_type, verification_status').eq('profile_id', profile.id),
  ]);

  return res.status(200).json({
    ...profile,
    subjects: tutorUnitIds,
    employment: employment || [],
    verifications: verifications || [],
  });
}

async function searchTutors(req, res, ctx) {
  const { q, limit = 20, offset = 0 } = req.query;
  if (!q) throw new SecurityError('q required', 400);

  const allowedUnitIds = await getCurriculumUnitScopeForTutors(ctx);
  if (!allowedUnitIds.length) return res.status(200).json([]);

  const { data: profileIds } = await supabase
    .from('tutor_profile_units')
    .select('profile_id')
    .in('unit_id', allowedUnitIds);
  const ids = [...new Set((profileIds || []).map(p => p.profile_id))];
  if (!ids.length) return res.status(200).json([]);

  const tsquery = q
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .split(' ')
    .filter(w => w)
    .map(w => `${w}:*`)
    .join(' & ');
  if (!tsquery) return res.status(200).json([]);

  const { data } = await supabase
    .from('tutor_profiles')
    .select('id, display_name, headline, bio, hourly_rate, profile_views')
    .eq('listing_status', 'active')
    .eq('profile_visibility', true)
    .in('id', ids)
    .textSearch('search_vector', tsquery)
    .order('profile_views', { ascending: false })
    .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

  return res.status(200).json(data || []);
}

async function getMyProfile(req, res, ctx) {
  const profile = await ensureProfileOwnership(ctx.userId, false);
  if (!profile) return res.status(200).json(null);

  const [{ data: units }, { data: employment }, { data: verifications }, { data: listingHistory }] = await Promise.all([
    supabase.from('tutor_profile_units').select('unit_id').eq('profile_id', profile.id),
    supabase.from('tutor_employment').select('*').eq('profile_id', profile.id).order('start_date', { ascending: false }),
    supabase.from('tutor_verification_checks').select('*').eq('profile_id', profile.id).order('created_at', { ascending: false }),
    supabase.from('tutor_listing_history').select('*').eq('profile_id', profile.id).order('created_at', { ascending: false }),
  ]);

  return res.status(200).json({
    ...profile,
    units: units?.map(u => u.unit_id) || [],
    employment: employment || [],
    verifications: verifications || [],
    listing_history: listingHistory || [],
  });
}

async function getMyEmployment(req, res, ctx) {
  const profile = await ensureProfileOwnership(ctx.userId, true);
  const { data } = await supabase.from('tutor_employment').select('*').eq('profile_id', profile.id).order('start_date', { ascending: false });
  return res.status(200).json(data || []);
}

async function getMyVerifications(req, res, ctx) {
  const profile = await ensureProfileOwnership(ctx.userId, true);
  const { data } = await supabase.from('tutor_verification_checks').select('*').eq('profile_id', profile.id).order('created_at', { ascending: false });
  return res.status(200).json(data || []);
}

async function getMyContactRequests(req, res, ctx) {
  const { data, error } = await supabase
    .from('tutor_contact_requests')
    .select('*')
    .or(`tutor_id.eq.${ctx.userId},requester_id.eq.${ctx.userId}`)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw new SecurityError('Failed to fetch requests', 500);
  return res.status(200).json(data || []);
}

async function adminListProfiles(req, res) {
  const { status, verification_status } = req.query;
  let query = supabase.from('tutor_profiles').select('*').order('created_at', { ascending: false });
  if (status) query = query.eq('listing_status', status);
  if (verification_status) query = query.eq('verification_status', verification_status);
  const { data } = await query;
  return res.status(200).json(data || []);
}

async function adminListVerifications(req, res) {
  const { status } = req.query;
  let query = supabase.from('tutor_verification_checks').select('*').order('created_at', { ascending: false });
  if (status) query = query.eq('verification_status', status);
  const { data } = await query;
  return res.status(200).json(data || []);
}

async function createOrUpdateProfile(body, res, ctx) {
  const { display_name, headline, bio, years_experience, country, district, teaching_mode, languages, hourly_rate, unit_ids } = body;
  if (!display_name) throw new SecurityError('display_name required', 400);

  const { data: userProfile } = await supabase
    .from('user_profiles')
    .select('role, is_approved_teacher')
    .eq('user_id', ctx.userId)
    .maybeSingle();

  const isAdminUser = !!ctx.adminData;
  if (!isAdminUser && (!userProfile || userProfile.role !== 'teacher' || !userProfile.is_approved_teacher)) {
    throw new SecurityError('Only approved teachers can manage a tutor profile', 403);
  }

  const { data: existing } = await supabase
    .from('tutor_profiles')
    .select('id')
    .eq('user_id', ctx.userId)
    .maybeSingle();

  const profilePayload = {
    display_name,
    headline: headline || null,
    bio: bio || null,
    years_experience: years_experience || 0,
    country: country || null,
    district: district || null,
    teaching_mode: teaching_mode || 'both',
    languages: languages || [],
    hourly_rate: hourly_rate || 0,
    updated_at: new Date().toISOString(),
  };

  let profileId;
  if (existing) {
    await supabase.from('tutor_profiles').update(profilePayload).eq('id', existing.id);
    profileId = existing.id;
  } else {
    profilePayload.user_id = ctx.userId;
    const { data: newProfile } = await supabase.from('tutor_profiles').insert(profilePayload).select().single();
    profileId = newProfile.id;
  }

  if (unit_ids && Array.isArray(unit_ids)) {
    await supabase.from('tutor_profile_units').delete().eq('profile_id', profileId);
    if (unit_ids.length) {
      const rows = unit_ids.map(unitId => ({ profile_id: profileId, unit_id: unitId }));
      await supabase.from('tutor_profile_units').insert(rows);
    }
  }

  await auditLog({
    actorId: ctx.userId,
    actorRole: ctx.adminData?.admin_role,
    action: existing ? 'update_tutor_profile' : 'create_tutor_profile',
    targetType: 'tutor_profile',
    targetId: profileId,
  });

  return res.status(200).json({ success: true, profile_id: profileId });
}

async function updateEmployment(body, res, ctx) {
  const { employment } = body;
  if (!employment || !Array.isArray(employment)) throw new SecurityError('employment array required', 400);

  const profile = await ensureProfileOwnership(ctx.userId, true);

  await supabase.from('tutor_employment').delete().eq('profile_id', profile.id);

  if (employment.length) {
    const rows = employment.map(e => ({
      profile_id: profile.id,
      institution: e.institution,
      role: e.role,
      start_date: e.start_date || null,
      end_date: e.end_date || null,
      currently_working: e.currently_working || false,
      description: e.description || null,
    }));
    await supabase.from('tutor_employment').insert(rows);
  }

  await auditLog({
    actorId: ctx.userId,
    action: 'update_tutor_employment',
    targetType: 'tutor_profile',
    targetId: profile.id,
  });

  return res.status(200).json({ success: true });
}

async function uploadVerification(body, res, ctx) {
  const { file_id, verification_type } = body;
  if (!file_id || !verification_type) throw new SecurityError('file_id and verification_type required', 400);

  const validTypes = [
    'identity',
    'degree_certificate',
    'teaching_certificate',
    'teaching_license',
    'recommendation_letter',
    'curriculum_vitae',
    'employment_proof',
    'other',
  ];
  if (!validTypes.includes(verification_type)) throw new SecurityError('Invalid verification_type', 400);

  const profile = await ensureProfileOwnership(ctx.userId, true);

  const { data: file } = await supabase
    .from('user_files')
    .select('id')
    .eq('id', file_id)
    .eq('user_id', ctx.userId)
    .eq('is_active', true)
    .maybeSingle();
  if (!file) throw new SecurityError('File not found', 404);

  const { data: check } = await supabase
    .from('tutor_verification_checks')
    .insert({
      profile_id: profile.id,
      file_id,
      verification_type,
      verification_status: 'pending',
    })
    .select()
    .single();

  await supabase.from('tutor_profiles').update({ verification_status: 'pending_review' }).eq('id', profile.id);

  await auditLog({
    actorId: ctx.userId,
    action: 'tutor_upload_verification',
    targetType: 'tutor_verification_check',
    targetId: check.id,
  });

  return res.status(200).json({ success: true, check_id: check.id });
}

async function activateListing(body, res, ctx) {
  const { profile_id, payment_id } = body;
  if (!profile_id || !payment_id) throw new SecurityError('profile_id and payment_id required', 400);

  const profile = await ensureProfileOwnership(ctx.userId, false);
  if (!profile || profile.id !== profile_id) throw new SecurityError('Profile not found or access denied', 404);

  const { data: payment } = await supabase
    .from('momo_donations')
    .select('id, payment_type, status')
    .eq('id', payment_id)
    .eq('user_id', ctx.userId)
    .maybeSingle();

  if (!payment) throw new SecurityError('Payment not found', 404);
  if (payment.payment_type !== 'tutor_listing') throw new SecurityError('Invalid payment type', 400);
  if (payment.status !== 'success') throw new SecurityError('Payment not completed', 400);

  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  await supabase.from('tutor_listing_history').insert({
    profile_id: profile.id,
    payment_id,
    starts_at: new Date().toISOString(),
    expires_at: expiresAt,
    status: 'active',
  });

  await supabase.from('tutor_profiles').update({
    listing_status: 'active',
    profile_visibility: true,
    expires_at: expiresAt,
  }).eq('id', profile.id);

  await createNotification(ctx.userId, 'payment_received', {
    display_name: profile.display_name,
    expiry_date: expiresAt,
  });

  return res.status(200).json({ success: true, expires_at: expiresAt });
}

async function sendContactRequest(body, res, ctx) {
  const { tutor_id, message } = body;
  if (!tutor_id) throw new SecurityError('tutor_id required', 400);

  // Minor safety gate: a minor account cannot initiate direct contact with a
  // tutor until a verified parental/guardian consent record is on file.
  // Fails closed — default is blocked, not blocked-unless-flagged.
  if (await isMinorSafetyBlocked(ctx.userId)) {
    throw new SecurityError('Parental consent is required before contacting a tutor', 403);
  }

  const allowedUnitIds = await getCurriculumUnitScopeForTutors(ctx);
  if (!allowedUnitIds.length) throw new SecurityError('No curriculum context', 400);

  const { data: tutorProfile } = await supabase
    .from('tutor_profiles')
    .select('id, listing_status, profile_visibility')
    .eq('user_id', tutor_id)
    .maybeSingle();

  if (!tutorProfile || tutorProfile.listing_status !== 'active' || !tutorProfile.profile_visibility) {
    throw new SecurityError('Tutor not available', 400);
  }

  const { data: units } = await supabase
    .from('tutor_profile_units')
    .select('unit_id')
    .eq('profile_id', tutorProfile.id);

  const tutorUnitIds = (units || []).map(u => u.unit_id);
  if (!tutorUnitIds.some(uid => allowedUnitIds.includes(uid))) {
    throw new SecurityError('Tutor not available in your curriculum', 400);
  }

  const { data: existing } = await supabase
    .from('tutor_contact_requests')
    .select('id')
    .eq('tutor_id', tutor_id)
    .eq('requester_id', ctx.userId)
    .eq('status', 'pending')
    .maybeSingle();

  if (existing) throw new SecurityError('You already have a pending request with this tutor', 400);

  await supabase.from('tutor_contact_requests').insert({
    tutor_id,
    requester_id: ctx.userId,
    status: 'pending',
    message: message || null,
  });

  await createNotification(tutor_id, 'new_contact_request', {
    requester_name: (await getUserProfileName(ctx.userId)) || 'A student',
  });

  return res.status(200).json({ success: true });
}

async function respondContactRequest(body, res, ctx) {
  const { request_id, action } = body;
  if (!request_id || !['accept', 'reject'].includes(action)) {
    throw new SecurityError('request_id and action (accept/reject) required', 400);
  }

  const { data: request } = await supabase
    .from('tutor_contact_requests')
    .select('*')
    .eq('id', request_id)
    .eq('tutor_id', ctx.userId)
    .eq('status', 'pending')
    .maybeSingle();

  if (!request) throw new SecurityError('Request not found or already handled', 404);

  const newStatus = action === 'accept' ? 'accepted' : 'rejected';
  await supabase.from('tutor_contact_requests').update({
    status: newStatus,
    responded_at: new Date().toISOString(),
  }).eq('id', request_id);

  await createNotification(
    request.requester_id,
    newStatus === 'accepted' ? 'tutor_accepted_request' : 'tutor_rejected_request',
    {}
  );

  return res.status(200).json({ success: true });
}

async function adminVerifyDocument(body, res, ctx) {
  const { check_id, action, rejection_reason } = body;
  if (!check_id || !action) throw new SecurityError('check_id and action required', 400);
  if (!['approve', 'reject'].includes(action)) throw new SecurityError('Invalid action', 400);

  const { data: check } = await supabase
    .from('tutor_verification_checks')
    .select('*')
    .eq('id', check_id)
    .maybeSingle();

  if (!check) throw new SecurityError('Verification check not found', 404);

  const updatePayload = {
    verification_status: action === 'approve' ? 'approved' : 'rejected',
    reviewed_by: ctx.userId,
    reviewed_at: new Date().toISOString(),
    rejection_reason: action === 'reject' ? (rejection_reason || null) : null,
  };

  await supabase.from('tutor_verification_checks').update(updatePayload).eq('id', check_id);

  const { data: profile } = await supabase
    .from('tutor_profiles')
    .select('*')
    .eq('id', check.profile_id)
    .maybeSingle();

  if (profile) {
    const newScore = action === 'approve' ? Math.min(100, profile.verification_score + 20) : profile.verification_score;
    await supabase.from('tutor_profiles').update({
      verification_score: newScore,
      verification_status: 'verified',
    }).eq('id', profile.id);
    await createNotification(profile.user_id, action === 'approve' ? 'verification_approved' : 'verification_rejected', {
      verification_type: check.verification_type,
      reason: rejection_reason || '',
    });
  }

  await auditLog({
    actorId: ctx.userId,
    actorRole: ctx.adminData?.admin_role,
    action: action === 'approve' ? 'verify_document_approved' : 'verify_document_rejected',
    targetType: 'tutor_verification_check',
    targetId: check_id,
  });

  return res.status(200).json({ success: true });
}

async function adminManageProfile(body, res, ctx) {
  const { profile_id, listing_status, profile_visibility, featured_until, verification_status } = body;
  if (!profile_id) throw new SecurityError('profile_id required', 400);

  const updates = {};
  if (listing_status !== undefined) updates.listing_status = listing_status;
  if (profile_visibility !== undefined) updates.profile_visibility = profile_visibility;
  if (featured_until !== undefined) updates.featured_until = featured_until;
  if (verification_status !== undefined) updates.verification_status = verification_status;

  if (Object.keys(updates).length === 0) throw new SecurityError('No updates provided', 400);

  await supabase.from('tutor_profiles').update(updates).eq('id', profile_id);

  await auditLog({
    actorId: ctx.userId,
    actorRole: ctx.adminData?.admin_role,
    action: 'admin_update_tutor_profile',
    targetType: 'tutor_profile',
    targetId: profile_id,
    metadata: updates,
  });

  return res.status(200).json({ success: true });
}

async function ensureProfileOwnership(userId, required = true) {
  const { data } = await supabase
    .from('tutor_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (!data && required) throw new SecurityError('Tutor profile not found. Create one first.', 404);
  return data;
}
