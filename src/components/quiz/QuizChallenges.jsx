 /* features/quiz/QuizChallenges.jsx */
import { useEffect, useState } from 'react';
import { getRequest } from '../../api/client';
import Icon from '../../components/Icon/Icon';
import ProgressBar from '../../components/ProgressBar/ProgressBar';

export default function QuizChallenges({ user, level, class_name }) {
  const [challenge, setChallenge] = useState(null);

  useEffect(() => {
    if (!user) return;
    getRequest('interactions', 'daily-challenge').then(setChallenge).catch(() => {});
  }, [user]);

  if (!challenge || !challenge.title) return null;

  const percent = challenge.target ? (challenge.progress / challenge.target) * 100 : 0;
  const levelName = level?.display_name || level?.id || '';
  const classLabel = class_name || '';

  return (
    <div className="card" style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-8)', flexDirection: 'row', alignItems: 'center', gap: 'var(--space-4)' }}>
      <Icon name="rocket" style={{ fontSize: '2rem', color: 'var(--warm)', flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <h4 style={{ marginBottom: 'var(--space-2)' }}>
          {challenge.title}
          {levelName && <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-dim)', fontWeight: 400 }}> — {levelName}{classLabel ? ` · ${classLabel}` : ''}</span>}
        </h4>
        <p style={{ color: 'var(--text-dim)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-3)' }}>
          {challenge.reward_xp} XP reward
        </p>
        <ProgressBar value={challenge.progress} max={challenge.target} variant="warm" />
      </div>
      <div style={{ flexShrink: 0, textAlign: 'center' }}>
        {challenge.completed ? (
          <Icon name="circle-check" style={{ color: 'var(--success)', fontSize: '1.5rem' }} />
        ) : (
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', display: 'block' }}>
            {challenge.progress}/{challenge.target}
          </span>
        )}
      </div>
    </div>
  );
}
