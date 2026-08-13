/* features/flashcards/FlashcardSection.jsx */
import React from 'react';
import Button from '../../components/Button/Button';

export function FlashcardSection({ headingTitle, headingSubtitle, onStartStudy, onBrowseDecks, user }) {
  const previewCards = [
    { q: 'What is the function of the mitochondria?', label: 'Cell Biology' },
    { q: 'Define the term osmosis.', label: 'Transport' },
    { q: 'What enzyme breaks down starch?', label: 'Nutrition' }
  ];

  return (
    <section id="flashcards" className="section reveal">
      <span className="sec-label">Study Tools</span>
      <h2 className="section-title">
        {headingTitle || 'Transform the way you retain complex scientific concepts through active recall'}
      </h2>
      <p className="section-subtitle">
        {headingSubtitle || 'Flip cards, typed answers, multiple choice and structure identification — all in one adaptive system.'}
      </p>

      <div className="fc-home-preview">
        {previewCards.map((item, index) => (
          <div key={index} className="fc-preview-card">
            <p className="fc-preview-q">{item.q}</p>
            <span className="fc-chip fc-preview-chip">{item.label}</span>
            <div className="fc-preview-dots">
              {[0, 1, 2].map((dot) => (
                <span key={dot} className={`fc-preview-dot ${dot === index ? 'fc-active' : ''}`}></span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="fc-actions-row">
        <Button onClick={onStartStudy}>
          <i className="fa-solid fa-layer-group"></i>
          {user ? 'Start Studying' : 'Login to Study'}
        </Button>

        {user && (
          <Button variant="secondary" className="fc-browse-btn" onClick={onBrowseDecks}>
            <i className="fa-solid fa-arrow-right"></i> Browse Decks
          </Button>
        )}
      </div>
    </section>
  );
} 
