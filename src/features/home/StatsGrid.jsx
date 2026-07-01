// features/home/StatsGrid.jsx
import React from 'react';

export function StatsGrid({ stats }) {
  const items = [
    { key: 'resources_count', label: 'Resources', icon: 'fa-book-open' },
    { key: 'users_count', label: 'Learners', icon: 'fa-users' },
    { key: 'downloads_count', label: 'Downloads', icon: 'fa-download' },
    { key: 'quiz_attempts', label: 'Quiz Attempts', icon: 'fa-pen-to-square' },
  ];

  return (
    <section id="stats" className="section reveal">
      <span className="sec-label">Our Impact</span>
      <h2 className="section-title">The Numbers Behind Our Community</h2>
      <p className="section-subtitle">
        Every number here represents a learner who chose to study smarter with AliverBiopharm.
      </p>
      <div className="stats-grid">
        {items.map(item => (
          <div key={item.key}>
            <div className="stat-number">{stats?.[item.key] || 0}</div>
            <div className="stat-label">{item.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
