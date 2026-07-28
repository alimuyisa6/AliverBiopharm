 import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  FaUserGear,
  FaArrowRight,
  FaMagnifyingGlass,
  FaBookOpen,
  FaGraduationCap,
  FaSeedling,
  FaFlask,
  FaCapsules,
  FaSpinner
} from 'react-icons/fa6';
import { getContentGuideImage } from '../../api/client';

const LEVEL_ICONS = {
  'O-Level': FaSeedling,
  'A-Level': FaFlask,
  'Pharmacy': FaCapsules
};

const LEVEL_DISPLAY = {
  'O-Level': 'Secondary School Biology',
  'A-Level': 'Advanced Secondary Biology',
  'Pharmacy': 'Pharmacy & Pharmaceutical Sciences'
};

export function ContentGuideCard({ user }) {
  const [imageData, setImageData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    const fetchImage = async () => {
      if (!user?.profile?.track) {
        setLoading(false);
        return;
      }
      try {
        const data = await getContentGuideImage(
          user.profile.track,
          user.profile.class_name
        );
        setImageData(data);
      } catch {
        setImageData(null);
      } finally {
        setLoading(false);
      }
    };
    fetchImage();
  }, [user?.profile?.track, user?.profile?.class_name]);

  if (!user?.profile?.track) return null;

  const level = user.profile.track;
  const className = user.profile.class_name || 'Not set';
  const displayName = LEVEL_DISPLAY[level] || level;
  const Icon = LEVEL_ICONS[level] || FaBookOpen;
  const classLabel = level === 'Pharmacy' ? 'Programme' : 'Class';
  const hasImage = imageData?.image_url && !imageError;

  return (
    <section className="content-guide-section">
      <div className="content-guide-card">
        <div className="content-guide-grid">
          <div className="content-guide-visual">
            {loading ? (
              <div className="content-guide-loading">
                <FaSpinner className="icon-spin" />
              </div>
            ) : hasImage ? (
              <img
                src={imageData.image_url}
                alt={imageData.alt_text || `${displayName} - ${className}`}
                className="content-guide-image"
                loading="lazy"
                onError={() => setImageError(true)}
              />
            ) : (
              <div className="content-guide-image-fallback">
                <Icon className="content-guide-fallback-icon" />
                <span className="content-guide-fallback-text">
                  {level} · {className}
                </span>
                {imageError && (
                  <span className="content-guide-fallback-hint">Image unavailable</span>
                )}
              </div>
            )}
          </div>

          <div className="content-guide-content">
            <div className="content-guide-header">
              <div className="content-guide-level-badge">
                <Icon className="content-guide-icon" />
                <span>{level}</span>
              </div>
              <h2 className="content-guide-title">{displayName}</h2>
            </div>

            <div className="content-guide-body">
              <div className="content-guide-info">
                <div className="content-guide-row">
                  <FaGraduationCap className="content-guide-row-icon" />
                  <span className="content-guide-label">Current {classLabel}:</span>
                  <span className="content-guide-value">{className}</span>
                </div>
                <div className="content-guide-row">
                  <FaBookOpen className="content-guide-row-icon" />
                  <span className="content-guide-label">Content Available:</span>
                  <span className="content-guide-value">All {level} materials for {className}</span>
                </div>
              </div>

              <div className="content-guide-actions">
                <div className="content-guide-search-hint">
                  <FaMagnifyingGlass className="content-guide-search-icon" />
                  <span>
                    To see content for a different {classLabel.toLowerCase()}, update your profile
                  </span>
                </div>
                <Link to="/profile" className="content-guide-btn">
                  <FaUserGear />
                  Change {classLabel}
                  <FaArrowRight />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
