 import React, { useState, useEffect } from 'react';
import { getInfoSectionsList } from '../api/client';

const GROUP_CONFIG = {
  biology: {
    label: 'Biology',
    icon: 'fa-dna',
    button: 'Explore Biology',
    accent: '#0a7e7e',
    grad: 'linear-gradient(135deg, #0a7e7e 0%, #0ab5b5 100%)',
    img: 'https://images.unsplash.com/photo-1530026405186-ed1f139313f8?w=400&q=80',
  },
  pharmacy: {
    label: 'Pharmacy',
    icon: 'fa-pills',
    button: 'Explore Pharmacy',
    accent: '#b8873a',
    grad: 'linear-gradient(135deg, #b8873a 0%, #e6a83a 100%)',
    img: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&q=80',
  },
  study: {
    label: 'Study Guides',
    icon: 'fa-book-open',
    button: 'View Study Guides',
    accent: '#5a3a8a',
    grad: 'linear-gradient(135deg, #5a3a8a 0%, #8a5ab5 100%)',
    img: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=400&q=80',
  },
  exam: {
    label: 'Exam Prep',
    icon: 'fa-graduation-cap',
    button: 'Start Prep',
    accent: '#1a6b3a',
    grad: 'linear-gradient(135deg, #1a6b3a 0%, #2ea855 100%)',
    img: 'https://images.unsplash.com/photo-1434030216411-0b793f4b6923?w=400&q=80',
  },
  clinical: {
    label: 'Clinical Practice',
    icon: 'fa-stethoscope',
    button: 'View Clinical',
    accent: '#8a1a1a',
    grad: 'linear-gradient(135deg, #8a1a1a 0%, #c0392b 100%)',
    img: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=400&q=80',
  },
  calculations: {
    label: 'Calculations',
    icon: 'fa-calculator',
    button: 'Practice Calculations',
    accent: '#1a4a8a',
    grad: 'linear-gradient(135deg, #1a4a8a 0%, #2980b9 100%)',
    img: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=400&q=80',
  },
  safety: {
    label: 'Safety',
    icon: 'fa-shield-halved',
    button: 'View Safety',
    accent: '#7a5a1a',
    grad: 'linear-gradient(135deg, #7a5a1a 0%, #b8873a 100%)',
    img: 'https://images.unsplash.com/photo-1582719471384-894fbb16e074?w=400&q=80',
  },
  general: {
    label: 'Resources',
    icon: 'fa-file-lines',
    button: 'Browse Resources',
    accent: '#0a7e7e',
    grad: 'linear-gradient(135deg, #0a7e7e 0%, #0ab5b5 100%)',
    img: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=400&q=80',
  },
};

export default function InfoCards() {
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getInfoSectionsList()
      .then(data => { if (Array.isArray(data)) setSections(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (loading) return;
    const section = document.getElementById('info-resources');
    if (!section) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { section.classList.add('in'); observer.disconnect(); } },
      { threshold: 0.1 }
    );
    observer.observe(section);
    return () => observer.disconnect();
  }, [loading]);

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

  const grouped = sections.reduce((acc, s) => {
    const cat = s.category || 'general';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(s);
    return acc;
  }, {});

  return (
    <div className="info-groups-wrapper">
      {Object.entries(grouped).map(([category, items]) => {
        const config = GROUP_CONFIG[category] || GROUP_CONFIG.general;
        return (
          <div key={category} className="info-group">
            <div className="info-group-header" style={{ '--group-accent': config.accent, '--group-grad': config.grad }}>
              <div className="info-group-header-bg" style={{ backgroundImage: `url(${config.img})` }} />
              <div className="info-group-header-overlay" style={{ background: config.grad.replace('135deg', '145deg').replace('100%)', '85%)') }} />
              <div className="info-group-header-diagonal" />
              <div className="info-group-header-content">
                <span className="info-group-icon"><i className={`fa-solid ${config.icon}`} /></span>
                <div>
                  <span className="info-group-label">{config.label}</span>
                  <p className="info-group-count">{items.length} {items.length === 1 ? 'resource' : 'resources'}</p>
                </div>
              </div>
            </div>
            <div className="info-group-cards">
              {items.map(section => (
                <a key={section.slug} href={`/info/${section.slug}`} className="info-nav-card" style={{ '--card-accent': config.accent }}>
                  <div className="info-nav-card-diagonal" style={{ background: config.grad }} />
                  <span className="info-nav-card-icon" style={{ background: `${config.accent}18` }}>
                    <i className={`fa-solid ${section.icon || 'fa-file-lines'}`} style={{ color: config.accent }} />
                  </span>
                  <h4 className="info-nav-card-title">{section.title}</h4>
                  <p className="info-nav-card-desc">{section.short_description || 'Learn more about this topic'}</p>
                  <span className="info-nav-card-cta" style={{ color: config.accent }}>
                    Explore <i className="fa-solid fa-chevron-right" />
                  </span>
                </a>
              ))}
            </div>
            <div className="info-group-footer" style={{ '--group-accent': config.accent }}>
              <a href={`/info/${items[0]?.slug}`} className="info-group-btn" style={{ background: config.grad }}>
                <i className={`fa-solid ${config.icon}`} /> {config.button}
              </a>
            </div>
          </div>
        );
      })}
    </div>
  );
}
