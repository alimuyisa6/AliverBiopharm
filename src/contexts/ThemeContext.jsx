import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

const ThemeContext = createContext(null);

const LEVEL_THEMES = {
  'O-Level': {
    primary: 'var(--clr-cyan)',
    secondary: 'var(--clr-cyan-light)',
    accent: 'var(--clr-magenta)',
    gradient: 'var(--gradient-cyan)',
    badge: 'var(--badge-cyan)',
    icon: 'fa-seedling',
    label: 'O-Level',
    color: '#0a7e7e'
  },
  'A-Level': {
    primary: 'var(--clr-magenta)',
    secondary: 'var(--clr-magenta-light)',
    accent: 'var(--clr-blue)',
    gradient: 'var(--gradient-magenta)',
    badge: 'var(--badge-magenta)',
    icon: 'fa-flask',
    label: 'A-Level',
    color: '#b8873a'
  },
  'Pharmacy': {
    primary: 'var(--clr-green)',
    secondary: 'var(--clr-green-light)',
    accent: 'var(--clr-purple)',
    gradient: 'var(--gradient-green)',
    badge: 'var(--badge-green)',
    icon: 'fa-capsules',
    label: 'Pharmacy',
    color: '#10b981'
  }
};

export function ThemeProvider({ children }) {
  const { user } = useAuth();
  const [levelTheme, setLevelTheme] = useState(null);
  const [currentLevel, setCurrentLevel] = useState(null);

  useEffect(() => {
    const track = user?.profile?.track;
    if (track && LEVEL_THEMES[track]) {
      setLevelTheme(LEVEL_THEMES[track]);
      setCurrentLevel(track);
      document.body.className = `level-${track.toLowerCase().replace('-', '')}`;
    } else {
      setLevelTheme(null);
      setCurrentLevel(null);
      document.body.className = '';
    }
  }, [user?.profile?.track]);

  const value = {
    levelTheme,
    currentLevel,
    themes: LEVEL_THEMES,
    getTheme: (level) => LEVEL_THEMES[level] || null
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
