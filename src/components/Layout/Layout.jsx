import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { Link, useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Icon from '../Icon/Icon';
import { useLayout } from '../../contexts/LayoutContext';
import { useAuth } from '../../contexts/AuthContext';
import { signout } from '../../api/client';
import { getRequest } from '../../api/client';
import SearchOverlay from '../SearchOverlay/SearchOverlay';
import ClassSwitcher from '../ClassSwitcher/ClassSwitcher';
import AdminLauncher from '../AdminLauncher';
import NetworkStatus from '../NetworkStatus/NetworkStatus';

const EXCLUDED_PATHS = ['/login', '/register'];
const SCROLL_STORAGE_KEY = 'scroll-positions';
const NO_CHROME_PATHS = ['/recall', '/quiz', '/profile', '/notes', '/past-papers'];

function loadScrollMap() {
  try {
    return new Map(JSON.parse(sessionStorage.getItem(SCROLL_STORAGE_KEY) || '[]'));
  } catch {
    return new Map();
  }
}

function persistScrollMap(map) {
  try {
    sessionStorage.setItem(SCROLL_STORAGE_KEY, JSON.stringify([...map.entries()]));
  } catch {}
}

export default function Layout({ children, showFooter = true }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [accordionOpen, setAccordionOpen] = useState(null);
  const [navNotes, setNavNotes] = useState({});
  const [loadingNavNotes, setLoadingNavNotes] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();
  const navigationType = useNavigationType();

  const {
    logo,
    siteName,
    navigation,
    footer,
    groups,
    level,
    theme,
    toggleTheme,
    isAuthenticated,
    refreshUser,
    activeGroupId,
    features,
    uiMap
  } = useLayout();

  const { user } = useAuth();

  const isAuthPage = EXCLUDED_PATHS.includes(location.pathname);
  const isNoteDetailPage = location.pathname.startsWith('/notes/read');
  const isRoomPage = location.pathname.startsWith('/classroom/');
  const isNoChromePage = NO_CHROME_PATHS.some((path) => location.pathname.startsWith(path));

  const hideHeader = isAuthPage || isNoteDetailPage || isNoChromePage;
  const hideFooter = isAuthPage || isRoomPage || isNoteDetailPage || isNoChromePage;

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
      scrollPositions.current.set(routeKey, window.scrollY);

      clearTimeout(persistTimeout.current);
      persistTimeout.current = setTimeout(() => persistScrollMap(scrollPositions.current), 200);
    };

    window.addEventListener('scroll', handler, { passive: true });

    return () => window.removeEventListener('scroll', handler);
  }, [routeKey]);

  useLayoutEffect(() => {
    const restore = () => {
      if (navigationType === 'POP' && scrollPositions.current.has(routeKey)) {
        window.scrollTo(0, scrollPositions.current.get(routeKey));
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
      navigate('/');
    } catch {
      navigate('/');
    } finally {
      setSigningOut(false);
    }
  };

  const groupedNav = groups.reduce((acc, group) => {
    const existing = acc.find((item) => item.level_id === group.level_id);

    if (existing) {
      existing.classes.push(group);
    } else {
      acc.push({
        level_id: group.level_id,
        level_name: group.level_id,
        classes: [group]
      });
    }

    return acc;
  }, []);

  const fetchNavNotes = async (groupId) => {
    setLoadingNavNotes(true);

    try {
      const data = await getRequest('notes', 'nav_list', { group_id: groupId });

      setNavNotes((prev) => ({ ...prev, [groupId]: data }));
    } catch {
      setNavNotes((prev) => ({ ...prev, [groupId]: [] }));
    } finally {
      setLoadingNavNotes(false);
    }
  };

  const filteredNavigation = navigation.filter((link) => {
    if (link.href === '/quiz' && features.quizzes === false) return false;
    if (link.href === '/flashcards' && features.flashcards === false) return false;
    if (link.href === '/past-papers' && features.past_papers === false) return false;
    if (link.href === '/recall' && features.recall === false) return false;
    if (link.href === '/classroom' && features.classrooms === false) return false;
    return true;
  });

  const loginButton = uiMap.login_button || { label: 'Sign In', variant: 'outline', color: 'primary', icon: 'right-to-bracket' };
  const signupButton = uiMap.signup_button || { label: 'Sign Up', variant: 'solid', color: 'primary', icon: 'user-plus' };
  const searchIcon = uiMap.search_icon || { icon: 'magnifying-glass', size: 'sm' };
  const themeIcon = theme === 'dark' ? 'sun' : 'moon';

  const mapVariant = (variant) => {
    if (variant === 'solid') return 'primary';
    if (variant === 'outline') return 'secondary';
    return 'ghost';
  };

  return (
    <div className="app-layout">
      <a href="#main-content" className="skip-link">Skip to content</a>

      <NetworkStatus />

      {!hideHeader && (
        <header className={`site-header${scrolled ? ' scrolled' : ''}`}>
          <div className="header-container">
            <Link to="/" className="header-logo">
              {logo ? <img src={logo} alt={siteName} /> : siteName}
            </Link>

            <nav className="main-nav">
              {filteredNavigation.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  className={`main-nav-link${location.pathname === link.href ? ' active' : ''}`}
                >
                  {link.icon && <Icon name={link.icon} />}
                  {link.label}
                </Link>
              ))}
            </nav>

            <div className="nav-actions">
              {isAuthenticated && (
                <span className="class-switcher-wrap">
                  <ClassSwitcher />
                </span>
              )}

              <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setSearchOpen(true)} aria-label="Search">
                <Icon name={searchIcon.icon} />
              </button>

              {isAuthenticated ? (
                <div className="dropdown">
                  <button className="btn btn-ghost btn-sm" onClick={() => navigate('/profile')}>
                    <Icon name="user" />
                  </button>
                </div>
              ) : (
                <>
                  <Link
                    to="/login"
                    className={`btn btn-${mapVariant(loginButton.variant)} btn-sm btn-radius-sm`}
                  >
                    {loginButton.icon && <Icon name={loginButton.icon} />}
                    {loginButton.label}
                  </Link>
                  <Link
                    to="/register"
                    className={`btn btn-${mapVariant(signupButton.variant)} btn-sm btn-radius-sm`}
                  >
                    {signupButton.icon && <Icon name={signupButton.icon} />}
                    {signupButton.label}
                  </Link>
                </>
              )}

              <button className="btn btn-ghost btn-sm btn-icon" onClick={toggleTheme} aria-label="Toggle theme">
                <Icon name={themeIcon} />
              </button>

              <button className="hamburger-btn" onClick={() => setMobileOpen(true)} aria-label="Menu">
                <Icon name="bars" />
              </button>
            </div>
          </div>
        </header>
      )}

      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
      <AdminLauncher />

      <AnimatePresence>
        {mobileOpen && (
          <>
            <div className="mobile-nav-overlay" onClick={() => setMobileOpen(false)} />
            <motion.div
              className="mobile-nav-panel"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.25 }}
            >
              <div className="mobile-nav-panel-inner">
                {filteredNavigation.map((link) => (
                  <Link key={link.href} to={link.href} className="mobile-nav-link" onClick={() => setMobileOpen(false)}>
                    {link.icon && <Icon name={link.icon} />}
                    {link.label}
                  </Link>
                ))}

                <div className="dropdown-divider" />

                {groupedNav.map((group) => (
                  <div key={group.level_id} className="mobile-nav-accordion">
                    <button
                      className="mobile-nav-accordion-trigger"
                      onClick={() => {
                        const nextOpen = accordionOpen === group.level_id ? null : group.level_id;

                        setAccordionOpen(nextOpen);

                        if (nextOpen) {
                          group.classes.forEach((cls) => {
                            if (!navNotes[cls.id]) fetchNavNotes(cls.id);
                          });
                        }
                      }}
                    >
                      <span>{group.level_name}</span>
                      <Icon name={accordionOpen === group.level_id ? 'chevron-down' : 'chevron-right'} />
                    </button>

                    <div className={`mobile-nav-accordion-content ${accordionOpen === group.level_id ? 'open' : ''}`}>
                      {group.classes.map((cls) => (
                        <div key={cls.id} className="mobile-nav-class-group">
                          <Link to={`/class/${cls.id}`} className="mobile-nav-sub-link mobile-nav-class-link" onClick={() => setMobileOpen(false)}>
                            {cls.name}
                          </Link>

                          {navNotes[cls.id] ? (
                            navNotes[cls.id].map((unit) => (
                              <div key={unit.unit_id} className="mobile-nav-unit-group">
                                {unit.notes.map((note) => (
                                  <Link
                                    key={note.id}
                                    to={`/notes/read?id=${note.id}`}
                                    className="mobile-nav-sub-link mobile-nav-note-link"
                                    onClick={() => setMobileOpen(false)}
                                  >
                                    {note.title}
                                  </Link>
                                ))}
                              </div>
                            ))
                          ) : loadingNavNotes ? (
                            <span className="mobile-nav-loading">Loading...</span>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                <div className="dropdown-divider" />

                {isAuthenticated ? (
                  <>
                    <Link to="/dashboard" className="mobile-nav-link" onClick={() => setMobileOpen(false)}>
                      <Icon name="gauge-high" /> Dashboard
                    </Link>
                    <Link to="/profile" className="mobile-nav-link" onClick={() => setMobileOpen(false)}>
                      <Icon name="gear" /> Profile
                    </Link>
                    <button className="mobile-nav-link" onClick={handleSignout} disabled={signingOut}>
                      <Icon name="right-from-bracket" />
                      {signingOut ? 'Signing out...' : 'Sign Out'}
                    </button>
                  </>
                ) : (
                  <>
                    <Link to="/login" className="mobile-nav-link" onClick={() => setMobileOpen(false)}>
                      {loginButton.icon && <Icon name={loginButton.icon} />} {loginButton.label}
                    </Link>
                    <Link to="/register" className="mobile-nav-link" onClick={() => setMobileOpen(false)}>
                      {signupButton.icon && <Icon name={signupButton.icon} />} {signupButton.label}
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
        initial={navigationType === 'POP' ? false : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {children}
      </motion.main>

      {!hideFooter && showFooter && (
        <footer className="footer">
          <div className="footer-inner">
            <div className="footer-brand">
              <Link to="/" className="header-logo">
                {logo ? <img src={logo} alt={siteName} className="footer-logo" /> : siteName}
              </Link>
              <p className="footer-tagline">Advancing biology and pharmacy education for every learner.</p>

              {footer.social_links && Object.keys(footer.social_links).length > 0 && (
                <div className="footer-social">
                  {Object.entries(footer.social_links).map(([platform, url]) => (
                    <a
                      key={platform}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="footer-social-link"
                      data-platform={platform}
                      aria-label={platform}
                    >
                      <Icon name={platform} />
                    </a>
                  ))}
                </div>
              )}
            </div>

            {footer.quick_links?.length > 0 && (
              <div>
                <h4 className="footer-heading">Quick Links</h4>
                <div className="footer-links">
                  {footer.quick_links.map((item, index) => (
                    <Link key={index} to={item.path} className="footer-link">{item.label}</Link>
                  ))}
                </div>
              </div>
            )}

            {footer.resource_links?.length > 0 && (
              <div>
                <h4 className="footer-heading">Resources</h4>
                <div className="footer-links">
                  {footer.resource_links.map((item, index) => (
                    <Link key={index} to={item.path} className="footer-link">{item.label}</Link>
                  ))}
                </div>
              </div>
            )}

            {footer.community_links?.length > 0 && (
              <div>
                <h4 className="footer-heading">Community</h4>
                <div className="footer-links">
                  {footer.community_links.map((item, index) => (
                    <Link key={index} to={item.path} className="footer-link">{item.label}</Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="footer-bottom">
            <p>&copy; {new Date().getFullYear()} {siteName}. All rights reserved.</p>
            <nav className="footer-bottom-nav">
              <Link to="/privacy" className="footer-link">Privacy</Link>
              <Link to="/terms" className="footer-link">Terms</Link>
              <Link to="/about" className="footer-link">About</Link>
            </nav>
          </div>
        </footer>
      )}
    </div>
  );
}
