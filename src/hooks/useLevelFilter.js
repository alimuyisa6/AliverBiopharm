 import { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';

const LEVEL_CONFIG = {
  'O-Level': {
    displayName: 'Secondary School Biology',
    classLabel: 'Class',
    options: ['Form 1', 'Form 2', 'Form 3', 'Form 4'],
    icon: 'fa-seedling',
    color: '#0a7e7e'
  },
  'A-Level': {
    displayName: 'Advanced Secondary Biology',
    classLabel: 'Class',
    options: ['Form 5', 'Form 6'],
    icon: 'fa-flask',
    color: '#b8873a'
  },
  'Pharmacy': {
    displayName: 'Pharmacy & Pharmaceutical Sciences',
    classLabel: 'Programme',
    options: ['Certificate', 'Diploma', 'Degree'],
    icon: 'fa-capsules',
    color: '#10b981'
  }
};

export function useLevelFilter() {
  const { user } = useAuth();

  return useMemo(() => {
    if (!user?.profile) {
      return {
        level: null,
        class_name: null,
        showAll: false,
        isAdmin: false,
        config: null,
        displayName: null,
        classLabel: 'Class',
        classOptions: []
      };
    }

    const profile = user.profile;
    const config = LEVEL_CONFIG[profile.track] || null;

    if (profile.role === 'student') {
      return {
        level: profile.track,
        class_name: profile.class_name,
        showAll: false,
        isAdmin: false,
        config,
        displayName: config?.displayName || profile.track,
        classLabel: config?.classLabel || 'Class',
        classOptions: config?.options || []
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
          classOptions: []
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
          classOptions: []
        };
      }

      const teacherConfig = LEVEL_CONFIG[profile.approved_track || profile.track] || null;
      return {
        level: profile.approved_track || profile.track,
        class_name: profile.class_name,
        showAll: false,
        isAdmin: false,
        config: teacherConfig,
        displayName: teacherConfig?.displayName || profile.track,
        classLabel: teacherConfig?.classLabel || 'Class',
        classOptions: teacherConfig?.options || []
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
      classOptions: []
    };
  }, [user]);
}
