import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiCall } from '../services/apiService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      const data = await apiCall('get_user');
      setUser(data?.user || null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
    const interval = setInterval(fetchUser, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchUser]);

  const login = async (email, password) => {
    const data = await apiCall('signin', { email, password });
    if (data.user) setUser(data.user);
    return data;
  };

  const register = async (email, password, displayName) => {
    const data = await apiCall('signup', { email, password, displayName });
    if (data.user) setUser(data.user);
    return data;
  };

  const logout = async () => {
    await apiCall('signout');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, isAuthenticated: !!user, isAdmin: user?.is_admin, login, register, logout, refresh: fetchUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  return useContext(AuthContext);
}

export default AuthContext;
