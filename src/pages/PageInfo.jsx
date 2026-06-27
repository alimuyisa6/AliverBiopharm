 import React, { useState, useEffect } from 'react';
import { getInfoSection } from '../api/client';

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function escapeAttr(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#039;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function getCalloutVariant(variant) {
  const variants = {
    tip: { bg: 'rgba(10,126,126,0.06)', border: 'var(--clr-cyan)', icon: 'fa-lightbulb' },
    warning: { bg: 'rgba(184,135,58,0.06)', border: 'var(--clr-magenta)', icon: 'fa-triangle-exclamation' },
    info: { bg: 'rgba(10,126,126,0.04)', border: 'var(--clr-cyan)', icon: 'fa-circle-info' },
    danger: { bg: 'rgba(220,53,69,0.06)', border: '#dc3545', icon: 'fa-skull' },
    success: { bg: 'rgba(25,135,84,0.06)', border: '#198754', icon: 'fa-circle-check' }
  };
  return variants[variant] || variants.info;
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

export default function InfoPage({ slug }) {
  const [section, setSection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '6rem 1rem' }}>
        <div style={{
          width: '48px', height: '48px',
          border: '3px solid var(--clr-border-glow)',
          borderTopColor: 'var(--clr-cyan)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
          margin: '0 auto 1rem'
        }} />
        <p style={{ color: 'var(--clr-text-dim)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-base)' }}>
          Loading content...
        </p>
      </div>
    );
  }

  if (error === 'not_found' || !section || !section.title) {
    return (
      <div style={{ textAlign: 'center', padding: '6rem 1rem' }}>
        <i className="fa-solid fa-file-circle-question" style={{ fontSize: '3.5rem', color: 'var(--clr-text-muted)', display: 'block', marginBottom: '1.5rem' }} aria-hidden="true" />
        <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--clr-white)', marginBottom: '0.5rem', fontSize: 'clamp(1.5rem,4vw,2rem)' }}>Section Not Found</h2>
        <p style={{ color: 'var(--clr-text-dim)', marginBottom: '2rem', fontFamily: 'var(--font-body)' }}>This page doesn't exist or has been moved.</p>
        <a href="/" className="btn-primary"><i className="fa-solid fa-house" aria-hidden="true" /> Back to Home</a>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: '6rem 1rem' }}>
        <i className="fa-solid fa-circle-exclamation" style={{ fontSize: '3.5rem', color: 'var(--clr-magenta)', display: 'block', marginBottom: '1.5rem' }} aria-hidden="true" />
        <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--clr-white)', marginBottom: '0.5rem', fontSize: 'clamp(1.5rem,4vw,2rem)' }}>Something Went Wrong</h2>
        <p style={{ color: 'var(--clr-text-dim)', marginBottom: '2rem', fontFamily: 'var(--font-body)' }}>Please try refreshing the page or come back later.</p>
        <a href="/" className="btn-primary"><i className="fa-solid fa-rotate-right" aria-hidden="true" /> Try Again</a>
      </div>
    );
  }

  const categoryLabel = getCategoryLabel(section.category || 'general');

  return (
    <article className="info-page">
      <div className="section" style={{ paddingTop: '80px' }}>
        <a href="/" className="info-back-link" aria-label="Back to home" style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
          color: 'var(--clr-cyan)', textDecoration: 'none',
          fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)',
          fontWeight: 500, marginBottom: '1.5rem',
          transition: 'color var(--transition-fast)'
        }}>
          <i className="fa-solid fa-arrow-left" aria-hidden="true" />
          Back to Home
        </a>

        <header className="info-header" style={{ marginBottom: '2.5rem' }}>
          <span className="sec-label">
            <i className={`fa-solid ${section.icon || 'fa-file-lines'}`} aria-hidden="true" style={{ marginRight: '0.35rem' }} />
            {categoryLabel}
          </span>
          <h1 className="section-title" style={{ fontSize: 'clamp(2rem,5vw,3.5rem)', textAlign: 'left', marginBottom: '0.75rem' }}>
            {escapeHtml(section.title)}
          </h1>
          {section.description && (
            <p className="section-subtitle" style={{ textAlign: 'left', marginLeft: 0, maxWidth: '680px' }}>
              {escapeHtml(section.description)}
            </p>
          )}
        </header>

        <div className="info-content">
          <ContentBlocks blocks={section.content || []} />
        </div>

        <nav style={{ marginTop: '3.5rem', paddingTop: '2rem', borderTop: '1px solid var(--clr-border-glow)', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <a href="/" className="btn-primary">
            <i className="fa-solid fa-arrow-left" aria-hidden="true" />
            All Resources
          </a>
        </nav>
      </div>
    </article>
  );
}

function ContentBlocks({ blocks }) {
  if (!blocks || !blocks.length) {
    return (
      <div style={{ background: 'var(--clr-navy-card)', border: '1px solid var(--clr-border-glow)', borderRadius: 'var(--radius-md)', padding: '2rem', textAlign: 'center' }}>
        <i className="fa-solid fa-file-lines" style={{ fontSize: '2rem', color: 'var(--clr-text-muted)', display: 'block', marginBottom: '0.75rem' }} aria-hidden="true" />
        <p style={{ color: 'var(--clr-text-dim)', fontFamily: 'var(--font-body)' }}>Content coming soon.</p>
      </div>
    );
  }

  return blocks.map((block, i) => {
    switch (block.type) {
      case 'heading':
        return (
          <h2 key={i} style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.25rem,3vw,1.75rem)', fontWeight: 700, color: 'var(--clr-white)', margin: '2rem 0 1rem', letterSpacing: 'var(--ls-snug)', lineHeight: 'var(--lh-snug)' }}>
            {escapeHtml(block.text || '')}
          </h2>
        );

      case 'text':
        return (
          <div key={i} className="info-text-block" style={{ marginBottom: '1.5rem' }}>
            {block.heading && (
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--clr-white)', marginBottom: '0.6rem', letterSpacing: 'var(--ls-snug)' }}>
                {escapeHtml(block.heading)}
              </h3>
            )}
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-base)', lineHeight: 'var(--lh-relaxed)', color: 'var(--clr-text-dim)', margin: 0 }}>
              {escapeHtml(block.body || '')}
            </p>
          </div>
        );

      case 'image':
        return (
          <figure key={i} className="info-image-block" style={{ margin: '1.5rem 0', borderRadius: 'var(--radius-md)', overflow: 'hidden', background: 'var(--clr-navy-card)', border: '1px solid var(--clr-border-glow)', maxWidth: '100%' }}>
            <img src={escapeAttr(block.src || '')} alt={escapeAttr(block.alt || 'Image')} style={{ width: '100%', height: 'auto', display: 'block', maxHeight: '450px', objectFit: 'contain', background: 'var(--clr-navy-light)' }} loading="lazy" />
            {block.caption && (
              <figcaption style={{ padding: '0.75rem 1.25rem', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: 'var(--clr-text-muted)', textAlign: 'center', borderTop: '1px solid var(--clr-border-glow)' }}>
                {escapeHtml(block.caption)}
              </figcaption>
            )}
          </figure>
        );

      case 'callout': {
        const v = getCalloutVariant(block.variant || 'info');
        return (
          <div key={i} className="info-callout" style={{ background: v.bg, borderLeft: `4px solid ${v.border}`, borderRadius: 'var(--radius-sm)', padding: '1rem 1.25rem', margin: '1.5rem 0', display: 'flex', gap: '0.85rem', alignItems: 'flex-start' }}>
            <i className={`fa-solid ${v.icon}`} style={{ fontSize: '1.15rem', color: v.border, flexShrink: 0, marginTop: '0.15rem' }} aria-hidden="true" />
            <div>
              {block.heading && (
                <strong style={{ display: 'block', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--clr-white)', marginBottom: '0.3rem' }}>
                  {escapeHtml(block.heading)}
                </strong>
              )}
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-base)', lineHeight: 'var(--lh-relaxed)', color: 'var(--clr-text-dim)', margin: 0 }}>
                {escapeHtml(block.body || '')}
              </p>
            </div>
          </div>
        );
      }

      case 'list':
        return (
          <ul key={i} className="info-list" style={{ margin: '1rem 0 1.5rem', paddingLeft: '1.5rem', fontFamily: 'var(--font-body)', fontSize: 'var(--text-base)', color: 'var(--clr-text-dim)', lineHeight: 'var(--lh-relaxed)', listStyleType: 'none' }}>
            {(block.items || []).map((item, j) => (
              <li key={j} style={{ marginBottom: '0.5rem', paddingLeft: '0.25rem', display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                <i className="fa-solid fa-circle-check" style={{ color: 'var(--clr-cyan)', fontSize: '0.7rem', flexShrink: 0, marginTop: '0.45rem' }} aria-hidden="true" />
                <span>{escapeHtml(item)}</span>
              </li>
            ))}
          </ul>
        );

      case 'table': {
        if (!block.rows || !block.rows.length) return null;
        const headers = block.headers || [];
        return (
          <div key={i} className="info-table-wrapper" style={{ overflowX: 'auto', margin: '1.5rem 0', borderRadius: 'var(--radius-md)', border: '1px solid var(--clr-border-glow)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: 'var(--clr-text-dim)' }}>
              {headers.length > 0 && (
                <thead>
                  <tr style={{ background: 'var(--clr-navy-light)' }}>
                    {headers.map((h, j) => (
                      <th key={j} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 700, color: 'var(--clr-white)', borderBottom: '2px solid var(--clr-border-glow)', whiteSpace: 'nowrap' }}>
                        {escapeHtml(h)}
                      </th>
                    ))}
                  </tr>
                </thead>
              )}
              <tbody>
                {block.rows.map((row, ri) => (
                  <tr key={ri} style={{ background: ri % 2 === 0 ? 'transparent' : 'var(--clr-navy-light)' }}>
                    {(Array.isArray(row) ? row : []).map((cell, ci) => (
                      <td key={ci} style={{ padding: '0.65rem 1rem', borderBottom: '1px solid var(--clr-border-glow)' }}>
                        {escapeHtml(String(cell))}
                      </td>
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
