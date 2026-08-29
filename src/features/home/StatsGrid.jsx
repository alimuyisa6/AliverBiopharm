 /* components/StatsGrid/StatsGrid.jsx */
import { useState, useEffect, useRef } from 'react';
import Icon from '../Icon/Icon';

const ITEMS = [
  { key: 'resources_count', label: 'Resources', icon: 'book-open' },
  { key: 'users_count', label: 'Learners', icon: 'users' },
  { key: 'downloads_count', label: 'Downloads', icon: 'download' },
  { key: 'quiz_attempts', label: 'Quiz Attempts', icon: 'pen-to-square' },
];

function AnimatedNumber({ target, label, icon }) {
  // ... all existing logic unchanged ...
  return (
    <div className="stat-item" ref={ref}>
      <Icon name={icon} className="stat-icon" style={{ color: 'var(--primary)' }} />
      <div className="stat-value">{format(count)}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

export default function StatsGrid({ stats = {} }) {
  return (
    <section className="section">
      <div className="section-head">
        <div className="section-head-left">
          <span className="eyebrow">Our Impact</span>
          <h2>Trusted by learners across levels</h2>
        </div>
      </div>
      <div className="stats-grid">
        {ITEMS.map((item) => (
          <AnimatedNumber key={item.key} target={stats[item.key] || 0} label={item.label} icon={item.icon} />
        ))}
      </div>
    </section>
  );
}
