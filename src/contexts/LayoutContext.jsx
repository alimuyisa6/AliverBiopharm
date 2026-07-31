/* contexts/LayoutContext.jsx */
import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { bootstrapPlatform, switchClass } from '../api/cachedClient';

export const LayoutContext = createContext(null);

export function LayoutProvider({ children }) {
  const { user, loading: authLoading, refresh } = useAuth();
  const [bootstrap, setBootstrap] = useState(null);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');

  const effectiveLevel = user?.profile?.active_level_id || user?.profile?.track || 'O-Level';
  const activeGroupId = user?.profile?.active_group_id || null;

  useEffect(() => {
    if (theme === 'dark') {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    setLoading(true);
    bootstrapPlatform(effectiveLevel)
      .then(setBootstrap)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [effectiveLevel, activeGroupId]);

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === 'light' ? 'dark' : 'light'));
  }, []);

  const handleSwitchClass = useCallback(async (groupId) => {
    setSwitching(true);
    try {
      await switchClass(groupId);
      await refresh();
    } finally {
      setSwitching(false);
    }
  }, [refresh]);

  const value = useMemo(() => {
    const isReady = !loading && !authLoading;
    if (!isReady || !bootstrap) {
      return {
        loading: true, bootstrap: null,logo: null, siteName: 'AliverBiopharm', navigation: [],
        footer: { quick_links: [], resource_links: [], community_links: [], social_links: {} },
        groups: [], level: null, user, isAuthenticated: !!user,
        colorTheme: {}, theme, toggleTheme, authLoading,
        refreshUser: refresh, switchClass: handleSwitchClass, switching, activeGroupId,
      };
    }

    return {
      loading: false,
      bootstrap,
      logo: bootstrap.universal?.logo_url || null,
      siteName: bootstrap.universal?.site_name || 'AliverBiopharm',
      navigation: bootstrap.header?.nav_items || [],
      footer: bootstrap.footer || { quick_links: [], resource_links: [], community_links: [], social_links: {} },
      groups: bootstrap.groups || [],
      level: bootstrap.level,
      user,
      isAuthenticated: !!user,
      colorTheme: bootstrap.theme || {},
      theme,
      toggleTheme,
      authLoading,
      refreshUser: refresh,
      switchClass: handleSwitchClass,
      switching,
      activeGroupId,
    };
  }, [bootstrap, loading, authLoading, user, theme, toggleTheme, refresh, handleSwitchClass, switching, activeGroupId]);

  return (
    <LayoutContext.Provider value={value}>
      {children}
    </LayoutContext.Provider>
  );
}

export function useLayout() {
  const ctx = useContext(LayoutContext);
  if (!ctx) throw new Error('useLayout must be used within LayoutProvider');
  return ctx;
} 
