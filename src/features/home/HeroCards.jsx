import React from 'react';
import { Link } from 'react-router-dom';
import { useHeroCards } from './useHeroCards';


const ACCENT_VARS = {
  cyan: 'var(--clr-cyan)',
  magenta: 'var(--clr-magenta)',
  blue: 'var(--clr-blue)',
  green: 'var(--clr-green)',
  purple: 'var(--clr-purple)',
  orange: 'var(--clr-orange)'
};

export function HeroCards({ cards, user }) {
  const { spread, isTouch, handleEnter, handleLeave } = useHeroCards();

  if (!user) {
    return (
      <section id="home" className="hero-cards-section">
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
    <section id="home" className="hero-cards-section">
      <div className="hero-cards-glow" />
      <div
        className={`hero-cards-stack ${spread || isTouch ? 'is-spread' : ''}`}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        onFocus={handleEnter}
        onBlur={handleLeave}
      >
        {cards.slice(0, 6).map((card, idx) => {
          const accentColor = ACCENT_VARS[card.accent] || 'var(--clr-cyan)';
          return (
            <Link
              key={card.slug || idx}
              to={card.link}
              className="hero-card"
              style={{
                '--card-index': idx,
                '--grid-col': idx % 3,
                '--grid-row': Math.floor(idx / 3),
                '--card-accent': accentColor,
                backgroundImage: card.image_url ? `url(${card.image_url})` : undefined
              }}
            >
              <span className="hero-card-overlay" />
              <span className="hero-card-content">
                <span className="hero-card-title">{card.title}</span>
                {card.subtitle && <span className="hero-card-subtitle">{card.subtitle}</span>}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
