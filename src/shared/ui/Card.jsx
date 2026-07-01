// shared/ui/Card.jsx
import React from 'react';

export function Card({ children, featured = false, className = '' }) {
  return (
    <div className={`card ${featured ? 'featured' : ''} ${className}`}>
      {children}
    </div>
  );
}
