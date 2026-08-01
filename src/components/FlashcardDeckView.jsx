 /* components/FlashcardDeckView.jsx */
import { useState, useEffect } from 'react';
import {
  getFlashcardDeck,
  toggleFlashcardKnown,
  toggleFlashcardBookmark,
  rateFlashcard,
  checkFlashcardAnswer,
  startFlashcardSession,
  updateFlashcardSession,
} from '../api/cachedClient';
import Icon from './Icon/Icon';
import Button from './Button/Button';
import ProgressBar from './ProgressBar/ProgressBar';
import Spinner from './Spinner/Spinner';
import { useToast } from './Toast/Toast';

const MODES = [
  { value: 'flip', icon: 'rotate', label: 'Flip' },
  { value: 'typed', icon: 'keyboard', label: 'Typed' },
  { value: 'multiple_choice', icon: 'list-check', label: 'MCQ' },
  { value: 'structure_identification', icon: 'microscope', label: 'Structure' },
];

const MODE_CARD_COLOR = {
  flip: 'card-blue',
  typed: 'card-teal',
  multiple_choice: 'card-violet',
  structure_identification: 'card-amber',
};

export default function FlashcardDeckView({ deck: deckMeta, knownIds = [], mode: initialMode = 'flip', onComplete }) {
  const [deck, setDeck] = useState(null);
  const [cards, setCards] = useState([]);
  const [index, setIndex] = useState(0);
  const [mode, setMode] = useState(initialMode);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState(new Set(knownIds));
  const [bookmarked, setBookmarked] = useState(new Set());
  const [sessionId, setSessionId] = useState(null);
  const [typedAnswer, setTypedAnswer] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [mcAnswered, setMcAnswered] = useState(null);
  const [structureTab, setStructureTab] = useState('name');
  const [loading, setLoading] = useState(true);
  const addToast = useToast();

  const card = cards[index] || null;

  useEffect(() => { loadDeck(); }, [deckMeta.id]);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === ' ') { e.preventDefault(); setFlipped((f) => !f); }
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
    } catch {
      addToast('Failed to load deck', 'error');
    }
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
    setIndex((i) => i + 1);
    resetCard();
  }

  function handlePrev() {
    if (index <= 0) return;
    setIndex((i) => i - 1);
    resetCard();
  }

  async function handleToggleKnown() {
    if (!card) return;
    try {
      await toggleFlashcardKnown(card.id);
      setKnown((prev) => {
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
      setBookmarked((prev) => {
        const next = new Set(prev);
        next.has(card.id) ? next.delete(card.id) : next.add(card.id);
        return next;
      });
    } catch {}
  }

  async function handleRate(difficulty) {
    if (!card) return;
    try {
      await rateFlashcard(card.id, difficulty);
    } catch {}
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
    setFeedback({
      correct,
      strength: correct ? 'excellent' : 'incorrect',
      correct_answer: card.mc_options?.[card.mc_correct_index],
    });
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

  if (loading) {
    return (
      <div className="fcd-loading-wrap">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!card) {
    return (
      <div className="section fcd-empty">
        <Icon name="layer-group" className="fcd-empty-icon" />
        <p>No cards in this deck yet.</p>
        <Button variant="ghost" onClick={() => onComplete({ sessionId, total: 0 })} icon="arrow-left">
          Back
        </Button>
      </div>
    );
  }

  const isKnown = known.has(card.id);
  const isBookmarked = bookmarked.has(card.id);
  const isLast = index === cards.length - 1;
  const cardColor = MODE_CARD_COLOR[mode] || 'card-blue';

  return (
    <div className="flashcard-deck-view">
      <div className="section fcd-section">
        <div className="fcd-progress-row">
          <ProgressBar value={index + 1} max={cards.length} variant="gradient" />
        </div>

        <div className="fcd-mode-row">
          {MODES.map((m) => (
            <Button
              key={m.value}
              variant={mode === m.value ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => { setMode(m.value); resetCard(); }}
              icon={m.icon}
            >
              {m.label}
            </Button>
          ))}
        </div>

        <div className="fcd-meta-row">
          <span className="fcd-meta-index">{index + 1} / {cards.length}</span>
          {deck?.title && <span className="fcd-meta-title">{deck.title}</span>}
        </div>

        {mode === 'flip' && (
          <div className={`card ${cardColor} fcd-question-card is-flip`} onClick={() => setFlipped((f) => !f)}>
            {!flipped ? (
              <div>
                <span className="chip fcd-answer-chip">Question</span>
                <h3 className="fcd-card-heading">{card.front_text}</h3>
                {card.image_url && <img src={card.image_url} alt="" className="fcd-card-image" />}
                <p className="fcd-tap-hint"><Icon name="hand" /> Tap to flip</p>
              </div>
            ) : (
              <div>
                <span className="chip fcd-answer-chip is-correct">Answer</span>
                <h3 className="fcd-card-heading">{card.back_text}</h3>
                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); speakText(card.back_text); }} icon="volume-high" />
              </div>
            )}
          </div>
        )}

        {mode === 'typed' && (
          <div>
            <div className={`card ${cardColor} fcd-question-card-static`}>
              <span className="chip fcd-answer-chip">Question</span>
              <h3>{card.front_text}</h3>
              {card.image_url && <img src={card.image_url} alt="" className="fcd-card-image" />}
            </div>
            <div className="fcd-input-row">
              <input
                className="form-input"
                placeholder="Type your answer..."
                value={typedAnswer}
                onChange={(e) => setTypedAnswer(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCheckTyped(); }}
                disabled={!!feedback}
              />
              {!feedback && (
                <Button onClick={() => handleCheckTyped()} disabled={!typedAnswer.trim()} icon="check">
                  Check
                </Button>
              )}
            </div>
            {feedback && (
              <div className={`alert ${feedback.correct ? 'alert-success' : 'alert-error'}`}>
                <Icon name={feedback.correct ? 'circle-check' : 'circle-xmark'} />
                <span>
                  {feedback.correct ? 'Correct! ' : 'Incorrect. '}
                  Correct answer: <strong>{feedback.correct_answer}</strong>
                </span>
              </div>
            )}
          </div>
        )}

        {mode === 'multiple_choice' && (
          <div>
            <div className={`card ${cardColor} fcd-question-card-static`}>
              <span className="chip fcd-answer-chip">Question</span>
              <h3>{card.front_text}</h3>
            </div>
            {card.mc_options?.length > 0 ? (
              <div className="fcd-mc-list">
                {card.mc_options.map((opt, i) => {
                  let variant = 'secondary';
                  if (mcAnswered !== null) {
                    if (i === card.mc_correct_index) variant = 'primary';
                    else if (i === mcAnswered) variant = 'danger';
                  }
                  return (
                    <Button
                      key={i}
                      variant={variant}
                      onClick={() => handleMCSelect(i)}
                      disabled={mcAnswered !== null}
                    >
                      <span className="fcd-mc-option-letter">{String.fromCharCode(65 + i)}</span>
                      {opt}
                    </Button>
                  );
                })}
              </div>
            ) : (
              <p className="fcd-mc-empty">No MCQ options for this card.</p>
            )}
            {feedback && (
              <div className={`alert ${feedback.correct ? 'alert-success' : 'alert-error'}`}>
                <Icon name={feedback.correct ? 'circle-check' : 'circle-xmark'} />
                <span>
                  {feedback.correct ? 'Correct! ' : `Incorrect. Answer: `}
                  <strong>{feedback.correct_answer}</strong>
                </span>
              </div>
            )}
          </div>
        )}

        {mode === 'structure_identification' && (
          <div>
            <div className={`card ${cardColor} fcd-question-card-static`}>
              <span className="chip fcd-answer-chip">Structure</span>
              {card.image_url ? (
                <img src={card.image_url} alt={card.structure_name || 'Structure'} className="fcd-structure-image" />
              ) : (
                <div className="fcd-structure-placeholder">
                  <Icon name="image" className="fcd-structure-placeholder-icon" />
                  <p>{card.structure_name || 'Image coming soon'}</p>
                </div>
              )}
            </div>
            <div className="fcd-structure-tabs">
              <Button variant={structureTab === 'name' ? 'primary' : 'ghost'} size="sm" onClick={() => setStructureTab('name')} icon="tag">
                Name
              </Button>
              <Button variant={structureTab === 'function' ? 'primary' : 'ghost'} size="sm" onClick={() => setStructureTab('function')} icon="gear">
                Function
              </Button>
            </div>
            <div className="fcd-input-row">
              <input
                className="form-input"
                placeholder={structureTab === 'name' ? 'What is this structure called?' : 'What is its function?'}
                value={typedAnswer}
                onChange={(e) => setTypedAnswer(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCheckTyped(structureTab); }}
                disabled={!!feedback}
              />
              {!feedback && (
                <Button onClick={() => handleCheckTyped(structureTab)} disabled={!typedAnswer.trim()} icon="check">
                  Check
                </Button>
              )}
            </div>
            {feedback && (
              <div className={`alert ${feedback.correct ? 'alert-success' : 'alert-error'}`}>
                <Icon name={feedback.correct ? 'circle-check' : 'circle-xmark'} />
                <span>
                  {feedback.correct ? 'Correct! ' : 'Not quite. '}
                  {structureTab === 'name'
                    ? <>Structure: <strong>{feedback.correct_answer || card.structure_name}</strong></>
                    : <>Function: <strong>{feedback.correct_answer}</strong></>}
                </span>
              </div>
            )}
          </div>
        )}

        <div className="fcd-rate-row">
          <Button variant="ghost" size="sm" onClick={() => handleRate('easy')}>Easy</Button>
          <Button variant="ghost" size="sm" onClick={() => handleRate('medium')}>Medium</Button>
          <Button variant="ghost" size="sm" onClick={() => handleRate('hard')}>Hard</Button>
        </div>

        <div className="fcd-actions-row">
          <Button variant={isKnown ? 'primary' : 'ghost'} size="sm" onClick={handleToggleKnown} icon={isKnown ? 'circle-check' : 'circle'}>
            {isKnown ? 'Known' : 'Mark Known'}
          </Button>
          <Button variant={isBookmarked ? 'warm' : 'ghost'} size="sm" onClick={handleToggleBookmark} icon="bookmark">
            {isBookmarked ? 'Saved' : 'Save'}
          </Button>
        </div>

        <div className="fcd-nav-row">
          <Button variant="secondary" onClick={handlePrev} disabled={index === 0} icon="arrow-left" />
          {isLast ? (
            <Button onClick={handleFinish} icon="flag-checkered">Finish</Button>
          ) : (
            <Button onClick={handleNext} icon="arrow-right" />
          )}
        </div>

        <p className="fcd-keyboard-hint">
          <Icon name="keyboard" /> Arrow keys navigate · Space flips
        </p>
      </div>
    </div>
  );
}
