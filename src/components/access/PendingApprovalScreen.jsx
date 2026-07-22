import React from 'react';
import { FaClock, FaEnvelope, FaArrowLeft } from 'react-icons/fa6';
import { Link } from 'react-router-dom';

export function PendingApprovalScreen() {
  return (
    <div className="pending-approval-page">
      <div className="pending-approval-card">
        <div className="pending-approval-icon">
          <FaClock />
        </div>
        <h2 className="pending-approval-title">Teacher Account Pending Approval</h2>
        <p className="pending-approval-text">
          Your teacher application is being reviewed by an administrator.
          You'll be notified via email once your account is approved.
        </p>
        <div className="pending-approval-status">
          <span className="pending-status-dot"></span>
          Under Review
        </div>
        <div className="pending-approval-help">
          <FaEnvelope />
          <span>Questions? Contact us at</span>
          <a href="mailto:support@aliverbiopharm.com">support@aliverbiopharm.com</a>
        </div>
        <Link to="/" className="pending-approval-back">
          <FaArrowLeft />
          Return Home
        </Link>
      </div>
    </div>
  );
}
