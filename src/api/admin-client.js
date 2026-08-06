import { apiCall } from './client';

export async function requestHandoff() {
  return apiCall('auth', 'handoff_create', {});
}

export async function approveTeacher(userId, approved_track, notes = null) {
  return apiCall('admin', 'approve_teacher', { userId, approved_track, notes });
}

export async function rejectTeacher(userId, reason) {
  return apiCall('admin', 'reject_teacher', { userId, reason });
}
