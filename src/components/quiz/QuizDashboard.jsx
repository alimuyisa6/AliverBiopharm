 import { useEffect, useState } from 'react';
import { getRequest } from '../../api/client';

export default function QuizDashboard({ user }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    if (!user) return;
    getRequest('interactions', 'dashboard').then(setData).catch(() => {});
  }, [user]);
  if (!data) return <div className="dashboard-skeleton"></div>;
  const xpPercent = (data.xp / data.next_level_xp) * 100;
  return (
    <div className="learner-dashboard">
      <div className="dashboard-card"><i className="fa-solid fa-award"></i><div><span>Rank</span><strong>{data.rank_title}</strong></div></div>
      <div className="dashboard-card"><i className="fa-solid fa-chart-line"></i><div><span>XP</span><strong>{data.xp}</strong><div className="xp-bar"><div style={{ width: `${xpPercent}%` }}></div></div></div></div>
      <div className="dashboard-card"><i className="fa-solid fa-fire"></i><div><span>Streak</span><strong>{data.streak} days</strong></div></div>
      <div className="dashboard-card"><i className="fa-solid fa-medal"></i><div><span>Badges</span><strong>{data.badges_count}</strong></div></div>
      <div className="dashboard-card"><i className="fa-solid fa-dna"></i><div><span>Topics</span><strong>{data.completed_topics}/{data.total_topics}</strong></div></div>
      <div className="dashboard-card"><i className="fa-solid fa-bullseye"></i><div><span>Next Goal</span><strong>{data.next_goal.topic} Block {data.next_goal.block}</strong></div></div>
    </div>
  );
}
