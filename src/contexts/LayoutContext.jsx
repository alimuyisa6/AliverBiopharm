 import { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { bootstrapPlatform } from '../api/cachedClient';

const LayoutContext = createContext(null);

export function useLayout() {
  const context = useContext(LayoutContext);
  if (!context) throw new Error('useLayout must be used within LayoutProvider');
  return context;
}

export function LayoutProvider({ children }) {
  const [bootstrap, setBootstrap] = useState(null);
  const [loading, setLoading] = useState(true);
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    const level = user?.profile?.track || 'O-Level';
    bootstrapPlatform(level)
      .then(data => setBootstrap(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user?.profile?.track]);

  const value = {
    loading: loading || authLoading,
    universal: bootstrap?.universal,
    logo: bootstrap?.universal?.logo_url,
    platform: bootstrap?.platform,
    header: bootstrap?.header,
    footer: bootstrap?.footer,
    landing: bootstrap?.landing,
    onboardingConfig: bootstrap?.onboarding_config,
    groups: bootstrap?.groups || [],
    level: bootstrap?.level,
    user,
    isAuthenticated: !!user,
    primaryColor: bootstrap?.platform?.primary_color || '#0a7e7e',
    accentColor: bootstrap?.platform?.accent_color || '#b8873a',
    fontFamily: bootstrap?.platform?.font_family || 'Inter',
    levelIcon: bootstrap?.level?.icon || 'fa-seedling',
  };

  return <LayoutContext.Provider value={value}>{children}</LayoutContext.Provider>;
}
