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
    <section className="section quiz-learning-path">
      <h3 className="quiz-section-heading">
        <Icon name="route" className="icon stat-icon-secondary" />
        Your Learning Path{levelName ? ` in ${levelName}` : ''}
        {class_name && <span className="quiz-section-heading-sub"> – {class_name}</span>}
      </h3>
      <div className="grid grid-cols-3">
        {paths.map((p) => (
          <div key={p.id} className="stat-card">
            <Icon
              name={p.icon || 'book-open'}
              className={`stat-icon ${p.completed ? 'stat-icon-success' : 'stat-icon-muted'}`}
            />
            <div className="stat-value quiz-path-value">{p.topic_name}</div>
            <div className="stat-label">{p.completed ? 'Completed' : 'Upcoming'}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
 
