 /* components/access/AccessDenied.jsx */
import { Link } from 'react-router-dom';
import Icon from '../Icon/Icon';

export function AccessDenied() {
  return (
    <div className="section access-denied">
      <div className="card access-denied-card">
        <Icon name="lock" className="access-denied-icon" />
        <h2 className="access-denied-title">Access Restricted</h2>
        <p className="access-denied-text">
          You don't have permission to view this content.
          Please verify your account status or contact support.
        </p>

        <Link to="/" className="btn btn-secondary">
          <Icon name="arrow-left" />
          Return Home
        </Link>
      </div>
    </div>
  );
}
