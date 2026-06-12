import React, { createContext, useContext, useState, useEffect } from 'react';
import { getUser, signout } from '../api/client';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const data = await getUser();
      setUser(data.user || null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    await signout();
    setUser(null);
  }

  return React.createElement(AuthContext.Provider, { value: { user, loading, logout, refresh: checkAuth } }, children);
}

export function useAuth() {
  return useContext(AuthContext);
}

export function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading">Loading...</div>;
  if (!user) {
    window.location.href = '/login';
    return null;
  }
  return children;
}
