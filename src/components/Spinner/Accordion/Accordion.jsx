/* components/Accordion/Accordion.jsx */
import { useState } from 'react';
import Icon from '../Icon/Icon';

export default function Accordion({ items = [] }) {
  const [activeIndex, setActiveIndex] = useState(null);

  if (!items.length) return null;

  return (
    <div className="accordion">
      {items.map((item, idx) => (
        <div key={idx} className={`accordion-item ${activeIndex === idx ? 'active' : ''}`}>
          <button
            className="accordion-trigger"
            onClick={() => setActiveIndex(activeIndex === idx ? null : idx)}
            aria-expanded={activeIndex === idx}
          >
            <span>{item.title}</span>
            <Icon name="plus" className="accordion-icon" />
          </button>
          <div className="accordion-content">
            <div className="accordion-body">{item.content}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
