// features/home/FaqAccordion.jsx
import React from 'react';

export function FaqAccordion({ items }) {
  return (
    <section id="faq" className="section reveal">
      <span className="sec-label">FAQ</span>
      <h2 className="section-title">Questions We Hear Most Often</h2>
      <p className="section-subtitle">
        Straightforward answers about our platform, resources, tools, and membership options.
      </p>
      <div className="faq-list">
        {(items || []).filter(Boolean).map((item, idx) => (
          <div key={idx} className="faq-item">
            <button className="faq-question" onClick={e => e.currentTarget.parentElement.classList.toggle('active')}>
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
