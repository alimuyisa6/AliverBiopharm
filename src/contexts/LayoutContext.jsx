 /* contexts/LayoutContext.jsx */
import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { bootstrapPlatform, switchClass } from '../api/cachedClient';
import { getAllSiteSections } from '../api/client';
import { getCachedStale } from '../utils/cache';

export const LayoutContext = createContext(null);

const KNOWN_LEVEL_KEY = 'known_level';

function getKnownLevel() {
  try {
    return localStorage.getItem(KNOWN_LEVEL_KEY) || 'O-Level';
  } catch {
    return 'O-Level';
  }
}

function setKnownLevel(level) {
  try {
    if (level) localStorage.setItem(KNOWN_LEVEL_KEY, level);
  } catch {
  }
}

export function LayoutProvider({ children }) {
  const { user, loading: authLoading, refresh } = useAuth();

  const effectiveLevel = user?.profile?.active_level_id || user?.profile?.track || getKnownLevel();
  const activeGroupId = user?.profile?.active_group_id || null;

  const [bootstrap, setBootstrap] = useState(() => getCachedStale(`bootstrap_${effectiveLevel}`));
  const [loading, setLoading] = useState(() => !getCachedStale(`bootstrap_${effectiveLevel}`));
  const [switching, setSwitching] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
  const [sections, setSections] = useState(() => getCachedStale('site_sections') || {});

  useEffect(() => {
    setKnownLevel(effectiveLevel);
  }, [effectiveLevel]);

  useEffect(() => {
    if (theme === 'dark') {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    let cancelled = false;

    const cachedBootstrap = getCachedStale(`bootstrap_${effectiveLevel}`);
    const cachedSections = getCachedStale('site_sections');

    if (cachedBootstrap) {
      setBootstrap(cachedBootstrap);
      setLoading(false);
    } else {
      setLoading(true);
    }
    if (cachedSections) {
      setSections(cachedSections);
    }

    Promise.allSettled([
      bootstrapPlatform(effectiveLevel),
      getAllSiteSections()
    ])
      .then(([bootstrapResult, sectionsResult]) => {
        if (cancelled) return;
        if (bootstrapResult.status === 'fulfilled') {
          setBootstrap(bootstrapResult.value);
        } else {
          console.error('bootstrapPlatform failed', bootstrapResult.reason);
        }
        if (sectionsResult.status === 'fulfilled') {
          setSections(sectionsResult.value || {});
        } else {
          console.error('getAllSiteSections failed', sectionsResult.reason);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
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
    const isReady = !authLoading && (!loading || !!bootstrap);
    if (!isReady || !bootstrap) {
      return {
        loading: true, bootstrap: null, logo: null, siteName: 'AliverBiopharm', navigation: [],
        footer: { quick_links: [], resource_links: [], community_links: [], social_links: {} },
        groups: [], level: null, user, isAuthenticated: !!user,
        colorTheme: {}, theme, toggleTheme, authLoading,
        refreshUser: refresh, switchClass: handleSwitchClass, switching, activeGroupId,
        sections,
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
      sections,
    };
  }, [bootstrap, loading, authLoading, user, theme, toggleTheme, refresh, handleSwitchClass, switching, activeGroupId, sections]);

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
