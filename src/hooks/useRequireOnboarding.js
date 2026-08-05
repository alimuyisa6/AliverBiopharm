/* hooks/useRequireOnboarding.js */
import { useAuth } from '../contexts/AuthContext';

export function useRequireOnboarding() {
  const { user, loading } = useAuth();

  return { user, loading, isReady: !loading && user?.profile?.onboarding_completed };
}
