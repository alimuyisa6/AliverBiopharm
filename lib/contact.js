// /lib/contact.js
import { supabase } from './core.js';

async function parseBody(req) { const chunks = []; for await (const chunk of req) chunks.push(chunk); return JSON.parse(Buffer.concat(chunks).toString()); }

export async function handler(req, res, path, ctx) {
  if (req.method === 'POST') {
    const body = await parseBody(req);
    switch (path) {
      case 'submit_contact': return submitContact(body, res);
      case 'subscribe_newsletter': return subscribeNewsletter(body, res);
      default: return res.status(400).json({ error: 'Invalid action' });
    }
  }
  return res.status(405).json({ error: 'Method not allowed' });
}

async function submitContact(body, res) {
  const { formData } = body;
  if (!formData?.name || !formData?.email || !formData?.message) return res.status(400).json({ error: 'Name, email and message are required' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) return res.status(400).json({ error: 'Invalid email address' });
  const { error } = await supabase.from('contact_messages').insert({
    name: formData.name.trim(), email: formData.email.trim().toLowerCase(), subject: formData.subject?.trim() || '', message: formData.message.trim(), is_read: false, created_at: new Date().toISOString()
  });
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ success: true });
}

async function subscribeNewsletter(body, res) {
  const { formData } = body;
  const email = formData?.email;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Valid email required' });
  const { error } = await supabase.from('newsletter_subscribers').upsert({ email: email.trim().toLowerCase(), is_active: true, created_at: new Date().toISOString() }, { onConflict: 'email' });
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ success: true });
}
