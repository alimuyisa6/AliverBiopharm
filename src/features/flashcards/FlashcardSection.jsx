 // features/flashcards/FlashcardSection.jsx
import React from 'react';

export function FlashcardSection({ headingTitle, headingSubtitle, onStartStudy, onBrowseDecks, user }) {
  const previewCards = [
    { q: 'What is the function of the mitochondria?', label: 'Cell Biology' },
    { q: 'Define the term osmosis.', label: 'Transport' },
    { q: 'What enzyme breaks down starch?', label: 'Nutrition' },
  ];

  return (
    <section id="flashcards" className="section reveal">
      <span className="sec-label">STUDY TOOLS</span>
      <h2 className="section-title">
        {headingTitle || 'Transform the way you retain complex scientific concepts through active recall'}
      </h2>
      <p className="section-subtitle">
        {headingSubtitle || 'Flip cards, typed answers, multiple choice and structure identification — all in one adaptive system.'}
      </p>
      <div className="fc-home-preview">
        {previewCards.map((item, i) => (
          <div key={i} className="fc-preview-card">
            <p className="fc-preview-q">{item.q}</p>
            <span className="fc-chip fc-preview-chip">{item.label}</span>
            <div className="fc-preview-dots">
              {[0, 1, 2].map(d => (
                <span key={d} className={`fc-preview-dot ${d === i ? 'fc-active' : ''}`}></span>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="fc-actions-row">
        <button className="btn btn-primary" onClick={onStartStudy}>
          <i className="fa-solid fa-layer-group"></i>
          {user ? 'Start Studying' : 'Login to Study'}
        </button>
        {user && (
          <button className="btn btn-secondary fc-browse-btn" onClick={onBrowseDecks}>
            <i className="fa-solid fa-arrow-right"></i> Browse Decks
          </button>
        )}
      </div>
    </section>
  );
}
