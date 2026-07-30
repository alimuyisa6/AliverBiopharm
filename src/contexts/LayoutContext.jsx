import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { bootstrapPlatform, switchClass as switchClassApi } from '../api/cachedClient';

const LayoutContext = createContext(null);

const DEFAULT_COLOR_THEME = {
  theme: { primary_color: '#0a7e7e' },
  navigation: {},
  search_config: {},
  branding: {},
  features: {}
};

export function useLayout() {
  const context = useContext(LayoutContext);
  if (!context) throw new Error('useLayout must be used within LayoutProvider');
  return context;
}

export function LayoutProvider({ children }) {
  const [bootstrap, setBootstrap] = useState(null);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const { user, loading: authLoading, refresh } = useAuth();

  const effectiveLevel = user?.profile?.active_level_id || user?.profile?.track || 'O-Level';
  const activeGroupId = user?.profile?.active_group_id || null;

  useEffect(() => {
    setLoading(true);
    bootstrapPlatform(effectiveLevel)
      .then(data => setBootstrap(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [effectiveLevel, activeGroupId]);

  const switchClass = useCallback(async (groupId) => {
    setSwitching(true);
    try {
      await switchClassApi(groupId);
      await refresh();
    } finally {
      setSwitching(false);
    }
  }, [refresh]);

  const value = useMemo(() => {
    const isReady = !loading && !authLoading;
    const fallback = {
      universal: null,
      logo: null,
      platform: null,
      header: {},
      footer: {},
      landing: null,
      onboardingConfig: null,
      groups: [],
      level: null,
      user,
      isAuthenticated: !!user,
      primaryColor: '#0a7e7e',
      accentColor: '#b8873a',
      fontFamily: 'Inter',
      levelIcon: 'fa-seedling',
      navItems: [],
      navigation: [],
      socialLinks: [],
      footerLinks: [],
      colorTheme: DEFAULT_COLOR_THEME,
      authLoading,
      refreshUser: refresh,
      switchClass,
      switching,
      activeGroupId
    };

    if (!isReady || !bootstrap) return fallback;

    const colorTheme = bootstrap.theme || DEFAULT_COLOR_THEME;
    const themeColors = colorTheme.theme || {};

    return {
      loading: false,
      universal: bootstrap.universal,
      logo: bootstrap.universal?.logo_url,
      platform: bootstrap.platform,
      header: bootstrap.header || {},
      footer: bootstrap.footer || {},
      landing: bootstrap.landing,
      onboardingConfig: bootstrap.onboarding_config,
      groups: bootstrap.groups || [],
      level: bootstrap.level,
      user,
      isAuthenticated: !!user,
      primaryColor: themeColors.primary_color || bootstrap.platform?.primary_color || '#0a7e7e',
      accentColor: themeColors.accent_color || bootstrap.platform?.accent_color || '#b8873a',
      fontFamily: themeColors.font_family || bootstrap.platform?.font_family || 'Inter',
      levelIcon: bootstrap.level?.icon || 'fa-seedling',
      navItems: bootstrap.header?.nav_items || [],
      navigation: bootstrap.header?.nav_items || [],
      socialLinks: bootstrap.footer?.social_links || {},
      footerLinks: bootstrap.footer?.quick_links || [],
      colorTheme,
      authLoading,
      refreshUser: refresh,
      switchClass,
      switching,
      activeGroupId
    };
  }, [bootstrap, loading, authLoading, user, refresh, switchClass, switching, activeGroupId]);

  return (
    <LayoutContext.Provider value={value}>
      {children}
    </LayoutContext.Provider>
  );
} 
