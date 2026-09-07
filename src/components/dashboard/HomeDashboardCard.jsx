 /* components/dashboard/HomeDashboardCard.jsx */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getUserDashboard } from '../../api/cachedClient';

export default function HomeDashboardCard() {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    if (!user) {
      setSummary(null);
      return;
    }

    let mounted = true;

    getUserDashboard()
      .then((data) => {
        if (mounted) setSummary(data);
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, [user]);

  if (!summary) return null;

  const { platform, quiz, achievements } = summary;

  return (
    <section className="section">
      <div className="section-head">
        <div className="section-head-left">
          <span className="eyebrow">Your learning</span>
          <h2>Learning snapshot</h2>
        </div>
        <Link to="/dashboard" className="text-link">View full dashboard →</Link>
      </div>
      <div className="dash-strip">
        <div className="dash-cell">
          <div className="dc-label">Total XP</div>
          <div className="dc-value green">{platform.total_xp.toLocaleString()}</div>
          <div className="dc-sub">{platform.xp_progress.xpToNext} to next level</div>
        </div>
        <div className="dash-cell">
          <div className="dc-label">Day streak</div>
          <div className="dc-value amber">{platform.current_streak}</div>
          <div className="dc-sub">Keep going</div>
        </div>
        <div className="dash-cell">
          <div className="dc-label">Badges</div>
          <div className="dc-value">{achievements.earned_count}</div>
          <div className="dc-sub">of {achievements.total_count}</div>
        </div>
        <div className="dash-cell">
          <div className="dc-label">Quiz blocks</div>
          <div className="dc-value">{quiz.blocks_completed}</div>
          <div className="dc-sub">{quiz.recent_pass_rate}% pass rate</div>
        </div>
      </div>
    </section>
  );
}
