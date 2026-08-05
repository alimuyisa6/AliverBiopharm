 import React, { useState } from 'react';

const ACCENTS = ['blue', 'teal', 'violet', 'amber', 'emerald'];

export function FaqAccordion({ items }) {
  const [activeIndex, setActiveIndex] = useState(null);
  if (!items || !Array.isArray(items)) return null;

  return (
    <section id="faq" className="section reveal">
      <span className="sec-label">FAQ</span>
      <h2 className="section-title">Questions We Hear Most Often</h2>
      <p className="section-subtitle">
        Straightforward answers about our platform, resources, tools, and membership options.
      </p>
      <div className="home-faq-list">
        {items.filter(Boolean).map((item, idx) => {
          const accent = ACCENTS[idx % ACCENTS.length];
          return (
            <div
              key={idx}
              className={`home-faq-item home-faq-${accent}${activeIndex === idx ? ' active' : ''}`}
            >
              <button
                className="home-faq-question"
                onClick={() => setActiveIndex(activeIndex === idx ? null : idx)}
                aria-expanded={activeIndex === idx}
              >
                <span className="home-faq-icon">
                  <i className="fa-solid fa-circle-question"></i>
                </span>
                <span className="home-faq-question-text">{item.question}</span>
                <span className="home-faq-plus">+</span>
              </button>
              <div className="home-faq-answer"><p>{item.answer}</p></div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
