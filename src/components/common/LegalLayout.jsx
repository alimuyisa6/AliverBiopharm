import React from 'react';

export default function LegalLayout({ title, lastUpdated, children }) {
  return (
    <div style={{ maxWidth: 'var(--max-width)', margin: '0 auto', padding: '2rem 1.5rem 4rem' }}>
      <h1 style={{ fontSize: 'var(--text-h2)', marginBottom: '0.5rem', fontFamily: 'var(--font-display)' }}>
        {title}
      </h1>
      <p style={{ color: 'var(--clr-text-dim)', marginBottom: '2.5rem', fontSize: 'var(--text-sm)' }}>
        Last updated: {lastUpdated}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {children}
      </div>
    </div>
  );
}
