 /* components/Layout/Layout.jsx */
import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Icon from '../Icon/Icon';
import { useLayout } from '../../contexts/LayoutContext';
import { useAuth } from '../../contexts/AuthContext';
import { signout } from '../../api/client';
import SearchOverlay from '../SearchOverlay/SearchOverlay';
import ClassSwitcher from '../ClassSwitcher/ClassSwitcher';

const EXCLUDED_PATHS = ['/login', '/register'];

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
  const { logo, siteName, navigation, footer, groups, level, theme, toggleTheme, isAuthenticated, refreshUser, activeGroupId } = useLayout();
  const { user } = useAuth();
  const isAuthPage = EXCLUDED_PATHS.includes(location.pathname);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

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
    } catch {} finally {
      setSigningOut(false);
    }
  };

  const groupedNav = groups.reduce((acc, g) => {
    const existing = acc.find((item) => item.level_id === g.level_id);
    if (existing) {
      existing.classes.push(g);
    } else {
      acc.push({ level_id: g.level_id, level_name: g.level_id, classes: [g] });
    }
    return acc;
  }, []);

  const fetchNavNotes = async (groupId) => {
    setLoadingNavNotes(true);
    try {
      const res = await fetch(`/api/server?module=notes&path=nav_list&group_id=${groupId}`, { credentials: 'include' });
      const data = await res.json();
      if (data && !data.error) {
        setNavNotes(prev => ({ ...prev, [groupId]: data }));
      }
    } catch (e) {
    } finally {
      setLoadingNavNotes(false);
    }
  };

  return (
    <div className="app-layout">
      <a href="#main-content" className="skip-link">Skip to content</a>

      {!isAuthPage && (
        <header className={`site-header${scrolled ? ' scrolled' : ''}`}>
          <div className="header-container">
            <Link to="/" className="header-logo">
              {logo ? <img src={logo} alt={siteName} /> : siteName}
            </Link>

            <nav className="main-nav">
              {navigation.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  className={`main-nav-link${location.pathname === link.href ? ' active' : ''}`}
                >
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
                <Icon name="magnifying-glass" />
              </button>

              {isAuthenticated ? (
                <div className="dropdown" style={{ position: 'relative' }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => {}}>
                    <Icon name="user" />
                  </button>
                </div>
              ) : (
                <>
                  <Link to="/login" className="btn btn-ghost btn-sm">Sign In</Link>
                  <Link to="/register" className="btn btn-primary btn-sm">Sign Up</Link>
                </>
              )}

              <button className="btn btn-ghost btn-sm btn-icon" onClick={toggleTheme} aria-label="Toggle theme">
                <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
              </button>

              <button className="hamburger-btn" onClick={() => setMobileOpen(true)} aria-label="Menu">
                <Icon name="bars" />
              </button>
            </div>
          </div>
        </header>
      )}

      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />

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
                {navigation.map((link) => (
                  <Link key={link.href} to={link.href} className="mobile-nav-link" onClick={() => setMobileOpen(false)}>
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
                          group.classes.forEach(cls => {
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
                        <div key={cls.id} style={{ marginBottom: 'var(--space-2)' }}>
                          <Link to={`/class/${cls.id}`} className="mobile-nav-sub-link" onClick={() => setMobileOpen(false)} style={{ fontWeight: 600 }}>
                            {cls.name}
                          </Link>
                          {navNotes[cls.id] ? (
                            navNotes[cls.id].map(unit => (
                              <div key={unit.unit_id} style={{ paddingLeft: 'var(--space-4)' }}>
                                {unit.notes.map(note => (
                                  <Link
                                    key={note.id}
                                    to={`/notes/read?id=${note.id}`}
                                    className="mobile-nav-sub-link"
                                    onClick={() => setMobileOpen(false)}
                                    style={{ fontSize: 'var(--text-xs)' }}
                                  >
                                    {note.title}
                                  </Link>
                                ))}
                              </div>
                            ))
                          ) : loadingNavNotes ? (
                            <span style={{ paddingLeft: 'var(--space-4)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Loading...</span>
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
                      <Icon name="right-to-bracket" /> Sign In
                    </Link>
                    <Link to="/register" className="mobile-nav-link" onClick={() => setMobileOpen(false)}>
                      <Icon name="user-plus" /> Sign Up
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
        key={location.pathname}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {children}
      </motion.main>

      {!isAuthPage && showFooter && (
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
                    <a key={platform} href={url} target="_blank" rel="noopener noreferrer" className="footer-social-link">
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
                  {footer.quick_links.map((item, i) => (
                    <Link key={i} to={item.path} className="footer-link">{item.label}</Link>
                  ))}
                </div>
              </div>
            )}
            {footer.resource_links?.length > 0 && (
              <div>
                <h4 className="footer-heading">Resources</h4>
                <div className="footer-links">
                  {footer.resource_links.map((item, i) => (
                    <Link key={i} to={item.path} className="footer-link">{item.label}</Link>
                  ))}
                </div>
              </div>
            )}
            {footer.community_links?.length > 0 && (
              <div>
                <h4 className="footer-heading">Community</h4>
                <div className="footer-links">
                  {footer.community_links.map((item, i) => (
                    <Link key={i} to={item.path} className="footer-link">{item.label}</Link>
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
