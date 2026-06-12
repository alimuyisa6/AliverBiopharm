import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function setCorsHeaders(res, req) {
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'https://aliverbiopharm.com').split(',').map(o => o.trim());
  const requestOrigin = req.headers.origin || '';
  const corsOrigin = allowedOrigins.includes(requestOrigin) ? requestOrigin : allowedOrigins[0];
  res.setHeader('Access-Control-Allow-Origin', corsOrigin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-CSRF-Token, Cookie');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Cache-Control', 'no-store, must-revalidate');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
}

function parseCookies(req) {
  const cookieHeader = req.headers.cookie || '';
  return Object.fromEntries(cookieHeader.split(';').map(c => {
    const [k, ...v] = c.trim().split('=');
    return [k.trim(), decodeURIComponent(v.join('='))];
  }));
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function generateSessionToken() {
  return crypto.randomBytes(48).toString('base64url');
}

async function createUserSession(userId, ip, userAgent) {
  const sessionToken = generateSessionToken();
  const hashedToken = hashToken(sessionToken);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await supabase.from('user_sessions').insert({
    user_id: userId,
    session_token_hash: hashedToken,
    ip_address: ip,
    user_agent: (userAgent || '').substring(0, 500),
    expires_at: expiresAt,
    is_active: true
  });
  if (error) throw error;
  return { access_token: sessionToken, expires_at: expiresAt };
}

async function validateSession(token) {
  if (!token || token.length < 20) return null;
  const hashedToken = hashToken(token);
  const { data, error } = await supabase.from('user_sessions').select('user_id, expires_at, is_active').eq('session_token_hash', hashedToken).eq('is_active', true).single();
  if (error || !data) return null;
  if (new Date(data.expires_at) < new Date()) {
    await supabase.from('user_sessions').update({ is_active: false }).eq('session_token_hash', hashedToken);
    return null;
  }
  return data;
}

async function isAdmin(userId) {
  if (!userId) return null;
  const { data } = await supabase.from('admin_master').select('admin_role, permissions').eq('admin_id', userId).eq('is_active', true).maybeSingle();
  return data;
}

export default async function handler(req, res) {
  setCorsHeaders(res, req);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { path } = req.query;

  if (req.method === 'GET') {
    switch (path) {
      case 'get_user': return getUser(req, res);
      default: return res.status(400).json({ error: 'Invalid action' });
    }
  }
  if (req.method === 'POST') {
    switch (path) {
      case 'signup':  return signup(req, res);
      case 'signin':  return signin(req, res);
      case 'signout': return signout(req, res);
      default: return res.status(400).json({ error: 'Invalid action' });
    }
  }
  return res.status(405).json({ error: 'Method not allowed' });
}

async function getUser(req, res) {
  const cookies = parseCookies(req);
  const token = cookies.session || '';
  if (!token) return res.status(200).json({ user: null });

  const session = await validateSession(token);
  if (!session) return res.status(200).json({ user: null });

  const { data: { user }, error } = await supabase.auth.admin.getUserById(session.user_id);
  if (error || !user) return res.status(200).json({ user: null });

  const adminData = await isAdmin(session.user_id);

  const { data: restriction } = await supabase
    .from('user_restrictions')
    .select('restriction_type, lock_reason, expires_at')
    .eq('user_id', session.user_id)
    .maybeSingle();

  return res.status(200).json({
    user: {
      id: user.id,
      email: user.email,
      is_admin: !!adminData,
      admin_role: adminData?.admin_role || null,
      permissions: adminData?.permissions || null,
      restriction: restriction || null
    }
  });
}

async function signup(req, res) {
  const { email, password } = req.body;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Invalid email' });
  if (!password || password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

  const ip = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown';

  const { data, error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: {
      emailRedirectTo: `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}`
    }
  });

  if (error) {
    if (error.code === 'user_already_exists') {
      return res.status(200).json({ user: null, message: 'Account exists. Check your email.' });
    }
    return res.status(400).json({ error: error.message });
  }

  if (data.session) {
    const session = await createUserSession(data.user.id, ip, req.headers['user-agent']);
    res.setHeader('Set-Cookie', `session=${session.access_token}; HttpOnly; Secure; SameSite=Strict; Max-Age=${7 * 24 * 60 * 60}; Path=/`);
    return res.status(200).json({ user: { id: data.user.id, email: data.user.email } });
  }

  return res.status(200).json({ user: null });
}

async function signin(req, res) {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const ip = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown';

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password
  });

  if (error) return res.status(401).json({ error: 'Invalid email or password' });

  // Check restrictions
  const { data: restriction } = await supabase
    .from('user_restrictions')
    .select('restriction_type, lock_reason, expires_at')
    .eq('user_id', data.user.id)
    .maybeSingle();

  if (restriction) {
    if (restriction.restriction_type === 'disabled') {
      return res.status(403).json({ error: 'Your account has been permanently disabled. Contact support.' });
    }
    if (restriction.restriction_type === 'suspended') {
      return res.status(403).json({ error: restriction.lock_reason || 'Your account has been suspended. Contact support.' });
    }
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

async function signout(req, res) {
  const cookies = parseCookies(req);
  const token = cookies.session || '';
  if (token) {
    const hashedToken = hashToken(token);
    await supabase.from('user_sessions').update({ is_active: false }).eq('session_token_hash', hashedToken);
  }
  res.setHeader('Set-Cookie', 'session=; HttpOnly; Secure; SameSite=Strict; Max-Age=0; Path=/');
  return res.status(200).json({ success: true });
}
