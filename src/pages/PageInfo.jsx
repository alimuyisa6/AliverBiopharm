 import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getInfoSection } from '../api/client';

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
      <div className="info-page-loading">
        <div className="info-page-spinner" />
        <p>Loading content...</p>
      </div>
    );
  }

  if (error === 'not_found' || !section || !section.title) {
    return (
      <div className="info-page-error">
        <i className="fa-solid fa-file-circle-question" aria-hidden="true" />
        <h2>Section Not Found</h2>
        <p>This page doesn't exist or has been moved.</p>
        <a href="/" className="btn-primary"><i className="fa-solid fa-house" aria-hidden="true" /> Back to Home</a>
      </div>
    );
  }

  if (error) {
    return (
      <div className="info-page-error">
        <i className="fa-solid fa-circle-exclamation" aria-hidden="true" />
        <h2>Something Went Wrong</h2>
        <p>Please try refreshing the page or come back later.</p>
        <a href="/" className="btn-primary"><i className="fa-solid fa-rotate-right" aria-hidden="true" /> Try Again</a>
      </div>
    );
  }

  return (
    <article className="info-page">
      <div className="section info-page-section">
        <a href="/" className="info-back-link" aria-label="Back to home">
          <i className="fa-solid fa-arrow-left" aria-hidden="true" />
          Back to Home
        </a>

        <header className="info-header">
          <span className="sec-label">
            <i className={`fa-solid ${section.icon || 'fa-file-lines'}`} aria-hidden="true" />
            {getCategoryLabel(section.category || 'general')}
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
            <img
              src={escapeAttr(block.src || '')}
              alt={escapeAttr(block.alt || 'Image')}
              loading="lazy"
            />
            {block.caption && <figcaption>{escapeHtml(block.caption)}</figcaption>}
          </figure>
        );

      case 'callout': {
        const variantClass = `info-callout-${block.variant || 'info'}`;
        const iconMap = {
          tip: 'fa-lightbulb',
          warning: 'fa-triangle-exclamation',
          info: 'fa-circle-info',
          danger: 'fa-skull',
          success: 'fa-circle-check'
        };
        return (
          <div key={i} className={`info-callout ${variantClass}`}>
            <i className={`fa-solid ${iconMap[block.variant] || 'fa-circle-info'}`} aria-hidden="true" />
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
                  <tr>
                    {headers.map((h, j) => <th key={j}>{escapeHtml(h)}</th>)}
                  </tr>
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
