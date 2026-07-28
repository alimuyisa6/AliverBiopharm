 import { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLayout } from '../contexts/LayoutContext';

export function useLevelFilter() {
  const { user } = useAuth();
  const { groups, level, platform } = useLayout();

  return useMemo(() => {
    if (!user?.profile || !groups) {
      return {
        level: null,
        class_name: null,
        showAll: false,
        isAdmin: false,
        config: null,
        displayName: null,
        classLabel: platform?.group_label || 'Class',
        classOptions: [],
      };
    }

    const profile = user.profile;
    const config = platform || {};

    if (profile.role === 'student') {
      return {
        level: profile.track,
        class_name: profile.class_name,
        showAll: false,
        isAdmin: false,
        config,
        displayName: level?.display_name || profile.track,
        classLabel: config.group_label || 'Class',
        classOptions: groups.map(g => g.name),
      };
    }

    if (profile.role === 'teacher') {
      if (!profile.is_approved_teacher) {
        return {
          level: null,
          class_name: null,
          showAll: false,
          isAdmin: false,
          config: null,
          displayName: null,
          classLabel: 'Class',
          classOptions: [],
        };
      }
      if (profile.approved_track === 'ALL') {
        return {
          level: null,
          class_name: null,
          showAll: true,
          isAdmin: false,
          config: null,
          displayName: 'All Levels',
          classLabel: 'Class',
          classOptions: [],
        };
      }
      const teacherTrack = profile.approved_track || profile.track;
      return {
        level: teacherTrack,
        class_name: profile.class_name,
        showAll: false,
        isAdmin: false,
        config: platform,
        displayName: level?.display_name || teacherTrack,
        classLabel: config.group_label || 'Class',
        classOptions: groups.filter(g => g.level_id === teacherTrack).map(g => g.name),
      };
    }

    return {
      level: null,
      class_name: null,
      showAll: false,
      isAdmin: false,
      config: null,
      displayName: null,
      classLabel: 'Class',
      classOptions: [],
    };
  }, [user, groups, level, platform]);
}
