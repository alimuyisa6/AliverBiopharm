 /* contexts/LayoutContext.jsx */
import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { bootstrapPlatform, switchClass } from '../api/cachedClient';
import { getAllSiteSections } from '../api/client';
import { getCachedStale } from '../utils/cache';

export const LayoutContext = createContext(null);

export function LayoutProvider({ children }) {
  const { user, loading: authLoading, refresh } = useAuth();

  const effectiveLevel = user?.profile?.active_level_id || user?.profile?.track || null;
  const activeGroupId = user?.profile?.active_group_id || null;

  const [bootstrap, setBootstrap] = useState(() => {
    if (!effectiveLevel) return null;
    return getCachedStale(`bootstrap_${effectiveLevel}`);
  });

  const [loading, setLoading] = useState(() => {
    if (!effectiveLevel) return false;
    return !getCachedStale(`bootstrap_${effectiveLevel}`);
  });

  const [switching, setSwitching] = useState(false);
  const [theme, setTheme] = useState('light');
  const [sections, setSections] = useState(() => getCachedStale('site_sections') || {});

  useEffect(() => {
    if (document.documentElement) {
      const storedTheme = document.documentElement.getAttribute('data-theme') || 'light';
      setTheme(storedTheme);
    }
  }, []);

  useEffect(() => {
    document.body.classList.toggle('dark-mode', theme === 'dark');
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    if (!effectiveLevel) {
      setBootstrap(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const cachedBootstrap = getCachedStale(`bootstrap_${effectiveLevel}`);
    const cachedSections = getCachedStale('site_sections');

    if (cachedBootstrap) {
      setBootstrap(cachedBootstrap);
      setLoading(false);
    } else {
      setLoading(true);
    }

    if (cachedSections) setSections(cachedSections);

    Promise.allSettled([
      bootstrapPlatform(effectiveLevel),
      getAllSiteSections()
    ])
      .then(([bootstrapResult, sectionsResult]) => {
        if (cancelled) return;

        if (bootstrapResult.status === 'fulfilled') {
          setBootstrap(bootstrapResult.value);
        }

        if (sectionsResult.status === 'fulfilled') {
          setSections(sectionsResult.value || {});
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
    setTheme((current) => {
      const next = current === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', next);
      return next;
    });
  }, []);

  const handleSwitchClass = useCallback(async (groupId) => {
    setSwitching(true);

    try {
      await switchClass(groupId);
      await refresh();
    } catch (error) {
      console.error('[SWITCH_CLASS_ERROR]', error?.message || 'Failed to switch class');
      throw new Error('We could not update your class. Please try again.');
    } finally {
      setSwitching(false);
    }
  }, [refresh]);

  const value = useMemo(() => {
    const platformConfig = bootstrap?.platform || null;

    const safeFeatures = {};
    const safeFeatureKeys = [
      'recall',
      'videos',
      'quizzes',
      'articles',
      'glossary',
      'community',
      'donations',
      'classrooms',
      'flashcards',
      'past_papers',
      'lab_simulations'
    ];

    for (const key of safeFeatureKeys) {
      safeFeatures[key] = platformConfig?.features_enabled?.[key] ?? true;
    }

    const uiComponents = bootstrap?.ui_components || [];
    const uiMap = {};

    for (const component of uiComponents) {
      if (component?.component_key) {
        const { properties = {}, component_type = null } = component;
        const safeProperties = {};

        for (const key of Object.keys(properties)) {
          if (['icon', 'label', 'color', 'variant', 'size'].includes(key)) {
            safeProperties[key] = properties[key];
          }
        }

        uiMap[component.component_key] = {
          ...safeProperties,
          component_type
        };
      }
    }

    const baseNav = bootstrap?.header?.nav_items || [];

    const mergedNavigation = [
      ...baseNav,
      ...(platformConfig?.primary_nav || []).map((item, index) => ({
        label: item?.label || '',
        href: item?.href || '',
        icon: item?.icon || null,
        auth_required: item?.auth_required ?? false,
        position: baseNav.length + index
      })),
      ...(platformConfig?.secondary_nav || []).map((item, index) => ({
        label: item?.label || '',
        href: item?.href || '',
        icon: item?.icon || null,
        auth_required: item?.auth_required ?? false,
        position: baseNav.length + (platformConfig?.primary_nav?.length || 0) + index
      }))
    ].sort((a, b) => (a.position || 0) - (b.position || 0));

    if (!bootstrap) {
      return {
        loading: false,
        bootstrap: null,
        logo: null,
        siteName: 'AliverBiopharm',
        navigation: [],
        footer: { quick_links: [], resource_links: [], community_links: [], social_links: {} },
        groups: [],
        level: null,
        user,
        isAuthenticated: !!user,
        colorTheme: {},
        theme,
        toggleTheme,
        authLoading,
        refreshUser: refresh,
        switchClass: handleSwitchClass,
        switching,
        activeGroupId,
        sections,
        features: safeFeatures,
        uiMap: {},
        platform: null
      };
    }

    return {
      loading: false,
      bootstrap,
      logo: bootstrap.universal?.logo_url || null,
      siteName: bootstrap.universal?.site_name || platformConfig?.site_name || 'AliverBiopharm',
      navigation: mergedNavigation,
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
      features: safeFeatures,
      uiMap,
      platform: platformConfig
    };
  }, [
    bootstrap,
    loading,
    authLoading,
    user,
    theme,
    toggleTheme,
    refresh,
    handleSwitchClass,
    switching,
    activeGroupId,
    sections
  ]);

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
