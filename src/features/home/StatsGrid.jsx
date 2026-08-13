/* features/home/StatsGrid.jsx */
import { useState, useEffect, useRef } from 'react';
import Icon from '../../components/Icon/Icon';

const ITEMS = [
  { key: 'resources_count', label: 'Resources', icon: 'book-open' },
  { key: 'users_count', label: 'Learners', icon: 'users' },
  { key: 'downloads_count', label: 'Downloads', icon: 'download' },
  { key: 'quiz_attempts', label: 'Quiz Attempts', icon: 'pen-to-square' }
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

  const format = (num) => (num >= 1000 ? `${(num / 1000).toFixed(1).replace(/\.0$/, '')}k+` : num);

  return (
    <div className="stat-card" ref={ref}>
      <Icon name={icon === 'dna' ? 'microscope' : icon} className="stat-icon" style={{ color: 'var(--primary)' }} />
      <div className="stat-value">{format(count)}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

export function StatsGrid({ stats = {} }) {
  return (
    <section className="section reveal">
      <span className="sec-label">Our Impact</span>
      <h2 className="section-title">
        Trusted by Learners<br />Across Levels
      </h2>
      <p className="section-subtitle">
        Every number represents a student who chose to study smarter.
      </p>

      <div className="grid grid-cols-4">
        {ITEMS.map((item) => (
          <AnimatedNumber key={item.key} target={stats[item.key] || 0} label={item.label} icon={item.icon} />
        ))}
      </div>
    </section>
  );
} 
