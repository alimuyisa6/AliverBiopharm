 import React from 'react';

export default function FlashcardProgress({ result, onRestart, onHome }) {
  const { total = 0, correct = 0, incorrect = 0, score = 0 } = result || {};

  function scoreColor() {
    if (score >= 80) return 'fc-green';
    if (score >= 50) return 'fc-cyan';
    return 'fc-red';
  }

  function message() {
    if (score >= 80) return 'Outstanding work! 🎉';
    if (score >= 60) return 'Good effort! Keep it up.';
    if (score >= 40) return 'Keep practising — you\'re getting there.';
    return 'Review the material and try again.';
  }

  return (
    <div className="fc-page">
      <div className="fc-page-inner">
        <div className="fc-complete-card">
          <div className="fc-complete-trophy">🏆</div>
          <h2 className="fc-complete-title">Session Complete</h2>
          <p className="fc-complete-sub">{message()}</p>

          <div className="fc-stats-row">
            <div className="fc-stat-box">
              <div className={`fc-stat-value ${scoreColor()}`}>{score}%</div>
              <div className="fc-stat-label">Score</div>
            </div>
            <div className="fc-stat-box">
              <div className="fc-stat-value fc-green">{correct}</div>
              <div className="fc-stat-label">Correct</div>
            </div>
            <div className="fc-stat-box">
              <div className="fc-stat-value fc-red">{incorrect}</div>
              <div className="fc-stat-label">Missed</div>
            </div>
          </div>

          <div className="fc-complete-actions">
            <button className="fc-btn-primary" onClick={onRestart}>
              <i className="fa-solid fa-rotate-right"></i> Study Again
            </button>
            <button className="fc-btn-ghost" onClick={onHome}>
              <i className="fa-solid fa-house"></i> Home
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
