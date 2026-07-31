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
    <div className="card" style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-8)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-4)' }}>
        <Icon name="lightbulb" style={{ fontSize: '1.5rem', color: 'var(--warm)' }} />
        <div>
          <h4 style={{ marginBottom: 'var(--space-3)' }}>
            Focus Areas{levelName ? ` – ${levelName}` : ''}{classLabel ? ` (${classLabel})` : ''}
          </h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
            {weak.weak_topics.map(t => (
              <span key={t} className="badge badge-error">{t}</span>
            ))}
          </div>
          {weak.recommended_block && (
            <Button variant="warm" size="sm" onClick={() => onRecommend(weak.recommended_block.topic, weak.recommended_block.block)}>
              Practice {weak.recommended_block.topic} Block {weak.recommended_block.block} <Icon name="arrow-right" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
