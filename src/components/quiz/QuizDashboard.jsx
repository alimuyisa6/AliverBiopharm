/* features/quiz/QuizDashboard.jsx */
import { useEffect, useState } from 'react';
import { getRequest } from '../../api/client';
import Icon from '../../components/Icon/Icon';
import ProgressBar from '../../components/ProgressBar/ProgressBar';
import Skeleton from '../../components/Skeleton/Skeleton';

export default function QuizDashboard({ user, level, class_name }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!user) return;
    getRequest('interactions', 'dashboard').then(setData).catch(() => {});
  }, [user]);

  if (!data) {
    return (
      <div style={{ marginBottom: 'var(--space-8)' }}>
        <Skeleton height={100} />
      </div>
    );
  }

  const xpPercent = data.next_level_xp ? (data.xp / data.next_level_xp) * 100 : 0;
  const levelName = level?.display_name || level?.id || '';
  const classLabel = class_name || '';

  return (
    <div style={{ marginBottom: 'var(--space-8)' }}>
      <h3 style={{ marginBottom: 'var(--space-6)' }}>
        <Icon name="graduation-cap" style={{ marginRight: 'var(--space-3)', color: 'var(--primary)' }} />
        {levelName ? `${levelName} Dashboard` : 'Your Dashboard'}
        {classLabel && <span style={{ fontWeight: 400, fontSize: 'var(--text-base)', color: 'var(--text-dim)' }}> – {classLabel}</span>}
      </h3>
      <div className="grid grid-cols-3">
        <div className="stat-card">
          <Icon name="trophy" className="stat-icon" style={{ color: 'var(--warm)' }} />
          <div className="stat-value">{data.rank_title || 'Beginner'}</div>
          <div className="stat-label">Rank</div>
        </div>
        <div className="stat-card">
          <Icon name="chart-line" className="stat-icon" style={{ color: 'var(--primary)' }} />
          <div className="stat-value">{data.xp || 0}</div>
          <div className="stat-label">XP</div>
          <ProgressBar value={xpPercent} max={100} variant="gradient" showLabel />
        </div>
        <div className="stat-card">
          <Icon name="fire" className="stat-icon" style={{ color: 'var(--warm)' }} />
          <div className="stat-value">{data.streak || 0} days</div>
          <div className="stat-label">Streak</div>
        </div>
        <div className="stat-card">
          <Icon name="medal" className="stat-icon" style={{ color: 'var(--accent)' }} />
          <div className="stat-value">{data.badges_count || 0}</div>
          <div className="stat-label">Badges</div>
        </div>
        <div className="stat-card">
          <Icon name="dna" className="stat-icon" style={{ color: 'var(--secondary)' }} />
          <div className="stat-value">{data.completed_topics || 0}/{data.total_topics || 0}</div>
          <div className="stat-label">Topics</div>
        </div>
        <div className="stat-card">
          <Icon name="bullseye" className="stat-icon" style={{ color: 'var(--accent)' }} />
          <div className="stat-value">
            {data.next_goal?.topic ? `${data.next_goal.topic} Block ${data.next_goal.block}` : '—'}
          </div>
          <div className="stat-label">Next Goal</div>
        </div>
      </div>
    </div>
  );
} 
