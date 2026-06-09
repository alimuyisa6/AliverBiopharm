import React, { useEffect, useRef } from 'react';

export default function PreparingMessage({ title, logoUrl }) {
  const progressRef = useRef(null);

  useEffect(() => {
    if (progressRef.current) {
      progressRef.current.style.width = '0%';
      setTimeout(() => {
        if (progressRef.current) progressRef.current.style.width = '100%';
      }, 100);
    }
  }, []);

  return (
    <div className="preparing-message">
      <div className="content">
        <div className="preparing-spinner" id="split-container">
          <div className="logo-wrapper">
            <div className="fragment f1" style={{ backgroundImage: `url(${logoUrl})` }}></div>
            <div className="fragment f2" style={{ backgroundImage: `url(${logoUrl})` }}></div>
            <div className="fragment f3" style={{ backgroundImage: `url(${logoUrl})` }}></div>
            <div className="fragment f4" style={{ backgroundImage: `url(${logoUrl})` }}></div>
          </div>
        </div>
        <h3>Preparing Your Lesson</h3>
        <p>Loading "<span className="preparing-title">{title}</span>"</p>
        <div className="preparing-progress">
          <div className="progress-bar" ref={progressRef}></div>
        </div>
        <p className="preparing-tip">
          <i className="fa-regular fa-lightbulb"></i> Did you know? Active recall improves retention by 50%
        </p>
      </div>
    </div>
  );
}
