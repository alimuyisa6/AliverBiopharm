// features/classroom/ClassroomSection.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';

export function ClassroomSection({ user }) {
  const navigate = useNavigate();

  const levels = [
    { key: 'O-Level', label: 'O-Level Biology', classes: 'Form 1 - Form 4', color: '#0ab5b5', icon: 'fa-microscope' },
    { key: 'A-Level', label: 'A-Level Biology', classes: 'Form 5 - Form 6', color: '#b8873a', icon: 'fa-dna' },
    { key: 'Pharmacy', label: 'Pharmacy', classes: 'Certificate, Diploma, Degree', color: '#10b981', icon: 'fa-capsules' },
  ];

  return (
    <section id="classroom" className="section reveal">
      <span className="sec-label">Live Learning</span>
      <h2 className="section-title">Live Classroom Discussions</h2>
      <p className="section-subtitle">
        Join real-time discussions led by verified tutors. Select your level, pick a topic, raise your hand and start learning with fellow students.
      </p>
      <div className="classroom-level-grid">
        {levels.map(lvl => (
          <div key={lvl.key} className="classroom-level-card" style={{ borderTop: `3px solid ${lvl.color}` }}>
            <div className="classroom-level-icon" style={{ color: lvl.color }}>
              <i className={`fa-solid ${lvl.icon}`}></i>
            </div>
            <h3 className="classroom-level-title">{lvl.label}</h3>
            <p className="classroom-level-classes">{lvl.classes}</p>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap', marginTop: '1.5rem' }}>
        <button className="btn-primary" onClick={() => navigate('/classroom')}>
          <i className="fa-solid fa-users"></i>
          {user ? 'Enter Classroom' : 'Login to Join'}
        </button>
        <button className="btn-download" onClick={() => navigate('/tutor/apply')} style={{ padding: '10px 20px' }}>
          <i className="fa-solid fa-chalkboard-user"></i>
          Become a Tutor
        </button>
      </div>
    </section>
  );
}
