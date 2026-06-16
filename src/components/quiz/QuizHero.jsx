 import { useEffect, useState } from 'react';
import { getPlatformStats } from '../../api/client';

export default function QuizHero() {
  const [stats, setStats] = useState({ total_questions: 0, total_topics: 0, total_learners: 0, average_pass_rate: 0 });
  useEffect(() => {
    getPlatformStats().then(setStats).catch(() => {});
  }, []);
  return (
    <div className="quiz-hero">
      <div className="hero-bg"></div>
      <div className="hero-content">
        <h1>Master Biology and Pharmacy <span>One Quiz at a Time</span></h1>
        <p>Build scientific knowledge, track progress, earn achievements, and master every topic.</p>
        <div className="hero-stats">
          <div className="stat-card"><i className="fa-solid fa-book-medical"></i><div><strong>{stats.total_questions}</strong><span>Questions</span></div></div>
          <div className="stat-card"><i className="fa-solid fa-dna"></i><div><strong>{stats.total_topics}</strong><span>Topics</span></div></div>
          <div className="stat-card"><i className="fa-solid fa-user-graduate"></i><div><strong>{stats.total_learners}</strong><span>Learners</span></div></div>
          <div className="stat-card"><i className="fa-solid fa-chart-line"></i><div><strong>{stats.average_pass_rate}%</strong><span>Pass Rate</span></div></div>
        </div>
      </div>
    </div>
  );
}
