import { Link } from 'react-router-dom';
import Icon from '../../components/Icon/Icon';
import Button from '../../components/Button/Button';

export default function TutorCard({ tutor, onContact, user }) {
  return (
    <div className="card tutor-card">
      <div className="card-image-placeholder tutor-card-avatar">
        {tutor.avatar_url ? (
          <img src={tutor.avatar_url} alt={tutor.display_name} className="tutor-avatar-img" />
        ) : (
          <Icon name="user-graduate" />
        )}
      </div>

      <div className="card-body">
        <h3 className="card-title">{tutor.display_name}</h3>
        {tutor.headline && <p className="card-text">{tutor.headline}</p>}

        <div className="tutor-chip-row">
          {tutor.teaching_mode && (
            <span className="chip">
              {tutor.teaching_mode === 'online'
                ? 'Online'
                : tutor.teaching_mode === 'physical'
                  ? 'In-Person'
                  : 'Both'}
            </span>
          )}

          {tutor.hourly_rate > 0 && <span className="chip">{tutor.hourly_rate} UGX/h</span>}
        </div>
      </div>

      <div className="card-footer tutor-card-footer">
        <Link to={`/tutor/${tutor.id}`} className="btn btn-secondary btn-sm">View Profile</Link>
        {user && onContact && <Button size="sm" onClick={() => onContact(tutor)}>Contact</Button>}
      </div>
    </div>
  );
}
