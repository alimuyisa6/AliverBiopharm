import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  getUserDashboard, getUserAchievements, getContinueReading,
  getPersonalRecords, getDailyChallenge, getWeakAreas
} from '../api/client';
import {
  FaFire, FaTrophy, FaBookOpen, FaBolt, FaArrowRight, FaSpinner,
  FaMedal, FaStopwatch, FaStar, FaChartLine
} from 'react-icons/fa6';
import '../styles/Dashboard.css';

const pageVariants = {
  initial: { opacity: 0, y: 20 },
  in: { opacity: 1, y: 0 },
};

function formatBadgeLabel(badge) {
  if (!badge || badge === 'Unknown') return 'Achievement';
  return badge
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dashboard, setDashboard] = useState(null);
  const [achievements, setAchievements] = useState([]);
  const [continueReading, setContinueReading] = useState([]);
  const [records, setRecords] = useState(null);
  const [challenge, setChallenge] = useState(null);
  const [weakAreas, setWeakAreas] = useState({ weak_topics: [], recommended_block: null });

  useEffect(() => {
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
          getWeakAreas().catch(() => ({ weak_topics: [], recommended_block: null })),
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
  }, []);

  if (loading) {
    return (
      <div className="dashboard-loading">
        <FaSpinner className="icon-spin" size={32} color="var(--clr-cyan)" />
      </div>
    );
  }

  const xpIntoLevel = dashboard ? dashboard.xp % 100 : 0;

  return (
    <motion.div className="dashboard-page section" initial="initial" animate="in" variants={pageVariants} transition={{ duration: 0.3 }}>
      <div className="dashboard-header">
        <h1 className="section-title">
          Welcome back{dashboard?.display_name ? `, ${dashboard.display_name}` : ''}
        </h1>
        <p className="section-subtitle">{dashboard?.rank_title || 'Beginner'} · Here's where you left off</p>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: '1.5rem' }}>{error}</div>}

      <div className="dashboard-stat-grid">
        <div className="card dashboard-stat-card">
          <FaBolt className="dashboard-stat-icon" style={{ color: 'var(--clr-cyan)' }} />
          <div className="dashboard-stat-value">{dashboard?.xp ?? 0} XP</div>
          <div className="dashboard-stat-label">{xpIntoLevel}/100 to next level</div>
          <div className="dashboard-progress-track">
            <div className="dashboard-progress-fill" style={{ width: `${xpIntoLevel}%`, background: 'var(--clr-cyan)' }} />
          </div>
        </div>

        <div className="card dashboard-stat-card">
          <FaFire className="dashboard-stat-icon" style={{ color: 'var(--clr-orange)' }} />
          <div className="dashboard-stat-value">{dashboard?.streak ?? 0}</div>
          <div className="dashboard-stat-label">Day streak</div>
        </div>

        <div className="card dashboard-stat-card">
          <FaTrophy className="dashboard-stat-icon" style={{ color: 'var(--clr-magenta)' }} />
          <div className="dashboard-stat-value">{dashboard?.badges_count ?? 0}</div>
          <div className="dashboard-stat-label">Badges earned</div>
        </div>

        <div className="card dashboard-stat-card">
          <FaChartLine className="dashboard-stat-icon" style={{ color: 'var(--clr-blue)' }} />
          <div className="dashboard-stat-value">{dashboard?.completed_topics ?? 0}/{dashboard?.total_topics ?? 0}</div>
          <div className="dashboard-stat-label">Topics completed</div>
        </div>
      </div>

      {dashboard?.next_goal?.topic && (
        <Link to="/quiz" className="card dashboard-cta">
          <div>
            <div className="dashboard-cta-label">Continue where you left off</div>
            <div className="dashboard-cta-title">{dashboard.next_goal.topic} · Block {dashboard.next_goal.block}</div>
          </div>
          <FaArrowRight />
        </Link>
      )}

      {challenge?.title && (
        <div className="card dashboard-section-card">
          <div className="dashboard-section-header">
            <h2><FaBolt style={{ color: 'var(--clr-orange)' }} /> Daily challenge</h2>
            {challenge.completed && <span className="badge-success">Complete</span>}
          </div>
          <div className="dashboard-challenge-title">{challenge.title}</div>
          {challenge.target > 0 && (
            <div className="dashboard-progress-track">
              <div
                className="dashboard-progress-fill"
                style={{
                  width: `${Math.min(100, Math.round((challenge.progress / challenge.target) * 100))}%`,
                  background: challenge.completed ? 'var(--clr-success)' : 'var(--clr-orange)'
                }}
              />
            </div>
          )}
          <div className="dashboard-challenge-meta">
            {challenge.progress}/{challenge.target} · Reward: {challenge.reward_xp} XP
          </div>
        </div>
      )}

      <div className="dashboard-section-card card">
        <div className="dashboard-section-header">
          <h2><FaBookOpen style={{ color: 'var(--clr-cyan)' }} /> Continue reading</h2>
        </div>
        {continueReading.length === 0 ? (
          <p className="dashboard-empty">No reading in progress yet.</p>
        ) : (
          <div className="dashboard-list">
            {continueReading.map((item) => (
              <Link key={item.note_id} to={`/notes/read?id=${item.note_id}`} className="dashboard-list-item">
                <div>
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
        <div className="dashboard-section-card card">
          <div className="dashboard-section-header">
            <h2><FaChartLine style={{ color: 'var(--clr-error)' }} /> Areas to review</h2>
          </div>
          <div className="dashboard-tags">
            {weakAreas.weak_topics.map((topic) => (
              <span key={topic} className="badge-error">{topic}</span>
            ))}
          </div>
          {weakAreas.recommended_block && (
            <Link to="/quiz" className="dashboard-recommend-link">
              Practice {weakAreas.recommended_block.topic} · Block {weakAreas.recommended_block.block} <FaArrowRight />
            </Link>
          )}
        </div>
      )}

      {records && (records.highest_score > 0 || records.fastest_completion > 0 || records.perfect_blocks > 0) && (
        <div className="dashboard-section-card card">
          <div className="dashboard-section-header">
            <h2><FaStar style={{ color: 'var(--clr-magenta)' }} /> Personal records</h2>
          </div>
          <div className="dashboard-records-grid">
            <div className="dashboard-record">
              <FaStar className="dashboard-record-icon" />
              <div className="dashboard-record-value">{records.highest_score}%</div>
              <div className="dashboard-record-label">Highest score</div>
            </div>
            <div className="dashboard-record">
              <FaStopwatch className="dashboard-record-icon" />
              <div className="dashboard-record-value">{records.fastest_completion}s</div>
              <div className="dashboard-record-label">Fastest block</div>
            </div>
            <div className="dashboard-record">
              <FaMedal className="dashboard-record-icon" />
              <div className="dashboard-record-value">{records.perfect_blocks}</div>
              <div className="dashboard-record-label">Perfect blocks</div>
            </div>
          </div>
        </div>
      )}

      {achievements.length > 0 && (
        <div className="dashboard-section-card card">
          <div className="dashboard-section-header">
            <h2><FaTrophy style={{ color: 'var(--clr-magenta)' }} /> Recent achievements</h2>
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
