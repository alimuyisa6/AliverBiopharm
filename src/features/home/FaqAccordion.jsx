 /* features/home/FaqAccordion.jsx */
import { useState } from 'react';

const ACCENTS = ['grey', 'green', 'blue', 'amber', 'emerald'];

export function FaqAccordion({ items }) {
  const [activeIndex, setActiveIndex] = useState(null);

  if (!items || !Array.isArray(items)) return null;

  return (
    <section id="faq" className="section reveal">
      <span className="sec-label">Before you ask</span>
      <h2 className="section-title">
        The Questions We Get<br />All the Time
      </h2>
      <p className="section-subtitle">
        Straightforward answers about pricing, access, and how billing works.
      </p>

      <div className="home-faq-list">
        {items.filter(Boolean).map((item, index) => {
          const accent = ACCENTS[index % ACCENTS.length];

          return (
            <div
              key={index}
              className={`home-faq-item home-faq-${accent}${activeIndex === index ? ' active' : ''}`}
            >
              <button
                className="home-faq-question"
                onClick={() => setActiveIndex(activeIndex === index ? null : index)}
                aria-expanded={activeIndex === index}
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
