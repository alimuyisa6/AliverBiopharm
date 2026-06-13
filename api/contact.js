import { createClient } from '@supabase/supabase-js';

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

export default async function handler(req, res) {
  setCorsHeaders(res, req);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { path } = req.query;

  if (req.method === 'POST') {
    switch (path) {
      case 'submit_contact': return submitContact(req, res);
      case 'subscribe_newsletter': return subscribeNewsletter(req, res);
      default: return res.status(400).json({ error: 'Invalid action' });
    }
  }
  return res.status(405).json({ error: 'Method not allowed' });
}

async function submitContact(req, res) {
  const { formData } = req.body;
  if (!formData?.name || !formData?.email || !formData?.message) {
    return res.status(400).json({ error: 'Name, email and message are required' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }
  const { error } = await supabase.from('contact_messages').insert({
    name: formData.name.trim(),
    email: formData.email.trim().toLowerCase(),
    subject: formData.subject?.trim() || '',
    message: formData.message.trim(),
    is_read: false,
    created_at: new Date().toISOString()
  });
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ success: true });
}

async function subscribeNewsletter(req, res) {
  const { formData } = req.body;
  const email = formData?.email;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Valid email required' });
  }
  const { error } = await supabase.from('newsletter_subscribers').upsert(
    { email: email.trim().toLowerCase(), is_active: true, created_at: new Date().toISOString() },
    { onConflict: 'email' }
  );
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ success: true });
}
