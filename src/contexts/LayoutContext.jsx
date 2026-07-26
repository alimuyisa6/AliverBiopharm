 import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getAllSiteSections } from '../api/cachedClient';
import { useAuth } from './AuthContext';

const LayoutContext = createContext(null);

export function useLayout() {
  const context = useContext(LayoutContext);
  if (!context) throw new Error('useLayout must be used within LayoutProvider');
  return context;
}

export function LayoutProvider({ children }) {
  const [sections, setSections] = useState(null);
  const [sectionsLoading, setSectionsLoading] = useState(true);
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  const { user, loading: authLoading, refresh: refreshUser } = useAuth();

  const toggleTheme = useCallback(() => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('theme', next);
      return next;
    });
  }, []);

  useEffect(() => {
    getAllSiteSections()
      .then(setSections)
      .catch(() => {})
      .finally(() => setSectionsLoading(false));
  }, []);

  useEffect(() => {
    document.body.classList.toggle('dark-mode', theme === 'dark');
    document.body.classList.toggle('light-mode', theme !== 'dark');
  }, [theme]);

  const value = {
    sections,
    user,
    loading: sectionsLoading || authLoading,
    authLoading,
    theme,
    toggleTheme,
    refreshUser,
    isAuthenticated: !!user,
    logo: sections?.site_config?.logo_url,
    siteName: sections?.site_config?.site_name || 'AliverBiopharm',
    navigation: sections?.navigation?.links || [],
    footer: sections?.footer || { social_links: [], columns: [] },
  };

  return <LayoutContext.Provider value={value}>{children}</LayoutContext.Provider>;
}
