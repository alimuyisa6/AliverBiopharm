 import React, { useState, useEffect } from 'react';
import { getInfoSectionsList } from '../api/client';

export default function InfoCards() {
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getInfoSectionsList()
      .then(data => {
        if (Array.isArray(data)) setSections(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="info-cards-grid">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="info-card-skeleton">
            <div className="info-card-skeleton-icon" />
            <div className="info-card-skeleton-title" />
            <div className="info-card-skeleton-desc" />
          </div>
        ))}
      </div>
    );
  }

  if (!sections.length) return null;

  return (
    <div className="info-cards-grid">
      {sections.map(section => (
        <a key={section.slug} href={`/info/${section.slug}`} className="info-nav-card">
          <span className="info-nav-card-icon">
            <i className={`fa-solid ${section.icon || 'fa-file-lines'}`} aria-hidden="true" />
          </span>
          <h4 className="info-nav-card-title">{section.title}</h4>
          <p className="info-nav-card-desc">{section.short_description || 'Learn more about this topic'}</p>
          <span className="info-nav-card-cta">
            Explore
            <i className="fa-solid fa-chevron-right" aria-hidden="true" />
          </span>
        </a>
      ))}
    </div>
  );
}
