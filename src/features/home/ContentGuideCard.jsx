import React from 'react';
import { Link } from 'react-router-dom';
import {
  FaUserGear,
  FaArrowRight,
  FaMagnifyingGlass,
  FaBookOpen,
  FaGraduationCap,
  FaSeedling,
  FaFlask,
  FaCapsules
} from 'react-icons/fa6';

const LEVEL_ICONS = {
  'O-Level': FaSeedling,
  'A-Level': FaFlask,
  'Pharmacy': FaCapsules
};

const LEVEL_COLORS = {
  'O-Level': '#0a7e7e',
  'A-Level': '#b8873a',
  'Pharmacy': '#10b981'
};

const LEVEL_DISPLAY = {
  'O-Level': 'Secondary School Biology',
  'A-Level': 'Advanced Secondary Biology',
  'Pharmacy': 'Pharmacy & Pharmaceutical Sciences'
};

export function ContentGuideCard({ user }) {
  if (!user?.profile?.track) return null;

  const level = user.profile.track;
  const className = user.profile.class_name || 'Not set';
  const displayName = LEVEL_DISPLAY[level] || level;
  const color = LEVEL_COLORS[level] || '#0a7e7e';
  const Icon = LEVEL_ICONS[level] || FaBookOpen;
  const classLabel = level === 'Pharmacy' ? 'Programme' : 'Class';

  return (
    <section className="content-guide-section">
      <div className="content-guide-card" style={{ borderColor: color }}>
        <div className="content-guide-header">
          <div className="content-guide-level-badge" style={{ backgroundColor: color }}>
            <Icon className="content-guide-icon" />
            <span>{level}</span>
          </div>
          <h2 className="content-guide-title">{displayName}</h2>
        </div>

        <div className="content-guide-body">
          <div className="content-guide-info">
            <div className="content-guide-row">
              <FaGraduationCap className="content-guide-row-icon" style={{ color }} />
              <span className="content-guide-label">Current {classLabel}:</span>
              <span className="content-guide-value">{className}</span>
            </div>
            <div className="content-guide-row">
              <FaBookOpen className="content-guide-row-icon" style={{ color }} />
              <span className="content-guide-label">Content Available:</span>
              <span className="content-guide-value">All {level} materials for {className}</span>
            </div>
          </div>

          <div className="content-guide-actions">
            <div className="content-guide-search-hint">
              <FaMagnifyingGlass className="content-guide-search-icon" style={{ color }} />
              <span>To see content for a different {classLabel.toLowerCase()}, update your profile</span>
            </div>
            <Link to="/profile" className="content-guide-btn" style={{ backgroundColor: color }}>
              <FaUserGear />
              Change {classLabel}
              <FaArrowRight />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
