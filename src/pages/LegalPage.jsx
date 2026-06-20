 import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAllSiteSections } from '../api/client';

export default function LegalPage({ type }) {
  const [sections, setSections] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');

  useEffect(() => {
    async function load() {
      const data = await getAllSiteSections();
      setSections(data);
    }
    load();
  }, []);

  if (!sections) return <div className="homepage">Loading...</div>;

  const page = sections[type];
  const currentYear = new Date().getFullYear();
  const navLinks = sections?.navigation?.links || [{ href: '/', label: 'Home' }];

  return (
    <div className="homepage">
      <header className="site-header" id="site-header">
        <div className="header-container">
          <Link to="/" className="logo-link" aria-label="AliverBiopharm Home">
            {sections?.site_config?.logo_url ? (
              <img src={sections.site_config.logo_url} alt="AliverBiopharm" style={{ height: '70px', width: 'auto' }} />
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
            <button className="mobile-toggle" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="Open menu">
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
            {navLinks.map(link => (
              link.href.startsWith('#') || link.href.startsWith('http') ? (
                <a key={link.href} href={link.href}>{link.label}</a>
              ) : (
                <Link key={link.href} to={link.href} onClick={() => setMobileMenuOpen(false)}>{link.label}</Link>
              )
            ))}
          </nav>
        </div>
      </div>
      <div className={`mobile-nav-overlay ${mobileMenuOpen ? 'active' : ''}`} onClick={() => setMobileMenuOpen(false)}></div>

      <section className="section reveal legal-section">
        <div className="legal-content-wrap">
          <h1 className="legal-title">{page?.title || 'Page not found'}</h1>
          {page?.sections?.length ? (
            <div className="legal-body">
              {page.sections.map((block, idx) => (
                <div key={idx} className="legal-block">
                  {block.heading && <h2>{block.heading}</h2>}
                  {block.content.split('\n\n').map((para, pIdx) => (
                    <p key={pIdx}>{para}</p>
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
        <div style={{ maxWidth: 'var(--max-width)', margin: '0 auto', display: 'flex', justifyContent: 'space-between', gap: '40px', flexWrap: 'wrap' }}>
          <div style={{ maxWidth: '260px' }}>
            <Link to="/" className="logo-link" style={{ marginBottom: '14px', display: 'inline-flex' }}>
              {sections?.site_config?.logo_url ? (
                <img src={sections.site_config.logo_url} alt="AliverBiopharm" style={{ height: '50px' }} />
              ) : (
                'AliverBiopharm'
              )}
            </Link>
            <p style={{ fontSize: '.85rem', lineHeight: 1.7, color: 'var(--clr-text-dim)' }}>
              Advancing biology and pharmacy education for every learner.
            </p>
            <div className="footer-social">
              {(sections?.footer?.social_links || []).map(s => (
                <a key={s.platform} href={s.url} target="_blank" rel="noreferrer">
                  <i className={s.icon}></i>
                </a>
              ))}
            </div>
          </div>

          <div className="footer-grid">
            {(sections?.footer?.columns || []).map(col => (
              <div key={col.heading}>
                <h4 style={{ fontWeight: 700, color: 'var(--clr-white)', fontSize: '0.9rem', marginBottom: '16px' }}>
                  {col.heading}
                </h4>
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {col.items?.map(item => (
                    <li key={item.label}>
                      {item.href.startsWith('#') || item.href.startsWith('http') ? (
                        <a href={item.href} style={{ fontSize: '0.875rem', color: 'var(--clr-text-dim)' }}>
                          {item.icon && <i className={item.icon} style={{ marginRight: '0.5rem' }}></i>}
                          {item.label}
                        </a>
                      ) : (
                        <Link to={item.href} style={{ fontSize: '0.875rem', color: 'var(--clr-text-dim)' }}>
                          {item.icon && <i className={item.icon} style={{ marginRight: '0.5rem' }}></i>}
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

        <div style={{ maxWidth: 'var(--max-width)', margin: '2rem auto 0', paddingTop: '1.5rem', borderTop: '1px solid var(--clr-border-glow)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <p style={{ fontSize: '.75rem', color: 'var(--clr-text-muted)' }}>&copy; {currentYear} AliverBiopharm. All rights reserved.</p>
          <nav style={{ display: 'flex', gap: '22px' }}>
            <Link to="/privacy" style={{ fontSize: '.875rem', color: 'var(--clr-text-dim)' }}>Privacy Policy</Link>
            <Link to="/terms" style={{ fontSize: '.875rem', color: 'var(--clr-text-dim)' }}>Terms of Use</Link>
            <Link to="/accessibility" style={{ fontSize: '.875rem', color: 'var(--clr-text-dim)' }}>Accessibility</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
