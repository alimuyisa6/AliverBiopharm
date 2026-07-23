import { supabase } from './core.js';
import { requireAuth, SecurityError } from './security-middleware.js';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export async function handler(req, res, path, ctx) {
  requireAuth(ctx);

  if (req.method === 'POST' && path === 'file') {
    return uploadFile(req, res, ctx);
  }

  if (req.method === 'DELETE' && path === 'file') {
    return deleteFile(req, res, ctx);
  }

  if (req.method === 'GET' && path === 'files') {
    return getFiles(req, res, ctx);
  }

  throw new SecurityError('Invalid action', 400);
}

async function uploadFile(req, res, ctx) {
  const body = await parseMultipartForm(req);
  const { file, category, metadata } = body;

  if (!file) throw new SecurityError('File is required', 400);
  if (file.size > MAX_FILE_SIZE) throw new SecurityError('File must be under 10MB', 400);
  if (!ALLOWED_MIME_TYPES.includes(file.mimeType)) {
    throw new SecurityError('File type not allowed. Use PDF or images.', 400);
  }

  const folder = category || 'general';
  const fileName = `${ctx.userId}/${folder}/${Date.now()}-${file.originalName}`;

  const { error: uploadError } = await supabase.storage
    .from('uploads')
    .upload(fileName, file.buffer, {
      contentType: file.mimeType,
      cacheControl: '3600',
      upsert: false
    });

  if (uploadError) throw new SecurityError('Failed to upload: ' + uploadError.message, 500);

  const { data: urlData } = supabase.storage.from('uploads').getPublicUrl(fileName);

  const { data: record, error: insertError } = await supabase
    .from('user_files')
    .insert({
      user_id: ctx.userId,
      file_name: file.originalName,
      file_url: urlData.publicUrl,
      file_path: fileName,
      file_size: file.size,
      file_mime_type: file.mimeType,
      category: category || 'general',
      metadata: metadata || {}
    })
    .select()
    .single();

  if (insertError) {
    await supabase.storage.from('uploads').remove([fileName]);
    throw new SecurityError('Failed to save file record', 500);
  }

  return res.status(200).json({
    success: true,
    file: record
  });
}

async function deleteFile(req, res, ctx) {
  const { file_id } = req.query;

  if (!file_id) throw new SecurityError('file_id is required', 400);

  const { data: file, error: fetchError } = await supabase
    .from('user_files')
    .select('*')
    .eq('id', file_id)
    .eq('user_id', ctx.userId)
    .maybeSingle();

  if (fetchError || !file) throw new SecurityError('File not found', 404);

  const { error: storageError } = await supabase.storage
    .from('uploads')
    .remove([file.file_path]);

  if (storageError) console.error('Failed to delete from storage:', storageError);

  await supabase
    .from('user_files')
    .update({ is_active: false })
    .eq('id', file_id);

  return res.status(200).json({ success: true });
}

async function getFiles(req, res, ctx) {
  const { category } = req.query;

  let query = supabase
    .from('user_files')
    .select('*')
    .eq('user_id', ctx.userId)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (category) query = query.eq('category', category);

  const { data, error } = await query;

  if (error) throw new SecurityError('Failed to fetch files', 500);

  return res.status(200).json({ files: data || [] });
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
