 // src/contexts/AuthContext.jsx
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getUser, signin, signout, getProfile } from '../api/client';
import { Navigate, useLocation } from 'react-router-dom';
import { FaSpinner } from 'react-icons/fa6';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const data = await getUser();
      if (data?.user) {
        const profileData = await getProfile();
        setUser({ ...data.user, profile: profileData || { role: 'student', track: null, class_name: null, onboarding_completed: false } });
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

  const login = useCallback(async (email, password, turnstileToken) => {
    await signin(email, password, turnstileToken);
    await checkAuth();
  }, [checkAuth]);

  const logout = useCallback(async () => {
    await signout();
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
      <div style={{ minHeight: '40vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <FaSpinner className="icon-spin" size={28} color="var(--clr-cyan)" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!user.profile?.onboarding_completed && location.pathname !== '/onboarding' && location.pathname !== '/profile') {
    return <Navigate to="/onboarding" replace />;
  }

  return children;
}
