// shared/ui/Button.jsx
import React from 'react';

export function Button({ children, variant = 'primary', icon, onClick, disabled, className = '', type = 'button' }) {
  const baseClass = variant === 'primary' ? 'btn-primary' : variant === 'secondary' ? 'btn-secondary' : 'btn-download';
  
  return (
    <button
      type={type}
      className={`${baseClass} ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      {icon && <i className={`fa-solid ${icon}`}></i>}
      {children}
    </button>
  );
}
