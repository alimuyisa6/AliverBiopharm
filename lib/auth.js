 import {
  supabase,
  hashToken,
  parseCookies,
  getClientIp,
  getIpNetwork,
  generateSessionToken,
  generateCsrfToken,
  isAdmin,
  getAuthOnlyClient,
  maskEmail,
  auditLog,
  checkPasswordBreached,
  verifyTotp,
} from './core.js';
import {
  parseAndValidateBody,
  getSessionFingerprint,
  SecurityError,
  rateLimiter,
} from './security-middleware.js';
import crypto from 'crypto';
import { createNotification } from './notifications.js';

const USER_SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const ADMIN_SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export async function handler(req, res, path, ctx) {
  if (req.method === 'GET' && path === 'get_user') {
    if (!ctx.authenticated) return res.status(200).json({ user: null });
    const { data: { user }, error } = await supabase.auth.admin.getUserById(ctx.userId);
    if (error || !user) return res.status(200).json({ user: null });

    const [{ data: restriction }, { data: profile }] = await Promise.all([
      supabase
        .from('user_restrictions')
        .select('restriction_type, lock_reason, expires_at')
        .eq('user_id', ctx.userId)
        .maybeSingle(),
      supabase
        .from('user_profiles')
        .select('role, track, class_name, onboarding_completed, is_approved_teacher, approved_by, approved_at, approved_track, approval_notes, active_level_id, active_group_id')
        .eq('user_id', ctx.userId)
        .maybeSingle(),
    ]);

    return res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        full_name: user.user_metadata?.full_name || null,
        is_admin: !!ctx.adminData,
        admin_role: ctx.adminData?.admin_role || null,
        permissions: ctx.adminData?.permissions || null,
        mfa_enabled: ctx.adminData?.mfa_enabled || false,
        restriction: restriction || null,
        profile: profile || {
          role: 'student',
          track: null,
          class_name: null,
          onboarding_completed: false,
          is_approved_teacher: false,
          approved_track: null,
          active_level_id: null,
          active_group_id: null,
        },
      },
    });
  }

  if (req.method === 'POST' && path === 'signup') {
    const ip = getClientIp(req);
    const body = await parseAndValidateBody(req);
    const { email, password, turnstile_token, full_name, role, level } = body;
    console.error('[SIGNUP] start', JSON.stringify({ email: maskEmail(email), hasPassword: !!password, hasTurnstileToken: !!turnstile_token, role, level }));

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new SecurityError('Invalid email address', 400);
    if (!password || password.length < 10) throw new SecurityError('Password must be at least 10 characters', 400);
    if (password.length > 128) throw new SecurityError('Password must not exceed 128 characters', 400);
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasDigit = /[0-9]/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);
    const categories = [hasUpper, hasLower, hasDigit, hasSpecial].filter(Boolean).length;
    if (categories < 3) throw new SecurityError('Password must contain at least 3 of: uppercase letter, lowercase letter, number, special character', 400);
    if (!turnstile_token) throw new SecurityError('Please complete the verification challenge.', 400);

    const breachCheck = await checkPasswordBreached(password);
    if (breachCheck.breached) {
      throw new SecurityError('This password has appeared in known data breaches. Please choose a different password.', 400);
    }

    const trimmedName = (full_name || '').trim();
    if (!trimmedName || trimmedName.length < 2 || trimmedName.length > 100) throw new SecurityError('Full name must be between 2 and 100 characters', 400);

    if (!role || !['student', 'teacher'].includes(role)) throw new SecurityError('Role must be student or teacher', 400);
    if (!level || typeof level !== 'string') throw new SecurityError('Level is required', 400);

    const { data: curriculumLevel } = await supabase
      .from('curriculum_levels')
      .select('id, display_name')
      .eq('display_name', level)
      .maybeSingle();

    if (!curriculumLevel) throw new SecurityError('Invalid curriculum level', 400);

    const { data: defaultGroup } = await supabase
      .from('curriculum_groups')
      .select('id, name')
      .eq('level_id', curriculumLevel.id)
      .order('sequence_order', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!defaultGroup) throw new SecurityError('No default group found for this level', 400);

    const authClient = getAuthOnlyClient();
    const { data, error } = await authClient.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        emailRedirectTo: `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}`,
        captchaToken: turnstile_token,
        data: { full_name: trimmedName },
      },
    });

    if (error) {
      console.error('[SIGNUP] supabase signUp error', JSON.stringify({
        message: error.message,
        status: error.status,
        code: error.code,
        name: error.name,
      }));
      if (error.code === 'user_already_exists') {
        return res.status(200).json({ user: null, message: 'If this email is valid, please check your inbox to confirm your account.' });
      }
      if (error.code === 'captcha_failed') throw new SecurityError('Verification expired, please try again.', 400);
      throw new SecurityError('Registration failed. Please try again.', 400);
    }

    console.error('[SIGNUP] success', JSON.stringify({ userId: data.user?.id, hasSession: !!data.session }));

    if (data.user) {
      const profilePayload = {
        user_id: data.user.id,
        role,
        track: curriculumLevel.display_name,
        class_name: defaultGroup.name,
        active_level_id: curriculumLevel.id,
        active_group_id: defaultGroup.id,
        onboarding_completed: true,
        is_approved_teacher: false,
        approved_track: null,
        updated_at: new Date().toISOString(),
      };
      const { error: profileError } = await supabase
        .from('user_profiles')
        .upsert(profilePayload, { onConflict: 'user_id' });
      if (profileError) console.error('[SIGNUP] profile creation error', JSON.stringify({ message: profileError.message }));
    }

    if (data.session) {
      const session = await createUserSession(data.user.id, ip, req.headers['user-agent'], req, false, false);
      setSessionCookie(res, session.access_token, session.max_age_ms);
      const csrf_token = generateCsrfToken(session.csrf_secret, session.fingerprint);
      await createNotification(data.user.id, 'welcome', {});
      await auditLog({ actorId: data.user.id, action: 'signup', targetType: 'user', targetId: data.user.id, ip });
      return res.status(200).json({
        user: { id: data.user.id, email: data.user.email, full_name: trimmedName },
        csrf_token,
      });
    }
    return res.status(200).json({ user: null, message: 'If this email is valid, please check your inbox to confirm your account.' });
  }

  if (req.method === 'POST' && path === 'signin') {
    const ip = getClientIp(req);
    const body = await parseAndValidateBody(req);
    const { email, password, turnstile_token, mfa_code } = body;
    console.error('[SIGNIN] start', JSON.stringify({ email: maskEmail(email), hasPassword: !!password, hasTurnstileToken: !!turnstile_token }));

    if (!email || !password) throw new SecurityError('Email and password required', 400);

    const remaining = await rateLimiter.getAuthAttemptsRemaining(ip);
    console.error('[SIGNIN] attempts remaining', JSON.stringify({ ip, remaining }));
    if (remaining <= 0) {
      return res.status(429).json({
        error: 'Too many login attempts. Please try again in 15 minutes.',
        retry_after_minutes: 15,
        attempts_remaining: 0,
      });
    }

    if (!(await rateLimiter.check(ip, null, 'auth_attempt'))) {
      return res.status(429).json({
        error: 'Too many login attempts. Please try again in 15 minutes.',
        retry_after_minutes: 15,
        attempts_remaining: 0,
      });
    }

    if (!turnstile_token) throw new SecurityError('Please complete the verification challenge.', 400);

    const authClient = getAuthOnlyClient();
    const { data, error } = await authClient.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
      options: { captchaToken: turnstile_token },
    });

    if (error) {
      console.error('[SIGNIN] supabase signIn error', JSON.stringify({
        message: error.message,
        status: error.status,
        code: error.code,
        name: error.name,
      }));
      if (error.code === 'captcha_failed') throw new SecurityError('Verification expired, please try again.', 400);
      await auditLog({ action: 'signin_failed', ip, metadata: { email: maskEmail(email) } });
      throw new SecurityError('Invalid email or password', 401);
    }

    console.error('[SIGNIN] password verified', JSON.stringify({ userId: data.user.id }));

    const { data: restriction, error: restrictionError } = await supabase
      .from('user_restrictions')
      .select('restriction_type, lock_reason, expires_at')
      .eq('user_id', data.user.id)
      .maybeSingle();

    console.error('[SIGNIN] restriction check', JSON.stringify({ restriction, restrictionError: restrictionError?.message || null }));

    if (restriction) {
      if (restriction.restriction_type === 'disabled') throw new SecurityError('Your account has been permanently disabled. Contact support.', 403);
      if (restriction.restriction_type === 'suspended') throw new SecurityError(restriction.lock_reason || 'Your account has been suspended. Contact support.', 403);
      if (restriction.restriction_type === 'locked') {
        if (restriction.expires_at && new Date(restriction.expires_at) > new Date()) {
          const hoursLeft = Math.ceil((new Date(restriction.expires_at) - new Date()) / (1000 * 60 * 60));
          throw new SecurityError(`Your account is locked. Try again in ${hoursLeft} hours.`, 403);
        } else {
          await supabase.from('user_restrictions').delete().eq('user_id', data.user.id);
        }
      }
    }

    const adminCandidate = await isAdmin(data.user.id, ip);
    if (adminCandidate && adminCandidate.mfa_enabled) {
      if (!mfa_code) {
        return res.status(200).json({ mfa_required: true });
      }
      if (!verifyTotp(adminCandidate.mfa_secret, mfa_code)) {
        await auditLog({ actorId: data.user.id, action: 'mfa_failed', ip });
        throw new SecurityError('Invalid MFA code', 401);
      }
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role, track, class_name, onboarding_completed, is_approved_teacher, approved_track, active_level_id, active_group_id')
      .eq('user_id', data.user.id)
      .maybeSingle();

    const { error: terminateError } = await supabase
      .from('user_sessions')
      .update({ is_active: false })
      .eq('user_id', data.user.id)
      .eq('is_active', true);
    if (terminateError) console.error('[SIGNIN] session terminate error', JSON.stringify({ message: terminateError.message }));

    const mfaWasVerified = !!(adminCandidate && adminCandidate.mfa_enabled);
    const isAdminSession = !!adminCandidate;
    const session = await createUserSession(data.user.id, ip, req.headers['user-agent'], req, mfaWasVerified, isAdminSession);
    setSessionCookie(res, session.access_token, session.max_age_ms);

    if (ctx.adminData?.id) {
      await supabase.from('admin_master').update({ last_login: new Date().toISOString() }).eq('id', ctx.adminData.id);
    }

    const csrf_token = generateCsrfToken(session.csrf_secret, session.fingerprint);
    await createNotification(data.user.id, 'new_login', {
      location: 'Unknown',
      device: (req.headers['user-agent'] || 'Unknown browser').substring(0, 100),
    });
    await auditLog({ actorId: data.user.id, action: 'signin', ip, metadata: { mfa: mfaWasVerified, admin_session: isAdminSession } });

    console.error('[SIGNIN] success', JSON.stringify({ userId: data.user.id }));

    return res.status(200).json({
      user: {
        id: data.user.id,
        email: data.user.email,
        profile: profile || {
          role: 'student',
          track: null,
          class_name: null,
          onboarding_completed: false,
          is_approved_teacher: false,
          approved_track: null,
          active_level_id: null,
          active_group_id: null,
        },
      },
      csrf_token,
      teacher_pending: profile?.role === 'teacher' && !profile?.is_approved_teacher,
    });
  }

  if (req.method === 'POST' && path === 'signout') {
    if (ctx.authenticated && ctx.sessionId) {
      const { error } = await supabase.from('user_sessions').update({ is_active: false }).eq('id', ctx.sessionId);
      if (error) console.error('[SIGNOUT] error', JSON.stringify({ message: error.message }));
      await auditLog({ actorId: ctx.userId, action: 'signout', ip: getClientIp(req) });
    }
    res.setHeader('Set-Cookie', 'session=; HttpOnly; Secure; SameSite=None; Max-Age=0; Path=/');
    return res.status(200).json({ success: true });
  }

  if (req.method === 'POST' && path === 'update_profile') {
    if (!ctx.authenticated) throw new SecurityError('Authentication required', 401);
    const body = await parseAndValidateBody(req);
    const trimmedName = (body.full_name || '').trim();
    if (!trimmedName || trimmedName.length < 2 || trimmedName.length > 100) throw new SecurityError('Full name must be between 2 and 100 characters', 400);

    const { data, error } = await supabase.auth.admin.updateUserById(ctx.userId, {
      user_metadata: { full_name: trimmedName },
    });

    if (error) {
      console.error('[UPDATE_PROFILE] error', JSON.stringify({ message: error.message, userId: ctx.userId }));
      throw new SecurityError('Failed to update profile', 500);
    }

    return res.status(200).json({ user: { id: data.user.id, email: data.user.email, full_name: trimmedName } });
  }

  if (req.method === 'POST' && path === 'change_password') {
    if (!ctx.authenticated) throw new SecurityError('Authentication required', 401);
    const ip = getClientIp(req);
    if (!(await rateLimiter.check(ip, ctx.userId, 'change_password'))) throw new SecurityError('Too many requests', 429);

    const body = await parseAndValidateBody(req);
    const { current_password, new_password } = body;

    if (!current_password || !new_password) throw new SecurityError('Current and new password are required', 400);
    if (new_password.length < 10) throw new SecurityError('Password must be at least 10 characters', 400);
    if (new_password.length > 128) throw new SecurityError('Password must not exceed 128 characters', 400);
    const hasUpper = /[A-Z]/.test(new_password);
    const hasLower = /[a-z]/.test(new_password);
    const hasDigit = /[0-9]/.test(new_password);
    const hasSpecial = /[^A-Za-z0-9]/.test(new_password);
    const categories = [hasUpper, hasLower, hasDigit, hasSpecial].filter(Boolean).length;
    if (categories < 3) throw new SecurityError('Password must contain at least 3 of: uppercase letter, lowercase letter, number, special character', 400);

    const breachCheck = await checkPasswordBreached(new_password);
    if (breachCheck.breached) {
      throw new SecurityError('This password has appeared in known data breaches. Please choose a different password.', 400);
    }

    const { data: { user }, error: lookupError } = await supabase.auth.admin.getUserById(ctx.userId);
    if (lookupError || !user) throw new SecurityError('Account not found', 404);

    const authClient = getAuthOnlyClient();
    const { error: verifyError } = await authClient.auth.signInWithPassword({
      email: user.email,
      password: current_password,
    });

    if (verifyError) {
      console.error('[CHANGE_PASSWORD] verify error', JSON.stringify({ message: verifyError.message, userId: ctx.userId }));
      throw new SecurityError('Current password is incorrect', 401);
    }

    const { error: updateError } = await supabase.auth.admin.updateUserById(ctx.userId, {
      password: new_password,
    });

    if (updateError) {
      console.error('[CHANGE_PASSWORD] update error', JSON.stringify({ message: updateError.message, userId: ctx.userId }));
      throw new SecurityError('Failed to change password', 500);
    }

    const { error: terminateError } = await supabase
      .from('user_sessions')
      .update({ is_active: false })
      .eq('user_id', ctx.userId)
      .eq('is_active', true)
      .neq('id', ctx.sessionId);
    if (terminateError) console.error('[CHANGE_PASSWORD] session terminate error', JSON.stringify({ message: terminateError.message }));

    await createNotification(ctx.userId, 'password_changed', {});
    await auditLog({ actorId: ctx.userId, action: 'change_password', ip });

    return res.status(200).json({ success: true });
  }

  if (req.method === 'POST' && path === 'handoff_create') {
    if (!ctx.authenticated || !ctx.adminData) throw new SecurityError('Admin access required', 403);
    const ip = getClientIp(req);
    if (!(await rateLimiter.check(ip, ctx.userId, 'handoff_create'))) throw new SecurityError('Too many requests', 429);
    const token = crypto.randomBytes(32).toString('base64url');
    const { error } = await supabase.from('admin_handoff_tokens').insert({
      token_hash: hashToken(token),
      user_id: ctx.userId,
      creator_ip: ip,
      creator_ip_network: getIpNetwork(ip),
      expires_at: new Date(Date.now() + 60000).toISOString(),
    });
    if (error) {
      console.error('[HANDOFF_CREATE] error', JSON.stringify({ message: error.message }));
      throw new SecurityError('Failed to create handoff token', 500);
    }
    await auditLog({ actorId: ctx.userId, actorRole: ctx.adminData?.admin_role, action: 'handoff_create', ip });
    return res.status(200).json({ token });
  }

  if (req.method === 'POST' && path === 'handoff_exchange') {
    const ip = getClientIp(req);
    if (!(await rateLimiter.check(ip, null, 'handoff_exchange'))) throw new SecurityError('Too many requests', 429);
    const body = await parseAndValidateBody(req);
    if (!body.token || typeof body.token !== 'string') throw new SecurityError('Invalid token', 400);
    const hashedToken = hashToken(body.token);
    const { data: row } = await supabase
      .from('admin_handoff_tokens')
      .select('*')
      .eq('token_hash', hashedToken)
      .eq('used', false)
      .maybeSingle();
    if (!row || new Date(row.expires_at) < new Date()) throw new SecurityError('Invalid or expired token', 401);
    if (row.creator_ip_network && row.creator_ip_network !== getIpNetwork(ip)) {
      await supabase.from('admin_handoff_tokens').update({ used: true }).eq('token_hash', hashedToken);
      await auditLog({ actorId: row.user_id, action: 'handoff_network_mismatch', ip, metadata: { creator_ip_network: row.creator_ip_network, exchange_ip_network: getIpNetwork(ip) } });
      throw new SecurityError('Invalid or expired token', 401);
    }
    await supabase.from('admin_handoff_tokens').update({ used: true }).eq('token_hash', hashedToken);
    const adminData = await isAdmin(row.user_id, ip);
    if (!adminData || !adminData.admin_role) throw new SecurityError('Forbidden', 403);
    const session = await createUserSession(row.user_id, ip, req.headers['user-agent'], req, !!adminData.mfa_enabled, true);
    setSessionCookie(res, session.access_token, session.max_age_ms);
    const csrf_token = generateCsrfToken(session.csrf_secret, session.fingerprint);
    const { data: { user } } = await supabase.auth.admin.getUserById(row.user_id);
    await auditLog({ actorId: row.user_id, actorRole: adminData.admin_role, action: 'handoff_exchange', ip });
    return res.status(200).json({ user: { id: row.user_id, email: user?.email }, csrf_token });
  }

  throw new SecurityError('Invalid path', 400);
}

async function createUserSession(userId, ip, userAgent, req, mfaVerified = false, isAdminSession = false) {
  const sessionToken = generateSessionToken();
  const hashedToken = hashToken(sessionToken);
  const csrfSecret = crypto.randomBytes(32).toString('hex');
  const maxAgeMs = isAdminSession ? ADMIN_SESSION_MAX_AGE_MS : USER_SESSION_MAX_AGE_MS;
  const expiresAt = new Date(Date.now() + maxAgeMs).toISOString();
  const fingerprint = getSessionFingerprint(req, userId);
  const ipNetwork = getIpNetwork(ip);
  const { error } = await supabase.from('user_sessions').insert({
    user_id: userId,
    session_token_hash: hashedToken,
    ip_address: ip,
    user_agent: (userAgent || '').substring(0, 500),
    expires_at: expiresAt,
    is_active: true,
    fingerprint,
    csrf_secret: csrfSecret,
    mfa_verified: mfaVerified,
    ip_network: ipNetwork,
    network_mismatch_count: 0,
    session_max_age_ms: maxAgeMs,
    created_at: new Date().toISOString(),
  });
  if (error) {
    console.error('[CREATE_SESSION] error', JSON.stringify({ message: error.message, userId }));
    throw new SecurityError('Failed to create session', 500);
  }
  return {
    access_token: sessionToken,
    expires_at: expiresAt,
    csrf_secret: csrfSecret,
    fingerprint,
    max_age_ms: maxAgeMs,
  };
}

function setSessionCookie(res, token, maxAgeMs) {
  const maxAgeSeconds = Math.floor((maxAgeMs || USER_SESSION_MAX_AGE_MS) / 1000);
  res.setHeader(
    'Set-Cookie',
    `session=${token}; HttpOnly; Secure; SameSite=None; Max-Age=${maxAgeSeconds}; Path=/`
  );
}
