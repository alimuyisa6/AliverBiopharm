 import React, { createContext, useContext, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { useLayout } from './LayoutContext';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const { user } = useAuth();
  const { primaryColor, accentColor, fontFamily, levelIcon } = useLayout();

  const levelTheme = useMemo(() => {
    if (!user?.profile?.track) return null;
    return {
      primary: primaryColor,
      secondary: accentColor,
      font: fontFamily,
      icon: levelIcon,
      label: user.profile.track,
    };
  }, [user, primaryColor, accentColor, fontFamily, levelIcon]);

  const currentLevel = user?.profile?.track || null;

  const value = {
    levelTheme,
    currentLevel,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}
