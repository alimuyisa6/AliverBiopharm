 /* contexts/AuthContext.jsx */
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getUser, signin, signout } from '../api/client';
import Spinner from '../components/Spinner/Spinner';

export const AuthContext = createContext(null);

const REFRESH_INTERVAL = 12 * 60 * 1000;
const INACTIVITY_TIMEOUT = 30 * 60 * 1000;

const DEFAULT_PROFILE = {
  role: 'student',
  track: null,
  class_name: null,
  onboarding_completed: false,
  is_approved_teacher: false,
  approved_track: null
};

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
        setUser({
          ...data.user,
          profile: data.user.profile || DEFAULT_PROFILE
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

      inactivityRef.current = setTimeout(() => {
        signout().catch(() => {});
        setUser(null);
      }, INACTIVITY_TIMEOUT);
    };

    ['mousedown', 'keydown', 'touchstart', 'mousemove'].forEach((event) => {
      window.addEventListener(event, resetTimer, { passive: true });
    });

    resetTimer();

    return () => {
      ['mousedown', 'keydown', 'touchstart', 'mousemove'].forEach((event) => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [user, checkAuth]);

  const login = useCallback(async (email, password, turnstileToken, mfaCode) => {
    const result = await signin(email, password, turnstileToken, mfaCode);

    if (result?.mfa_required || result?.passkey_required) return result;

    await checkAuth();

    return result;
  }, [checkAuth]);

  const logout = useCallback(async () => {
    clearInterval(refreshRef.current);
    clearTimeout(inactivityRef.current);

    try {
      await signout();
    } catch {}

    setUser(null);
  }, []);

  const refresh = useCallback(() => checkAuth(), [checkAuth]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: !!user,
        login,
        logout,
        refresh
      }}
    >
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

  useEffect(() => {
    if (loading) return;

    if (!user) {
      navigate('/login', { replace: true, state: { from: location } });
    }
  }, [user, loading, location.pathname, navigate]);

  if (loading) {
    return (
      <div className="fcd-loading-wrap">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!user) return null;

  return children;
}
