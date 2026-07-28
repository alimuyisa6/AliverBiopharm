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
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) throw new SecurityError('Invalid email', 400);
  await supabase.from('contact_messages').insert({
    name: formData.name.trim(),
    email: formData.email.trim().toLowerCase(),
    subject: formData.subject?.trim() || '',
    message: formData.message.trim(),
    is_read: false
  });
  return res.status(200).json({ success: true });
}

async function subscribeNewsletter(body, res) {
  const email = body?.formData?.email;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new SecurityError('Valid email required', 400);
  
  const { data: { user } } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1, filter: `email.eq.${email}` });
  const userId = user?.length ? user[0].id : null;
  
  if (userId) {
    await supabase.from('notification_preferences').upsert({
      user_id: userId,
      module: 'newsletter',
      in_app: true,
      email: true
    }, { onConflict: 'user_id,module' });
  }
  
  return res.status(200).json({ success: true });
}
