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
import Spinner from '../components/Spinner/Spinner';
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
          <Skeleton height={48} width="60%" style={{ marginBottom: 'var(--space-6)' }} />
          <div className="grid grid-cols-4">
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

  const { platform, recall, quiz, notes, achievements, weak_areas, recent_activity, unit_xp, analytics } = summary;
  const levelColor = level?.id === 'Pharmacy' ? 'accent' : level?.id === 'A-Level' ? 'secondary' : 'primary';

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

  return (
    <Container>
      <PageHeader
        title={`Welcome back${user?.full_name ? `, ${user.full_name}` : ''}`}
        subtitle={`${platform.rank_title} · ${level?.display_name || ''}`}
        badges={[{ label: level?.display_name || 'No Level', variant: levelColor }]}
      />

      <div className="grid grid-cols-4" style={{ marginBottom: 'var(--space-10)' }}>
        <StatCard icon="rocket" value={platform.total_xp} label="XP" color={levelColor} />
        <StatCard icon="fire" value={platform.current_streak} label="Day Streak" color="warm" />
        <StatCard icon="trophy" value={achievements.earned_count} label="Badges" color="accent" />
        <StatCard icon="chart-line" value={`${quiz.topics_attempted}`} label="Quiz Topics Attempted" color="secondary" />
      </div>

      <div style={{ marginBottom: 'var(--space-8)' }}>
        <ProgressBar value={platform.xp_progress.xpIntoLevel} max={100} variant="gradient" />
        <p style={{ textAlign: 'center', fontSize: 'var(--text-sm)', color: 'var(--text-dim)', marginTop: 'var(--space-2)' }}>
          {platform.xp_progress.xpIntoLevel}/100 XP to next level
        </p>
      </div>

      <div style={{ marginBottom: 'var(--space-10)' }}>
        <h3 style={{ marginBottom: 'var(--space-6)' }}>Your Activity</h3>
        <div className="grid grid-cols-3">
          <StatCard icon="book-open" value={recall.total_sessions} label="Recall Sessions" color="primary" />
          <StatCard icon="graduation-cap" value={quiz.blocks_completed} label="Quiz Blocks Done" color="secondary" />
          <StatCard icon="fire" value={notes.reading_streak} label="Reading Streak" color="warm" />
        </div>
      </div>

      {quiz.recent_pass_rate > 0 && (
        <Link
          to="/quiz"
          className="card"
          style={{ marginBottom: 'var(--space-10)', padding: 'var(--space-6)', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', textDecoration: 'none' }}
        >
          <div>
            <span className="sec-label" style={{ textAlign: 'left', marginBottom: 'var(--space-2)' }}>Continue Practicing</span>
            <span style={{ fontWeight: 700, fontSize: 'var(--text-lg)' }}>Recent quiz pass rate: {quiz.recent_pass_rate}%</span>
          </div>
          <Icon name="arrow-right" style={{ fontSize: '1.5rem', color: 'var(--primary)' }} />
        </Link>
      )}

      {notes.continue_reading.length > 0 && (
        <div style={{ marginBottom: 'var(--space-10)' }}>
          <h3 style={{ marginBottom: 'var(--space-6)' }}>
            <Icon name="book-open" style={{ marginRight: 'var(--space-3)', color: `var(--${levelColor})` }} />
            Continue Reading
          </h3>
          <div className="grid grid-cols-3">
            {notes.continue_reading.map((item) => (
              <Link key={item.note_id} to={`/notes/read?id=${item.note_id}`} className="card" style={{ textDecoration: 'none' }}>
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
        <div style={{ marginBottom: 'var(--space-10)' }}>
          <h3 style={{ marginBottom: 'var(--space-6)' }}>
            <Icon name="star" style={{ marginRight: 'var(--space-3)', color: 'var(--warm)' }} />
            Personal Records
          </h3>
          <div className="grid grid-cols-3">
            <StatCard icon="star" value={`${recall.best_mastery}%`} label="Best Recall Mastery" color="warm" />
            <StatCard icon="flask" value={recall.topics_practiced} label="Recall Topics Practiced" color="secondary" />
            <StatCard icon="medal" value={achievements.earned_count} label="Achievements" color="accent" />
          </div>
        </div>
      )}

      {analytics?.recommendations?.length > 0 && (
        <div style={{ marginBottom: 'var(--space-10)' }}>
          <h3 style={{ marginBottom: 'var(--space-6)' }}>
            <Icon name="lightbulb" style={{ marginRight: 'var(--space-3)', color: 'var(--accent)' }} />
            Recommended For You
          </h3>
          <div className="grid grid-cols-3">
            {analytics.recommendations.slice(0, 3).map((item, idx) => (
              <Link
                key={idx}
                to={item.type === 'due_review' ? '/recall' : item.type === 'weak_topic' ? '/quiz' : '/flashcards'}
                className="card card-clickable"
                style={{ textDecoration: 'none' }}
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
        <div style={{ marginBottom: 'var(--space-10)' }}>
          <h3 style={{ marginBottom: 'var(--space-6)' }}>
            <Icon name="lightbulb" style={{ marginRight: 'var(--space-3)', color: 'var(--warm)' }} />
            Weak Areas
          </h3>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {weak_areas.map((weak, idx) => (
              <li key={idx} style={{ padding: 'var(--space-2) 0', borderBottom: '1px solid var(--border-light)' }}>
                <span style={{ fontWeight: 600 }}>{weak.concept}</span>
                <span style={{ marginLeft: 'var(--space-3)', color: 'var(--text-dim)' }}>({weak.incorrect_attempts} incorrect)</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {recent_activity?.length > 0 && (
        <div style={{ marginBottom: 'var(--space-10)' }}>
          <h3 style={{ marginBottom: 'var(--space-6)' }}>Recent Activity</h3>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {recent_activity.map((activity, idx) => (
              <li key={idx} style={{ padding: 'var(--space-2) 0', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <Icon
                  name={activity.type === 'recall' ? 'brain' : activity.type === 'quiz' ? 'graduation-cap' : 'book-open'}
                  style={{ color: activity.type === 'recall' ? 'var(--primary)' : 'var(--secondary)' }}
                />
                <span>{activity.details}</span>
                <span style={{ marginLeft: 'auto', color: 'var(--text-dim)' }}>{new Date(activity.date).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {unit_xp?.length > 0 && (
        <div style={{ marginBottom: 'var(--space-10)' }}>
          <h3 style={{ marginBottom: 'var(--space-6)' }}>Unit XP</h3>
          <div className="grid grid-cols-3">
            {unit_xp.map((unit, idx) => (
              <StatCard key={idx} icon="star" value={unit.xp} label={unit.unit_id} color="accent" />
            ))}
          </div>
        </div>
      )}
    </Container>
  );
}
