 // features/home/StatsGrid.jsx
import React, { useState, useEffect, useRef } from 'react';

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
          <AnimatedNumber key={item.key} target={stats?.[item.key] || 0} label={item.label} icon={item.icon} />
        ))}
      </div>
    </section>
  );
}

function AnimatedNumber({ target, label, icon }) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const started = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const duration = 2000;
          const startTime = performance.now();

          const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(Math.floor(eased * target));

            if (progress < 1) {
              requestAnimationFrame(animate);
            }
          };

          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.3 }
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target]);

  const formatNumber = (num) => {
    if (num >= 1000) {
      return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'k+';
    }
    return num;
  };

  return (
    <div ref={ref}>
      <div className="stat-number">
        <i className={`fa-solid ${icon}`} style={{ fontSize: '1.2rem', marginRight: '8px', opacity: 0.7 }}></i>
        {formatNumber(count)}
      </div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
