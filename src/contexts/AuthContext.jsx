/* contexts/AuthContext.jsx */
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getUser, signin, signout, getProfile } from '../api/client';
import Spinner from '../components/Spinner/Spinner';

export const AuthContext = createContext(null);

const REFRESH_INTERVAL = 12 * 60 * 1000;
const INACTIVITY_TIMEOUT = 30 * 60 * 1000;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const refreshRef = useRef(null);
  const inactivityRef = useRef(null);
  const lastActivityRef = useRef(Date.now());

  const checkAuth = useCallback(async () => {
    try {
      const data = await getUser();
      if (data?.user) {
        const profile = await getProfile();
        setUser({
          ...data.user,
          profile: profile || {
            role: 'student',
            track: null,
            class_name: null,
            onboarding_completed: false,
            is_approved_teacher: false,
            approved_track: null,
          },
        });
        lastActivityRef.current = Date.now();
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (!user) {
      clearInterval(refreshRef.current);
      clearTimeout(inactivityRef.current);
      return;
    }

    refreshRef.current = setInterval(() => {
      if (Date.now() - lastActivityRef.current < INACTIVITY_TIMEOUT) {
        checkAuth();
      }
    }, REFRESH_INTERVAL);

    const resetTimer = () => {
      lastActivityRef.current = Date.now();
      clearTimeout(inactivityRef.current);
      inactivityRef.current = setTimeout(() => setUser(null), INACTIVITY_TIMEOUT);
    };

    ['mousedown', 'keydown', 'touchstart', 'mousemove'].forEach((ev) =>
      window.addEventListener(ev, resetTimer, { passive: true })
    );

    resetTimer();

    return () => {
      ['mousedown', 'keydown', 'touchstart', 'mousemove'].forEach((ev) =>
        window.removeEventListener(ev, resetTimer)
      );
    };
  }, [user, checkAuth]);

  const login = useCallback(async (email, password, turnstileToken, mfaCode) => {
    const result = await signin(email, password, turnstileToken, mfaCode);
    if (result?.mfa_required) return result;
    await checkAuth();
    return result;
  }, [checkAuth]);

  const logout = useCallback(async () => {
    clearInterval(refreshRef.current);
    clearTimeout(inactivityRef.current);
    try { await signout(); } catch {}
    setUser(null);
  }, []);

  const refresh = useCallback(() => checkAuth(), [checkAuth]);

  return (
    <AuthContext.Provider value={{ user, loading, isAuthenticated: !!user, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <Spinner size="lg" />
      </div>
    );
  }

  if (!user) {
    navigate('/login', { replace: true, state: { from: location } });
    return null;
  }

  if (!user.profile?.onboarding_completed && location.pathname !== '/onboarding') {
    navigate('/onboarding', { replace: true });
    return null;
  }

  if (user.profile?.role === 'teacher' && !user.profile?.is_approved_teacher && location.pathname !== '/onboarding') {
    navigate('/onboarding', { replace: true });
    return null;
  }

  return children;
} 
