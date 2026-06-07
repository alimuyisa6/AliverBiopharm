import { supabase } from './supabase';

// Courses
export const getAllCourses = async () => {
  const { data, error } = await supabase.from('courses').select('*').order('created_at', { ascending: false });
  if (error) return { success: false, error: error.message };
  return { success: true, data };
};

export const getCourseById = async (courseId) => {
  const { data, error } = await supabase.from('courses').select('*').eq('id', courseId).single();
  if (error) return { success: false, error: error.message };
  return { success: true, data };
};

export const getCoursesByCategory = async (category) => {
  const { data, error } = await supabase.from('courses').select('*').eq('category', category).order('created_at', { ascending: false });
  if (error) return { success: false, error: error.message };
  return { success: true, data };
};

export const createCourse = async (courseData) => {
  const { data, error } = await supabase.from('courses').insert(courseData).select();
  if (error) return { success: false, error: error.message };
  return { success: true, id: data[0].id };
};

export const updateCourse = async (courseId, courseData) => {
  const { error } = await supabase.from('courses').update(courseData).eq('id', courseId);
  if (error) return { success: false, error: error.message };
  return { success: true };
};

export const deleteCourse = async (courseId) => {
  const { error } = await supabase.from('courses').delete().eq('id', courseId);
  if (error) return { success: false, error: error.message };
  return { success: true };
};

// Users (profiles)
export const getUserProfile = async (userId) => {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
  if (error) return { success: false, error: error.message };
  return { success: true, data };
};

export const createProfile = async (profile) => {
  const { error } = await supabase.from('profiles').insert(profile);
  if (error) return { success: false, error: error.message };
  return { success: true };
};

export const updateProfile = async (userId, updates) => {
  const { error } = await supabase.from('profiles').update(updates).eq('id', userId);
  if (error) return { success: false, error: error.message };
  return { success: true };
};

export const getAllUsers = async () => {
  const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
  if (error) return { success: false, error: error.message };
  return { success: true, data };
};

// Enrollment
export const enrollInCourse = async (userId, courseId) => {
  const { error } = await supabase.from('enrollments').insert({ user_id: userId, course_id: courseId });
  if (error) return { success: false, error: error.message };
  return { success: true };
};

export const unenrollFromCourse = async (userId, courseId) => {
  const { error } = await supabase.from('enrollments').delete().match({ user_id: userId, course_id: courseId });
  if (error) return { success: false, error: error.message };
  return { success: true };
};

export const getUserEnrollments = async (userId) => {
  const { data, error } = await supabase.from('enrollments').select('course_id').eq('user_id', userId);
  if (error) return { success: false, error: error.message };
  return { success: true, data: data.map(e => e.course_id) };
};

// Quiz results
export const saveQuizResult = async (userId, quizData) => {
  const { data, error } = await supabase.from('quiz_results').insert({ user_id: userId, ...quizData }).select();
  if (error) return { success: false, error: error.message };
  return { success: true, id: data[0].id };
};

export const getUserQuizResults = async (userId) => {
  const { data, error } = await supabase.from('quiz_results').select('*').eq('user_id', userId).order('completed_at', { ascending: false });
  if (error) return { success: false, error: error.message };
  return { success: true, data };
};

export const getLeaderboard = async (limitCount = 10) => {
  const { data, error } = await supabase.from('quiz_results').select('*').order('score', { ascending: false }).limit(limitCount);
  if (error) return { success: false, error: error.message };
  return { success: true, data };
};

// Notes
export const getAllNotes = async () => {
  const { data, error } = await supabase.from('notes').select('*').order('created_at', { ascending: false });
  if (error) return { success: false, error: error.message };
  return { success: true, data };
};

export const addNote = async (noteData) => {
  const { error } = await supabase.from('notes').insert(noteData);
  if (error) return { success: false, error: error.message };
  return { success: true };
};

// Forum posts
export const getForumPosts = async () => {
  const { data, error } = await supabase.from('forum_posts').select('*').order('created_at', { ascending: false });
  if (error) return { success: false, error: error.message };
  return { success: true, data };
};

export const createForumPost = async (postData) => {
  const { error } = await supabase.from('forum_posts').insert(postData);
  if (error) return { success: false, error: error.message };
  return { success: true };
};

export const addComment = async (postId, commentData) => {
  const { error } = await supabase.from('forum_comments').insert({ post_id: postId, ...commentData });
  if (error) return { success: false, error: error.message };
  return { success: true };
};

export const getComments = async (postId) => {
  const { data, error } = await supabase.from('forum_comments').select('*').eq('post_id', postId).order('created_at', { ascending: true });
  if (error) return { success: false, error: error.message };
  return { success: true, data };
};
