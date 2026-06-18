 import { supabase } from './core.js';
import { parseAndValidateBody, SecurityError } from './security-middleware.js';

export async function handler(req, res, path, ctx) {
  if (req.method === 'POST') {
    const body = await parseAndValidateBody(req);
    switch (path) {
      case 'submit_contact': return submitContact(body, res);
      case 'subscribe_newsletter': return subscribeNewsletter(body, res);
      default: throw new SecurityError('Invalid action', 400);
    }
  }
  throw new SecurityError('Method not allowed', 405);
}

async function submitContact(body, res) {
  const { formData } = body;
  if (!formData?.name || !formData?.email || !formData?.message) throw new SecurityError('Name, email and message are required', 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) throw new SecurityError('Invalid email address', 400);
  const { error } = await supabase.from('contact_messages').insert({
    name: formData.name.trim(), email: formData.email.trim().toLowerCase(), subject: formData.subject?.trim() || '', message: formData.message.trim(), is_read: false, created_at: new Date().toISOString()
  });
  if (error) throw new SecurityError('Failed to submit message', 500);
  return res.status(200).json({ success: true });
}

async function subscribeNewsletter(body, res) {
  const { formData } = body;
  const email = formData?.email;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new SecurityError('Valid email required', 400);
  const { error } = await supabase.from('newsletter_subscribers').upsert({ email: email.trim().toLowerCase(), is_active: true, created_at: new Date().toISOString() }, { onConflict: 'email' });
  if (error) throw new SecurityError('Failed to subscribe', 500);
  return res.status(200).json({ success: true });
}
