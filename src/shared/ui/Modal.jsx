// shared/ui/Modal.jsx
import React from 'react';

export function Modal({ open, onClose, children, className = '' }) {
  if (!open) return null;

  return (
    <div className="modal-overlay active" onClick={onClose}>
      <div className={`modal-content ${className}`} onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>&times;</button>
        {children}
      </div>
    </div>
  );
}
