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
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <Spinner size="lg" />
      </div>
    );
  }

  if (!card) {
    return (
      <div className="section" style={{ textAlign: 'center' }}>
        <Icon name="layer-group" style={{ fontSize: '3rem', color: 'var(--text-muted)', marginBottom: 'var(--space-4)' }} />
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

  return (
    <div className="flashcard-deck-view">
      <div className="section" style={{ paddingTop: 'var(--space-6)' }}>
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <ProgressBar value={index + 1} max={cards.length} variant="gradient" />
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-6)', flexWrap: 'wrap' }}>
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

        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-dim)' }}>
            {index + 1} / {cards.length}
          </span>
          {deck?.title && (
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>{deck.title}</span>
          )}
        </div>

        {mode === 'flip' && (
          <div className="card" style={{ padding: 'var(--space-8)', textAlign: 'center', cursor: 'pointer' }} onClick={() => setFlipped((f) => !f)}>
            {!flipped ? (
              <div>
                <span className="chip" style={{ marginBottom: 'var(--space-4)' }}>Question</span>
                <h3 style={{ marginBottom: 'var(--space-4)' }}>{card.front_text}</h3>
                {card.image_url && <img src={card.image_url} alt="" style={{ maxWidth: 200, margin: '0 auto' }} />}
                <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                  <Icon name="hand" /> Tap to flip
                </p>
              </div>
            ) : (
              <div>
                <span className="chip" style={{ marginBottom: 'var(--space-4)', background: 'var(--success-light)', color: 'var(--success)' }}>Answer</span>
                <h3 style={{ marginBottom: 'var(--space-4)' }}>{card.back_text}</h3>
                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); speakText(card.back_text); }} icon="volume-high" />
              </div>
            )}
          </div>
        )}

        {mode === 'typed' && (
          <div>
            <div className="card" style={{ padding: 'var(--space-8)', marginBottom: 'var(--space-6)' }}>
              <span className="chip" style={{ marginBottom: 'var(--space-4)' }}>Question</span>
              <h3>{card.front_text}</h3>
              {card.image_url && <img src={card.image_url} alt="" style={{ maxWidth: 200, marginTop: 'var(--space-4)' }} />}
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
              <input
                className="form-input"
                placeholder="Type your answer..."
                value={typedAnswer}
                onChange={(e) => setTypedAnswer(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCheckTyped(); }}
                disabled={!!feedback}
                style={{ flex: 1 }}
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
            <div className="card" style={{ padding: 'var(--space-8)', marginBottom: 'var(--space-6)' }}>
              <span className="chip" style={{ marginBottom: 'var(--space-4)' }}>Question</span>
              <h3>{card.front_text}</h3>
            </div>
            {card.mc_options?.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
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
                      style={{ justifyContent: 'flex-start' }}
                    >
                      <span style={{ fontWeight: 700, marginRight: 'var(--space-3)' }}>{String.fromCharCode(65 + i)}</span>
                      {opt}
                    </Button>
                  );
                })}
              </div>
            ) : (
              <p style={{ color: 'var(--text-muted)' }}>No MCQ options for this card.</p>
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
            <div className="card" style={{ padding: 'var(--space-8)', marginBottom: 'var(--space-6)' }}>
              <span className="chip" style={{ marginBottom: 'var(--space-4)' }}>Structure</span>
              {card.image_url ? (
                <img src={card.image_url} alt={card.structure_name || 'Structure'} style={{ maxWidth: 300, margin: '0 auto' }} />
              ) : (
                <div style={{ padding: 'var(--space-10)', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <Icon name="image" style={{ fontSize: '3rem', marginBottom: 'var(--space-4)' }} />
                  <p>{card.structure_name || 'Image coming soon'}</p>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
              <Button variant={structureTab === 'name' ? 'primary' : 'ghost'} size="sm" onClick={() => setStructureTab('name')} icon="tag">
                Name
              </Button>
              <Button variant={structureTab === 'function' ? 'primary' : 'ghost'} size="sm" onClick={() => setStructureTab('function')} icon="gear">
                Function
              </Button>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
              <input
                className="form-input"
                placeholder={structureTab === 'name' ? 'What is this structure called?' : 'What is its function?'}
                value={typedAnswer}
                onChange={(e) => setTypedAnswer(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCheckTyped(structureTab); }}
                disabled={!!feedback}
                style={{ flex: 1 }}
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

        <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'center', marginTop: 'var(--space-6)' }}>
          <Button variant="ghost" size="sm" onClick={() => handleRate('easy')}>Easy</Button>
          <Button variant="ghost" size="sm" onClick={() => handleRate('medium')}>Medium</Button>
          <Button variant="ghost" size="sm" onClick={() => handleRate('hard')}>Hard</Button>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-4)', justifyContent: 'center', marginTop: 'var(--space-6)' }}>
          <Button variant={isKnown ? 'primary' : 'ghost'} size="sm" onClick={handleToggleKnown} icon={isKnown ? 'circle-check' : 'circle'}>
            {isKnown ? 'Known' : 'Mark Known'}
          </Button>
          <Button variant={isBookmarked ? 'warm' : 'ghost'} size="sm" onClick={handleToggleBookmark} icon={isBookmarked ? 'bookmark' : 'bookmark'}>
            {isBookmarked ? 'Saved' : 'Save'}
          </Button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--space-8)' }}>
          <Button variant="secondary" onClick={handlePrev} disabled={index === 0} icon="arrow-left" />
          {isLast ? (
            <Button onClick={handleFinish} icon="flag-checkered">Finish</Button>
          ) : (
            <Button onClick={handleNext} icon="arrow-right" />
          )}
        </div>

        <p style={{ textAlign: 'center', marginTop: 'var(--space-4)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
          <Icon name="keyboard" /> Arrow keys navigate · Space flips
        </p>
      </div>
    </div>
  );
}
