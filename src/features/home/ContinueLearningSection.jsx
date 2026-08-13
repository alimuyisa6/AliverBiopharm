/* features/home/ContinueLearningSection.jsx */
import { Link } from 'react-router-dom';
import Icon from '../../components/Icon/Icon';

export function ContinueLearningSection({ continueLearning, user, streak }) {
  if (!user) return null;

  const items = Array.isArray(continueLearning) ? continueLearning : [];

  if (!items.length && !streak) return null;

  return (
    <section className="section reveal">
      <span className="sec-label">Your Journey</span>
      <h2 className="section-title">
        Pick Up Where<br />You Left Off
      </h2>
      <p className="section-subtitle">
        Your recent activity, ready when you are.
      </p>

      <div className="grid grid-cols-3">
        {streak > 0 && (
          <div className="stat-card">
            <Icon name="fire" className="stat-icon" style={{ color: 'var(--warm)' }} />
            <div className="stat-value">{streak}</div>
            <div className="stat-label">Day Streak</div>
          </div>
        )}

        {items.slice(0, 2).map((item) => (
          <Link key={item.note_id} to={`/notes/read?id=${item.note_id}`} className="card" style={{ textDecoration: 'none' }}>
            <div className="card-body">
              <h4 className="card-title">{item.title}</h4>
              <p className="card-text">{item.topic}</p>
            </div>

            <div style={{ padding: '0 var(--space-6) var(--space-6)' }}>
              <div className="progress-track">
                <div className="progress-fill progress-primary" style={{ width: `${item.progress_percentage}%` }} />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
} 
