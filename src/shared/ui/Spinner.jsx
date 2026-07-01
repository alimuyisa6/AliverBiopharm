// shared/ui/Spinner.jsx
import React from 'react';

export function Spinner({ size = 'md', className = '' }) {
  const sizes = { sm: '20px', md: '40px', lg: '60px' };

  return (
    <div className={`spinner ${className}`} style={{ width: sizes[size], height: sizes[size] }}>
      <i className="fa-solid fa-spinner fa-spin"></i>
    </div>
  );
}
