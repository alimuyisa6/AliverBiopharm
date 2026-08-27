// components/recall/RecallLeaderboardTab.jsx
import Icon from '../Icon/Icon';

export default function RecallLeaderboardTab({ leaderboard }) {
  function rankClass(index) {
    if (index === 0) return 'is-gold';
    if (index === 1) return 'is-silver';
    if (index === 2) return 'is-bronze';
    return 'is-default';
  }

  return (
    <div className="recall-tab-content">
      {leaderboard.length === 0 ? (
        <p className="recall-leaderboard-empty font-open-sans">No data yet. Be the first!</p>
      ) : (
        leaderboard.map((entry, index) => (
          <div key={entry.user_id || index} className="card recall-leaderboard-row">
            <span className={`recall-rank font-mono ${rankClass(index)}`}>#{index + 1}</span>
            <span className="recall-entry-name font-poppins">
              {entry.display_name || 'Anonymous Learner'}
            </span>
            <span className="font-mono">{entry.total_xp} XP</span>
            <span className="badge badge-primary font-comfortaa">Level {entry.recall_level}</span>
          </div>
        ))
      )}
    </div>
  );
}
