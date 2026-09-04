 /* contexts/AuthContext.jsx */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef
} from 'react';

import {
  useLocation,
  useNavigate
} from 'react-router-dom';

import {
  getUser,
  signin,
  signout
} from '../api/client';

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

  const navigate = useNavigate();

  /*
   * Check the current authenticated session and
   * retrieve the current user profile.
   */
  const checkAuth = useCallback(async () => {
    try {
      const data = await getUser();

      if (data?.user) {
        setUser({
          ...data.user,
          profile:
            data.user.profile || DEFAULT_PROFILE
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

  /*
   * Check authentication when the application starts.
   */
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  /*
   * Keep the authenticated session refreshed while
   * the user is active.
   */
  useEffect(() => {
    if (!user) {
      clearInterval(refreshRef.current);
      clearTimeout(inactivityRef.current);
      return;
    }

    refreshRef.current = setInterval(() => {
      if (
        Date.now() - lastActivityRef.current <
        INACTIVITY_TIMEOUT
      ) {
        checkAuth();
      }
    }, REFRESH_INTERVAL);

    const resetTimer = () => {
      lastActivityRef.current = Date.now();

      clearTimeout(inactivityRef.current);

      inactivityRef.current = setTimeout(() => {
        signout().catch(() => {});
        setUser(null);

        /*
         * When the session expires because of inactivity,
         * return the user to the public Home page.
         */
        navigate('/', { replace: true });
      }, INACTIVITY_TIMEOUT);
    };

    const activityEvents = [
      'mousedown',
      'keydown',
      'touchstart',
      'mousemove'
    ];

    activityEvents.forEach((event) => {
      window.addEventListener(
        event,
        resetTimer,
        { passive: true }
      );
    });

    resetTimer();

    return () => {
      clearInterval(refreshRef.current);
      clearTimeout(inactivityRef.current);

      activityEvents.forEach((event) => {
        window.removeEventListener(
          event,
          resetTimer
        );
      });
    };
  }, [user, checkAuth, navigate]);

  /*
   * Sign in.
   *
   * Successful authentication now lands on the
   * public Home page rather than Dashboard.
   *
   * MFA/passkey-required responses are returned first
   * so that the login page can complete those flows
   * before any navigation takes place.
   */
  const login = useCallback(
    async (
      email,
      password,
      turnstileToken,
      mfaCode
    ) => {
      const result = await signin(
        email,
        password,
        turnstileToken,
        mfaCode
      );

      /*
       * Do not redirect when another authentication
       * step is still required.
       */
      if (
        result?.mfa_required ||
        result?.passkey_required
      ) {
        return result;
      }

      /*
       * Load the authenticated user before navigating.
       */
      await checkAuth();

      /*
       * Default authenticated landing page:
       * Home, not Dashboard.
       */
      navigate('/', { replace: true });

      return result;
    },
    [checkAuth, navigate]
  );

  /*
   * Sign out and return to the public Home page.
   */
  const logout = useCallback(async () => {
    clearInterval(refreshRef.current);
    clearTimeout(inactivityRef.current);

    try {
      await signout();
    } catch {}

    setUser(null);

    navigate('/', { replace: true });
  }, [navigate]);

  /*
   * Manually refresh the current authentication state.
   */
  const refresh = useCallback(
    () => checkAuth(),
    [checkAuth]
  );

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

  if (!ctx) {
    throw new Error(
      'useAuth must be used within AuthProvider'
    );
  }

  return ctx;
}

/*
 * Protect authenticated routes.
 */
export function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      navigate('/login', {
        replace: true,
        state: {
          from: location
        }
      });
    }
  }, [
    user,
    loading,
    location,
    navigate
  ]);

  if (loading) {
    return (
      <div className="fcd-loading-wrap">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return children;
}
