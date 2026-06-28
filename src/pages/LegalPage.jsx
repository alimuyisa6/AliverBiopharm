 import React, { useState, useEffect } from 'react';
import { Link, useParams, useLocation } from 'react-router-dom';
import { getInfoSection } from '../api/client';
import { getSections } from '../api/sections';

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function escapeAttr(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#039;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function getCategoryLabel(category) {
  const map = {
    biology: 'Biology',
    pharmacy: 'Pharmacy',
    safety: 'Safety',
    study: 'Study Guide',
    exam: 'Exam Prep',
    clinical: 'Clinical Practice',
    calculations: 'Calculations',
    general: 'Resource'
  };
  return map[category] || 'Resource';
}

export default function InfoPage() {
  const { slug } = useParams();
  const { pathname } = useLocation();
  const [section, setSection] = useState(null);
  const [siteSections, setSiteSections] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');

  const currentYear = new Date().getFullYear();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname]);

  useEffect(() => {
    getSections().then(setSiteSections).catch(() => {});
  }, []);

  useEffect(() => {
    if (!slug) {
      setError('not_found');
      setLoading(false);
      return;
    }
    getInfoSection(slug)
      .then(data => {
        setSection(data);
        document.title = data?.title || slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      })
      .catch(err => {
        console.error('[InfoPage] Fetch error:', err);
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [slug]);

  const navLinks = siteSections?.navigation?.links || [{ href: '/', label: 'Home' }];

  const header = (
    <header className="site-header" id="site-header">
      <div className="header-container">
        <Link to="/" className="logo-link" aria-label="AliverBiopharm Home">
          {siteSections?.site_config?.logo_url ? (
            <img src={siteSections.site_config.logo_url} alt="AliverBiopharm" style={{ height: '70px', width: 'auto' }} />
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
  );

  const mobileNav = (
    <>
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
                <Link key={link.href} to={link.href} onClick={() => setMobileMenuOpen(false)}>{link.label}</Link>
              )
            )}
          </nav>
        </div>
      </div>
      <div className={`mobile-nav-overlay ${mobileMenuOpen ? 'active' : ''}`} onClick={() => setMobileMenuOpen(false)}></div>
    </>
  );

  const footer = (
    <footer className="footer-fat">
      <div style={{ maxWidth: 'var(--max-width)', margin: '0 auto', display: 'flex', justifyContent: 'space-between', gap: '40px', flexWrap: 'wrap' }}>
        <div style={{ maxWidth: '260px' }}>
          <Link to="/" className="logo-link" style={{ marginBottom: '14px', display: 'inline-flex' }}>
            {siteSections?.site_config?.logo_url ? (
              <img src={siteSections.site_config.logo_url} alt="AliverBiopharm" style={{ height: '50px' }} />
            ) : (
              'AliverBiopharm'
            )}
          </Link>
          <p style={{ fontSize: '.85rem', lineHeight: 1.7, color: 'var(--clr-text-dim)' }}>
            Advancing biology and pharmacy education for every learner.
          </p>
          <div className="footer-social">
            {(siteSections?.footer?.social_links || []).map(s => (
              <a key={s.platform} href={s.url} target="_blank" rel="noreferrer">
                <i className={s.icon}></i>
              </a>
            ))}
          </div>
        </div>
        <div className="footer-grid">
          {(siteSections?.footer?.columns || []).map(col => (
            <div key={col.heading}>
              <h4 style={{ fontWeight: 700, color: 'var(--clr-white)', fontSize: '0.9rem', marginBottom: '16px' }}>
                {col.heading}
              </h4>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {(col.items || []).map(item => (
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
          <Link to="/about" style={{ fontSize: '.875rem', color: 'var(--clr-text-dim)' }}>About Us</Link>
        </nav>
      </div>
    </footer>
  );

  if (loading) {
    return (
      <div className="homepage">
        {header}
        {mobileNav}
        <div className="info-page-loading">
          <div className="info-page-spinner" />
          <p>Loading content...</p>
        </div>
        {footer}
      </div>
    );
  }

  if (error === 'not_found' || !section || !section.title) {
    return (
      <div className="homepage">
        {header}
        {mobileNav}
        <div className="info-page-error">
          <i className="fa-solid fa-file-circle-question" aria-hidden="true" />
          <h2>Section Not Found</h2>
          <p>This page doesn't exist or has been moved.</p>
          <Link to="/" className="btn-primary"><i className="fa-solid fa-house" aria-hidden="true" /> Back to Home</Link>
        </div>
        {footer}
      </div>
    );
  }

  if (error) {
    return (
      <div className="homepage">
        {header}
        {mobileNav}
        <div className="info-page-error">
          <i className="fa-solid fa-circle-exclamation" aria-hidden="true" />
          <h2>Something Went Wrong</h2>
          <p>Please try refreshing the page or come back later.</p>
          <Link to="/" className="btn-primary"><i className="fa-solid fa-rotate-right" aria-hidden="true" /> Try Again</Link>
        </div>
        {footer}
      </div>
    );
  }

  return (
    <div className="homepage">
      {header}
      {mobileNav}
      <article className="info-page">
        <div className="section info-page-section">
          <Link to="/" className="info-back-link" aria-label="Back to home">
            <i className="fa-solid fa-arrow-left" aria-hidden="true" />
            Back to Home
          </Link>
          <header className="info-header">
            <span className="sec-label">
              <i className={`fa-solid ${section.icon || 'fa-file-lines'}`} aria-hidden="true" />
              {' '}{getCategoryLabel(section.category || 'general')}
            </span>
            <h1 className="section-title info-page-title">{escapeHtml(section.title)}</h1>
            {section.description && (
              <p className="section-subtitle info-page-subtitle">{escapeHtml(section.description)}</p>
            )}
          </header>
          <div className="info-content">
            <ContentBlocks blocks={section.content || []} />
          </div>
          <nav className="info-bottom-nav">
            <Link to="/" className="btn-primary">
              <i className="fa-solid fa-arrow-left" aria-hidden="true" />
              All Resources
            </Link>
          </nav>
        </div>
      </article>
      {footer}
    </div>
  );
}

function ContentBlocks({ blocks }) {
  if (!blocks || !blocks.length) {
    return (
      <div className="info-empty-content">
        <i className="fa-solid fa-file-lines" aria-hidden="true" />
        <p>Content coming soon.</p>
      </div>
    );
  }

  return blocks.map((block, i) => {
    switch (block.type) {
      case 'heading':
        return <h2 key={i} className="info-content-heading">{escapeHtml(block.text || '')}</h2>;

      case 'text':
        return (
          <div key={i} className="info-text-block">
            {block.heading && <h3 className="info-text-heading">{escapeHtml(block.heading)}</h3>}
            <p className="info-text-body">{escapeHtml(block.body || '')}</p>
          </div>
        );

      case 'image':
        return (
          <figure key={i} className="info-image-block">
            <img src={escapeAttr(block.src || '')} alt={escapeAttr(block.alt || 'Image')} loading="lazy" />
            {block.caption && <figcaption>{escapeHtml(block.caption)}</figcaption>}
          </figure>
        );

      case 'callout': {
        const variant = block.variant || 'info';
        const iconMap = { tip: 'fa-lightbulb', warning: 'fa-triangle-exclamation', info: 'fa-circle-info', danger: 'fa-skull', success: 'fa-circle-check' };
        return (
          <div key={i} className={`info-callout info-callout-${variant}`}>
            <i className={`fa-solid ${iconMap[variant] || 'fa-circle-info'}`} aria-hidden="true" />
            <div>
              {block.heading && <strong>{escapeHtml(block.heading)}</strong>}
              <p>{escapeHtml(block.body || '')}</p>
            </div>
          </div>
        );
      }

      case 'list':
        return (
          <ul key={i} className="info-list">
            {(block.items || []).map((item, j) => (
              <li key={j}>
                <i className="fa-solid fa-circle-check" aria-hidden="true" />
                <span>{escapeHtml(item)}</span>
              </li>
            ))}
          </ul>
        );

      case 'table': {
        if (!block.rows || !block.rows.length) return null;
        const headers = block.headers || [];
        return (
          <div key={i} className="info-table-wrapper">
            <table>
              {headers.length > 0 && (
                <thead>
                  <tr>{headers.map((h, j) => <th key={j}>{escapeHtml(h)}</th>)}</tr>
                </thead>
              )}
              <tbody>
                {block.rows.map((row, ri) => (
                  <tr key={ri}>
                    {(Array.isArray(row) ? row : []).map((cell, ci) => (
                      <td key={ci}>{escapeHtml(String(cell))}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }

      default:
        return null;
    }
  });
}
