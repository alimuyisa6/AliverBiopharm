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
import SplashScreen from './SplashScreen';

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
  const location = useLocation();
  const navigate = useNavigate();

  const {
    logo, siteName, navigation, footer, loading, authLoading, theme,
    toggleTheme, isAuthenticated, refreshUser, user,
  } = useLayout();

  // ---- Determine if we are on an authentication page ----
  const isAuthPage = location.pathname === '/login' || location.pathname === '/register';

  const currentYear = new Date().getFullYear();
  const isHomepage = location.pathname === '/';

  // ---- Favicon effect (unchanged) ----
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
      img.onerror = () => { applyDirectFallback(logoUrl); };
      img.src = logoUrl;
    };
    setFavicon(logo);
    return () => { cancelled = true; };
  }, [logo]);

  useEffect(() => { return () => { isMounted.current = false; }; }, []);

  // ---- Scroll listener (unchanged) ----
  useEffect(() => {
    const onScroll = throttle(() => {
      setScrolled(window.scrollY > 10);
      setShowBackToTop(window.scrollY > 400);
    }, 100);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // ---- Close mobile menu on route change ----
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

  // ---- Click outside dropdown ----
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
      if (searchOpen && !e.target.closest('.search-overlay-panel') && !e.target.closest('.search-toggle')) {
        setSearchOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [searchOpen]);

  useEffect(() => {
    document.body.style.overflow = (mobileMenuOpen || searchOpen) ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileMenuOpen, searchOpen]);

  // ---- Handlers ----
  const handleSignout = useCallback(async () => {
    setSigningOut(true);
    setUserDropdownOpen(false);
    try { await signout(); await refreshUser(); navigate('/'); } catch {} finally { if (isMounted.current) setSigningOut(false); }
  }, [refreshUser, navigate]);

  const closeMobileMenu = useCallback(() => { setMobileMenuOpen(false); document.body.style.overflow = ''; }, []);
  const toggleSearch = useCallback((e) => { e.stopPropagation(); setMobileMenuOpen(false); setSearchOpen((open) => !open); }, []);
  const closeSearch = useCallback(() => { setSearchOpen(false); }, []);

  const renderNavLink = (link) => {
    const isExternal = link.href?.startsWith('http') || link.href?.startsWith('mailto');
    if (isExternal) return <a href={link.href} target="_blank" rel="noopener noreferrer">{link.label}</a>;
    return <Link to={link.href} className={location.pathname === link.href ? 'active' : ''}>{link.label}</Link>;
  };

  const renderMobileNavLink = (link) => {
    const isExternal = link.href?.startsWith('http') || link.href?.startsWith('mailto');
    if (isExternal) return <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer" onClick={closeMobileMenu}>{link.label}</a>;
    return <Link key={link.href} to={link.href} onClick={closeMobileMenu}>{link.label}</Link>;
  };

  // ---- Render ----
  return (
    <div className="app-layout">
      <AnimatePresence mode="wait">
        {loading && <SplashScreen key="splash" />}
      </AnimatePresence>

      {!loading && (
        <>
          <a href="#main-content" className="skip-link">Skip to main content</a>

          {/* Header – hidden on auth pages */}
          {!isAuthPage && (
            <header className={`site-header${scrolled ? ' scrolled' : ''}`}>
              <div className="header-container">
                <Link to="/" className="logo-link" aria-label={`${siteName} Home`}>
                  {logo ? <img src={logo} alt={siteName} loading="eager" /> : <span className="logo-text">{siteName}</span>}
                </Link>

                <nav aria-label="Main navigation">
                  <ul className="main-nav">
                    {navigation.map((link) => <li key={link.href}>{renderNavLink(link)}</li>)}
                  </ul>
                </nav>

                <div className="nav-actions">
                  {isHomepage && !authLoading && <NotificationBell user={user} />}
                  {headerExtras}

                  <button className={`search-toggle${searchOpen ? ' active' : ''}`} onClick={toggleSearch} aria-label="Search" aria-expanded={searchOpen}>
                    {searchOpen ? <FaXmark /> : <FaMagnifyingGlass className="icon-cyan" />}
                  </button>

                  {!authLoading && isAuthenticated ? (
                    <div className="user-dropdown">
                      <button className="user-dropdown-trigger" onClick={(e) => { e.stopPropagation(); setUserDropdownOpen(!userDropdownOpen); }} aria-expanded={userDropdownOpen} aria-haspopup="true">
                        <FaUser /> <FaChevronDown size={10} />
                      </button>
                      <div className={`user-dropdown-menu${userDropdownOpen ? ' open' : ''}`}>
                        <Link to="/dashboard" onClick={() => setUserDropdownOpen(false)}><FaGaugeHigh className="icon-blue" /> Dashboard</Link>
                        <Link to="/profile" onClick={() => setUserDropdownOpen(false)}><FaGear className="icon-purple" /> Profile</Link>
                        <button onClick={() => { setUserDropdownOpen(false); handleSignout(); }} disabled={signingOut}>
                          {signingOut ? <FaSpinner className="icon-spin" /> : <FaRightFromBracket className="icon-red" />}
                          {signingOut ? 'Signing out...' : 'Sign Out'}
                        </button>
                      </div>
                    </div>
                  ) : !authLoading && !isAuthenticated ? (
                    <>
                      <Link to="/login" className="nav-signin-btn"><FaRightToBracket /> Sign In</Link>
                      <Link to="/register" className="nav-signup-btn"><FaUserPlus /> Sign Up</Link>
                    </>
                  ) : null}

                  <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle theme">
                    {theme === 'dark' ? <FaSun className="icon-orange" /> : <FaMoon className="icon-purple" />}
                  </button>

                  <button className="mobile-toggle" onClick={(e) => { e.stopPropagation(); setSearchOpen(false); setMobileMenuOpen(true); }} aria-label="Open menu" aria-expanded={mobileMenuOpen}>
                    <FaBars />
                  </button>
                </div>
              </div>
            </header>
          )}

          {/* Search Overlay */}
          <SearchOverlay isOpen={searchOpen} onClose={closeSearch} />

          {/* Mobile Menu */}
          <AnimatePresence>
            {mobileMenuOpen && (
              <>
                <motion.div key="mobile-nav-overlay" className="mobile-nav-overlay" variants={overlayVariants} initial="hidden" animate="visible" exit="exit" onClick={closeMobileMenu} />
                <motion.div key="mobile-nav-panel" className="mobile-nav-panel" variants={mobilePanelVariants} initial="hidden" animate="visible" exit="exit">
                  <div className="mobile-nav-panel-inner">
                    <div className="mobile-nav-header">
                      <div className="mobile-nav-header-row">
                        <div className="mobile-auth-top">
                          {!authLoading && isAuthenticated ? (
                            <button className="mobile-signout-btn" onClick={handleSignout} disabled={signingOut}>
                              {signingOut ? <FaSpinner className="icon-spin" /> : <FaRightFromBracket className="icon-red" />}
                              {signingOut ? 'Signing out...' : 'Sign Out'}
                            </button>
                          ) : !authLoading && !isAuthenticated ? (
                            <>
                              <Link to="/login" className="mobile-signin-btn" onClick={closeMobileMenu}><FaRightToBracket /> Sign In</Link>
                              <Link to="/register" className="mobile-signup-btn" onClick={closeMobileMenu}><FaUserPlus /> Sign Up</Link>
                            </>
                          ) : null}
                        </div>
                        <button className="mobile-close-btn" onClick={(e) => { e.preventDefault(); e.stopPropagation(); closeMobileMenu(); }} aria-label="Close menu" type="button"><FaXmark /></button>
                      </div>
                    </div>
                    <nav className="mobile-nav-links">
                      {navigation.map(renderMobileNavLink)}
                      {!authLoading && isAuthenticated && (
                        <>
                          <div className="mobile-nav-divider" />
                          <Link to="/dashboard" onClick={closeMobileMenu}><FaGaugeHigh className="icon-blue" /> Dashboard</Link>
                          <Link to="/profile" onClick={closeMobileMenu}><FaGear className="icon-purple" /> Profile</Link>
                        </>
                      )}
                    </nav>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>

          {/* Main content – add auth class when on auth pages */}
          <motion.main
            id="main-content"
            className={`main-content${isHomepage ? ' main-content-home' : ''}${isAuthPage ? ' main-content-auth' : ''}`}
            variants={pageVariants}
            initial="initial"
            animate="in"
            exit="out"
            transition={pageTransition}
            key={location.pathname}
          >
            {children}
          </motion.main>

          {/* Footer – hidden on auth pages */}
          {!isAuthPage && showFooter && (
            <footer className="footer-fat">
              <div className="footer-inner">
                <div className="footer-brand">
                  <Link to="/" className="logo-link">
                    {logo ? <img src={logo} alt={siteName} className="footer-logo" /> : <span className="logo-text">{siteName}</span>}
                  </Link>
                  <p className="footer-tagline">Advancing biology and pharmacy education for every learner.</p>
                  {footer.social_links && Object.keys(footer.social_links).length > 0 && (
                    <div className="footer-social">
                      {Object.entries(footer.social_links).map(([platform, url]) => (
                        <a key={platform} href={url} target="_blank" rel="noopener noreferrer" aria-label={platform}>
                          <i className={`fa-brands fa-${platform}`} />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
                {footer.quick_links && footer.quick_links.length > 0 && (
                  <div className="footer-grid">
                    <div>
                      <h4 className="footer-heading">Quick Links</h4>
                      <ul className="footer-col-list">
                        {footer.quick_links.filter(Boolean).map((item, itemIdx) => (
                          <li key={item.label || itemIdx}>
                            {item.path?.startsWith('http') ? (
                              <a href={item.path} className="footer-col-link" target="_blank" rel="noopener noreferrer">{item.label}</a>
                            ) : (
                              <Link to={item.path} className="footer-col-link">{item.label}</Link>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                    {footer.resource_links && footer.resource_links.length > 0 && (
                      <div>
                        <h4 className="footer-heading">Resources</h4>
                        <ul className="footer-col-list">
                          {footer.resource_links.filter(Boolean).map((item, itemIdx) => (
                            <li key={item.label || itemIdx}><Link to={item.path} className="footer-col-link">{item.label}</Link></li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {footer.community_links && footer.community_links.length > 0 && (
                      <div>
                        <h4 className="footer-heading">Community</h4>
                        <ul className="footer-col-list">
                          {footer.community_links.filter(Boolean).map((item, itemIdx) => (
                            <li key={item.label || itemIdx}><Link to={item.path} className="footer-col-link">{item.label}</Link></li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="footer-bottom">
                {/* Smaller copyright text */}
                <p className="footer-bottom-copy">&copy; {currentYear} {siteName}. All rights reserved.</p>
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

          {/* Back to Top Button */}
          <button className={`back-to-top-btn${showBackToTop ? ' visible' : ''}`} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="Back to top">
            <FaArrowUp />
          </button>
        </>
      )}
    </div>
  );
}
