import React, { useState } from 'react';

const LEVELS = [
  { value: 'O-Level', icon: 'fa-seedling', label: 'O-Level', sub: 'Senior 1 – 4' },
  { value: 'A-Level', icon: 'fa-flask',    label: 'A-Level', sub: 'Senior 5 – 6' },
  { value: 'Pharmacy', icon: 'fa-capsules', label: 'Pharmacy', sub: 'Certificate – Degree' },
];

const CLASSES = {
  'O-Level':  ['Senior 1', 'Senior 2', 'Senior 3', 'Senior 4'],
  'A-Level':  ['Senior 5', 'Senior 6'],
  'Pharmacy': ['Certificate', 'Diploma', "Bachelor's Degree"],
};

const DISCIPLINE_FOR = {
  'O-Level':  'Biology',
  'A-Level':  'Biology',
  'Pharmacy': 'Pharmacy',
};

const PROGRESS_STEPS = 3;

export default function FlashcardOnboarding({ onComplete }) {
  const [step, setStep]       = useState(0);
  const [level, setLevel]     = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const [cls, setCls]         = useState(null);

  function progressPct() {
    if (step === 0) return 10;
    if (step === 1) return 40;
    if (step === 2) return 75;
    return 100;
  }

  function handleLevelSelect(val) {
    setLevel(val);
  }

  function handleLevelNext() {
    if (!level) return;
    setStep(1);
  }

  function handleConfirmYes() {
    setConfirmed(true);
    setStep(2);
  }

  function handleConfirmChange() {
    setLevel(null);
    setStep(0);
  }

  function handleClassSelect(val) {
    setCls(val);
  }

  function handleClassNext() {
    if (!cls) return;
    onComplete({
      selected_level:      level,
      selected_discipline: DISCIPLINE_FOR[level],
      selected_class:      cls,
    });
  }

  return (
    <div className="fc-page">
      <div className="fc-page-inner">

        <div className="fc-progress-track">
          <div className="fc-progress-fill" style={{ width: `${progressPct()}%` }} />
        </div>

        {step === 0 && (
          <div className="fc-step">
            <span className="fc-step-label">Step 1 of 3</span>
            <h1 className="fc-step-title">What is your learning level?</h1>
            <p className="fc-step-subtitle">
              Choose the level that matches your current studies.
            </p>
            <div className="fc-option-grid fc-cols-1">
              {LEVELS.map(l => (
                <button
                  key={l.value}
                  className={`fc-option-btn ${level === l.value ? 'fc-selected' : ''}`}
                  onClick={() => handleLevelSelect(l.value)}
                >
                  <i className={`fa-solid ${l.icon} fc-option-icon`}></i>
                  <span className="fc-option-label">{l.label}</span>
                  <span className="fc-option-sub">{l.sub}</span>
                </button>
              ))}
            </div>
            <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'center' }}>
              <button
                className="fc-btn fc-btn-primary"
                onClick={handleLevelNext}
                disabled={!level}
              >
                Continue <i className="fa-solid fa-arrow-right"></i>
              </button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="fc-step">
            <span className="fc-step-label">Step 1 of 3 — Confirm</span>
            <h1 className="fc-step-title">Just to confirm</h1>
            <div className="fc-confirm-card">
              <div className="fc-confirm-badge">
                <i className="fa-solid fa-graduation-cap"></i>
                {level}
              </div>
              <p className="fc-confirm-question">
                Is <strong>{level}</strong> your current learning level?
              </p>
              <div className="fc-confirm-actions">
                <button className="fc-btn fc-btn-primary" onClick={handleConfirmYes}>
                  <i className="fa-solid fa-check"></i> Yes, that's right
                </button>
                <button className="fc-btn fc-btn-ghost" onClick={handleConfirmChange}>
                  Change
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="fc-step">
            <span className="fc-step-label">Step 2 of 3</span>
            <h1 className="fc-step-title">
              {level === 'Pharmacy' ? 'Which programme?' : 'Which class are you in?'}
            </h1>
            <p className="fc-step-subtitle">
              {level === 'Pharmacy'
                ? 'Select your current pharmacy programme.'
                : `Select your current ${level} class.`}
            </p>
            <div className="fc-option-grid fc-cols-1">
              {(CLASSES[level] || []).map(c => (
                <button
                  key={c}
                  className={`fc-option-btn ${cls === c ? 'fc-selected' : ''}`}
                  onClick={() => handleClassSelect(c)}
                >
                  <span className="fc-option-label">{c}</span>
                </button>
              ))}
            </div>
            <div style={{ marginTop: '1.5rem', display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button className="fc-btn fc-btn-ghost" onClick={() => setStep(0)}>
                <i className="fa-solid fa-arrow-left"></i> Back
              </button>
              <button
                className="fc-btn fc-btn-primary"
                onClick={handleClassNext}
                disabled={!cls}
              >
                Continue <i className="fa-solid fa-arrow-right"></i>
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
