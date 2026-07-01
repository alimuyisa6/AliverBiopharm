// shared/ui/EmptyState.jsx
import React from 'react';

export function EmptyState({ icon = 'fa-inbox', title, message, action }) {
  return (
    <div className="empty-state">
      <i className={`fa-solid ${icon} empty-state-icon`}></i>
      <h3>{title}</h3>
      <p>{message}</p>
      {action && action}
    </div>
  );
}
