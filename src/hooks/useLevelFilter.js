 /* hooks/useLevelFilter.js */
import { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLayout } from '../contexts/LayoutContext';

export function useLevelFilter() {
  const { user } = useAuth();
  const { groups, level } = useLayout();

  return useMemo(() => {
    if (!user?.profile || !groups) {
      return { level: null, class_name: null, showAll: false, displayName: null, classLabel: 'Class' };
    }

    const { role, track, class_name, is_approved_teacher, approved_track } = user.profile;

    if (role === 'student') {
      return {
        level: track,
        class_name,
        showAll: false,
        displayName: level?.display_name || track,
        classLabel: level?.group_label || 'Class',
      };
    }

    if (role === 'teacher') {
      if (!is_approved_teacher) {
        return { level: null, class_name: null, showAll: false, displayName: null, classLabel: 'Class' };
      }
      if (approved_track === 'ALL') {
        return { level: null, class_name: null, showAll: true, displayName: 'All Levels', classLabel: 'Class' };
      }
      const teacherTrack = approved_track || track;
      return {
        level: teacherTrack,
        class_name,
        showAll: false,
        displayName: level?.display_name || teacherTrack,
        classLabel: level?.group_label || 'Class',
      };
    }

    return { level: null, class_name: null, showAll: false, displayName: null, classLabel: 'Class' };
  }, [user, groups, level]);
}
