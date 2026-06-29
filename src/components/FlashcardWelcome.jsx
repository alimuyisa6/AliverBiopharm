import React, { useEffect, useState } from 'react';

export default function FlashcardWelcome({ user, level, discipline, cls, onDone }) {
  const [flipped, setFlipped] = useState(false);

  const displayName = user?.email
    ? user.email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    : 'Learner';

  useEffect(() => {
    const flipTimer = setTimeout(() => setFlipped(true), 1800);
    const doneTimer = setTimeout(() => onDone(), 3400);
    return () => { clearTimeout(flipTimer); clearTimeout(doneTimer); };
  }, [onDone]);

  return (
    <div className="fc-page">
      <div className="fc-page-inner">
        <span className="fc-step-label">Welcome</span>
        <h2 className="fc-step-title">You're all set</h2>
        <p className="fc-step-subtitle">
          {level} · {discipline} · {cls}
        </p>

        <div className="fc-welcome-wrap">
          <div className={`fc-welcome-card ${flipped ? 'fc-flipped' : ''}`}>

            <div className="fc-welcome-front">
              <div className="fc-welcome-emoji">👋</div>
              <div className="fc-welcome-name">Welcome, {displayName}</div>
              <div className="fc-welcome-sub">
                Get ready for your {level} {discipline} flashcards.
              </div>
            </div>

            <div className="fc-welcome-back">
              <div className="fc-welcome-emoji">😊</div>
              <div className="fc-welcome-name">Please have a seat.</div>
              <div className="fc-welcome-sub">
                Loading your personalised study session…
              </div>
              <div className="fc-welcome-pill">
                <i className="fa-solid fa-layer-group"></i>
                {cls}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
