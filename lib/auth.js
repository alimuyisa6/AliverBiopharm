// /lib/auth.js
import { supabase, parseCookies, hashToken, getClientIp, verifyTurnstile, generateSessionToken, validateSession, isAdmin } from './core.js';

async function parseBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString());
}

async function createUserSession(userId, ip, userAgent) {
  const sessionToken = generateSessionToken();
  const hashedToken = hashToken(sessionToken);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await supabase.from('user_sessions').insert({
    user_id: userId, session_token_hash: hashedToken, ip_address: ip,
    user_agent: (userAgent || '').substring(0, 500), expires_at: expiresAt, is_active: true
  });
  return { access_token: sessionToken, expires_at: expiresAt };
}

export async function handler(req, res, path, ctx) {
  const { userId, ip } = ctx;
  const cookies = parseCookies(req);
  const token = cookies.session || '';

  if (req.method === 'GET' && path === 'get_user') {
    if (!userId) return res.status(200).json({ user: null });
    const { data: { user }, error } = await supabase.auth.admin.getUserById(userId);
    if (error || !user) return res.status(200).json({ user: null });
    const adminData = await isAdmin(userId, ip);
    const { data: restriction } = await supabase.from('user_restrictions').select('restriction_type, lock_reason, expires_at').eq('user_id', userId).maybeSingle();
    return res.status(200).json({
      user: { id: user.id, email: user.email, is_admin: !!adminData, admin_role: adminData?.admin_role || null, permissions: adminData?.permissions || null, restriction: restriction || null }
    });
  }

  if (req.method === 'POST' && path === 'signup') {
    const { email, password, turnstile_token } = await parseBody(req);
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Invalid email' });
    if (!password || password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
    const turnstileOk = await verifyTurnstile(turnstile_token, ip);
    if (!turnstileOk) return res.status(400).json({ error: 'Captcha verification failed. Please try again.' });
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(), password,
      options: { emailRedirectTo: `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}` }
    });
    if (error) {
      if (error.code === 'user_already_exists') return res.status(200).json({ user: null, message: 'Account exists. Check your email.' });
      return res.status(400).json({ error: error.message });
    }
    if (data.session) {
      const session = await createUserSession(data.user.id, ip, req.headers['user-agent']);
      res.setHeader('Set-Cookie', `session=${session.access_token}; HttpOnly; Secure; SameSite=Strict; Max-Age=${7 * 24 * 60 * 60}; Path=/`);
      return res.status(200).json({ user: { id: data.user.id, email: data.user.email } });
    }
    return res.status(200).json({ user: null });
  }

  if (req.method === 'POST' && path === 'signin') {
    const { email, password, turnstile_token } = await parseBody(req);
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    const turnstileOk = await verifyTurnstile(turnstile_token, ip);
    if (!turnstileOk) return res.status(400).json({ error: 'Captcha verification failed. Please try again.' });
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (error) return res.status(401).json({ error: 'Invalid email or password' });
    const { data: restriction } = await supabase.from('user_restrictions').select('restriction_type, lock_reason, expires_at').eq('user_id', data.user.id).maybeSingle();
    if (restriction) {
      if (restriction.restriction_type === 'disabled') return res.status(403).json({ error: 'Your account has been permanently disabled. Contact support.' });
      if (restriction.restriction_type === 'suspended') return res.status(403).json({ error: restriction.lock_reason || 'Your account has been suspended. Contact support.' });
      if (restriction.restriction_type === 'locked') {
        if (restriction.expires_at && new Date(restriction.expires_at) > new Date()) {
          const hoursLeft = Math.ceil((new Date(restriction.expires_at) - new Date()) / (1000 * 60 * 60));
          return res.status(403).json({ error: `Your account is locked. Try again in ${hoursLeft} hours.` });
        } else {
          await supabase.from('user_restrictions').delete().eq('user_id', data.user.id);
        }
      }
    }
    const session = await createUserSession(data.user.id, ip, req.headers['user-agent']);
    res.setHeader('Set-Cookie', `session=${session.access_token}; HttpOnly; Secure; SameSite=Strict; Max-Age=${7 * 24 * 60 * 60}; Path=/`);
    return res.status(200).json({ user: { id: data.user.id, email: data.user.email } });
  }

  if (req.method === 'POST' && path === 'signout') {
    if (token) {
      const hashedToken = hashToken(token);
      await supabase.from('user_sessions').update({ is_active: false }).eq('session_token_hash', hashedToken);
    }
    res.setHeader('Set-Cookie', 'session=; HttpOnly; Secure; SameSite=Strict; Max-Age=0; Path=/');
    return res.status(200).json({ success: true });
  }

  return res.status(400).json({ error: 'Invalid path' });
}
