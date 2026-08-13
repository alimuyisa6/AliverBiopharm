 /* pages/Dashboard.jsx */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLayout } from '../contexts/LayoutContext';
import { getUserDashboard } from '../api/cachedClient';
import { useContentAccess } from '../hooks/useContentAccess';
import { useSecurityUiLock } from '../hooks/useSecurityUiLock';
import PageHeader from '../components/PageHeader/PageHeader';
import StatCard from '../components/StatCard/StatCard';
import ProgressBar from '../components/ProgressBar/ProgressBar';
import Skeleton from '../components/Skeleton/Skeleton';
import EmptyState from '../components/EmptyState/EmptyState';
import Icon from '../components/Icon/Icon';
import Container from '../components/Container/Container';

export default function Dashboard() {
  const { user } = useAuth();
  const { level, bootstrap } = useLayout();
  const access = useContentAccess();
  const { locked, reason } = useSecurityUiLock();

  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!access.canAccess) {
      setLoading(false);
      return;
    }

    let mounted = true;

    getUserDashboard()
      .then((data) => {
        if (mounted) setSummary(data);
      })
      .catch(() => {
        if (mounted) setError('Unable to load your dashboard right now. Please try again later.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [access.canAccess]);

  function getEmptyStateImage(key) {
    const uiComponents = bootstrap?.ui_components || [];
    const component = uiComponents.find((item) => item.component_key === `empty_state_${key}`);

    return component?.properties?.image_url || null;
  }

  if (!access.canAccess) {
    return (
      <Container>
        <EmptyState
          image={getEmptyStateImage('dashboard')}
          title="Access Restricted"
          description="Your account does not have access to this area."
        />
      </Container>
    );
  }

  if (loading) {
    return (
      <Container>
        <div className="dashboard-skeleton">
          <Skeleton height={48} width="60%" />
          <div className="dashboard-skeleton-grid">
            <Skeleton height={120} />
            <Skeleton height={120} />
            <Skeleton height={120} />
            <Skeleton height={120} />
          </div>
        </div>
      </Container>
    );
  }

  if (error || !summary) {
    return (
      <Container>
        <EmptyState
          image={getEmptyStateImage('error')}
          title="Something went wrong"
          description={error || 'Dashboard unavailable.'}
        />
      </Container>
    );
  }

  if (locked) {
    return (
      <Container>
        <EmptyState
          icon="lock"
          title="Action temporarily disabled"
          description={reason || 'Suspicious activity detected. Please try again later.'}
        />
      </Container>
    );
  }

  const {
    platform,
    recall,
    quiz,
    notes,
    achievements,
    weak_areas,
    recent_activity,
    unit_xp,
    analytics
  } = summary;

  const levelColor = level?.id === 'Pharmacy' ? 'accent' : level?.id === 'A-Level' ? 'secondary' : 'primary';

  return (
    <Container>
      <PageHeader
        title={`Welcome back${user?.full_name ? `, ${user.full_name}` : ''}`}
        subtitle={`${platform.rank_title} · ${level?.display_name || ''}`}
        badges={[{ label: level?.display_name || 'No Level', variant: levelColor }]}
      />

      <div className="dashboard-stats-grid">
        <StatCard icon="rocket" value={platform.total_xp} label="XP" color={levelColor} />
        <StatCard icon="fire" value={platform.current_streak} label="Day Streak" color="warm" />
        <StatCard icon="trophy" value={achievements.earned_count} label="Badges" color="accent" />
        <StatCard icon="chart-line" value={`${quiz.topics_attempted}`} label="Quiz Topics Attempted" color="secondary" />
      </div>

      <div className="dashboard-xp-section">
        <ProgressBar value={platform.xp_progress.xpIntoLevel} max={100} variant="gradient" />
        <p className="dashboard-xp-text">
          {platform.xp_progress.xpIntoLevel}/100 XP to next level
        </p>
      </div>

      <div className="dashboard-section">
        <h3 className="dashboard-section-title">Your Activity</h3>
        <div className="dashboard-section-grid">
          <StatCard icon="book-open" value={recall.total_sessions} label="Recall Sessions" color="primary" />
          <StatCard icon="graduation-cap" value={quiz.blocks_completed} label="Quiz Blocks Done" color="secondary" />
          <StatCard icon="fire" value={notes.reading_streak} label="Reading Streak" color="warm" />
        </div>
      </div>

      {quiz.recent_pass_rate > 0 && (
        <Link to="/quiz" className="dashboard-continue-link">
          <div>
            <span className="sec-label">Continue Practicing</span>
            <span className="dashboard-continue-text">
              Recent quiz pass rate: {quiz.recent_pass_rate}%
            </span>
          </div>
          <Icon name="arrow-right" className="dashboard-continue-icon" />
        </Link>
      )}

      {notes.continue_reading.length > 0 && (
        <div className="dashboard-section">
          <h3 className="dashboard-section-title">
            <Icon name="book-open" /> Continue Reading
          </h3>
          <div className="dashboard-section-grid">
            {notes.continue_reading.map((item) => (
              <Link key={item.note_id} to={`/notes/read?id=${item.note_id}`} className="card dashboard-note-card">
                <div className="card-body">
                  <h4 className="card-title">{item.title}</h4>
                  <p className="card-text">{Math.round(item.progress_percentage)}% read</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {recall.best_mastery > 0 && (
        <div className="dashboard-section">
          <h3 className="dashboard-section-title">
            <Icon name="star" /> Personal Records
          </h3>
          <div className="dashboard-section-grid">
            <StatCard icon="star" value={`${recall.best_mastery}%`} label="Best Recall Mastery" color="warm" />
            <StatCard icon="microscope" value={recall.topics_practiced} label="Recall Topics Practiced" color="secondary" />
            <StatCard icon="medal" value={achievements.earned_count} label="Achievements" color="accent" />
          </div>
        </div>
      )}

      {analytics?.recommendations?.length > 0 && (
        <div className="dashboard-section">
          <h3 className="dashboard-section-title">
            <Icon name="lightbulb" /> Recommended For You
          </h3>
          <div className="dashboard-section-grid">
            {analytics.recommendations.slice(0, 3).map((item, index) => (
              <Link
                key={index}
                to={item.type === 'due_review' ? '/recall' : item.type === 'weak_topic' ? '/quiz' : '/flashcards'}
                className="card dashboard-recommendation-card"
              >
                <div className="card-body">
                  <h4 className="card-title">{item.title}</h4>
                  <p className="card-text">{item.reason}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {weak_areas?.length > 0 && (
        <div className="dashboard-section">
          <h3 className="dashboard-section-title">
            <Icon name="lightbulb" /> Weak Areas
          </h3>
          <ul className="dashboard-list">
            {weak_areas.map((weak, index) => (
              <li key={index} className="dashboard-list-item">
                <span className="dashboard-list-main">{weak.concept}</span>
                <span className="dashboard-list-muted">({weak.incorrect_attempts} incorrect)</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {recent_activity?.length > 0 && (
        <div className="dashboard-section">
          <h3 className="dashboard-section-title">Recent Activity</h3>
          <ul className="dashboard-list">
            {recent_activity.map((activity, index) => (
              <li key={index} className="dashboard-activity-item">
                <Icon
                  name={activity.type === 'recall' ? 'brain' : activity.type === 'quiz' ? 'graduation-cap' : 'book-open'}
                  className="dashboard-activity-icon"
                />
                <span className="dashboard-activity-text">{activity.details}</span>
                <span className="dashboard-activity-date">{new Date(activity.date).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {unit_xp?.length > 0 && (
        <div className="dashboard-section">
          <h3 className="dashboard-section-title">Unit XP</h3>
          <div className="dashboard-section-grid">
            {unit_xp.map((unit, index) => (
              <StatCard key={index} icon="star" value={unit.xp} label={unit.unit_id} color="accent" />
            ))}
          </div>
        </div>
      )}
    </Container>
  );
}
