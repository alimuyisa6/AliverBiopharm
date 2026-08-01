 /* components/FlashcardWelcome.jsx */
import { useEffect, useState } from 'react';
import Icon from './Icon/Icon';

export default function FlashcardWelcome({ user, level, discipline, cls, onDone }) {
  const [flipped, setFlipped] = useState(false);

  const displayName = user?.email
    ? user.email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : 'Learner';

  useEffect(() => {
    const flipTimer = setTimeout(() => setFlipped(true), 1800);
    const doneTimer = setTimeout(() => onDone(), 3400);
    return () => {
      clearTimeout(flipTimer);
      clearTimeout(doneTimer);
    };
  }, [onDone]);

  return (
    <div className="flashcard-welcome">
      <div className="section fcd-empty">
        <span className="sec-label">Welcome</span>
        <h2 className="section-title">You're all set</h2>
        <p className="section-subtitle fcw-subtitle-gap">
          {level} · {discipline} · {cls}
        </p>

        <div className="fcw-flip-container">
          <div className={`fcw-flip-inner${flipped ? ' is-flipped' : ''}`}>
            <div className="card card-blue fcw-flip-face">
              <span className="fcw-emoji">👋</span>
              <h3 className="fcd-card-heading">Welcome, {displayName}</h3>
              <p className="quiz-challenge-reward">
                Get ready for your {level} {discipline} flashcards.
              </p>
            </div>

            <div className="card card-teal fcw-flip-face is-back">
              <span className="fcw-emoji">😊</span>
              <h3 className="fcd-card-heading">Please have a seat.</h3>
              <p className="quiz-challenge-reward">
                Loading your personalised study session…
              </p>
              <span className="chip fcd-answer-chip is-correct">
                <Icon name="layer-group" /> {cls}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
