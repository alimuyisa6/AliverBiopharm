 /* components/access/AccessDenied.jsx */
import { Link } from 'react-router-dom';
import Icon from '../Icon/Icon';

export function AccessDenied() {
  return (
    <div className="section" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <div className="card" style={{ padding: 'var(--space-8)', textAlign: 'center', maxWidth: 480, width: '100%' }}>
        <Icon name="lock" style={{ fontSize: '3rem', color: 'var(--error)', marginBottom: 'var(--space-4)' }} />
        <h2 style={{ marginBottom: 'var(--space-3)' }}>Access Restricted</h2>
        <p style={{ color: 'var(--text-dim)', marginBottom: 'var(--space-6)' }}>
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
