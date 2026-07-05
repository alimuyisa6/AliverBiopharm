 import { supabase, parseCookies, hashToken, getClientIp, verifyTurnstile, generateSessionToken, generateCsrfToken, isAdmin } from './core.js';
import { parseAndValidateBody, getSessionFingerprint, SecurityError, rateLimiter } from './security-middleware.js';
import crypto from 'crypto';
import { createNotification } from './notifications.js';

export async function handler(req, res, path, ctx) {
  if (req.method === 'GET' && path === 'get_user') {
    if (!ctx.authenticated) return res.status(200).json({ user: null });
    const { data: { user }, error } = await supabase.auth.admin.getUserById(ctx.userId);
    if (error || !user) return res.status(200).json({ user: null });
    const { data: restriction } = await supabase.from('user_restrictions').select('restriction_type, lock_reason, expires_at').eq('user_id', ctx.userId).maybeSingle();
    return res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        is_admin: !!ctx.adminData,
        admin_role: ctx.adminData?.admin_role || null,
        permissions: ctx.adminData?.permissions || null,
        restriction: restriction || null
      }
    });
  }

  if (req.method === 'POST' && path === 'signup') {
    const ip = getClientIp(req);
    const body = await parseAndValidateBody(req);
    const { email, password, turnstile_token } = body;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new SecurityError('Invalid email address', 400);
    if (!password || password.length < 10) throw new SecurityError('Password must be at least 10 characters', 400);
    if (password.length > 128) throw new SecurityError('Password must not exceed 128 characters', 400);
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasDigit = /[0-9]/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);
    const categories = [hasUpper, hasLower, hasDigit, hasSpecial].filter(Boolean).length;
    if (categories < 3) throw new SecurityError('Password must contain at least 3 of: uppercase letter, lowercase letter, number, special character', 400);
    const turnstileOk = await verifyTurnstile(turnstile_token, ip);
    if (!turnstileOk) throw new SecurityError('Captcha verification failed. Please try again.', 400);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(), password,
      options: { emailRedirectTo: `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}` }
    });
    if (error) {
      if (error.code === 'user_already_exists') return res.status(200).json({ user: null, message: 'Account exists. Check your email.' });
      throw new SecurityError('Registration failed. Please try again.', 400);
    }
    if (data.session) {
      const session = await createUserSession(data.user.id, ip, req.headers['user-agent'], req);
      setSessionCookie(res, session.access_token);
      const csrf_token = generateCsrfToken(session.csrf_secret);
      await createNotification(data.user.id, 'welcome', {});
      return res.status(200).json({ user: { id: data.user.id, email: data.user.email }, csrf_token });
    }
    return res.status(200).json({ user: null });
  }

  if (req.method === 'POST' && path === 'signin') {
    const ip = getClientIp(req);
    const body = await parseAndValidateBody(req);
    const { email, password, turnstile_token } = body;
    if (!email || !password) throw new SecurityError('Email and password required', 400);
    const remaining = rateLimiter.getAuthAttemptsRemaining(ip);
    if (remaining <= 0) {
      return res.status(429).json({ error: 'Too many login attempts. Please try again in 15 minutes.', retry_after_minutes: 15, attempts_remaining: 0 });
    }
    const turnstileOk = await verifyTurnstile(turnstile_token, ip);
    if (!turnstileOk) throw new SecurityError('Captcha verification failed. Please try again.', 400);
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (error) throw new SecurityError('Invalid email or password', 401);
    const { data: restriction } = await supabase.from('user_restrictions').select('restriction_type, lock_reason, expires_at').eq('user_id', data.user.id).maybeSingle();
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
    await supabase.from('user_sessions').update({ is_active: false, terminated_reason: 'new_login', terminated_at: new Date().toISOString() }).eq('user_id', data.user.id).eq('is_active', true);
    const session = await createUserSession(data.user.id, ip, req.headers['user-agent'], req);
    setSessionCookie(res, session.access_token);
    if (ctx.adminData?.id) {
      await supabase.from('admin_master').update({ last_login: new Date().toISOString() }).eq('id', ctx.adminData.id);
    }
    const csrf_token = generateCsrfToken(session.csrf_secret);
    await createNotification(data.user.id, 'new_login', { location: 'Unknown', device: (req.headers['user-agent'] || 'Unknown browser').substring(0, 100) });
    return res.status(200).json({ user: { id: data.user.id, email: data.user.email }, csrf_token });
  }

  if (req.method === 'POST' && path === 'signout') {
    if (ctx.authenticated && ctx.sessionId) {
      await supabase.from('user_sessions').update({ is_active: false, terminated_reason: 'user_logout', terminated_at: new Date().toISOString() }).eq('id', ctx.sessionId);
    }
    res.setHeader('Set-Cookie', 'session=; HttpOnly; Secure; SameSite=None; Max-Age=0; Path=/');
    return res.status(200).json({ success: true });
  }

  if (req.method === 'POST' && path === 'handoff_create') {
    if (!ctx.authenticated || !ctx.adminData) throw new SecurityError('Admin access required', 403);
    const ip = getClientIp(req);
    if (!rateLimiter.check(ip, ctx.userId, 'handoff_create')) throw new SecurityError('Too many requests', 429);
    const token = crypto.randomBytes(32).toString('base64url');
    const { error } = await supabase.from('admin_handoff_tokens').insert({
      token_hash: hashToken(token),
      user_id: ctx.userId,
      expires_at: new Date(Date.now() + 60000).toISOString()
    });
    if (error) throw new SecurityError('Failed to create handoff token', 500);
    return res.status(200).json({ token });
  }

  if (req.method === 'POST' && path === 'handoff_exchange') {
    const ip = getClientIp(req);
    if (!rateLimiter.check(ip, null, 'handoff_exchange')) throw new SecurityError('Too many requests', 429);
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
    await supabase.from('admin_handoff_tokens').update({ used: true }).eq('token_hash', hashedToken);
    const adminData = await isAdmin(row.user_id, ip);
    if (!adminData || !adminData.admin_role) throw new SecurityError('Forbidden', 403);
    const session = await createUserSession(row.user_id, ip, req.headers['user-agent'], req);
    setSessionCookie(res, session.access_token);
    const csrf_token = generateCsrfToken(session.csrf_secret);
    const { data: { user } } = await supabase.auth.admin.getUserById(row.user_id);
    return res.status(200).json({ user: { id: row.user_id, email: user?.email }, csrf_token });
  }

  throw new SecurityError('Invalid path', 400);
}

async function createUserSession(userId, ip, userAgent, req) {
  const sessionToken = generateSessionToken();
  const hashedToken = hashToken(sessionToken);
  const csrfSecret = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const fingerprint = getSessionFingerprint(req, userId);
  const { error } = await supabase.from('user_sessions').insert({
    user_id: userId, session_token_hash: hashedToken, ip_address: ip,
    user_agent: (userAgent || '').substring(0, 500), expires_at: expiresAt,
    is_active: true, fingerprint, csrf_secret: csrfSecret,
    created_at: new Date().toISOString()
  });
  if (error) throw new SecurityError('Failed to create session', 500);
  return { access_token: sessionToken, expires_at: expiresAt, csrf_secret: csrfSecret };
}

function setSessionCookie(res, token) {
  res.setHeader('Set-Cookie', `session=${token}; HttpOnly; Secure; SameSite=None; Max-Age=${7 * 24 * 60 * 60}; Path=/`);
}
