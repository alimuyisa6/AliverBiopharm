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
      <div className="quiz-dashboard-loading">
        <Skeleton height={100} />
      </div>
    );
  }

  const xpPercent = data.next_level_xp ? (data.xp / data.next_level_xp) * 100 : 0;
  const levelName = level?.display_name || level?.id || '';
  const classLabel = class_name || '';

  return (
    <div className="quiz-dashboard">
      <h3 className="quiz-section-heading">
        <Icon name="graduation-cap" className="icon" />
        {levelName ? `${levelName} Dashboard` : 'Your Dashboard'}
        {classLabel && <span className="quiz-section-heading-sub"> – {classLabel}</span>}
      </h3>
      <div className="grid grid-cols-3">
        <div className="stat-card">
          <Icon name="trophy" className="stat-icon stat-icon-warm" />
          <div className="stat-value">{data.rank_title || 'Beginner'}</div>
          <div className="stat-label">Rank</div>
        </div>
        <div className="stat-card">
          <Icon name="chart-line" className="stat-icon stat-icon-primary" />
          <div className="stat-value">{data.xp || 0}</div>
          <div className="stat-label">XP</div>
          <ProgressBar value={xpPercent} max={100} variant="gradient" showLabel />
        </div>
        <div className="stat-card">
          <Icon name="fire" className="stat-icon stat-icon-warm" />
          <div className="stat-value">{data.streak || 0} days</div>
          <div className="stat-label">Streak</div>
        </div>
        <div className="stat-card">
          <Icon name="medal" className="stat-icon stat-icon-accent" />
          <div className="stat-value">{data.badges_count || 0}</div>
          <div className="stat-label">Badges</div>
        </div>
        <div className="stat-card">
          <Icon name="dna" className="stat-icon stat-icon-secondary" />
          <div className="stat-value">{data.completed_topics || 0}/{data.total_topics || 0}</div>
          <div className="stat-label">Topics</div>
        </div>
        <div className="stat-card">
          <Icon name="bullseye" className="stat-icon stat-icon-accent" />
          <div className="stat-value">
            {data.next_goal?.topic ? `${data.next_goal.topic} Block ${data.next_goal.block}` : '—'}
          </div>
          <div className="stat-label">Next Goal</div>
        </div>
      </div>
    </div>
  );
}
