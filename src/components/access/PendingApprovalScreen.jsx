 /* components/access/PendingApprovalScreen.jsx */
import { Link } from 'react-router-dom';
import Icon from '../Icon/Icon';

export function PendingApprovalScreen() {
  return (
    <div className="section pending-approval">
      <div className="card pending-approval-card">
        <Icon name="clock" className="pending-approval-icon" />
        <h2 className="pending-approval-title">
          Teacher Account<br />Pending Approval
        </h2>
        <p className="pending-approval-text">
          Your teacher application is being reviewed by an administrator.
          You'll be notified via email once your account is approved.
        </p>

        <div className="alert alert-warning pending-approval-alert">
          <span className="status-dot status-dot-warning" />
          Under Review
        </div>

        <div className="pending-approval-contact">
          <Icon name="envelope" />
          <span>Questions? Contact us at</span>
          <a href="mailto:support@aliverbiopharm.com">support@aliverbiopharm.com</a>
        </div>

        <Link to="/" className="btn btn-secondary">
          <Icon name="arrow-left" />
          Return Home
        </Link>
      </div>
    </div>
  );
}
