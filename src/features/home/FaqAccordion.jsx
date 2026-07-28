 import React, { useState } from 'react';

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
      <div className="faq-list">
        {items.filter(Boolean).map((item, idx) => (
          <div key={idx} className={`faq-item${activeIndex === idx ? ' active' : ''}`}>
            <button
              className="faq-question"
              onClick={() => setActiveIndex(activeIndex === idx ? null : idx)}
            >
              <span>{item.question}</span>
              <span className="faq-plus">+</span>
            </button>
            <div className="faq-answer"><p>{item.answer}</p></div>
          </div>
        ))}
      </div>
    </section>
  );
}
