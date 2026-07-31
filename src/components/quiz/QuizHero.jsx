 /* features/quiz/QuizHero.jsx */
import { useEffect, useState } from 'react';
import { getPlatformStats } from '../../api/client';
import Icon from '../../components/Icon/Icon';
import Skeleton from '../../components/Skeleton/Skeleton';

export default function QuizHero({ level, class_name }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPlatformStats()
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ padding: 'var(--space-10)' }}>
        <Skeleton height={120} />
      </div>
    );
  }

  const levelName = level?.display_name || level?.id || '';
  const classLabel = class_name || '';

  return (
    <section className="section reveal" style={{ paddingTop: 0 }}>
      <div
        className="card"
        style={{
          padding: 'var(--space-10)',
          textAlign: 'center',
          background: 'linear-gradient(135deg, var(--primary-light), var(--accent-light))',
        }}
      >
        <h1 style={{ marginBottom: 'var(--space-4)' }}>
          {levelName ? `Master ${levelName}` : 'Master Your Studies'}
          {classLabel && (
            <span style={{ display: 'block', fontSize: 'var(--text-xl)', fontWeight: 400, marginTop: 'var(--space-2)' }}>
              {classLabel}
            </span>
          )}
        </h1>
        <p style={{ color: 'var(--text-dim)', marginBottom: 'var(--space-8)' }}>
          {levelName
            ? `Build your knowledge in ${levelName}${classLabel ? ` (${classLabel})` : ''}, track progress, and master every topic.`
            : 'Build scientific knowledge, track progress, earn achievements, and master every topic.'}
        </p>
        <div className="grid grid-cols-4" style={{ gap: 'var(--space-4)' }}>
          <div className="stat-card">
            <Icon name="book-open" className="stat-icon" style={{ color: 'var(--primary)' }} />
            <div className="stat-value">{stats?.total_questions ?? 0}</div>
            <div className="stat-label">Questions</div>
          </div>
          <div className="stat-card">
            <Icon name="dna" className="stat-icon" style={{ color: 'var(--secondary)' }} />
            <div className="stat-value">{stats?.total_topics ?? 0}</div>
            <div className="stat-label">Topics</div>
          </div>
          <div className="stat-card">
            <Icon name="user-graduate" className="stat-icon" style={{ color: 'var(--accent)' }} />
            <div className="stat-value">{stats?.total_learners ?? 0}</div>
            <div className="stat-label">Learners</div>
          </div>
          <div className="stat-card">
            <Icon name="chart-line" className="stat-icon" style={{ color: 'var(--warm)' }} />
            <div className="stat-value">{stats?.average_pass_rate ?? 0}%</div>
            <div className="stat-label">Pass Rate</div>
          </div>
        </div>
      </div>
    </section>
  );
}
