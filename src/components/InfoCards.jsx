 import React, { useState, useEffect } from 'react';
import { getInfoSectionsList } from '../api/client';

export default function InfoCards() {
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getInfoSectionsList()
      .then(setSections)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="info-cards-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: '14px', padding: 0 }}>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} style={{ background: 'var(--clr-navy-card)', border: '1px solid var(--clr-border-glow)', borderRadius: 'var(--radius-md)', padding: '1.25rem', minHeight: '130px', animation: 'pulse 1.5s ease-in-out infinite' }}>
            <div style={{ width: '28px', height: '28px', background: 'var(--clr-navy-light)', borderRadius: '8px', marginBottom: '0.75rem' }} />
            <div style={{ width: '70%', height: '14px', background: 'var(--clr-navy-light)', borderRadius: '4px', marginBottom: '0.5rem' }} />
            <div style={{ width: '90%', height: '10px', background: 'var(--clr-navy-light)', borderRadius: '4px' }} />
          </div>
        ))}
      </div>
    );
  }

  if (!sections.length) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--clr-text-muted)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)' }}>
        <i className="fa-solid fa-folder-open" style={{ fontSize: '2rem', display: 'block', marginBottom: '0.75rem' }} aria-hidden="true" />
        No resources available yet.
      </div>
    );
  }

  return (
    <div className="info-cards-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: '14px', padding: 0 }}>
      {sections.map(section => (
        <a
          key={section.slug}
          href={`/info/${section.slug}`}
          className="info-nav-card"
          style={{
            display: 'flex', flexDirection: 'column', textDecoration: 'none',
            background: 'var(--clr-navy-card)', border: '1px solid var(--clr-border-glow)',
            borderRadius: 'var(--radius-md)', padding: '1.25rem',
            transition: 'transform var(--transition-fast), box-shadow var(--transition-fast), border-color var(--transition-fast)',
            cursor: 'pointer', WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation', minHeight: '130px'
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', background: 'var(--clr-navy-light)', borderRadius: '10px', marginBottom: '0.85rem', flexShrink: 0 }}>
            <i className={`fa-solid ${section.icon || 'fa-file-lines'}`} style={{ fontSize: '1rem', color: 'var(--clr-cyan)' }} aria-hidden="true" />
          </span>
          <h4 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--clr-white)', margin: '0 0 0.35rem', letterSpacing: 'var(--ls-snug)', lineHeight: 'var(--lh-snug)' }}>
            {section.title}
          </h4>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-xs)', color: 'var(--clr-text-muted)', lineHeight: 'var(--lh-snug)', margin: '0 0 auto', flex: 1 }}>
            {section.short_description || 'Learn more about this topic'}
          </p>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.85rem', fontFamily: 'var(--font-body)', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--clr-cyan)', whiteSpace: 'nowrap' }}>
            Explore
            <i className="fa-solid fa-chevron-right" style={{ fontSize: '0.6rem' }} aria-hidden="true" />
          </span>
        </a>
      ))}
    </div>
  );
}
