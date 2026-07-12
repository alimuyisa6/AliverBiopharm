import { useState, useEffect, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaSun, FaMoon, FaBars, FaXmark, FaUser, FaChevronDown,
  FaSignInAlt, FaUserPlus, FaSignOutAlt, FaSpinner,
  FaGaugeHigh, FaGear, FaArrowUp,
} from 'react-icons/fa6';
import { useLayout } from '../context/LayoutContext';
import { signout } from '../api/client';

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
  hidden: { x: '100%', opacity: 0 },
  visible: { x: 0, opacity: 1, transition: { type: 'tween', duration: 0.3, ease: 'easeInOut' } },
  exit: { x: '100%', opacity: 0, transition: { type: 'tween', duration: 0.25, ease: 'easeInOut' } },
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

  const {
    logo,
    siteName,
    navigation,
    footer,
    loading,
    theme,
    toggleTheme,
    isAuthenticated,
    refreshUser,
    user,
  } = useLayout();

  const location = useLocation();
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 10);
      setShowBackToTop(window.scrollY > 400);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const handleSignout = useCallback(async () => {
    setSigningOut(true);
    try {
      await signout();
      await refreshUser();
      navigate('/');
    } catch {
    } finally {
      setSigningOut(false);
    }
  }, [refreshUser, navigate]);

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
          onClick={() => setMobileMenuOpen(false)}
        >
          {link.label}
        </a>
      );
    }
    return (
      <Link key={link.href} to={link.href} onClick={() => setMobileMenuOpen(false)}>
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
            {headerExtras}

            {isAuthenticated ? (
              <div className="user-dropdown">
                <button className="user-dropdown-trigger">
                  <FaUser />
                  <FaChevronDown size={10} />
                </button>
                <div className="user-dropdown-menu">
                  <Link to="/dashboard">
                    <FaGaugeHigh /> Dashboard
                  </Link>
                  <Link to="/profile">
                    <FaGear /> Profile
                  </Link>
                  <button onClick={handleSignout} disabled={signingOut}>
                    {signingOut ? (
                      <FaSpinner className="icon-spin" />
                    ) : (
                      <FaSignOutAlt />
                    )}
                    {signingOut ? 'Signing out...' : 'Sign Out'}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <Link to="/login" className="btn-primary" style={{ padding: '0.35rem 0.9rem', fontSize: '0.8rem' }}>
                  <FaSignInAlt /> Sign In
                </Link>
                <Link
                  to="/register"
                  className="btn-primary"
                  style={{
                    padding: '0.35rem 0.9rem',
                    fontSize: '0.8rem',
                    background: 'var(--clr-blue)',
                    boxShadow: 'var(--shadow-blue)',
                  }}
                >
                  <FaUserPlus /> Sign Up
                </Link>
              </>
            )}

            <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle theme">
              {theme === 'dark' ? <FaSun /> : <FaMoon />}
            </button>

            <button
              className="mobile-toggle"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open menu"
            >
              <FaBars />
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              className="mobile-nav-overlay active"
              variants={overlayVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={() => setMobileMenuOpen(false)}
            />

            <motion.div
              className="mobile-nav-panel active"
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
                        <button className="mobile-signout-btn" onClick={handleSignout} disabled={signingOut}>
                          {signingOut ? (
                            <FaSpinner className="icon-spin" />
                          ) : (
                            <FaSignOutAlt />
                          )}
                          {signingOut ? 'Signing out...' : 'Sign Out'}
                        </button>
                      ) : (
                        <>
                          <Link
                            to="/login"
                            className="mobile-signin-btn"
                            onClick={() => setMobileMenuOpen(false)}
                          >
                            <FaSignInAlt /> Sign In
                          </Link>
                          <Link
                            to="/register"
                            className="mobile-signup-btn"
                            onClick={() => setMobileMenuOpen(false)}
                          >
                            <FaUserPlus /> Sign Up
                          </Link>
                        </>
                      )}
                    </div>
                    <button
                      className="mobile-close-btn"
                      onClick={() => setMobileMenuOpen(false)}
                      aria-label="Close menu"
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
                      <Link to="/dashboard" onClick={() => setMobileMenuOpen(false)}>
                        <FaGaugeHigh /> Dashboard
                      </Link>
                      <Link to="/profile" onClick={() => setMobileMenuOpen(false)}>
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

      <motion.main
        id="main-content"
        style={{ flex: 1, marginTop: 60, width: '100%', maxWidth: '100vw', overflowX: 'hidden' }}
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
          <div className="footer-inner" style={{
            maxWidth: 'var(--max-width)',
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: '280px 1fr',
            gap: '2rem',
            padding: '0 1.5rem 2rem',
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <Link to="/" className="logo-link">
                {logo ? (
                  <img
                    src={logo}
                    alt={siteName}
                    style={{
                      height: 100,
                      maxHeight: 100,
                      width: 'auto',
                      maxWidth: 240,
                      objectFit: 'contain',
                      margin: '-30px 0',
                    }}
                  />
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
              <p style={{
                fontFamily: 'var(--font-body)',
                fontSize: 'var(--text-sm)',
                lineHeight: 'var(--lh-relaxed)',
                color: 'var(--clr-text-dim)',
                maxWidth: 240,
              }}>
                Advancing biology and pharmacy education for every learner.
              </p>
              {footer.social_links?.length > 0 && (
                <div className="footer-social">
                  {footer.social_links.filter(Boolean).map((s, idx) => {
                    const IconComponent = iconMap[s.icon] || null;
                    return (
                      <a key={s.platform || idx} href={s.url} target="_blank" rel="noopener noreferrer" aria-label={s.platform}>
                        {IconComponent && <IconComponent />}
                      </a>
                    );
                  })}
                </div>
              )}
            </div>

            {footer.columns?.length > 0 && (
              <div className="footer-grid">
                {footer.columns.filter(Boolean).map((col, idx) => (
                  <div key={col.heading || idx}>
                    <h4 style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: 'var(--text-xl)',
                      fontWeight: 700,
                      letterSpacing: 'var(--ls-snug)',
                      color: 'var(--clr-white)',
                      marginBottom: '0.75rem',
                    }}>
                      {col.heading}
                    </h4>
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

          <div className="footer-bottom" style={{
            maxWidth: 'var(--max-width)',
            margin: '0 auto',
            padding: '1.5rem 1.5rem 1rem',
            borderTop: '1px solid var(--clr-border-glow)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}>
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
        className={`back-to-top${showBackToTop ? ' visible' : ''}`}
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        aria-label="Back to top"
      >
        <FaArrowUp />
      </button>
    </div>
  );
}
