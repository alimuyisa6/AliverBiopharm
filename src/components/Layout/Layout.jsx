 import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { Link, useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Icon from '../Icon/Icon';
import { useLayout } from '../../contexts/LayoutContext';
import { useAuth } from '../../contexts/AuthContext';
import { signout } from '../../api/client';
import SearchOverlay from '../SearchOverlay/SearchOverlay';
import AdminLauncher from '../AdminLauncher';
import NetworkStatus from '../NetworkStatus/NetworkStatus';

const EXCLUDED_PATHS = ['/login', '/register'];
const SCROLL_STORAGE_KEY = 'scroll-positions';
const NO_CHROME_PATHS = ['/recall', '/quiz', '/profile', '/notes', '/past-papers'];

function loadScrollMap() {
  try {
    return new Map(
      JSON.parse(sessionStorage.getItem(SCROLL_STORAGE_KEY) || '[]')
    );
  } catch {
    return new Map();
  }
}

function persistScrollMap(map) {
  try {
    sessionStorage.setItem(
      SCROLL_STORAGE_KEY,
      JSON.stringify([...map.entries()])
    );
  } catch {}
}

export default function Layout({ children, showFooter = true }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();
  const navigationType = useNavigationType();

  const {
    logo,
    siteName,
    navigation,
    footer,
    theme,
    toggleTheme,
    isAuthenticated,
    refreshUser,
    features,
    uiMap
  } = useLayout();

  const { user } = useAuth();

  const isAuthPage = EXCLUDED_PATHS.includes(location.pathname);
  const isNoteDetailPage = location.pathname.startsWith('/notes/read');
  const isRoomPage = location.pathname.startsWith('/classroom/');
  const isNoChromePage = NO_CHROME_PATHS.some((path) =>
    location.pathname.startsWith(path)
  );

  const hideHeader =
    isAuthPage || isNoteDetailPage || isNoChromePage;

  const hideFooter =
    isAuthPage ||
    isRoomPage ||
    isNoteDetailPage ||
    isNoChromePage;

  const scrollPositions = useRef(loadScrollMap());
  const persistTimeout = useRef(null);
  const routeKey = location.key || 'default';

  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
  }, []);

  useEffect(() => {
    const handler = () => {
      setScrolled(window.scrollY > 10);

      scrollPositions.current.set(
        routeKey,
        window.scrollY
      );

      clearTimeout(persistTimeout.current);

      persistTimeout.current = setTimeout(() => {
        persistScrollMap(scrollPositions.current);
      }, 200);
    };

    window.addEventListener('scroll', handler, {
      passive: true
    });

    return () => {
      window.removeEventListener('scroll', handler);
      clearTimeout(persistTimeout.current);
    };
  }, [routeKey]);

  useLayoutEffect(() => {
    const restore = () => {
      if (
        navigationType === 'POP' &&
        scrollPositions.current.has(routeKey)
      ) {
        window.scrollTo(
          0,
          scrollPositions.current.get(routeKey)
        );
      } else {
        window.scrollTo(0, 0);
      }
    };

    restore();

    const raf = requestAnimationFrame(restore);

    return () => cancelAnimationFrame(raf);
  }, [routeKey, navigationType]);

  useEffect(() => {
    setMobileOpen(false);
    setSearchOpen(false);
  }, [location.pathname]);

  const handleSignout = async () => {
    setSigningOut(true);

    try {
      await signout();
      await refreshUser();

      // After signing out, return to the public Home page.
      navigate('/');
    } catch {
      navigate('/');
    } finally {
      setSigningOut(false);
    }
  };

  /*
   * Navigation policy
   * -----------------
   *
   * The curriculum is already exposed through dedicated
   * content-type cards on the platform.
   *
   * Therefore curriculum resources should NOT be duplicated
   * in the global header or footer.
   *
   * The following are intentionally excluded:
   *
   * - About from the header
   * - Classroom from the header
   * - Blog from the header
   * - Contact from the header
   * - Notes
   * - Quizzes
   * - Flashcards
   * - Past Papers
   * - Recall
   * - PDFs
   * - Glossary
   *
   * About is retained only in the bottom footer navigation.
   */

  const blockedHeaderPaths = [
    '/about',
    '/classroom',
    '/blog',
    '/contact',
    '/notes',
    '/quiz',
    '/flashcards',
    '/past-papers',
    '/recall',
    '/pdfs',
    '/glossary'
  ];

  const filteredNavigation = navigation.filter((link) => {
    if (blockedHeaderPaths.includes(link.href)) {
      return false;
    }

    if (
      link.href === '/quiz' &&
      features.quizzes === false
    ) {
      return false;
    }

    if (
      link.href === '/flashcards' &&
      features.flashcards === false
    ) {
      return false;
    }

    if (
      link.href === '/past-papers' &&
      features.past_papers === false
    ) {
      return false;
    }

    if (
      link.href === '/recall' &&
      features.recall === false
    ) {
      return false;
    }

    if (
      link.href === '/classroom' &&
      features.classrooms === false
    ) {
      return false;
    }

    return true;
  });

  const loginButton =
    uiMap.login_button || {
      label: 'Sign In',
      variant: 'outline',
      color: 'primary',
      icon: 'right-to-bracket'
    };

  const signupButton =
    uiMap.signup_button || {
      label: 'Sign Up',
      variant: 'solid',
      color: 'primary',
      icon: 'user-plus'
    };

  const searchIcon =
    uiMap.search_icon || {
      icon: 'magnifying-glass',
      size: 'sm'
    };

  const themeIcon =
    theme === 'dark'
      ? 'sun'
      : 'moon';

  return (
    <div className="app-layout">
      <a
        href="#main-content"
        className="skip-link"
      >
        Skip to content
      </a>

      <NetworkStatus />

      {!hideHeader && (
        <header
          className={`site-header${
            scrolled ? ' scrolled' : ''
          }`}
        >
          <div className="header-container">
            <Link
              to="/"
              className="header-logo"
            >
              {logo ? (
                <img
                  src={logo}
                  alt={siteName}
                />
              ) : (
                siteName
              )}
            </Link>

            <nav className="main-nav">
              {filteredNavigation.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  className={`main-nav-link${
                    location.pathname === link.href
                      ? ' active'
                      : ''
                  }`}
                >
                  {link.icon && (
                    <Icon name={link.icon} />
                  )}

                  {link.label}
                </Link>
              ))}
            </nav>

            <div className="nav-actions">
              <button
                className="btn btn-ghost btn-sm btn-icon"
                onClick={() =>
                  setSearchOpen(true)
                }
                aria-label="Search"
              >
                <Icon name={searchIcon.icon} />
              </button>

              <button
                className="btn btn-ghost btn-sm btn-icon"
                onClick={toggleTheme}
                aria-label="Toggle theme"
              >
                <Icon name={themeIcon} />
              </button>

              <button
                className="hamburger-btn"
                onClick={() =>
                  setMobileOpen(true)
                }
                aria-label="Menu"
              >
                <Icon name="bars" />
              </button>
            </div>
          </div>
        </header>
      )}

      <SearchOverlay
        open={searchOpen}
        onClose={() =>
          setSearchOpen(false)
        }
      />

      <AdminLauncher />

      <AnimatePresence>
        {mobileOpen && (
          <>
            <div
              className="mobile-nav-overlay"
              onClick={() =>
                setMobileOpen(false)
              }
            />

            <motion.div
              className="mobile-nav-panel"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{
                duration: 0.25
              }}
            >
              <div className="mobile-nav-panel-inner">

                {/*
                 * Mobile navigation uses the same filtered
                 * navigation as the desktop header.
                 *
                 * This prevents old/stale configuration from
                 * reintroducing curriculum links, About, or
                 * Classroom into the mobile menu.
                 */}

                {filteredNavigation.map((link) => (
                  <Link
                    key={link.href}
                    to={link.href}
                    className="mobile-nav-link"
                    onClick={() =>
                      setMobileOpen(false)
                    }
                  >
                    {link.icon && (
                      <Icon name={link.icon} />
                    )}

                    {link.label}
                  </Link>
                ))}

                <div className="dropdown-divider" />

                {isAuthenticated ? (
                  <>
                    <Link
                      to="/"
                      className="mobile-nav-link"
                      onClick={() =>
                        setMobileOpen(false)
                      }
                    >
                      <Icon name="house" />
                      Home
                    </Link>

                    <Link
                      to="/dashboard"
                      className="mobile-nav-link"
                      onClick={() =>
                        setMobileOpen(false)
                      }
                    >
                      <Icon name="gauge-high" />
                      Dashboard
                    </Link>

                    <Link
                      to="/profile"
                      className="mobile-nav-link"
                      onClick={() =>
                        setMobileOpen(false)
                      }
                    >
                      <Icon name="gear" />
                      Profile
                    </Link>

                    <button
                      className="mobile-nav-link"
                      onClick={handleSignout}
                      disabled={signingOut}
                    >
                      <Icon name="right-from-bracket" />

                      {signingOut
                        ? 'Signing out...'
                        : 'Sign Out'}
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      to="/"
                      className="mobile-nav-link"
                      onClick={() =>
                        setMobileOpen(false)
                      }
                    >
                      <Icon name="house" />
                      Home
                    </Link>

                    <Link
                      to="/login"
                      className="mobile-nav-link"
                      onClick={() =>
                        setMobileOpen(false)
                      }
                    >
                      {loginButton.icon && (
                        <Icon
                          name={loginButton.icon}
                        />
                      )}

                      {loginButton.label}
                    </Link>

                    <Link
                      to="/register"
                      className="mobile-nav-link"
                      onClick={() =>
                        setMobileOpen(false)
                      }
                    >
                      {signupButton.icon && (
                        <Icon
                          name={signupButton.icon}
                        />
                      )}

                      {signupButton.label}
                    </Link>
                  </>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <motion.main
        id="main-content"
        key={routeKey}
        initial={
          navigationType === 'POP'
            ? false
            : {
                opacity: 0,
                y: 20
              }
        }
        animate={{
          opacity: 1,
          y: 0
        }}
        transition={{
          duration: 0.3
        }}
      >
        {children}
      </motion.main>

      {!hideFooter &&
        showFooter && (
          <footer className="footer">
            <div
              className="footer-wave"
              aria-hidden="true"
            >
              <svg
                viewBox="0 0 1440 120"
                preserveAspectRatio="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M0,64 C240,120 480,0 720,32 C960,64 1200,112 1440,48 L1440,120 L0,120 Z"
                  className="footer-wave-path"
                />
              </svg>
            </div>

            <div className="footer-inner">
              <div className="footer-brand">
                <Link
                  to="/"
                  className="header-logo"
                >
                  {logo ? (
                    <img
                      src={logo}
                      alt={siteName}
                      className="footer-logo"
                    />
                  ) : (
                    siteName
                  )}
                </Link>

                <p className="footer-tagline">
                  Advancing biology and pharmacy education
                  for every learner.
                </p>

                {footer.social_links &&
                  Object.keys(
                    footer.social_links
                  ).length > 0 && (
                    <div className="footer-social">
                      {Object.entries(
                        footer.social_links
                      ).map(
                        ([platform, url]) => (
                          <a
                            key={platform}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="footer-social-link"
                            data-platform={
                              platform
                            }
                            aria-label={
                              platform
                            }
                          >
                            <Icon
                              name={platform}
                            />
                          </a>
                        )
                      )}
                    </div>
                  )}
              </div>

              {footer.quick_links?.length > 0 && (
                <div>
                  <h4 className="footer-heading">
                    Quick Links
                  </h4>

                  <div className="footer-links">
                    {footer.quick_links
                      .filter(
                        (item) =>
                          item.path !==
                            '/about' &&
                          item.path !==
                            '/classroom' &&
                          item.path !==
                            '/notes' &&
                          item.path !==
                            '/quiz' &&
                          item.path !==
                            '/flashcards' &&
                          item.path !==
                            '/past-papers' &&
                          item.path !==
                            '/recall' &&
                          item.path !==
                            '/pdfs' &&
                          item.path !==
                            '/glossary'
                      )
                      .map(
                        (item, index) => (
                          <Link
                            key={index}
                            to={item.path}
                            className="footer-link"
                          >
                            {item.label}
                          </Link>
                        )
                      )}
                  </div>
                </div>
              )}

              {footer.resource_links?.length > 0 && (
                <div>
                  <h4 className="footer-heading">
                    Resources
                  </h4>

                  <div className="footer-links">
                    {footer.resource_links
                      .filter(
                        (item) =>
                          item.path !==
                            '/about' &&
                          item.path !==
                            '/classroom' &&
                          item.path !==
                            '/notes' &&
                          item.path !==
                            '/quiz' &&
                          item.path !==
                            '/flashcards' &&
                          item.path !==
                            '/past-papers' &&
                          item.path !==
                            '/recall' &&
                          item.path !==
                            '/pdfs' &&
                          item.path !==
                            '/glossary'
                      )
                      .map(
                        (item, index) => (
                          <Link
                            key={index}
                            to={item.path}
                            className="footer-link"
                          >
                            {item.label}
                          </Link>
                        )
                      )}
                  </div>
                </div>
              )}

              {footer.community_links?.length > 0 && (
                <div>
                  <h4 className="footer-heading">
                    Community
                  </h4>

                  <div className="footer-links">
                    {footer.community_links
                      .filter(
                        (item) =>
                          item.path !==
                            '/about' &&
                          item.path !==
                            '/classroom'
                      )
                      .map(
                        (item, index) => (
                          <Link
                            key={index}
                            to={item.path}
                            className="footer-link"
                          >
                            {item.label}
                          </Link>
                        )
                      )}
                  </div>
                </div>
              )}
            </div>

            <div className="footer-bottom">
              <p>
                &copy;{' '}
                {new Date().getFullYear()}{' '}
                {siteName}. All rights reserved.
              </p>

              <nav className="footer-bottom-nav">
                <Link
                  to="/privacy"
                  className="footer-link"
                >
                  Privacy
                </Link>

                <Link
                  to="/terms"
                  className="footer-link"
                >
                  Terms
                </Link>

                {/* About intentionally remains here only. */}
                <Link
                  to="/about"
                  className="footer-link"
                >
                  About
                </Link>
              </nav>
            </div>
          </footer>
        )}
    </div>
  );
}
