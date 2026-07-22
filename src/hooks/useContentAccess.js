import { useAuth } from '../contexts/AuthContext';

export function useContentAccess() {
  const { user } = useAuth();

  if (!user?.profile) {
    return {
      canAccess: false,
      reason: 'no_profile',
      level: null,
      showAll: false,
      isTeacher: false,
      isStudent: false,
      isPending: false,
      isApproved: false
    };
  }

  const profile = user.profile;
  const isStudent = profile.role === 'student';
  const isTeacher = profile.role === 'teacher';
  const isApproved = profile.is_approved_teacher === true;
  const track = profile.track;
  const approvedTrack = profile.approved_track;

  if (isStudent) {
    return {
      canAccess: true,
      reason: 'student',
      level: track,
      showAll: false,
      isTeacher: false,
      isStudent: true,
      isPending: false,
      isApproved: false
    };
  }

  if (isTeacher) {
    if (!isApproved) {
      return {
        canAccess: false,
        reason: 'pending_approval',
        level: null,
        showAll: false,
        isTeacher: true,
        isStudent: false,
        isPending: true,
        isApproved: false
      };
    }

    if (approvedTrack === 'ALL') {
      return {
        canAccess: true,
        reason: 'approved_teacher_all',
        level: null,
        showAll: true,
        isTeacher: true,
        isStudent: false,
        isPending: false,
        isApproved: true
      };
    }

    return {
      canAccess: true,
      reason: 'approved_teacher',
      level: approvedTrack || track,
      showAll: false,
      isTeacher: true,
      isStudent: false,
      isPending: false,
      isApproved: true
    };
  }

  return {
    canAccess: false,
    reason: 'unknown',
    level: null,
    showAll: false,
    isTeacher: false,
    isStudent: false,
    isPending: false,
    isApproved: false
  };
}
