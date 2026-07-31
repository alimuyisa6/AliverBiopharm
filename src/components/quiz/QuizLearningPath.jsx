 /* features/quiz/QuizLearningPath.jsx */
import { useEffect, useState } from 'react';
import { getRequest } from '../../api/client';
import Icon from '../../components/Icon/Icon';

export default function QuizLearningPath({ level, class_name }) {
  const [paths, setPaths] = useState([]);
  const levelId = typeof level === 'object' ? level?.id : level;

  useEffect(() => {
    if (!levelId) return;
    getRequest('interactions', 'learning-paths', { level: levelId })
      .then(setPaths)
      .catch(() => {});
  }, [levelId]);

  if (!paths.length) return null;

  const levelName = typeof level === 'object' ? level?.display_name || levelId : levelId;

  return (
    <section className="section" style={{ paddingTop: 0 }}>
      <h3 style={{ marginBottom: 'var(--space-6)' }}>
        <Icon name="route" style={{ marginRight: 'var(--space-3)', color: 'var(--secondary)' }} />
        Your Learning Path{levelName ? ` in ${levelName}` : ''}
        {class_name && <span style={{ fontWeight: 400, fontSize: 'var(--text-base)', color: 'var(--text-dim)' }}> – {class_name}</span>}
      </h3>
      <div className="grid grid-cols-3">
        {paths.map((p) => (
          <div key={p.id} className="stat-card">
            <Icon
              name={p.icon || 'book-open'}
              className="stat-icon"
              style={{ color: p.completed ? 'var(--success)' : 'var(--text-muted)' }}
            />
            <div className="stat-value" style={{ fontSize: 'var(--text-base)' }}>{p.topic_name}</div>
            <div className="stat-label">{p.completed ? 'Completed' : 'Upcoming'}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
