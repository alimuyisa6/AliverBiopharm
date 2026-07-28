 import React from 'react';
import { Link } from 'react-router-dom';

export function ContinueLearningSection({ continueLearning, user }) {
  if (!user || !continueLearning) return null;

  const views = continueLearning.views || [];
  const favorites = continueLearning.favorites || [];
  const streak = continueLearning.streak || 0;
  const hasContent = views.length > 0 || favorites.length > 0 || streak > 0;
  if (!hasContent) return null;

  return (
    <section id="continue-learning" className="section reveal">
      <span className="sec-label">Your Journey</span>
      <h2 className="section-title">Pick Up Where You Left Off</h2>
      <p className="section-subtitle">Your recent activity and saved resources, ready when you are.</p>
      <div className="continue-learning-grid">
        {streak > 0 && (
          <div className="continue-card">
            <i className="fa-solid fa-fire continue-streak-icon" />
            <strong>{streak}-Day Streak</strong>
            <p>Keep it up!</p>
          </div>
        )}
        {views.length > 0 && (
          <div className="continue-card">
            <strong>Recent Views</strong>
            <ul className="continue-list">
              {views.filter(Boolean).map(v => (
                <li key={v.resource_id}>
                  <Link to={`/notes/read?id=${v.resource_id}`} className="continue-link">{v.title}</Link>
                </li>
              ))}
            </ul>
          </div>
        )}
        {favorites.length > 0 && (
          <div className="continue-card">
            <strong>Favorites</strong>
            <ul className="continue-list">
              {favorites.slice(0, 3).filter(Boolean).map(f => (
                <li key={f.resource_id}>{f.title}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
