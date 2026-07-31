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
      <div className="section" style={{ textAlign: 'center' }}>
        <span className="sec-label">Welcome</span>
        <h2 className="section-title">You're all set</h2>
        <p className="section-subtitle" style={{ marginBottom: 'var(--space-8)' }}>
          {level} · {discipline} · {cls}
        </p>

        <div style={{ perspective: '1000px', maxWidth: 400, margin: '0 auto' }}>
          <div
            style={{
              position: 'relative',
              width: '100%',
              height: 240,
              transition: 'transform 0.6s',
              transformStyle: 'preserve-3d',
              transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
            }}
          >
            <div className="card" style={{
              position: 'absolute',
              inset: 0,
              backfaceVisibility: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 'var(--space-8)',
              textAlign: 'center',
            }}>
              <span style={{ fontSize: '3rem', marginBottom: 'var(--space-4)' }}>👋</span>
              <h3 style={{ marginBottom: 'var(--space-3)' }}>Welcome, {displayName}</h3>
              <p style={{ color: 'var(--text-dim)' }}>
                Get ready for your {level} {discipline} flashcards.
              </p>
            </div>

            <div className="card" style={{
              position: 'absolute',
              inset: 0,
              backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 'var(--space-8)',
              textAlign: 'center',
            }}>
              <span style={{ fontSize: '3rem', marginBottom: 'var(--space-4)' }}>😊</span>
              <h3 style={{ marginBottom: 'var(--space-3)' }}>Please have a seat.</h3>
              <p style={{ color: 'var(--text-dim)', marginBottom: 'var(--space-4)' }}>
                Loading your personalised study session…
              </p>
              <span className="chip" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>
                <Icon name="layer-group" style={{ marginRight: 'var(--space-2)' }} />
                {cls}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
