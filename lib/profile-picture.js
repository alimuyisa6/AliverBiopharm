import { supabase } from './core.js';
import { requireAuth, SecurityError } from './security-middleware.js';

export async function handler(req, res, path, ctx) {
  requireAuth(ctx);

  if (req.method === 'POST' && path === 'upload') {
    return uploadProfilePicture(req, res, ctx);
  }

  if (req.method === 'DELETE' && path === 'picture') {
    return deleteProfilePicture(req, res, ctx);
  }

  if (req.method === 'GET' && path === 'picture') {
    return getProfilePicture(req, res, ctx);
  }

  throw new SecurityError('Invalid action', 400);
}

async function uploadProfilePicture(req, res, ctx) {
  const body = await parseMultipartForm(req);
  const { file } = body;

  if (!file) throw new SecurityError('File is required', 400);
  if (file.size > 2 * 1024 * 1024) throw new SecurityError('File must be under 2MB', 400);

  const mimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!mimeTypes.includes(file.mimeType)) {
    throw new SecurityError('File type not allowed. Use JPEG, PNG, WebP, or GIF.', 400);
  }

  const fileName = `${ctx.userId}/profile.jpg`;

  const { data: existing } = await supabase.storage
    .from('profile_pictures')
    .list(`${ctx.userId}/`);

  if (existing && existing.length > 0) {
    await supabase.storage.from('profile_pictures').remove([`${ctx.userId}/${existing[0].name}`]);
  }

  const { error: uploadError } = await supabase.storage
    .from('profile_pictures')
    .upload(fileName, file.buffer, {
      contentType: file.mimeType,
      cacheControl: '31536000',
      upsert: true
    });

  if (uploadError) throw new SecurityError('Failed to upload: ' + uploadError.message, 500);

  const { data: urlData } = supabase.storage.from('profile_pictures').getPublicUrl(fileName);

  await supabase
    .from('user_profiles')
    .update({
      profile_picture_url: urlData.publicUrl,
      profile_picture_updated_at: new Date().toISOString()
    })
    .eq('user_id', ctx.userId);

  return res.status(200).json({
    success: true,
    profile_picture_url: urlData.publicUrl
  });
}

async function deleteProfilePicture(req, res, ctx) {
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('profile_picture_url')
    .eq('user_id', ctx.userId)
    .maybeSingle();

  if (profile?.profile_picture_url) {
    const fileName = profile.profile_picture_url.split('/').pop();
    await supabase.storage.from('profile_pictures').remove([`${ctx.userId}/${fileName}`]);
  }

  await supabase
    .from('user_profiles')
    .update({
      profile_picture_url: null,
      profile_picture_updated_at: null
    })
    .eq('user_id', ctx.userId);

  return res.status(200).json({ success: true });
}

async function getProfilePicture(req, res, ctx) {
  const { user_id } = req.query;
  const targetUserId = user_id || ctx.userId;

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('profile_picture_url')
    .eq('user_id', targetUserId)
    .maybeSingle();

  return res.status(200).json({
    profile_picture_url: profile?.profile_picture_url || null
  });
}

async function parseMultipartForm(req) {
  return new Promise((resolve, reject) => {
    const Busboy = require('busboy');
    const busboy = Busboy({ headers: req.headers });
    const fields = {};
    let file = null;

    busboy.on('field', (fieldname, val) => {
      fields[fieldname] = val;
    });

    busboy.on('file', (fieldname, stream, info) => {
      const chunks = [];
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('end', () => {
        file = {
          buffer: Buffer.concat(chunks),
          originalName: info.filename,
          mimeType: info.mimeType,
          size: chunks.reduce((acc, chunk) => acc + chunk.length, 0)
        };
      });
    });

    busboy.on('finish', () => {
      resolve({ file, ...fields });
    });

    busboy.on('error', (err) => {
      reject(new SecurityError('Failed to parse upload: ' + err.message, 400));
    });

    req.pipe(busboy);
  });
}
