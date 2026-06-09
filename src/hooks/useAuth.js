import { useAuthContext } from '../context/AuthContext';

/**
 * Unified authentication hook
 * Returns consistent authentication state across the entire app
 */
export default function useAuth() {
  const authContext = useAuthContext();
  
  if (!authContext) {
    return {
      user: null,
      loading: true,
      isAuthenticated: false,
      isAdmin: false,
      authStatus: 'idle',
      hasValidSession: false,
      login: async () => { throw new Error('Auth not initialized'); },
      register: async () => { throw new Error('Auth not initialized'); },
      logout: async () => { throw new Error('Auth not initialized'); },
      refresh: async () => {}
    };
  }

  return authContext;
}
