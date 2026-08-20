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
      <div className="quiz-hero-loading">
        <Skeleton height={120} />
      </div>
    );
  }

  const levelName = level?.display_name || level?.id || '';
  const classLabel = class_name || '';

  return (
    <section className="section reveal quiz-hero-section">
      <div className="card quiz-hero-card">
        <h1 className="quiz-hero-title font-fraunces">
          {levelName ? (
            <>Master<br />{levelName}</>
          ) : (
            <>Master Your<br />Studies</>
          )}

          {classLabel && <span className="quiz-hero-classlabel font-maven-pro">{classLabel}</span>}
        </h1>

        <p className="quiz-hero-subtitle font-source-sans">
          {levelName
            ? `Build your knowledge in ${levelName}${classLabel ? ` (${classLabel})` : ''}, track progress, and master every topic.`
            : 'Build scientific knowledge, track progress, earn achievements, and master every topic.'}
        </p>

        <div className="grid grid-cols-4 quiz-hero-stats">
          <div className="stat-card">
            <Icon name="book-open" className="stat-icon stat-icon-primary" />
            <div className="stat-value font-poppins">{stats?.total_questions ?? 0}</div>
            <div className="stat-label font-source-sans">Questions</div>
          </div>

          <div className="stat-card">
            <Icon name="microscope" className="stat-icon stat-icon-secondary" />
            <div className="stat-value font-poppins">{stats?.total_topics ?? 0}</div>
            <div className="stat-label font-source-sans">Topics</div>
          </div>

          <div className="stat-card">
            <Icon name="user-graduate" className="stat-icon stat-icon-accent" />
            <div className="stat-value font-poppins">{stats?.total_learners ?? 0}</div>
            <div className="stat-label font-source-sans">Learners</div>
          </div>

          <div className="stat-card">
            <Icon name="chart-line" className="stat-icon stat-icon-warm" />
            <div className="stat-value font-poppins">{stats?.average_pass_rate ?? 0}%</div>
            <div className="stat-label font-source-sans">Pass Rate</div>
          </div>
        </div>
      </div>
    </section>
  );
}
