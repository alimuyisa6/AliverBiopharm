import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { apiCall } from '../services/apiService';

const AuthContext = createContext(null);

const SESSION_STORAGE_KEY = 'auth_session';
const SESSION_CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authStatus, setAuthStatus] = useState('idle'); // idle, checking, authenticated, unauthenticated, error
  const lastFetchRef = useRef(null);
  const retryCountRef = useRef(0);
  const maxRetriesRef = useRef(3);

  // Initialize from localStorage on mount
  const initializeFromStorage = useCallback(() => {
    try {
      const cached = localStorage.getItem(SESSION_STORAGE_KEY);
      if (cached) {
        const { user: cachedUser, timestamp } = JSON.parse(cached);
        const isExpired = Date.now() - timestamp > SESSION_CACHE_DURATION;
        if (!isExpired && cachedUser) {
          setUser(cachedUser);
          setAuthStatus('authenticated');
          return true;
        }
      }
    } catch (err) {
      console.warn('Failed to parse cached session:', err);
    }
    return false;
  }, []);

  // Fetch user from backend
  const fetchUser = useCallback(async (forceRefresh = false) => {
    // Prevent rapid sequential calls
    const now = Date.now();
    if (!forceRefresh && lastFetchRef.current && now - lastFetchRef.current < 5000) {
      return;
    }

    lastFetchRef.current = now;
    setAuthStatus('checking');

    try {
      const data = await apiCall('get_user');
      
      if (data?.user) {
        setUser(data.user);
        setAuthStatus('authenticated');
        retryCountRef.current = 0;
        
        // Cache to localStorage
        try {
          localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
            user: data.user,
            timestamp: Date.now()
          }));
        } catch (storageErr) {
          console.warn('Failed to cache session:', storageErr);
        }
      } else {
        setUser(null);
        setAuthStatus('unauthenticated');
        localStorage.removeItem(SESSION_STORAGE_KEY);
        retryCountRef.current = 0;
      }
    } catch (err) {
      console.error('Failed to fetch user:', err);
      
      // On error: check if we have cached user, keep them authenticated
      const hasCachedUser = user !== null;
      
      if (hasCachedUser) {
        // Keep existing user - don't clear on fetch error
        setAuthStatus('authenticated');
        retryCountRef.current = 0;
      } else {
        // Only set to error/unauthenticated if we don't have a cached user
        retryCountRef.current += 1;
        if (retryCountRef.current >= maxRetriesRef.current) {
          setAuthStatus('unauthenticated');
          setUser(null);
          localStorage.removeItem(SESSION_STORAGE_KEY);
        } else {
          setAuthStatus('checking'); // Keep checking, don't set to error
        }
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Initialize on mount
  useEffect(() => {
    const hasCache = initializeFromStorage();
    if (hasCache) {
      setLoading(false);
      // Still try to fetch fresh data but don't wait
      fetchUser(true);
    } else {
      fetchUser(false);
    }
  }, [initializeFromStorage, fetchUser]);

  // Periodic refresh (every 30 minutes)
  useEffect(() => {
    const interval = setInterval(() => {
      if (authStatus === 'authenticated') {
        fetchUser(true);
      }
    }, SESSION_CACHE_DURATION);
    return () => clearInterval(interval);
  }, [fetchUser, authStatus]);

  const login = async (email, password) => {
    setAuthStatus('checking');
    try {
      const data = await apiCall('signin', { email, password });
      if (data.user) {
        setUser(data.user);
        setAuthStatus('authenticated');
        retryCountRef.current = 0;
        
        try {
          localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
            user: data.user,
            timestamp: Date.now()
          }));
        } catch (storageErr) {
          console.warn('Failed to cache session:', storageErr);
        }
      }
      return data;
    } catch (err) {
      setAuthStatus('error');
      throw err;
    }
  };

  const register = async (email, password, displayName) => {
    setAuthStatus('checking');
    try {
      const data = await apiCall('signup', { email, password, displayName });
      if (data.user) {
        setUser(data.user);
        setAuthStatus('authenticated');
        retryCountRef.current = 0;
        
        try {
          localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
            user: data.user,
            timestamp: Date.now()
          }));
        } catch (storageErr) {
          console.warn('Failed to cache session:', storageErr);
        }
      }
      return data;
    } catch (err) {
      setAuthStatus('error');
      throw err;
    }
  };

  const logout = async () => {
    setAuthStatus('checking');
    try {
      await apiCall('signout');
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setUser(null);
      setAuthStatus('unauthenticated');
      localStorage.removeItem(SESSION_STORAGE_KEY);
      retryCountRef.current = 0;
    }
  };

  const value = {
    user,
    loading,
    isAuthenticated: !!user && authStatus === 'authenticated',
    isAdmin: user?.is_admin || false,
    authStatus,
    login,
    register,
    logout,
    refresh: fetchUser,
    hasValidSession: !!user
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within AuthProvider');
  }
  return context;
}

export default AuthContext;
