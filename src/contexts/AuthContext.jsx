 import React, { createContext, useContext, useState, useEffect } from 'react';
import { getUser, signout } from '../api/client';
import { Navigate } from 'react-router-dom';
import { LoadingContext } from '../loading/LoadingProvider';

export const AuthContext = createContext();

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

  return (
    <AuthContext.Provider value={{ user, loading, logout, refresh: checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
}
