import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getAllSiteSections } from '../api/cachedClient';
import { getUser } from '../api/client';

const LayoutContext = createContext(null);

export function useLayout() {
  const context = useContext(LayoutContext);
  if (!context) throw new Error('useLayout must be used within LayoutProvider');
  return context;
}

export function LayoutProvider({ children }) {
  const [sections, setSections] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  const toggleTheme = useCallback(() => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('theme', next);
      return next;
    });
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const data = await getUser();
      setUser(data?.user || null);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    Promise.all([getAllSiteSections(), refreshUser()])
      .then(([data]) => setSections(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [refreshUser]);

  useEffect(() => {
    document.body.classList.toggle('dark-mode', theme === 'dark');
    document.body.classList.toggle('light-mode', theme !== 'dark');
  }, [theme]);

  const value = {
    sections,
    user,
    loading,
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
