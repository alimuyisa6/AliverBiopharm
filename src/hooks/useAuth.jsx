import { useAuthContext } from '@context/AuthContext';

const useAuth = () => {
  const {
    user,
    userData,
    loading,
    error,
    isAuthenticated,
    isAdmin,
    refreshUserData,
    logout,
  } = useAuthContext();

  return { user, userData, loading, error, isAuthenticated, isAdmin, refreshUserData, logout };
};

export default useAuth;
