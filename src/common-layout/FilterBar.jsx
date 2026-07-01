// common-layout/FilterBar.jsx
import React from 'react';

export function FilterBar({ options, selected, onSelect, label, colorMap }) {
  return (
    <div className="filter-bar">
      {label && <span className="filter-label">{label}</span>}
      <div className="filter-buttons">
        {options.map(option => (
          <button
            key={option}
            className={`filter-btn ${selected === option ? 'active' : ''}`}
            style={selected === option && colorMap ? { background: colorMap[option], borderColor: colorMap[option] } : {}}
            onClick={() => onSelect(option)}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}
