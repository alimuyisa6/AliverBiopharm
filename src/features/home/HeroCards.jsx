 import React, { useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { flattenCardFrames } from './heroFrames';
import { useCardCycle } from './useCardCycle';
import { useHeroCards } from './useHeroCards';

const ACCENT_VARS = {
  cyan: 'var(--clr-cyan)',
  magenta: 'var(--clr-magenta)',
  blue: 'var(--clr-blue)',
  green: 'var(--clr-green)',
  purple: 'var(--clr-purple)',
  orange: 'var(--clr-orange)'
};

function HeroCard({ card, index, total }) {
  const navigate = useNavigate();
  const frames = useMemo(() => flattenCardFrames(card), [card]);
  const frame = useCardCycle(frames, index);
  const accentColor = ACCENT_VARS[frame.accent] || 'var(--clr-cyan)';

  function handleActivate() { navigate(frame.link); }
  function handleKeyDown(e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleActivate(); }
  }

  return (
    <div
      className="hero-card-slot"
      style={{
        transform: `rotate(${(index * 360) / total}deg) translateX(140px) rotate(-${(index * 360) / total}deg)`
      }}
    >
      <div
        className="hero-card"
        role="button"
        tabIndex={0}
        onClick={handleActivate}
        onKeyDown={handleKeyDown}
        style={{
          backgroundImage: frame.image_url ? `url(${frame.image_url})` : undefined,
          '--card-accent': accentColor
        }}
      >
        <span className="hero-card-overlay" />
        <span className="hero-card-spark" aria-hidden="true"><i className="fa-solid fa-atom" /></span>
        {frames.length > 1 && (
          <span className="hero-card-depth-dot">
            {frames.map((f, i) => <span key={i} className={i === frames.indexOf(frame) ? 'active' : ''} />)}
          </span>
        )}
        <span className="hero-card-content">
          <span className="hero-card-title">{frame.title}</span>
          {frame.subtitle && <span className="hero-card-subtitle">{frame.subtitle}</span>}
        </span>
      </div>
    </div>
  );
}

export function HeroCards({ cards, user, backgroundImage }) {
  const { spread, handleEnter, handleLeave, handleTap } = useHeroCards();

  if (!user) {
    return (
      <section
        id="home"
        className="hero-cards-section"
        style={backgroundImage ? { backgroundImage: `url(${backgroundImage})` } : undefined}
      >
        <div className="hero-cards-glow" />
        <div className="hero-gate-card">
          <h1 className="hero-gate-title">Welcome to AliverBiopharm</h1>
          <p className="hero-gate-subtitle">
            Log in to explore O-Level, A-Level and Pharmacy resources, or create a free account to get started.
          </p>
          <div className="hero-gate-actions">
            <Link to="/login" className="btn-primary">Log In</Link>
            <Link to="/signup" className="btn-secondary">Create Account</Link>
          </div>
        </div>
      </section>
    );
  }

  if (!cards?.length) return null;

  return (
    <section
      id="home"
      className="hero-cards-section"
      style={backgroundImage ? { backgroundImage: `url(${backgroundImage})` } : undefined}
    >
      <div className="hero-cards-glow" />
      <div className="hero-ring" onMouseEnter={handleEnter} onMouseLeave={handleLeave} onClick={handleTap}>
        <div className={`hero-ring-inner${spread ? ' is-spread' : ''}`}>
          {cards.map((card, idx) => (
            <HeroCard key={card.slug || idx} card={card} index={idx} total={cards.length} />
          ))}
        </div>
      </div>
    </section>
  );
}
