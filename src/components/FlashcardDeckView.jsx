import React, { useState, useEffect, useCallback } from 'react';
import {
  getFlashcardDeck,
  toggleFlashcardKnown,
  toggleFlashcardBookmark,
  rateFlashcard,
  checkFlashcardAnswer,
  startFlashcardSession,
  updateFlashcardSession,
} from '../api/cachedClient';

const MODES = [
  { value: 'flip',                   icon: 'fa-rotate',        label: 'Flip' },
  { value: 'typed',                  icon: 'fa-keyboard',      label: 'Typed' },
  { value: 'multiple_choice',        icon: 'fa-list-check',    label: 'MCQ' },
  { value: 'structure_identification', icon: 'fa-microscope',  label: 'Structure' },
];

export default function FlashcardDeckView({ deck: deckMeta, knownIds = [], mode: initialMode = 'flip', onComplete }) {
  const [deck, setDeck]           = useState(null);
  const [cards, setCards]         = useState([]);
  const [index, setIndex]         = useState(0);
  const [mode, setMode]           = useState(initialMode);
  const [flipped, setFlipped]     = useState(false);
  const [known, setKnown]         = useState(new Set(knownIds));
  const [bookmarked, setBookmarked] = useState(new Set());
  const [sessionId, setSessionId] = useState(null);
  const [typedAnswer, setTypedAnswer] = useState('');
  const [feedback, setFeedback]   = useState(null);
  const [mcAnswered, setMcAnswered] = useState(null);
  const [structureTab, setStructureTab] = useState('name');
  const [loading, setLoading]     = useState(true);

  const card = cards[index] || null;

  useEffect(() => {
    loadDeck();
  }, [deckMeta.id]);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'ArrowLeft')  handlePrev();
      if (e.key === ' ')          { e.preventDefault(); setFlipped(f => !f); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [index, cards.length]);

  async function loadDeck() {
    setLoading(true);
    try {
      const data = await getFlashcardDeck(deckMeta.id);
      setDeck(data);
      setCards(data.cards || []);
      const sid = await startFlashcardSession(deckMeta.id, mode);
      setSessionId(sid?.session_id || null);
    } catch {}
    setLoading(false);
  }

  function resetCard() {
    setFlipped(false);
    setTypedAnswer('');
    setFeedback(null);
    setMcAnswered(null);
    setStructureTab('name');
  }

  function handleNext() {
    if (index >= cards.length - 1) return;
    setIndex(i => i + 1);
    resetCard();
  }

  function handlePrev() {
    if (index <= 0) return;
    setIndex(i => i - 1);
    resetCard();
  }

  async function handleToggleKnown() {
    if (!card) return;
    try {
      await toggleFlashcardKnown(card.id);
      setKnown(prev => {
        const next = new Set(prev);
        next.has(card.id) ? next.delete(card.id) : next.add(card.id);
        return next;
      });
    } catch {}
  }

  async function handleToggleBookmark() {
    if (!card) return;
    try {
      await toggleFlashcardBookmark(card.id);
      setBookmarked(prev => {
        const next = new Set(prev);
        next.has(card.id) ? next.delete(card.id) : next.add(card.id);
        return next;
      });
    } catch {}
  }

  async function handleRate(difficulty) {
    if (!card) return;
    try { await rateFlashcard(card.id, difficulty); } catch {}
  }

  async function handleCheckTyped(checkType = 'answer') {
    if (!card || !typedAnswer.trim()) return;
    try {
      const result = await checkFlashcardAnswer(card.id, typedAnswer.trim(), checkType);
      setFeedback(result);
      if (sessionId) {
        await updateFlashcardSession(sessionId, card.id, result.correct, index).catch(() => {});
      }
    } catch {}
  }

  async function handleMCSelect(optionIndex) {
    if (!card || mcAnswered !== null) return;
    const correct = optionIndex === card.mc_correct_index;
    setMcAnswered(optionIndex);
    setFeedback({ correct, strength: correct ? 'excellent' : 'incorrect', correct_answer: card.mc_options?.[card.mc_correct_index] });
    if (sessionId) {
      await updateFlashcardSession(sessionId, card.id, correct, index).catch(() => {});
    }
  }

  function handleFinish() {
    onComplete({ sessionId, total: cards.length });
  }

  function speakText(text) {
    if (!text || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.speak(utt);
  }

  function feedbackClass(strength) {
    if (strength === 'excellent') return 'fc-feedback-excellent';
    if (strength === 'strong')    return 'fc-feedback-strong';
    if (strength === 'partial')   return 'fc-feedback-partial';
    return 'fc-feedback-incorrect';
  }

  function feedbackIcon(strength) {
    if (strength === 'excellent') return 'fa-circle-check';
    if (strength === 'strong')    return 'fa-check';
    if (strength === 'partial')   return 'fa-circle-exclamation';
    return 'fa-circle-xmark';
  }

  if (loading) {
    return (
      <div className="fc-page">
        <div className="fc-page-inner">
          <div className="fc-loading">
            <div className="fc-spinner"></div>
            Loading deck…
          </div>
        </div>
      </div>
    );
  }

  if (!card) {
    return (
      <div className="fc-page">
        <div className="fc-page-inner">
          <div className="fc-empty">
            <i className="fa-solid fa-layer-group"></i>
            No cards in this deck yet.
          </div>
          <button className="fc-btn fc-btn-ghost" onClick={() => onComplete({ sessionId, total: 0 })}>
            <i className="fa-solid fa-arrow-left"></i> Back
          </button>
        </div>
      </div>
    );
  }

  const isKnown      = known.has(card.id);
  const isBookmarked = bookmarked.has(card.id);
  const isLast       = index === cards.length - 1;

  return (
    <div className="fc-page">
      <div className="fc-page-inner">

        <div className="fc-progress-track">
          <div className="fc-progress-fill" style={{ width: `${((index + 1) / cards.length) * 100}%` }} />
        </div>

        <div className="fc-mode-bar">
          {MODES.map(m => (
            <button
              key={m.value}
              className={`fc-mode-btn ${mode === m.value ? 'fc-active' : ''}`}
              onClick={() => { setMode(m.value); resetCard(); }}
            >
              <i className={`fa-solid ${m.icon}`}></i>
              <span>{m.label}</span>
            </button>
          ))}
        </div>

        <div className="fc-study-wrap">
          <div className="fc-card-counter">
            {index + 1} / {cards.length}
            {deck?.title && <span style={{ marginLeft: '0.5rem', opacity: 0.6 }}>· {deck.title}</span>}
          </div>

          {/* ── FLIP MODE ── */}
          {mode === 'flip' && (
            <div className="fc-flip-scene" onClick={() => setFlipped(f => !f)}>
              <div className={`fc-flip-card ${flipped ? 'fc-flipped' : ''}`}>
                <div className="fc-card-face fc-card-front">
                  <span className="fc-card-tag">Question</span>
                  <button className="fc-speak-btn" onClick={e => { e.stopPropagation(); speakText(card.front_text); }}>
                    <i className="fa-solid fa-volume-high"></i>
                  </button>
                  {card.image_url
                    ? <img src={card.image_url} alt="" className="fc-card-image" />
                    : null}
                  <p className="fc-card-question">{card.front_text}</p>
                  <span className="fc-card-hint"><i className="fa-regular fa-hand-pointer"></i> Tap to flip</span>
                </div>
                <div className="fc-card-face fc-card-back">
                  <span className="fc-card-tag">Answer</span>
                  <button className="fc-speak-btn" onClick={e => { e.stopPropagation(); speakText(card.back_text); }}>
                    <i className="fa-solid fa-volume-high"></i>
                  </button>
                  <p className="fc-card-answer">{card.back_text}</p>
                </div>
              </div>
            </div>
          )}

          {/* ── TYPED MODE ── */}
          {mode === 'typed' && (
            <>
              <div className="fc-flip-scene" style={{ cursor: 'default' }}>
                <div className="fc-card-face fc-card-front" style={{ position: 'relative', height: '100%' }}>
                  <span className="fc-card-tag">Question</span>
                  <button className="fc-speak-btn" onClick={() => speakText(card.front_text)}>
                    <i className="fa-solid fa-volume-high"></i>
                  </button>
                  {card.image_url
                    ? <img src={card.image_url} alt="" className="fc-card-image" />
                    : null}
                  <p className="fc-card-question">{card.front_text}</p>
                </div>
              </div>
              <div className="fc-typed-wrap">
                <input
                  className="fc-typed-input"
                  placeholder="Type your answer…"
                  value={typedAnswer}
                  onChange={e => setTypedAnswer(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleCheckTyped(); }}
                  disabled={!!feedback}
                />
                {!feedback && (
                  <button
                    className="fc-btn fc-btn-primary"
                    onClick={() => handleCheckTyped()}
                    disabled={!typedAnswer.trim()}
                  >
                    <i className="fa-solid fa-check"></i> Check
                  </button>
                )}
                {feedback && (
                  <div className={`fc-feedback ${feedbackClass(feedback.strength)}`}>
                    <i className={`fa-solid ${feedbackIcon(feedback.strength)}`}></i>
                    <span>
                      {feedback.strength === 'excellent' && 'Perfect! '}
                      {feedback.strength === 'strong'    && 'Close! '}
                      {feedback.strength === 'partial'   && 'Partially correct. '}
                      {feedback.strength === 'incorrect' && 'Not quite. '}
                      Correct answer: <strong>{feedback.correct_answer}</strong>
                      {feedback.explanation && <span> — {feedback.explanation}</span>}
                    </span>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── MULTIPLE CHOICE MODE ── */}
          {mode === 'multiple_choice' && (
            <>
              <div className="fc-flip-scene" style={{ cursor: 'default' }}>
                <div className="fc-card-face fc-card-front" style={{ position: 'relative', height: '100%' }}>
                  <span className="fc-card-tag">Question</span>
                  <p className="fc-card-question">{card.front_text}</p>
                </div>
              </div>
              {(card.mc_options?.length > 0)
                ? (
                  <div className="fc-mc-grid">
                    {card.mc_options.map((opt, i) => {
                      let cls = 'fc-mc-btn';
                      if (mcAnswered !== null) {
                        if (i === card.mc_correct_index) cls += ' fc-mc-correct';
                        else if (i === mcAnswered)       cls += ' fc-mc-wrong';
                      }
                      return (
                        <button key={i} className={cls} onClick={() => handleMCSelect(i)} disabled={mcAnswered !== null}>
                          <span className="fc-mc-letter">{String.fromCharCode(65 + i)}</span>
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                )
                : (
                  <div className="fc-empty">
                    <i className="fa-solid fa-list-check"></i>
                    No MCQ options for this card.
                  </div>
                )}
              {feedback && (
                <div className={`fc-feedback ${feedbackClass(feedback.strength)}`}>
                  <i className={`fa-solid ${feedbackIcon(feedback.strength)}`}></i>
                  <span>
                    {feedback.correct ? 'Correct! ' : `Incorrect. Answer: `}
                    <strong>{feedback.correct_answer}</strong>
                  </span>
                </div>
              )}
            </>
          )}

          {/* ── STRUCTURE IDENTIFICATION MODE ── */}
          {mode === 'structure_identification' && (
            <>
              <div className="fc-flip-scene" style={{ cursor: 'default', height: 'auto', minHeight: '200px' }}>
                <div className="fc-card-face fc-card-front" style={{ position: 'relative', minHeight: '200px' }}>
                  <span className="fc-card-tag">Structure</span>
                  {card.image_url
                    ? <img src={card.image_url} alt={card.structure_name || 'Structure'} className="fc-card-image" />
                    : (
                      <div className="fc-card-placeholder">
                        <i className="fa-solid fa-image"></i>
                        <span>{card.structure_name || 'Image coming soon'}</span>
                      </div>
                    )}
                </div>
              </div>

              <div className="fc-structure-tabs">
                <button
                  className={`fc-structure-tab ${structureTab === 'name' ? 'fc-active' : ''}`}
                  onClick={() => setStructureTab('name')}
                >
                  <i className="fa-solid fa-tag"></i> Name
                </button>
                <button
                  className={`fc-structure-tab ${structureTab === 'function' ? 'fc-active' : ''}`}
                  onClick={() => setStructureTab('function')}
                >
                  <i className="fa-solid fa-gear"></i> Function
                </button>
              </div>

              <div className="fc-typed-wrap">
                <input
                  className="fc-typed-input"
                  placeholder={structureTab === 'name' ? 'What is this structure called?' : 'What is its function?'}
                  value={typedAnswer}
                  onChange={e => setTypedAnswer(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleCheckTyped(structureTab); }}
                  disabled={!!feedback}
                />
                {!feedback && (
                  <button
                    className="fc-btn fc-btn-primary"
                    onClick={() => handleCheckTyped(structureTab)}
                    disabled={!typedAnswer.trim()}
                  >
                    <i className="fa-solid fa-check"></i> Check
                  </button>
                )}
                {feedback && (
                  <div className={`fc-feedback ${feedbackClass(feedback.strength)}`}>
                    <i className={`fa-solid ${feedbackIcon(feedback.strength)}`}></i>
                    <span>
                      {feedback.strength === 'excellent' && 'Excellent! '}
                      {feedback.strength === 'strong'    && 'Close! '}
                      {feedback.strength === 'partial'   && 'Partially correct. '}
                      {feedback.strength === 'incorrect' && 'Not quite. '}
                      {structureTab === 'name'
                        ? <>Structure: <strong>{feedback.correct_answer || card.structure_name}</strong></>
                        : <>Function: <strong>{feedback.correct_answer}</strong></>}
                    </span>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── ACTIONS ── */}
          <div className="fc-difficulty-row">
            <button className="fc-diff-btn fc-diff-easy"   onClick={() => handleRate('easy')}>Easy</button>
            <button className="fc-diff-btn fc-diff-medium" onClick={() => handleRate('medium')}>Medium</button>
            <button className="fc-diff-btn fc-diff-hard"   onClick={() => handleRate('hard')}>Hard</button>
          </div>

          <div className="fc-card-actions">
            <button
              className={`fc-action-btn ${isKnown ? 'fc-known' : ''}`}
              onClick={handleToggleKnown}
            >
              <i className={`fa-${isKnown ? 'solid' : 'regular'} fa-circle-check`}></i>
              {isKnown ? 'Known' : 'Mark Known'}
            </button>
            <button
              className={`fc-action-btn ${isBookmarked ? 'fc-bookmarked' : ''}`}
              onClick={handleToggleBookmark}
            >
              <i className={`fa-${isBookmarked ? 'solid' : 'regular'} fa-bookmark`}></i>
              {isBookmarked ? 'Saved' : 'Save'}
            </button>
          </div>

          <div className="fc-nav-row">
            <button className="fc-nav-btn" onClick={handlePrev} disabled={index === 0}>
              <i className="fa-solid fa-arrow-left"></i>
            </button>

            {isLast
              ? (
                <button className="fc-btn fc-btn-primary" onClick={handleFinish}>
                  Finish <i className="fa-solid fa-flag-checkered"></i>
                </button>
              )
              : (
                <button className="fc-nav-btn" onClick={handleNext}>
                  <i className="fa-solid fa-arrow-right"></i>
                </button>
              )}
          </div>

          <p style={{ textAlign: 'center', fontSize: 'var(--text-sm)', color: 'var(--clr-text-muted)', fontFamily: 'var(--font-mono)' }}>
            <i className="fa-regular fa-keyboard"></i> ← → navigate · Space flip
          </p>
        </div>

      </div>
    </div>
  );
}
