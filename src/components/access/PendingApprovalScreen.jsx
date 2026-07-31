 /* components/access/PendingApprovalScreen.jsx */
import { Link } from 'react-router-dom';
import Icon from '../Icon/Icon';

export function PendingApprovalScreen() {
  return (
    <div className="section" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <div className="card" style={{ padding: 'var(--space-8)', textAlign: 'center', maxWidth: 480, width: '100%' }}>
        <Icon name="clock" style={{ fontSize: '3rem', color: 'var(--warning)', marginBottom: 'var(--space-4)' }} />
        <h2 style={{ marginBottom: 'var(--space-3)' }}>Teacher Account Pending Approval</h2>
        <p style={{ color: 'var(--text-dim)', marginBottom: 'var(--space-4)' }}>
          Your teacher application is being reviewed by an administrator.
          You'll be notified via email once your account is approved.
        </p>
        <div className="alert alert-warning" style={{ marginBottom: 'var(--space-4)', justifyContent: 'center' }}>
          <span className="status-dot status-dot-warning" />
          Under Review
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)', fontSize: 'var(--text-sm)', color: 'var(--text-dim)' }}>
          <Icon name="envelope" />
          <span>Questions? Contact us at</span>
          <a href="mailto:support@aliverbiopharm.com" style={{ color: 'var(--primary)' }}>support@aliverbiopharm.com</a>
        </div>
        <Link to="/" className="btn btn-secondary">
          <Icon name="arrow-left" />
          Return Home
        </Link>
      </div>
    </div>
  );
}
