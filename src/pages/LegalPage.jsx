 import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { getAllSiteSections } from '../api/client';

function RichText({ text }) {
  const TOKEN_RE = /([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})|((https?:\/\/)[^\s<>"']+)/g;
  const parts = [];
  let last = 0;
  let match;

  while ((match = TOKEN_RE.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const raw = match[0];
    const isEmail = !!match[1];
    parts.push(
      <a
        key={match.index}
        href={isEmail ? `mailto:${raw}` : raw}
        target={isEmail ? undefined : '_blank'}
        rel={isEmail ? undefined : 'noopener noreferrer'}
        className="legal-link"
      >
        {raw}
      </a>
    );
    last = match.index + raw.length;
  }

  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

export default function LegalPage({ type }) {
  const [sections, setSections] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  const { pathname } = useLocation();

  const currentYear = new Date().getFullYear();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname]);

  useEffect(() => {
    getAllSiteSections().then(setSections).catch(() => {});
  }, []);

  if (!sections) {
    return (
      <div className="homepage">
        <div className="info-page-loading">
          <div className="info-page-spinner" />
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  const page = sections[type];
  const navLinks = sections?.navigation?.links || [{ href: '/', label: 'Home' }];

  return (
    <div className="homepage">
      <header className="site-header" id="site-header">
        <div className="header-container">
          <Link to="/" className="logo-link" aria-label="AliverBiopharm Home">
            {sections?.site_config?.logo_url ? (
              <img src={sections.site_config.logo_url} alt="AliverBiopharm" />
            ) : (
              'AliverBiopharm'
            )}
          </Link>
          <nav aria-label="Main navigation">
            <ul className="main-nav" id="main-nav">
              {navLinks.map(link => (
                <li key={link.href}>
                  {link.href.startsWith('#') || link.href.startsWith('http') ? (
                    <a href={link.href}>{link.label}</a>
                  ) : (
                    <Link to={link.href}>{link.label}</Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>
          <div className="nav-actions">
            <button
              className="theme-toggle"
              onClick={() => {
                const dark = document.body.classList.toggle('dark-mode');
                localStorage.setItem('theme', dark ? 'dark' : 'light');
                setTheme(dark ? 'dark' : 'light');
              }}
              aria-label="Toggle dark mode"
            >
              <i className={`fa-solid ${theme === 'dark' ? 'fa-sun' : 'fa-moon'}`}></i>
            </button>
            <button
              className="mobile-toggle"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Open menu"
            >
              <i className="fa-solid fa-bars"></i>
            </button>
          </div>
        </div>
      </header>

      <div className={`mobile-nav-panel ${mobileMenuOpen ? 'active' : ''}`}>
        <div className="mobile-nav-panel-inner">
          <div className="mobile-nav-header">
            <div className="mobile-nav-header-row">
              <button className="mobile-close-btn" onClick={() => setMobileMenuOpen(false)}>
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
          </div>
          <nav className="mobile-nav-links">
            {navLinks.map(link =>
              link.href.startsWith('#') || link.href.startsWith('http') ? (
                <a key={link.href} href={link.href}>{link.label}</a>
              ) : (
                <Link key={link.href} to={link.href} onClick={() => setMobileMenuOpen(false)}>
                  {link.label}
                </Link>
              )
            )}
          </nav>
        </div>
      </div>
      <div
        className={`mobile-nav-overlay ${mobileMenuOpen ? 'active' : ''}`}
        onClick={() => setMobileMenuOpen(false)}
      />

      <section className="legal-section">
        <div className="legal-content-wrap">
          <h1 className="legal-title">{page?.title || 'Page Not Found'}</h1>
          {page?.sections?.length ? (
            <div className="legal-body">
              {page.sections.map((block, idx) => (
                <div key={idx} className="legal-block">
                  {block.heading && <h2>{block.heading}</h2>}
                  {block.content.split('\n\n').map((para, pIdx) => (
                    <p key={pIdx}>
                      <RichText text={para} />
                    </p>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <p className="legal-empty">No content has been added for this page yet.</p>
          )}
        </div>
      </section>

      <footer className="footer-fat">
        <div className="footer-inner">
          <div className="footer-brand">
            <Link to="/" className="logo-link">
              {sections?.site_config?.logo_url ? (
                <img src={sections.site_config.logo_url} alt="AliverBiopharm" className="footer-logo" />
              ) : (
                'AliverBiopharm'
              )}
            </Link>
            <p className="footer-tagline">
              Advancing biology and pharmacy education for every learner.
            </p>
            <div className="footer-social">
              {(sections?.footer?.social_links || []).filter(Boolean).map(s => (
                <a key={s.platform} href={s.url} target="_blank" rel="noreferrer">
                  <i className={s.icon}></i>
                </a>
              ))}
            </div>
          </div>
          <div className="footer-grid">
            {(sections?.footer?.columns || []).filter(Boolean).map(col => (
              <div key={col.heading}>
                <h4 className="footer-col-heading">{col.heading}</h4>
                <ul className="footer-col-list">
                  {(col.items || []).filter(Boolean).map(item => (
                    <li key={item.label}>
                      {item.href.startsWith('#') || item.href.startsWith('http') ? (
                        <a href={item.href} className="footer-col-link">
                          {item.icon && <i className={item.icon}></i>}
                          {item.label}
                        </a>
                      ) : (
                        <Link to={item.href} className="footer-col-link">
                          {item.icon && <i className={item.icon}></i>}
                          {item.label}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="footer-bottom">
          <p>&copy; {currentYear} AliverBiopharm. All rights reserved.</p>
          <nav className="footer-bottom-nav">
            <Link to="/privacy">Privacy Policy</Link>
            <Link to="/terms">Terms of Use</Link>
            <Link to="/about">About Us</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
