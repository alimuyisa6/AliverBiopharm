 /* pages/Dashboard.jsx */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLayout } from '../contexts/LayoutContext';
import { getUserDashboard, getUserAchievements, getContinueReading, getPersonalRecords, getDailyChallenge, getWeakAreas } from '../api/cachedClient';
import { useContentAccess } from '../hooks/useContentAccess';
import PageHeader from '../components/PageHeader/PageHeader';
import StatCard from '../components/StatCard/StatCard';
import ProgressBar from '../components/ProgressBar/ProgressBar';
import Spinner from '../components/Spinner/Spinner';
import EmptyState from '../components/EmptyState/EmptyState';
import Icon from '../components/Icon/Icon';
import Container from '../components/Container/Container';

export default function Dashboard() {
  const { user } = useAuth();
  const { level } = useLayout();
  const access = useContentAccess();
  const [dashboard, setDashboard] = useState(null);
  const [achievements, setAchievements] = useState([]);
  const [continueReading, setContinueReading] = useState([]);
  const [records, setRecords] = useState(null);
  const [challenge, setChallenge] = useState(null);
  const [weakAreas, setWeakAreas] = useState({ weak_topics: [], recommended_block: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!access.canAccess) return;
    Promise.all([
      getUserDashboard(),
      getUserAchievements().catch(() => []),
      getContinueReading(5).catch(() => []),
      getPersonalRecords().catch(() => null),
      getDailyChallenge().catch(() => null),
      getWeakAreas().catch(() => ({ weak_topics: [], recommended_block: null })),
    ])
      .then(([dash, achieve, reading, recs, chall, weak]) => {
        setDashboard(dash);
        setAchievements(Array.isArray(achieve) ? achieve : []);
        setContinueReading(Array.isArray(reading) ? reading : []);
        setRecords(recs);
        setChallenge(chall);
        setWeakAreas(weak || { weak_topics: [], recommended_block: null });
      })
      .finally(() => setLoading(false));
  }, [access.canAccess]);

  if (!access.canAccess) {
    return (
      <Container>
        <EmptyState icon="lock" title="Access Restricted" description="Your account does not have access to this area." />
      </Container>
    );
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <Spinner size="lg" />
      </div>
    );
  }

  const xpIntoLevel = dashboard ? dashboard.xp % 100 : 0;
  const levelColor = level?.id === 'Pharmacy' ? 'accent' : level?.id === 'A-Level' ? 'secondary' : 'primary';

  return (
    <Container>
      <PageHeader
        title={`Welcome back${user?.full_name ? `, ${user.full_name}` : ''}`}
        subtitle={`${dashboard?.rank_title || 'Beginner'} · ${level?.display_name || ''}`}
        badges={[
          { label: level?.display_name || 'No Level', variant: levelColor },
        ]}
      />

      <div className="grid grid-cols-4" style={{ marginBottom: 'var(--space-10)' }}>
        <StatCard icon="rocket" value={dashboard?.xp ?? 0} label="XP" color={levelColor} />
        <StatCard icon="fire" value={dashboard?.streak ?? 0} label="Day Streak" color="warm" />
        <StatCard icon="trophy" value={dashboard?.badges_count ?? 0} label="Badges" color="accent" />
        <StatCard icon="chart-line" value={`${dashboard?.completed_topics ?? 0}/${dashboard?.total_topics ?? 0}`} label="Topics Done" color="secondary" />
      </div>

      <div style={{ marginBottom: 'var(--space-8)' }}>
        <ProgressBar value={xpIntoLevel} max={100} variant="gradient" />
        <p style={{ textAlign: 'center', fontSize: 'var(--text-sm)', color: 'var(--text-dim)', marginTop: 'var(--space-2)' }}>
          {xpIntoLevel}/100 XP to next level
        </p>
      </div>

      {dashboard?.next_goal?.topic && (
        <Link to="/quiz" className="card" style={{ marginBottom: 'var(--space-10)', padding: 'var(--space-6)', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', textDecoration: 'none' }}>
          <div>
            <span className="sec-label" style={{ textAlign: 'left', marginBottom: 'var(--space-2)' }}>Continue Where You Left Off</span>
            <span style={{ fontWeight: 700, fontSize: 'var(--text-lg)' }}>{dashboard.next_goal.topic} · Block {dashboard.next_goal.block}</span>
          </div>
          <Icon name="arrow-right" style={{ fontSize: '1.5rem', color: 'var(--primary)' }} />
        </Link>
      )}

      {continueReading.length > 0 && (
        <div style={{ marginBottom: 'var(--space-10)' }}>
          <h3 style={{ marginBottom: 'var(--space-6)' }}><Icon name="book-open" style={{ marginRight: 'var(--space-3)', color: `var(--${levelColor})` }} />Continue Reading</h3>
          <div className="grid grid-cols-3">
            {continueReading.slice(0, 3).map((item) => (
              <Link key={item.note_id} to={`/notes/read?id=${item.note_id}`} className="card" style={{ textDecoration: 'none' }}>
                <div className="card-body">
                  <h4 className="card-title">{item.title}</h4>
                  <p className="card-text">{item.topic} · {Math.round(item.progress_percentage)}%</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {weakAreas.weak_topics.length > 0 && (
        <div style={{ marginBottom: 'var(--space-10)' }}>
          <h3 style={{ marginBottom: 'var(--space-6)' }}><Icon name="chart-line" style={{ marginRight: 'var(--space-3)',
