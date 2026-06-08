 import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import useTheme from '../../hooks/useTheme';
import { apiCall } from '../../services/apiService';

function Navbar() {
  const { isAuthenticated, user, logout } = useAuth();
  const { darkMode, toggleTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [logoUrl, setLogoUrl] = useState('');
  const [navLinks, setNavLinks] = useState([]);
  const location = useLocation();

  useEffect(() => {
    setMobileOpen(false);
  }, [location]);

  useEffect(() => {
    apiCall('get_all_site_sections').then(sections => {
      if (sections?.site_config?.logo_url) setLogoUrl(sections.site_config.logo_url);
      if (sections?.navigation?.links) setNavLinks(sections.navigation.links);
    }).catch(() => {});
  }, []);

  const handleLogout = async () => {
    await logout();
    setMobileOpen(false);
  };

  return (
    <>
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <header className="site-header" id="site-header">
        <div className="header-container">
          <Link to="/" className="logo-link" aria-label="AliverBiopharm Home">
            <div style={{ height: '60px', overflow: 'hidden', display: 'flex', alignItems: 'center' }}>
              {logoUrl ? (
                <img
                  src={logoUrl}
                  fetchPriority="high"
                  loading="eager"
                  style={{
                    height: 'auto',
                    maxHeight: '100px',
                    width: 'auto',
                    maxWidth: '260px',
                    objectFit: 'contain',
                    display: 'block',
                    margin: '0',
                    filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.15))',
                  }}
                  alt="AliverBiopharm"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              ) : (
                <span className="font-display font-bold" style={{ fontSize: '1.25rem', color: 'var(--clr-white)' }}>AliverBiopharm</span>
              )}
            </div>
          </Link>
          <nav aria-label="Main navigation">
            <ul className="main-nav" id="main-nav">
              {navLinks.map((link, i) => (
                <li key={i}>
                  <a href={link.href}>{link.label}</a>
                </li>
              ))}
              {isAuthenticated && (
                <li className="user-dropdown">
                  <button className="user-dropdown-trigger" aria-haspopup="true" aria-expanded="false">
                    <i className="fa-solid fa-user" aria-hidden="true"></i> {user?.email?.split('@')[0]}
                  </button>
                  <div className="user-dropdown-menu">
                    <Link to="/dashboard">Dashboard</Link>
                    <button onClick={handleLogout}>Sign Out</button>
                  </div>
                </li>
              )}
            </ul>
          </nav>
          <div className="nav-actions">
            <button className="theme-toggle" id="theme-toggle" onClick={toggleTheme} aria-label="Toggle dark mode">
              <i className={`fa-solid ${darkMode ? 'fa-sun' : 'fa-moon'}`} aria-hidden="true"></i>
            </button>
            <button className="mobile-toggle" id="mobile-toggle" onClick={() => setMobileOpen(prev => !prev)} aria-label="Open menu" aria-expanded={mobileOpen}>
              <i className="fa-solid fa-bars" aria-hidden="true"></i>
            </button>
          </div>
        </div>
      </header>

      <div className={`mobile-nav-panel ${mobileOpen ? 'active' : ''}`} id="mobile-nav-panel" aria-hidden={!mobileOpen}>
        <div className="mobile-nav-panel-inner">
          <div className="mobile-nav-header">
            <div className="mobile-nav-header-row">
              <div className="mobile-auth-top" id="mobile-auth-top">
                {isAuthenticated ? (
                  <button className="mobile-signout-btn" onClick={handleLogout}><i className="fa-solid fa-right-from-bracket"></i> Sign Out</button>
                ) : (
                  <>
                    <button className="mobile-signin-btn" onClick={() => window.dispatchEvent(new CustomEvent('open-auth', { detail: 'signin' }))}>Sign In</button>
                    <button className="mobile-signup-btn" onClick={() => window.dispatchEvent(new CustomEvent('open-auth', { detail: 'signup' }))}>Create Account</button>
                  </>
                )}
              </div>
              <button className="mobile-close-btn" id="mobile-close-btn" onClick={() => setMobileOpen(false)} aria-label="Close menu">
                <i className="fa-solid fa-xmark" aria-hidden="true"></i>
              </button>
            </div>
          </div>
          <nav className="mobile-nav-links" id="mobile-nav-links" aria-label="Mobile navigation">
            {navLinks.map((link, i) => (
              <a key={i} href={link.href}>{link.label}</a>
            ))}
          </nav>
          <div className="mobile-nav-divider"></div>
          <div className="mobile-nav-footer" id="mobile-nav-footer"></div>
        </div>
      </div>
      <div className={`mobile-nav-overlay ${mobileOpen ? 'active' : ''}`} id="mobile-nav-overlay" onClick={() => setMobileOpen(false)}></div>
    </>
  );
}

export default Navbar;
