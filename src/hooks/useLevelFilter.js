import { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';

export function useLevelFilter() {
  const { user } = useAuth();

  return useMemo(() => {
    if (!user?.profile) {
      return { level: null, class_name: null, showAll: false, isAdmin: false };
    }

    const profile = user.profile;

    if (profile.role === 'student') {
      return {
        level: profile.track,
        class_name: profile.class_name,
        showAll: false,
        isAdmin: false
      };
    }

    if (profile.role === 'teacher') {
      if (!profile.is_approved_teacher) {
        return { level: null, class_name: null, showAll: false, isAdmin: false };
      }

      if (profile.approved_track === 'ALL') {
        return {
          level: null,
          class_name: null,
          showAll: true,
          isAdmin: false
        };
      }

      return {
        level: profile.approved_track || profile.track,
        class_name: profile.class_name,
        showAll: false,
        isAdmin: false
      };
    }

    return { level: null, class_name: null, showAll: false, isAdmin: false };
  }, [user]);
}
