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
            if (progress < 1) requestAnimationFrame(animate);
          };
          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target]);

  const format = (num) => (num >= 1000 ? (num / 1000).toFixed(1).replace(/\.0$/, '') + 'k+' : num);

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
