 import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaSun, FaMoon, FaBars, FaXmark, FaUser, FaChevronDown,
  FaRightToBracket, FaUserPlus, FaRightFromBracket, FaSpinner,
  FaGaugeHigh, FaGear, FaArrowUp,
} from 'react-icons/fa6';
import { useLayout } from '../contexts/LayoutContext';
import { signout } from '../api/client';
import NotificationBell from './NotificationBell';

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

export default function Layout({ children, headerExtras, showFooter = true }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  const isMounted = useRef(true);

  const {
    logo, siteName, navigation, footer, loading, theme,
    toggleTheme, isAuthenticated, refreshUser, user,
  } = useLayout();

  const location = useLocation();
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();
  const isHomepage = location.pathname === '/';

  // Dynamic favicon from Supabase logo, with a resilient fallback chain:
  // 1) Try to draw the logo onto a canvas so we can resize it into a clean
  //    32x32 / 180x180 icon.
  // 2) If the source image doesn't send CORS headers (common for Supabase
  //    Storage public URLs), the canvas becomes "tainted" and toDataURL()
  //    throws a SecurityError *inside* the async onload callback. That
  //    throw is NOT caught by a try/catch around the synchronous setup code,
  //    so it must be caught locally, right where it happens.
  // 3) On any failure (load error OR canvas taint), fall back to using the
  //    raw logo URL directly as the favicon href. Browsers will happily use
  //    a non-square/non-optimized image as a favicon.
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
          const size = 32; // Standard favicon size
          canvas.width = size;
          canvas.height = size;

          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, size, size);

          // 'Cover' fit (with a small extra zoom) instead of 'contain'.
          // At 16-32px, a logo drawn with letterboxed whitespace around it
          // reads as a faint speck. Filling the frame — even if it means
          // cropping a bit of empty margin off the source image — keeps
          // the mark legible in the browser tab.
          const zoom = 1.15;
          const scale = Math.max(size / img.width, size / img.height) * zoom;
          const x = (size - img.width * scale) / 2;
          const y = (size - img.height * scale) / 2;
          ctx.drawImage(img, x, y, img.width * scale, img.height * scale);

          // This is the line that throws SecurityError on a tainted canvas
          const faviconUrl = canvas.toDataURL('image/png');

          const faviconLink = document.createElement('link');
          faviconLink.rel = 'icon';
          faviconLink.type = 'image/png';
          faviconLink.href = faviconUrl;
          document.head.appendChild(faviconLink);

          // Apple touch icon (larger size)
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
          // Canvas was tainted (no CORS headers on the logo URL) — fall
          // back to using the logo URL directly instead of silently
          // failing to set any favicon at all.
          console.error('Favicon canvas processing failed, using direct URL fallback:', err);
          applyDirectFallback(logoUrl);
        }
      };

      img.onerror = () => {
        // Image itself failed to load — still fall back to a direct link
        // so we don't leave the favicon unset.
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
    const onScroll = () => {
      setScrolled(window.scrollY > 10);
      setShowBackToTop(window.scrollY > 400);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Force close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
    setUserDropdownOpen(false);
    document.body.style.overflow = '';

    const timeoutId = setTimeout(() => {
      if (isMounted.current) {
        setMobileMenuOpen(false);
        document.body.style.overflow = '';
      }
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [location.pathname]);

  // Close user dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (userDropdownOpen && !e.target.closest('.user-dropdown')) {
        setUserDropdownOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [userDropdownOpen]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileMenuOpen]);

  const handleSignout = useCallback(async () => {
    setSigningOut(true);
    setUserDropdownOpen(false);
    try {
      await signout();
      await refreshUser();
      navigate('/');
    } catch {
      // Silent fail
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
      {/* Skip to main content link */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      {/* Header */}
      <header className={`site-header${scrolled ? ' scrolled' : ''}`}>
        <div className="header-container">
          {/* Logo */}
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

          {/* Desktop Navigation */}
          <nav aria-label="Main navigation">
            <ul className="main-nav">
              {navigation.map((link) => (
                <li key={link.href}>{renderNavLink(link)}</li>
              ))}
            </ul>
          </nav>

          {/* Nav Actions */}
          <div className="nav-actions">
            {isHomepage && <NotificationBell user={user} />}
            {headerExtras}

            {/* User Dropdown (Desktop + Mobile) */}
            {isAuthenticated ? (
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
                    <FaGaugeHigh /> Dashboard
                  </Link>
                  <Link to="/profile" onClick={() => setUserDropdownOpen(false)}>
                    <FaGear /> Profile
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
                      <FaRightFromBracket />
                    )}
                    {signingOut ? 'Signing out...' : 'Sign Out'}
                  </button>
                </div>
              </div>
            ) : null}

            {/* Theme Toggle */}
            <button
              className="theme-toggle"
              onClick={toggleTheme}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <FaSun /> : <FaMoon />}
            </button>

            {/* Mobile Toggle (Hamburger) */}
            <button
              className="mobile-toggle"
              onClick={(e) => {
                e.stopPropagation();
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

      {/* Mobile Navigation Panel */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            {/* Overlay */}
            <motion.div
              key="mobile-nav-overlay"
              className="mobile-nav-overlay"
              variants={overlayVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={closeMobileMenu}
            />

            {/* Panel */}
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
                      {isAuthenticated ? (
                        <button
                          className="mobile-signout-btn"
                          onClick={handleSignout}
                          disabled={signingOut}
                        >
                          {signingOut ? (
                            <FaSpinner className="icon-spin" />
                          ) : (
                            <FaRightFromBracket />
                          )}
                          {signingOut ? 'Signing out...' : 'Sign Out'}
                        </button>
                      ) : (
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
                      )}
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
                  {isAuthenticated && (
                    <>
                      <div className="mobile-nav-divider" />
                      <Link to="/dashboard" onClick={closeMobileMenu}>
                        <FaGaugeHigh /> Dashboard
                      </Link>
                      <Link to="/profile" onClick={closeMobileMenu}>
                        <FaGear /> Profile
                      </Link>
                    </>
                  )}
                </nav>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <motion.main
        id="main-content"
        style={{
          flex: 1,
          marginTop: 60,
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

      {/* Footer */}
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

      {/* Back to Top Button with Cyan, Magenta, Orange, and Blue colors */}
      <button
        className={`back-to-top${showBackToTop ? ' visible' : ''}`}
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        aria-label="Back to top"
        style={{
          background: 'linear-gradient(135deg, #00BCD4 0%, #E91E63 33%, #FF9800 66%, #2196F3 100%)',
          border: 'none',
          boxShadow: '0 4px 15px rgba(0, 188, 212, 0.4), 0 0 20px rgba(233, 30, 99, 0.2)',
          transition: 'all 0.3s ease',
          position: 'fixed',
          bottom: '2rem',
          right: '2rem',
          zIndex: 1000,
          width: '3rem',
          height: '3rem',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          opacity: showBackToTop ? 1 : 0,
          transform: showBackToTop ? 'translateY(0)' : 'translateY(20px)',
          pointerEvents: showBackToTop ? 'auto' : 'none',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.1)';
          e.currentTarget.style.boxShadow = '0 6px 20px rgba(0, 188, 212, 0.6), 0 0 30px rgba(233, 30, 99, 0.4), 0 0 40px rgba(255, 152, 0, 0.2)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = '0 4px 15px rgba(0, 188, 212, 0.4), 0 0 20px rgba(233, 30, 99, 0.2)';
        }}
      >
        <FaArrowUp style={{ color: '#FFFFFF', fontSize: '1.2rem' }} />
      </button>

      {/* CSS for the gradient animation */}
      <style>{`
        .back-to-top {
          animation: gradientShift 3s ease infinite;
          background-size: 200% 200% !important;
        }

        @keyframes gradientShift {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }

        .back-to-top.visible {
          animation: gradientShift 3s ease infinite, fadeInUp 0.3s ease;
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
