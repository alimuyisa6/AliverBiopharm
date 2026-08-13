 /* features/quiz/QuizWeakAreas.jsx */
import { useEffect, useState } from 'react';
import { getRequest } from '../../api/client';
import Icon from '../../components/Icon/Icon';
import Button from '../../components/Button/Button';

export default function QuizWeakAreas({ user, onRecommend, level, class_name }) {
  const [weak, setWeak] = useState(null);

  useEffect(() => {
    if (!user) return;

    getRequest('interactions', 'weak-areas').then(setWeak).catch(() => {});
  }, [user]);

  if (!weak || !weak.weak_topics.length) return null;

  const levelName = level?.display_name || level?.id || '';
  const classLabel = class_name || '';

  return (
    <div className="card card-violet quiz-weakareas-card">
      <div className="quiz-weakareas-inner">
        <Icon name="lightbulb" className="quiz-weakareas-icon" />

        <div>
          <h4 className="quiz-weakareas-title">
            Focus Areas<br />
            {levelName ? `– ${levelName}` : ''}{classLabel ? ` (${classLabel})` : ''}
          </h4>

          <div className="quiz-weakareas-tags">
            {weak.weak_topics.map((topic) => (
              <span key={topic} className="badge badge-error">{topic}</span>
            ))}
          </div>

          {weak.recommended_block && (
            <Button
              variant="warm"
              size="sm"
              onClick={() => onRecommend(weak.recommended_block.topic, weak.recommended_block.block)}
            >
              Practice {weak.recommended_block.topic} Block {weak.recommended_block.block} <Icon name="arrow-right" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
