import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  getUserDashboard,
  getUserAchievements,
  getContinueReading,
  getPersonalRecords,
  getDailyChallenge,
  getWeakAreas
} from '../api/client';
import {
  FaFire,
  FaTrophy,
  FaBookOpen,
  FaBolt,
  FaArrowRight,
  FaSpinner,
  FaMedal,
  FaStopwatch,
  FaStar,
  FaChartLine,
  FaRocket,
  FaBrain,
  FaGraduationCap,
  FaFlask,
  FaCapsules,
  FaSeedling
} from 'react-icons/fa6';
import { useRequireOnboarding } from '../hooks/useRequireOnboarding';
import { useContentAccess } from '../hooks/useContentAccess';
import { PendingApprovalScreen } from '../components/access/PendingApprovalScreen';

const ICON_MAP = {
  'O-Level': FaSeedling,
  'A-Level': FaFlask,
  'Pharmacy': FaCapsules
};

function formatBadgeLabel(badge) {
  if (!badge || badge === 'Unknown') return 'Achievement';
  return badge
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const pageVariants = {
  initial: { opacity: 0, y: 20 },
  in: { opacity: 1, y: 0 }
};

export default function Dashboard() {
  const { isReady, user } = useRequireOnboarding();
  const access = useContentAccess();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dashboard, setDashboard] = useState(null);
  const [achievements, setAchievements] = useState([]);
  const [continueReading, setContinueReading] = useState([]);
  const [records, setRecords] = useState(null);
  const [challenge, setChallenge] = useState(null);
  const [weakAreas, setWeakAreas] = useState({ weak_topics: [], recommended_block: null });

  useEffect(() => {
    if (!isReady || !access.canAccess) return;

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError('');
      try {
        const [dash, achieve, reading, personalRecords, dailyChallenge, weak] = await Promise.all([
          getUserDashboard(),
          getUserAchievements().catch(() => []),
          getContinueReading(5).catch(() => []),
          getPersonalRecords().catch(() => null),
          getDailyChallenge().catch(() => null),
          getWeakAreas().catch(() => ({ weak_topics: [], recommended_block: null }))
        ]);
        if (cancelled) return;
        setDashboard(dash);
        setAchievements(Array.isArray(achieve) ? achieve : []);
        setContinueReading(Array.isArray(reading) ? reading : []);
        setRecords(personalRecords);
        setChallenge(dailyChallenge);
        setWeakAreas(weak || { weak_topics: [], recommended_block: null });
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load dashboard');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [isReady, access.canAccess]);

  if (!isReady || access.isPending) {
    return <PendingApprovalScreen />;
  }

  if (!access.canAccess) {
    return <div className="dashboard-access-denied">Access restricted. Please contact support.</div>;
  }

  if (loading) {
    return (
      <div className="dashboard-loading">
        <FaSpinner className="icon-spin" />
      </div>
    );
  }

  const xpIntoLevel = dashboard ? dashboard.xp % 100 : 0;
  const LevelIcon = user?.profile?.track ? ICON_MAP[user.profile.track] : FaGraduationCap;

  // Determine CSS class for the level-based accent color
  const levelColorClass = user?.profile?.track === 'Pharmacy' ? 'clr-green' : user?.profile?.track === 'A-Level' ? 'clr-magenta' : 'clr-cyan';

  return (
    <motion.div className="dashboard-page" initial="initial" animate="in" variants={pageVariants} transition={{ duration: 0.4 }}>
      <div className="dashboard-header">
        <div className="dashboard-header-left">
          <LevelIcon className={`dashboard-level-icon ${levelColorClass}`} />
          <div>
            <h1 className="dashboard-title">
              Welcome back{user?.full_name ? `, ${user.full_name}` : 'Learner'}
            </h1>
            <p className="dashboard-subtitle">
              <FaRocket className="dashboard-subtitle-icon" />
              {dashboard?.rank_title || 'Beginner'} · {user?.profile?.track || 'No level set'}
            </p>
          </div>
        </div>
        <div className={`dashboard-level-badge ${levelColorClass}`}>
          {user?.profile?.track || 'No Level'}
        </div>
      </div>

      {error && <div className="dashboard-alert">{error}</div>}

      <div className="dashboard-stats-grid">
        <div className="dashboard-stat-card">
          <FaBolt className={`dashboard-stat-icon ${levelColorClass}`} />
          <div className="dashboard-stat-value">{dashboard?.xp ?? 0}</div>
          <div className="dashboard-stat-label">XP</div>
          <div className="dashboard-progress-track">
            <div className={`dashboard-progress-fill ${levelColorClass}`} style={{ width: `${xpIntoLevel}%` }} />
          </div>
          <div className="dashboard-stat-sub">{xpIntoLevel}/100 to next level</div>
        </div>

        <div className="dashboard-stat-card">
          <FaFire className="dashboard-stat-icon clr-orange" />
          <div className="dashboard-stat-value">{dashboard?.streak ?? 0}</div>
          <div className="dashboard-stat-label">Day Streak</div>
        </div>

        <div className="dashboard-stat-card">
          <FaTrophy className="dashboard-stat-icon clr-magenta" />
          <div className="dashboard-stat-value">{dashboard?.badges_count ?? 0}</div>
          <div className="dashboard-stat-label">Badges Earned</div>
        </div>

        <div className="dashboard-stat-card">
          <FaChartLine className="dashboard-stat-icon clr-blue" />
          <div className="dashboard-stat-value">{dashboard?.completed_topics ?? 0}/{dashboard?.total_topics ?? 0}</div>
          <div className="dashboard-stat-label">Topics Completed</div>
        </div>
      </div>

      {dashboard?.next_goal?.topic && (
        <Link to="/quiz" className="dashboard-cta">
          <div className="dashboard-cta-content">
            <div className="dashboard-cta-label">
              <FaBrain className="dashboard-cta-icon" />
              Continue Where You Left Off
            </div>
            <div className="dashboard-cta-title">{dashboard.next_goal.topic} · Block {dashboard.next_goal.block}</div>
          </div>
          <FaArrowRight className="dashboard-cta-arrow" />
        </Link>
      )}

      {challenge?.title && (
        <div className="dashboard-section-card">
          <div className="dashboard-section-header">
            <h2 className="dashboard-section-title">
              <FaBolt className="dashboard-section-icon clr-orange" />
              Daily Challenge
            </h2>
            {challenge.completed && <span className="dashboard-badge-success">Complete</span>}
          </div>
          <div className="dashboard-challenge-title">{challenge.title}</div>
          {challenge.target > 0 && (
            <div className="dashboard-progress-track">
              <div
                className={`dashboard-progress-fill ${challenge.completed ? 'bg-green' : 'bg-orange'}`}
                style={{ width: `${Math.min(100, Math.round((challenge.progress / challenge.target) * 100))}%` }}
              />
            </div>
          )}
          <div className="dashboard-challenge-meta">
            {challenge.progress}/{challenge.target} · Reward: {challenge.reward_xp} XP
          </div>
        </div>
      )}

      <div className="dashboard-section-card">
        <div className="dashboard-section-header">
          <h2 className="dashboard-section-title">
            <FaBookOpen className={`dashboard-section-icon ${levelColorClass}`} />
            Continue Reading
          </h2>
        </div>
        {continueReading.length === 0 ? (
          <p className="dashboard-empty">No reading in progress yet. Start exploring our resources!</p>
        ) : (
          <div className="dashboard-list">
            {continueReading.map((item) => (
              <Link key={item.note_id} to={`/notes/read?id=${item.note_id}`} className="dashboard-list-item">
                <div className="dashboard-list-item-content">
                  <div className="dashboard-list-item-title">{item.title}</div>
                  <div className="dashboard-list-item-meta">{item.topic} · {Math.round(item.progress_percentage)}% complete</div>
                </div>
                <FaArrowRight className="dashboard-list-item-arrow" />
              </Link>
            ))}
          </div>
        )}
      </div>

      {weakAreas.weak_topics.length > 0 && (
        <div className="dashboard-section-card">
          <div className="dashboard-section-header">
            <h2 className="dashboard-section-title">
              <FaChartLine className="dashboard-section-icon clr-red" />
              Areas to Review
            </h2>
          </div>
          <div className="dashboard-tags">
            {weakAreas.weak_topics.map((topic) => (
              <span key={topic} className="dashboard-tag-error">{topic}</span>
            ))}
          </div>
          {weakAreas.recommended_block && (
            <Link to="/quiz" className="dashboard-recommend-link">
              Practice {weakAreas.recommended_block.topic} · Block {weakAreas.recommended_block.block}
              <FaArrowRight className="dashboard-recommend-arrow" />
            </Link>
          )}
        </div>
      )}

      {records && (records.highest_score > 0 || records.fastest_completion > 0 || records.perfect_blocks > 0) && (
        <div className="dashboard-section-card">
          <div className="dashboard-section-header">
            <h2 className="dashboard-section-title">
              <FaStar className="dashboard-section-icon clr-magenta" />
              Personal Records
            </h2>
          </div>
          <div className="dashboard-records-grid">
            <div className="dashboard-record">
              <FaStar className="dashboard-record-icon clr-orange" />
              <div className="dashboard-record-value">{records.highest_score}%</div>
              <div className="dashboard-record-label">Highest Score</div>
            </div>
            <div className="dashboard-record">
              <FaStopwatch className="dashboard-record-icon clr-blue" />
              <div className="dashboard-record-value">{records.fastest_completion}s</div>
              <div className="dashboard-record-label">Fastest Block</div>
            </div>
            <div className="dashboard-record">
              <FaMedal className="dashboard-record-icon clr-magenta" />
              <div className="dashboard-record-value">{records.perfect_blocks}</div>
              <div className="dashboard-record-label">Perfect Blocks</div>
            </div>
          </div>
        </div>
      )}

      {achievements.length > 0 && (
        <div className="dashboard-section-card">
          <div className="dashboard-section-header">
            <h2 className="dashboard-section-title">
              <FaTrophy className="dashboard-section-icon clr-magenta" />
              Recent Achievements
            </h2>
          </div>
          <div className="dashboard-achievements-grid">
            {achievements.slice(0, 8).map((a, idx) => (
              <div key={`${a.badge}-${idx}`} className="dashboard-achievement">
                <FaMedal className="dashboard-achievement-badge" />
                <div className="dashboard-achievement-name">{formatBadgeLabel(a.badge)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
