 /* features/quiz/QuizDashboard.jsx */
import { useEffect, useState } from 'react';
import { getUserDashboard } from '../../api/cachedClient';
import Icon from '../../components/Icon/Icon';
import ProgressBar from '../../components/ProgressBar/ProgressBar';
import Skeleton from '../../components/Skeleton/Skeleton';

export default function QuizDashboard({ user, level, class_name }) {
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    if (!user) return;

    getUserDashboard().then(setSummary).catch(() => {});
  }, [user]);

  if (!summary) {
    return (
      <div className="quiz-dashboard-loading">
        <Skeleton height={100} />
      </div>
    );
  }

  const { platform, quiz, achievements } = summary;
  const levelName = level?.display_name || level?.id || '';
  const classLabel = class_name || '';

  return (
    <div className="quiz-dashboard">
      <h3 className="quiz-section-heading font-poppins">
        <Icon name="graduation-cap" className="icon" />
        {levelName ? (
          <>{levelName}<br />Dashboard</>
        ) : (
          'Your Dashboard'
        )}

        {classLabel && <span className="quiz-section-heading-sub font-maven-pro"> – {classLabel}</span>}
      </h3>

      <div className="grid grid-cols-3">
        <div className="stat-card">
          <Icon name="trophy" className="stat-icon stat-icon-warm" />
          <div className="stat-value font-poppins">{platform.rank_title}</div>
          <div className="stat-label font-source-sans">Rank</div>
        </div>

        <div className="stat-card">
          <Icon name="chart-line" className="stat-icon stat-icon-primary" />
          <div className="stat-value font-poppins">{platform.total_xp}</div>
          <div className="stat-label font-source-sans">XP</div>
          <ProgressBar value={platform.xp_progress.progressPercent} max={100} variant="gradient" showLabel />
        </div>

        <div className="stat-card">
          <Icon name="fire" className="stat-icon stat-icon-warm" />
          <div className="stat-value font-poppins">{platform.current_streak} days</div>
          <div className="stat-label font-source-sans">Streak</div>
        </div>

        <div className="stat-card">
          <Icon name="medal" className="stat-icon stat-icon-accent" />
          <div className="stat-value font-poppins">{achievements?.earned_count || 0}</div>
          <div className="stat-label font-source-sans">Badges</div>
        </div>

        <div className="stat-card">
          <Icon name="microscope" className="stat-icon stat-icon-secondary" />
          <div className="stat-value font-poppins">{quiz.blocks_completed}</div>
          <div className="stat-label font-source-sans">Blocks Done</div>
        </div>

        <div className="stat-card">
          <Icon name="bullseye" className="stat-icon stat-icon-accent" />
          <div className="stat-value font-poppins">{quiz.recent_pass_rate}%</div>
          <div className="stat-label font-source-sans">Recent Pass Rate</div>
        </div>
      </div>
    </div>
  );
}
