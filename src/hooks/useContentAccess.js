 /* hooks/useContentAccess.js */
import { useAuth } from '../contexts/AuthContext';

export function useContentAccess() {
  const { user } = useAuth();

  if (!user?.profile) {
    return { canAccess: false, reason: 'no_profile', level: null, showAll: false, isPending: false };
  }

  const { role, track, is_approved_teacher, approved_track } = user.profile;

  if (role === 'student') {
    return { canAccess: true, reason: 'student', level: track, showAll: false, isPending: false };
  }

  if (role === 'teacher') {
    if (!is_approved_teacher) {
      return { canAccess: false, reason: 'pending_approval', level: null, showAll: false, isPending: true };
    }
    if (approved_track === 'ALL') {
      return { canAccess: true, reason: 'approved_teacher_all', level: null, showAll: true, isPending: false };
    }
    return { canAccess: true, reason: 'approved_teacher', level: approved_track || track, showAll: false, isPending: false };
  }

  return { canAccess: false, reason: 'unknown', level: null, showAll: false, isPending: false };
}
