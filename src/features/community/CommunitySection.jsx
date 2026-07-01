// features/community/CommunitySection.jsx
import React from 'react';

export function CommunitySection({ activity, weeklyChallenge, weeklyChallengeAnswer, onWeeklySubmit }) {
  const safeActivity = activity || [];

  return (
    <>
      <section id="daily-fact" className="section reveal daily-fact-section">
        {weeklyChallenge?.question && (
          <div className="weekly-challenge-card">
            <div className="challenge-badge">WEEKLY CHALLENGE</div>
            <h3 className="weekly-challenge-title">
              <i className="fa-solid fa-trophy weekly-challenge-trophy"></i> {weeklyChallenge.question}
            </h3>
            {!weeklyChallengeAnswer ? (
              <div className="weekly-challenge-options">
                {(weeklyChallenge.options || []).filter(Boolean).map((opt, i) => (
                  <button key={i} className="quiz-option-btn" onClick={() => onWeeklySubmit(i, weeklyChallenge.correct, weeklyChallenge.explanation)}>
                    {String.fromCharCode(65 + i)}) {opt}
                  </button>
                ))}
              </div>
            ) : (
              <p className="weekly-challenge-result">
                <i className={`fa-solid fa-${weeklyChallengeAnswer.correct ? 'check-circle' : 'times-circle'} ${weeklyChallengeAnswer.correct ? 'result-correct' : 'result-incorrect'}`}></i>
                {weeklyChallengeAnswer.correct ? ' Correct!' : ' Incorrect.'} {String.fromCharCode(65 + weeklyChallenge.correct)}) {weeklyChallenge.options?.[weeklyChallenge.correct]}
                <br /><small>{weeklyChallengeAnswer.explanation}</small>
              </p>
            )}
          </div>
        )}
      </section>

      <section id="community" className="section alt-bg reveal">
        <span className="sec-label">Community</span>
        <h2 className="section-title">See Who's Learning Right Now</h2>
        <p className="section-subtitle">
          Join thousands of active students downloading resources, completing quizzes, and building knowledge daily.
        </p>
        <div className="community-stream">
          {safeActivity.filter(Boolean).map((act, idx) => (
            <div key={idx} className="stream-item">
              <i className={`fa-solid fa-${act.type === 'download' ? 'download' : 'graduation-cap'} stream-icon`}></i>
              <span>{act.message}</span>
              <small className="stream-time">{new Date(act.time).toLocaleDateString()}</small>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
