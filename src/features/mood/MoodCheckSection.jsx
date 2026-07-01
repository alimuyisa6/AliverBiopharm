// features/mood/MoodCheckSection.jsx
import React from 'react';

export function MoodCheckSection({ moodSelected, moodMessage, moodSubmitted, onMoodSelect, onMessageChange, onSubmit }) {
  return (
    <section id="mood-check" className="section reveal mood-check-section">
      <div className="mood-section">
        <h3 className="mood-title">
          <i className="fa-solid fa-face-smile mood-icon"></i> How are you feeling about your studies today?
        </h3>
        <div className="mood-emojis">
          {['struggling', 'confused', 'okay', 'good', 'great'].map(m => (
            <button
              key={m}
              className={`mood-emoji ${moodSelected === m ? 'selected' : ''}`}
              onClick={() => onMoodSelect(m)}
            >
              {m === 'struggling' ? '😭' : m === 'confused' ? '🤔' : m === 'okay' ? '😐' : m === 'good' ? '😊' : '🚀'}
            </button>
          ))}
        </div>
        {moodSelected && !moodSubmitted && (
          <div className="mood-submit-area">
            <textarea className="form-input mood-textarea" placeholder="Tell us more (optional)..." value={moodMessage} onChange={e => onMessageChange(e.target.value)}></textarea>
            <button className="btn-primary" onClick={onSubmit}>Submit <i className="fa-solid fa-paper-plane"></i></button>
          </div>
        )}
        {moodSubmitted && <div className="mood-thanks">Thanks for sharing!</div>}
      </div>
    </section>
  );
}
