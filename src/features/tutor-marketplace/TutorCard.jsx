 import { Link } from 'react-router-dom';
import Icon from '../../components/Icon/Icon';
import Button from '../../components/Button/Button';

export default function TutorCard({ tutor, onContact, user }) {
  return (
    <div className="card tutor-card">
      <div className="tutor-avatar-wrapper">
        {tutor.avatar_url ? (
          <img src={tutor.avatar_url} alt={tutor.display_name} />
        ) : (
          <Icon name="user-graduate" />
        )}
      </div>

      <div className="tutor-info">
        <div className="tutor-name">{tutor.display_name}</div>
        {tutor.headline && <div className="tutor-headline">{tutor.headline}</div>}
        <div className="tutor-actions">
          <Link to={`/tutor/${tutor.id}`} className="btn btn-secondary btn-sm">View Profile</Link>
          {user && onContact && (
            <Button size="sm" onClick={() => onContact(tutor)}>Contact</Button>
          )}
        </div>
      </div>
    </div>
  );
}
