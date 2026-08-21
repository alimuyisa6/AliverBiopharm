import { supabase } from './core.js';
import { requireAuth, SecurityError } from './security-middleware.js';
import Busboy from 'busboy';
import { auditLog } from './core.js';

export async function handler(req, res, path, ctx) {
  try {
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

    console.error('[PROFILE_PICTURE] Invalid action:', { method: req.method, path });
    throw new SecurityError('Invalid action', 400);
  } catch (error) {
    console.error('[PROFILE_PICTURE_ERROR]', {
      path,
      method: req.method,
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

async function uploadProfilePicture(req, res, ctx) {
  try {
    console.log('[PROFILE_PICTURE] Upload started for user:', ctx.userId);

    const body = await parseMultipartForm(req);
    const { file } = body;

    if (!file) {
      console.error('[PROFILE_PICTURE] No file provided');
      throw new SecurityError('File is required', 400);
    }

    console.log('[PROFILE_PICTURE] File received:', {
      size: file.size,
      mimeType: file.mimeType,
      originalName: file.originalName
    });

    if (file.size > 2 * 1024 * 1024) {
      console.error('[PROFILE_PICTURE] File too large:', file.size);
      throw new SecurityError('File must be under 2MB', 400);
    }

    const mimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!mimeTypes.includes(file.mimeType)) {
      console.error('[PROFILE_PICTURE] Invalid mime type:', file.mimeType);
      throw new SecurityError('File type not allowed. Use JPEG, PNG, WebP, or GIF.', 400);
    }

    const fileName = `${ctx.userId}/profile.jpg`;

    const { data: existing } = await supabase.storage
      .from('profile_pictures')
      .list(`${ctx.userId}/`);

    if (existing && existing.length > 0) {
      console.log('[PROFILE_PICTURE] Removing existing file:', existing[0].name);
      const { error: removeError } = await supabase.storage
        .from('profile_pictures')
        .remove([`${ctx.userId}/${existing[0].name}`]);

      if (removeError) {
        console.error('[PROFILE_PICTURE] Remove existing file error:', removeError);
      }
    }

    console.log('[PROFILE_PICTURE] Uploading file:', fileName);
    const { error: uploadError } = await supabase.storage
      .from('profile_pictures')
      .upload(fileName, file.buffer, {
        contentType: file.mimeType,
        cacheControl: '31536000',
        upsert: true
      });

    if (uploadError) {
      console.error('[PROFILE_PICTURE] Upload error:', uploadError);
      throw new SecurityError('Failed to upload: ' + uploadError.message, 500);
    }

    const { data: urlData } = supabase.storage.from('profile_pictures').getPublicUrl(fileName);

    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({
        profile_picture_url: urlData.publicUrl,
        profile_picture_updated_at: new Date().toISOString()
      })
      .eq('user_id', ctx.userId);

    if (updateError) {
      console.error('[PROFILE_PICTURE] Database update error:', updateError);
      throw new SecurityError('Failed to update profile', 500);
    }

    await auditLog({
      actorId: ctx.userId,
      action: 'upload_profile_picture',
      targetType: 'user',
      targetId: ctx.userId,
      metadata: { url: urlData.publicUrl }
    });

    console.log('[PROFILE_PICTURE] Upload successful');
    return res.status(200).json({
      success: true,
      profile_picture_url: urlData.publicUrl
    });
  } catch (error) {
    console.error('[PROFILE_PICTURE] Upload error:', error);
    throw error;
  }
}

async function deleteProfilePicture(req, res, ctx) {
  try {
    console.log('[PROFILE_PICTURE] Delete started for user:', ctx.userId);

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('profile_picture_url')
      .eq('user_id', ctx.userId)
      .maybeSingle();

    console.log('[PROFILE_PICTURE] Current profile picture:', profile?.profile_picture_url);

    if (profile?.profile_picture_url) {
      const fileName = profile.profile_picture_url.split('/').pop();
      console.log('[PROFILE_PICTURE] Removing file:', fileName);
      const { error: removeError } = await supabase.storage
        .from('profile_pictures')
        .remove([`${ctx.userId}/${fileName}`]);

      if (removeError) {
        console.error('[PROFILE_PICTURE] Remove error:', removeError);
        throw new SecurityError('Failed to remove file from storage: ' + removeError.message, 500);
      }
    }

    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({
        profile_picture_url: null,
        profile_picture_updated_at: null
      })
      .eq('user_id', ctx.userId);

    if (updateError) {
      console.error('[PROFILE_PICTURE] Database update error:', updateError);
      throw new SecurityError('Failed to remove profile picture', 500);
    }

    await auditLog({
      actorId: ctx.userId,
      action: 'delete_profile_picture',
      targetType: 'user',
      targetId: ctx.userId,
      metadata: { deleted: true }
    });

    console.log('[PROFILE_PICTURE] Delete successful');
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('[PROFILE_PICTURE] Delete error:', error);
    throw error;
  }
}

async function getProfilePicture(req, res, ctx) {
  try {
    const { user_id } = req.query;
    const targetUserId = user_id || ctx.userId;

    console.log('[PROFILE_PICTURE] Get picture for user:', targetUserId);

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('profile_picture_url')
      .eq('user_id', targetUserId)
      .maybeSingle();

    return res.status(200).json({
      profile_picture_url: profile?.profile_picture_url || null
    });
  } catch (error) {
    console.error('[PROFILE_PICTURE] Get error:', error);
    throw error;
  }
}

async function parseMultipartForm(req) {
  try {
    const contentType = req.headers['content-type'] || '';
    if (!/^multipart\/(form-data|related)/i.test(contentType)) {
      console.error('[PROFILE_PICTURE] Invalid content-type:', contentType);
      throw new SecurityError('Expected multipart/form-data', 400);
    }

    return new Promise((resolve, reject) => {
      let busboy;
      try {
        busboy = Busboy({ headers: req.headers });
      } catch (err) {
        console.error('[PROFILE_PICTURE] Busboy initialization error:', err);
        reject(new SecurityError('Failed to parse upload: ' + err.message, 400));
        return;
      }

      const fields = {};
      let file = null;

      busboy.on('field', (fieldname, val) => {
        fields[fieldname] = val;
      });

      busboy.on('file', (fieldname, stream, info) => {
        console.log('[PROFILE_PICTURE] Receiving file:', info.filename);
        const chunks = [];
        stream.on('data', (chunk) => chunks.push(chunk));
        stream.on('end', () => {
          file = {
            buffer: Buffer.concat(chunks),
            originalName: info.filename,
            mimeType: info.mimeType,
            size: chunks.reduce((acc, chunk) => acc + chunk.length, 0)
          };
          console.log('[PROFILE_PICTURE] File received complete:', file.size);
        });
        stream.on('error', (err) => {
          console.error('[PROFILE_PICTURE] Stream error:', err);
          reject(new SecurityError('File stream error: ' + err.message, 400));
        });
      });

      busboy.on('finish', () => {
        console.log('[PROFILE_PICTURE] Multipart parsing complete');
        resolve({ file, ...fields });
      });

      busboy.on('error', (err) => {
        console.error('[PROFILE_PICTURE] Busboy error:', err);
        reject(new SecurityError('Failed to parse upload: ' + err.message, 400));
      });

      req.pipe(busboy);
    });
  } catch (error) {
    console.error('[PROFILE_PICTURE] Parse error:', error);
    throw error;
  }
}
