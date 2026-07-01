// shared/layout/BackToTop.jsx
import React from 'react';

export function BackToTop() {
  return (
    <button
      className="back-to-top"
      id="back-to-top"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
    >
      <i className="fa-solid fa-arrow-up"></i>
    </button>
  );
}
