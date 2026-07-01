// shared/ui/Badge.jsx
import React from 'react';

export function Badge({ children, color = 'cyan', className = '' }) {
  const colors = {
    cyan: '#00bcd4',
    magenta: '#e91e8c',
    green: '#10b981',
    gold: '#b8873a',
  };

  return (
    <span
      className={`badge ${className}`}
      style={{ background: colors[color] || color, color: '#fff' }}
    >
      {children}
    </span>
  );
}
