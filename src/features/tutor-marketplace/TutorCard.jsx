import { Link } from 'react-router-dom';
import Icon from '../../components/Icon/Icon';
import Button from '../../components/Button/Button';

export default function TutorCard({ tutor, onContact, user }) {
  return (
    <div className="card">
      <div className="card-image-placeholder" style={{ background: 'var(--primary-light)' }}>
        <Icon name="user-graduate" style={{ fontSize: '2rem' }} />
      </div>
      <div className="card-body">
        <h3 className="card-title">{tutor.display_name}</h3>
        {tutor.headline && <p className="card-text">{tutor.headline}</p>}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginTop: 'var(--space-3)' }}>
          {tutor.teaching_mode && (
            <span className="chip">{tutor.teaching_mode === 'online' ? 'Online' : tutor.teaching_mode === 'physical' ? 'In-Person' : 'Both'}</span>
          )}
          {tutor.hourly_rate > 0 && <span className="chip">{tutor.hourly_rate} UGX/h</span>}
        </div>
      </div>
      <div className="card-footer" style={{ display: 'flex', gap: 'var(--space-2)' }}>
        <Link to={`/tutor/${tutor.id}`} className="btn btn-secondary btn-sm">View Profile</Link>
        {user && onContact && (
          <Button size="sm" onClick={() => onContact(tutor)}>Contact</Button>
        )}
      </div>
    </div>
  );
}
