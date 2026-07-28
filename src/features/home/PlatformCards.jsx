 import React from 'react';
import { useLayout } from '../../contexts/LayoutContext';
import { useNavigate } from 'react-router-dom';

export function PlatformCards() {
  const { groups } = useLayout();
  const navigate = useNavigate();

  if (!groups || !Array.isArray(groups) || groups.length === 0) return null;

  return (
    <section className="platform-cards-section">
      <span className="sec-label">Platforms</span>
      <h2 className="section-title">Explore Our Platforms</h2>
      <p className="section-subtitle">Choose your path and start learning today</p>
      <div className="platform-cards-grid">
        {groups.map(group => (
          <div
            key={group.id}
            className="platform-card"
            onClick={() => navigate(`/level/${group.level_id}/group/${group.id}`)}
            role="button"
            tabIndex={0}
            onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && navigate(`/level/${group.level_id}/group/${group.id}`)}
          >
            <div className="platform-card-image-wrapper">
              <i className={`fas ${group.icon || 'fa-book'}`} />
            </div>
            <div className="platform-card-body">
              <h3>{group.name}</h3>
              <p>{group.description || 'Comprehensive learning resources tailored for you'}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
