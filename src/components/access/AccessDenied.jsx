import React from 'react';
import { FaLock, FaArrowLeft } from 'react-icons/fa6';
import { Link } from 'react-router-dom';

export function AccessDenied() {
  return (
    <div className="access-denied-page">
      <div className="access-denied-card">
        <div className="access-denied-icon">
          <FaLock />
        </div>
        <h2 className="access-denied-title">Access Restricted</h2>
        <p className="access-denied-text">
          You don't have permission to view this content.
          Please verify your account status or contact support.
        </p>
        <Link to="/" className="access-denied-back">
          <FaArrowLeft />
          Return Home
        </Link>
      </div>
    </div>
  );
}
