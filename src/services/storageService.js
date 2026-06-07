import { supabase } from './supabase';

const BUCKET_NAME = 'notes'; // create this bucket in Supabase

export const uploadFile = async (file, folder = '') => {
  const filePath = `${folder}/${Date.now()}-${file.name}`;
  const { data, error } = await supabase.storage.from(BUCKET_NAME).upload(filePath, file);
  if (error) return { success: false, error: error.message };
  const { data: urlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(filePath);
  return { success: true, url: urlData.publicUrl };
};

export const deleteFile = async (fileUrl) => {
  const path = fileUrl.split('/').slice(-2).join('/');
  const { error } = await supabase.storage.from(BUCKET_NAME).remove([path]);
  if (error) return { success: false, error: error.message };
  return { success: true };
};
