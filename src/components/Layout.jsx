 import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaSun, FaMoon, FaBars, FaXmark, FaUser, FaChevronDown,
  FaRightToBracket, FaUserPlus, FaRightFromBracket, FaSpinner,
  FaGaugeHigh, FaGear, FaArrowUp, FaMagnifyingGlass,
} from 'react-icons/fa6';
import { useLayout } from '../contexts/LayoutContext';
import { signout } from '../api/client';
import NotificationBell from './NotificationBell';
import SearchOverlay from './SearchOverlay';

const pageVariants = {
  initial: { opacity: 0, y: 20 },
  in: { opacity: 1, y: 0 },
  out: { opacity: 0, y: -20 },
};

const pageTransition = {
  type: 'tween',
  ease: 'easeInOut',
  duration: 0.3,
};

const mobilePanelVariants = {
  hidden: {
    x: '100%',
    opacity: 0,
    transition: { type: 'tween', duration: 0.25, ease: 'easeInOut' }
  },
  visible: {
    x: 0,
    opacity: 1,
    transition: { type: 'tween', duration: 0.3, ease: 'easeInOut' }
  },
  exit: {
    x: '100%',
    opacity: 0,
    transition: { type: 'tween', duration: 0.25, ease: 'easeInOut' }
  },
};

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

const throttle = (fn, limit) => {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      fn.apply(this, args);
      inThrottle = true;
      setTimeout(() => { inThrottle = false; }, limit);
    }
  };
};

export default function Layout({ children, headerExtras, showFooter = true }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  const isMounted = useRef(true);

  const {
    logo, siteName, navigation, footer, loading, authLoading, theme,
    toggleTheme, isAuthenticated, refreshUser, user,
  } = useLayout();

  const location = useLocation();
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();
  const isHomepage = location.pathname === '/';

  useEffect(() => {
    if (!logo) return;

    let cancelled = false;

    const clearExistingIcons = () => {
      document.querySelectorAll('link[rel*="icon"]').forEach((link) => link.remove());
    };

    const applyDirectFallback = (url) => {
      if (cancelled) return;
      clearExistingIcons();
      const faviconLink = document.createElement('link');
      faviconLink.rel = 'icon';
      faviconLink.href = url;
      document.head.appendChild(faviconLink);
    };

    const setFavicon = (logoUrl) => {
      clearExistingIcons();

      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        if (cancelled) return;
        try {
          const canvas = document.createElement('canvas');
          const size = 32;
          canvas.width = size;
          canvas.height = size;

          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, size, size);

          const zoom = 1.15;
          const scale = Math.max(size / img.width, size / img.height) * zoom;
          const x = (size - img.width * scale) / 2;
          const y = (size - img.height * scale) / 2;
          ctx.drawImage(img, x, y, img.width * scale, img.height * scale);

          const faviconUrl = canvas.toDataURL('image/png');

          const faviconLink = document.createElement('link');
          faviconLink.rel = 'icon';
          faviconLink.type = 'image/png';
          faviconLink.href = faviconUrl;
          document.head.appendChild(faviconLink);

          const appleCanvas = document.createElement('canvas');
          appleCanvas.width = 180;
          appleCanvas.height = 180;
          const appleCtx = appleCanvas.getContext('2d');
          appleCtx.fillStyle = '#ffffff';
          appleCtx.fillRect(0, 0, 180, 180);
          const appleScale = Math.max(180 / img.width, 180 / img.height) * zoom;
          const appleX = (180 - img.width * appleScale) / 2;
          const appleY = (180 - img.height * appleScale) / 2;
          appleCtx.drawImage(img, appleX, appleY, img.width * appleScale, img.height * appleScale);

          const appleTouchLink = document.createElement('link');
          appleTouchLink.rel = 'apple-touch-icon';
          appleTouchLink.href = appleCanvas.toDataURL('image/png');
          document.head.appendChild(appleTouchLink);
        } catch (err) {
          applyDirectFallback(logoUrl);
        }
      };

      img.onerror = () => {
        applyDirectFallback(logoUrl);
      };

      img.src = logoUrl;
    };

    setFavicon(logo);

    return () => {
      cancelled = true;
    };
  }, [logo]);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    const onScroll = throttle(() => {
      setScrolled(window.scrollY > 10);
      setShowBackToTop(window.scrollY > 400);
    }, 100);

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
    setUserDropdownOpen(false);
    setSearchOpen(false);
    document.body.style.overflow = '';

    const timeoutId = setTimeout(() => {
      if (isMounted.current) {
        setMobileMenuOpen(false);
        document.body.style.overflow = '';
      }
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [location.pathname]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (userDropdownOpen && !e.target.closest('.user-dropdown')) {
        setUserDropdownOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [userDropdownOpen]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        searchOpen &&
        !e.target.closest('.search-overlay-panel') &&
        !e.target.closest('.search-toggle')
      ) {
        setSearchOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [searchOpen]);

  useEffect(() => {
    if (mobileMenuOpen || searchOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileMenuOpen, searchOpen]);

  const handleSignout = useCallback(async () => {
    setSigningOut(true);
    setUserDropdownOpen(false);
    try {
      await signout();
      await refreshUser();
      navigate('/');
    } catch {
    } finally {
      if (isMounted.current) {
        setSigningOut(false);
      }
    }
  }, [refreshUser, navigate]);

  const closeMobileMenu = useCallback(() => {
    setMobileMenuOpen(false);
    document.body.style.overflow = '';
  }, []);

  const toggleSearch = useCallback((e) => {
    e.stopPropagation();
    setMobileMenuOpen(false);
    setSearchOpen((open) => !open);
  }, []);

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
  }, []);

  const renderNavLink = (link) => {
    const isExternal = link.href?.startsWith('http') || link.href?.startsWith('mailto');
    if (isExternal) {
      return (
        <a href={link.href} target="_blank" rel="noopener noreferrer">
          {link.label}
        </a>
      );
    }
    return (
      <Link to={link.href} className={location.pathname === link.href ? 'active' : ''}>
        {link.label}
      </Link>
    );
  };

  const renderMobileNavLink = (link) => {
    const isExternal = link.href?.startsWith('http') || link.href?.startsWith('mailto');
    if (isExternal) {
      return (
        <a
          key={link.href}
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={closeMobileMenu}
        >
          {link.label}
        </a>
      );
    }
    return (
      <Link key={link.href} to={link.href} onClick={closeMobileMenu}>
        {link.label}
      </Link>
    );
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1rem',
        fontFamily: 'var(--font-body)',
        color: 'var(--clr-text-dim)',
      }}>
        <FaSpinner className="icon-spin" size={32} color="var(--clr-cyan)" />
        <p>Loading {siteName}...</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <header className={`site-header${scrolled ? ' scrolled' : ''}`}>
        <div className="header-container">
          <Link to="/" className="logo-link" aria-label={`${siteName} Home`}>
            {logo ? (
              <img src={logo} alt={siteName} loading="eager" />
            ) : (
              <span style={{
                fontFamily: 'var(--font-display)',
                fontSize: '1.25rem',
                fontWeight: 700,
                letterSpacing: 'var(--ls-snug)',
                color: 'var(--clr-white)',
              }}>
                {siteName}
              </span>
            )}
          </Link>

          <nav aria-label="Main navigation">
            <ul className="main-nav">
              {navigation.map((link) => (
                <li key={link.href}>{renderNavLink(link)}</li>
              ))}
            </ul>
          </nav>

          <div className="nav-actions">
            {isHomepage && !authLoading && <NotificationBell user={user} />}
            {headerExtras}

            <button
              className="search-toggle"
              onClick={toggleSearch}
              aria-label="Search"
              aria-expanded={searchOpen}
            >
              {searchOpen ? <FaXmark /> : <FaMagnifyingGlass style={{ color: 'var(--clr-cyan)' }} />}
            </button>

            {!authLoading && isAuthenticated ? (
              <div className="user-dropdown">
                <button
                  className="user-dropdown-trigger"
                  onClick={(e) => {
                    e.stopPropagation();
                    setUserDropdownOpen(!userDropdownOpen);
                  }}
                  aria-expanded={userDropdownOpen}
                  aria-haspopup="true"
                >
                  <FaUser />
                  <FaChevronDown size={10} />
                </button>
                <div className={`user-dropdown-menu${userDropdownOpen ? ' open' : ''}`}>
                  <Link to="/dashboard" onClick={() => setUserDropdownOpen(false)}>
                    <FaGaugeHigh style={{ color: 'var(--clr-blue)' }} /> Dashboard
                  </Link>
                  <Link to="/profile" onClick={() => setUserDropdownOpen(false)}>
                    <FaGear style={{ color: 'var(--clr-purple)' }} /> Profile
                  </Link>
                  <button
                    onClick={() => {
                      setUserDropdownOpen(false);
                      handleSignout();
                    }}
                    disabled={signingOut}
                  >
                    {signingOut ? (
                      <FaSpinner className="icon-spin" />
                    ) : (
                      <FaRightFromBracket style={{ color: 'var(--clr-red)' }} />
                    )}
                    {signingOut ? 'Signing out...' : 'Sign Out'}
                  </button>
                </div>
              </div>
            ) : !authLoading && !isAuthenticated ? (
              <>
                <Link to="/login" className="nav-signin-btn">
                  <FaRightToBracket /> Sign In
                </Link>
                <Link to="/register" className="nav-signup-btn">
                  <FaUserPlus /> Sign Up
                </Link>
              </>
            ) : null}

            <button
              className="theme-toggle"
              onClick={toggleTheme}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? (
                <FaSun style={{ color: 'var(--clr-orange)' }} />
              ) : (
                <FaMoon style={{ color: 'var(--clr-purple)' }} />
              )}
            </button>

            <button
              className="mobile-toggle"
              onClick={(e) => {
                e.stopPropagation();
                setSearchOpen(false);
                setMobileMenuOpen(true);
              }}
              aria-label="Open menu"
              aria-expanded={mobileMenuOpen}
            >
              <FaBars />
            </button>
          </div>
        </div>
      </header>

      <SearchOverlay isOpen={searchOpen} onClose={closeSearch} />

      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              key="mobile-nav-overlay"
              className="mobile-nav-overlay"
              variants={overlayVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={closeMobileMenu}
            />

            <motion.div
              key="mobile-nav-panel"
              className="mobile-nav-panel"
              variants={mobilePanelVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <div className="mobile-nav-panel-inner">
                <div className="mobile-nav-header">
                  <div className="mobile-nav-header-row">
                    <div className="mobile-auth-top">
                      {!authLoading && isAuthenticated ? (
                        <button
                          className="mobile-signout-btn"
                          onClick={handleSignout}
                          disabled={signingOut}
                        >
                          {signingOut ? (
                            <FaSpinner className="icon-spin" />
                          ) : (
                            <FaRightFromBracket style={{ color: 'var(--clr-red)' }} />
                          )}
                          {signingOut ? 'Signing out...' : 'Sign Out'}
                        </button>
                      ) : !authLoading && !isAuthenticated ? (
                        <>
                          <Link
                            to="/login"
                            className="mobile-signin-btn"
                            onClick={closeMobileMenu}
                          >
                            <FaRightToBracket /> Sign In
                          </Link>
                          <Link
                            to="/register"
                            className="mobile-signup-btn"
                            onClick={closeMobileMenu}
                          >
                            <FaUserPlus /> Sign Up
                          </Link>
                        </>
                      ) : null}
                    </div>
                    <button
                      className="mobile-close-btn"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        closeMobileMenu();
                      }}
                      aria-label="Close menu"
                      type="button"
                    >
                      <FaXmark />
                    </button>
                  </div>
                </div>
                <nav className="mobile-nav-links">
                  {navigation.map(renderMobileNavLink)}
                  {!authLoading && isAuthenticated && (
                    <>
                      <div className="mobile-nav-divider" />
                      <Link to="/dashboard" onClick={closeMobileMenu}>
                        <FaGaugeHigh style={{ color: 'var(--clr-blue)' }} /> Dashboard
                      </Link>
                      <Link to="/profile" onClick={closeMobileMenu}>
                        <FaGear style={{ color: 'var(--clr-purple)' }} /> Profile
                      </Link>
                    </>
                  )}
                </nav>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <motion.main
        id="main-content"
        style={{
          flex: 1,
          marginTop: isHomepage ? 0 : 60,
          width: '100%',
          maxWidth: '100vw',
          overflowX: 'hidden'
        }}
        variants={pageVariants}
        initial="initial"
        animate="in"
        exit="out"
        transition={pageTransition}
        key={location.pathname}
      >
        {children}
      </motion.main>

      {showFooter && (
        <footer className="footer-fat">
          <div className="footer-inner">
            <div className="footer-brand">
              <Link to="/" className="logo-link">
                {logo ? (
                  <img src={logo} alt={siteName} className="footer-logo" />
                ) : (
                  <span className="logo-text">{siteName}</span>
                )}
              </Link>
              <p className="footer-tagline">
                Advancing biology and pharmacy education for every learner.
              </p>
              {footer.social_links?.length > 0 && (
                <div className="footer-social">
                  {footer.social_links.filter(Boolean).map((s, idx) => (
                    <a
                      key={s.platform || idx}
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={s.platform}
                    >
                      <i className={s.icon} />
                    </a>
                  ))}
                </div>
              )}
            </div>
            {footer.columns?.length > 0 && (
              <div className="footer-grid">
                {footer.columns.filter(Boolean).map((col, idx) => (
                  <div key={col.heading || idx}>
                    <h4 className="footer-heading">{col.heading}</h4>
                    <ul className="footer-col-list">
                      {(col.items || []).filter(Boolean).map((item, itemIdx) => (
                        <li key={item.label || itemIdx}>
                          {item.href?.startsWith('http') ? (
                            <a
                              href={item.href}
                              className="footer-col-link"
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {item.icon && <i className={item.icon} />}
                              {item.label}
                            </a>
                          ) : (
                            <Link to={item.href} className="footer-col-link">
                              {item.icon && <i className={item.icon} />}
                              {item.label}
                            </Link>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="footer-bottom">
            <p>&copy; {currentYear} {siteName}. All rights reserved.</p>
            <nav className="footer-bottom-nav">
              <Link to="/privacy">Privacy Policy</Link>
              <span className="footer-separator">•</span>
              <Link to="/terms">Terms of Use</Link>
              <span className="footer-separator">•</span>
              <Link to="/about">About Us</Link>
            </nav>
          </div>
        </footer>
      )}

      <button
        className="back-to-top-btn"
        data-visible={showBackToTop}
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        aria-label="Back to top"
      >
        <FaArrowUp />
      </button>

      <style>{`
        .nav-signin-btn,
        .nav-signup-btn {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.5rem 1rem;
          border-radius: 2rem;
          font-size: 0.9rem;
          font-weight: 600;
          text-decoration: none;
          transition: all 0.25s ease;
          white-space: nowrap;
        }

        .nav-signin-btn {
          color: var(--clr-cyan);
          border: 1.5px solid var(--clr-cyan);
          background: transparent;
        }

        .nav-signin-btn:hover {
          background: var(--clr-cyan);
          color: #fff;
        }

        .nav-signup-btn {
          background: var(--clr-cyan);
          color: #fff;
        }

        .nav-signup-btn:hover {
          background: var(--clr-magenta);
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(184, 135, 58, 0.3);
        }

        .back-to-top-btn {
          position: fixed;
          bottom: 2rem;
          right: 2rem;
          z-index: 1000;
          width: 3rem;
          height: 3rem;
          border-radius: 50%;
          border: none;
          background: var(--clr-cyan);
          color: #fff;
          font-size: 1.2rem;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          opacity: 0;
          transform: translateY(20px);
          pointer-events: none;
          box-shadow: 0 4px 16px rgba(10, 126, 126, 0.35);
          transition: transform 0.25s ease, opacity 0.25s ease, background 0.25s ease, box-shadow 0.25s ease;
        }

        .back-to-top-btn[data-visible="true"] {
          opacity: 1;
          transform: translateY(0);
          pointer-events: auto;
          animation: backToTopEnter 0.3s ease;
        }

        .back-to-top-btn:hover {
          background: var(--clr-magenta);
          transform: translateY(-3px) scale(1.06);
          box-shadow:
            0 0 0 4px rgba(10, 126, 126, 0.22),
            0 0 0 8px rgba(184, 135, 58, 0.18),
            0 0 0 12px rgba(59, 111, 212, 0.14),
            0 0 0 16px rgba(245, 158, 11, 0.1),
            0 8px 22px rgba(184, 135, 58, 0.4);
        }

        @keyframes backToTopEnter {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @media (prefers-reduced-motion: reduce) {
          .back-to-top-btn {
            transition: none;
            animation: none;
          }
        }

        @media (max-width: 768px) {
          .nav-signin-btn,
          .nav-signup-btn {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}
