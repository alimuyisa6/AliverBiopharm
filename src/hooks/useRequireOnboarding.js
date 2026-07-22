import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function useRequireOnboarding() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      navigate('/login', { replace: true });
      return;
    }

    if (!user.profile?.onboarding_completed) {
      navigate('/onboarding', { replace: true });
      return;
    }

    if (user.profile?.role === 'teacher' && !user.profile?.is_approved_teacher) {
      navigate('/onboarding', { replace: true });
      return;
    }
  }, [user, loading, navigate]);

  return { user, loading, isReady: !loading && user?.profile?.onboarding_completed };
}
