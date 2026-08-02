 /* hooks/useContentAccess.js */
import { useAuth } from '../contexts/AuthContext';

export function useContentAccess() {
  const { user, loading } = useAuth();

  // Auth is still resolving — this is NOT the same as "denied". Returning
  // canAccess:false here without signaling loading is what causes AccessDenied
  // to flash for a frame before the real profile data arrives, especially
  // since the route tree fully remounts on every navigation.
  if (loading) {
    return { canAccess: false, reason: 'loading', level: null, showAll: false, isPending: false, loading: true };
  }

  if (!user?.profile) {
    return { canAccess: false, reason: 'no_profile', level: null, showAll: false, isPending: false, loading: false };
  }

  const { role, track, is_approved_teacher, approved_track } = user.profile;

  if (role === 'student') {
    return { canAccess: true, reason: 'student', level: track, showAll: false, isPending: false, loading: false };
  }

  if (role === 'teacher') {
    if (!is_approved_teacher) {
      return { canAccess: false, reason: 'pending_approval', level: null, showAll: false, isPending: true, loading: false };
    }
    if (approved_track === 'ALL') {
      return { canAccess: true, reason: 'approved_teacher_all', level: null, showAll: true, isPending: false, loading: false };
    }
    return { canAccess: true, reason: 'approved_teacher', level: approved_track || track, showAll: false, isPending: false, loading: false };
  }

  return { canAccess: false, reason: 'unknown', level: null, showAll: false, isPending: false, loading: false };
}
