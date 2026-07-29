 import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { getUser, signin, signout, getProfile } from '../api/client';
import { Navigate, useLocation } from 'react-router-dom';
import { FaSpinner } from 'react-icons/fa6';

export const AuthContext = createContext(null);

const SESSION_REFRESH_INTERVAL = 12 * 60 * 1000;
const INACTIVITY_TIMEOUT = 30 * 60 * 1000;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const refreshIntervalRef = useRef(null);
  const inactivityTimeoutRef = useRef(null);
  const lastActivityRef = useRef(Date.now());

  const checkAuth = useCallback(async () => {
    try {
      const data = await getUser();
      if (data?.user) {
        const profileData = await getProfile();
        setUser({
          ...data.user,
          profile: profileData || {
            role: 'student',
            track: null,
            class_name: null,
            onboarding_completed: false,
            is_approved_teacher: false,
            approved_track: null,
            approval_notes: null
          }
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
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
      if (inactivityTimeoutRef.current) clearTimeout(inactivityTimeoutRef.current);
      return;
    }

    refreshIntervalRef.current = setInterval(() => {
      const timeSinceLastActivity = Date.now() - lastActivityRef.current;
      if (timeSinceLastActivity < INACTIVITY_TIMEOUT) {
        checkAuth();
      }
    }, SESSION_REFRESH_INTERVAL);

    const resetInactivityTimer = () => {
      lastActivityRef.current = Date.now();

      if (inactivityTimeoutRef.current) {
        clearTimeout(inactivityTimeoutRef.current);
      }

      inactivityTimeoutRef.current = setTimeout(() => {
        setUser(null);
      }, INACTIVITY_TIMEOUT);
    };

    const events = ['mousedown', 'keydown', 'touchstart', 'mousemove'];
    events.forEach(event => {
      window.addEventListener(event, resetInactivityTimer, { passive: true });
    });

    resetInactivityTimer();

    return () => {
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
      if (inactivityTimeoutRef.current) clearTimeout(inactivityTimeoutRef.current);
      events.forEach(event => {
        window.removeEventListener(event, resetInactivityTimer);
      });
    };
  }, [user, checkAuth]);

  const login = useCallback(async (email, password, turnstileToken, mfaCode) => {
    const result = await signin(email, password, turnstileToken, mfaCode);
    if (result?.mfa_required) {
      return result;
    }
    await checkAuth();
    return result;
  }, [checkAuth]);

  const logout = useCallback(async () => {
    if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
    if (inactivityTimeoutRef.current) clearTimeout(inactivityTimeoutRef.current);
    try {
      await signout();
    } catch {}
    setUser(null);
  }, []);

  const refresh = useCallback(async () => {
    await checkAuth();
  }, [checkAuth]);

  const value = {
    user,
    loading,
    isAuthenticated: !!user,
    login,
    logout,
    refresh,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

export function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="protected-loading">
        <FaSpinner className="icon-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!user.profile?.onboarding_completed && location.pathname !== '/onboarding' && location.pathname !== '/profile') {
    return <Navigate to="/onboarding" replace />;
  }

  if (user.profile?.role === 'teacher' && !user.profile?.is_approved_teacher && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  return children;
}
