import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { onAuthStateChange, logoutUser } from '@services/authService';
import { getUserProfile, createProfile } from '@services/databaseService';
import toast from 'react-hot-toast';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const { data: { subscription } } = onAuthStateChange(async (authUser) => {
      if (authUser) {
        setUser(authUser);
        const profile = await getUserProfile(authUser.id);
        if (profile.success && profile.data) {
          setUserData(profile.data);
        } else {
          const newProfile = {
            id: authUser.id,
            email: authUser.email,
            display_name: authUser.user_metadata?.displayName || authUser.email?.split('@')[0],
            role: 'student',
            created_at: new Date().toISOString(),
          };
          await createProfile(newProfile);
          setUserData(newProfile);
        }
      } else {
        setUser(null);
        setUserData(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const refreshUserData = useCallback(async () => {
    if (user) {
      const profile = await getUserProfile(user.id);
      if (profile.success) setUserData(profile.data);
    }
  }, [user]);

  const handleLogout = async () => {
    await logoutUser();
    setUser(null);
    setUserData(null);
    toast.success('Logged out');
  };

  const value = {
    user,
    userData,
    loading,
    error,
    isAuthenticated: !!user,
    isAdmin: userData?.role === 'admin',
    refreshUserData,
    logout: handleLogout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuthContext must be used within an AuthProvider');
  return context;
};

export default AuthContext;
