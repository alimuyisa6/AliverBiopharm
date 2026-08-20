 /* features/quiz/QuizWeakAreas.jsx */
import { useEffect, useState } from 'react';
import { getRequest } from '../../api/client';
import Icon from '../../components/Icon/Icon';

export default function QuizWeakAreas({ user, level, class_name }) {
  const [weakAreas, setWeakAreas] = useState([]);

  useEffect(() => {
    if (!user) return;

    getRequest('interactions', 'weak-areas')
      .then(setWeakAreas)
      .catch(() => {});
  }, [user]);

  if (!weakAreas.length) return null;

  const levelName = level?.display_name || level?.id || '';
  const classLabel = class_name || '';

  return (
    <section className="section quiz-weakareas-card">
      <div className="card card-violet quiz-weakareas-inner">
        <Icon name="triangle-exclamation" className="quiz-weakareas-icon" />

        <div className="quiz-weakareas-body">
          <h4 className="quiz-weakareas-title font-poppins">
            Focus Areas
            {levelName && <span className="quiz-section-heading-sub font-maven-pro"> — {levelName}{classLabel ? ` · ${classLabel}` : ''}</span>}
          </h4>

          <div className="quiz-weakareas-tags">
            {weakAreas.map((area, idx) => (
              <span key={idx} className="badge badge-warm font-comfortaa">
                {area.topic_name}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
