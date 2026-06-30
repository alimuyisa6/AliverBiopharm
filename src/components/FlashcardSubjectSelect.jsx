 import React, { useState, useEffect } from 'react';
import { getAdaptiveFlashcardDecks } from '../../api/cachedClient';
import { 
  FaSeedling, 
  FaBookOpen, 
  FaLightbulb, 
  FaRocket, 
  FaTrophy,
  FaArrowLeft,
  FaArrowRight,
  FaRandom,
  FaLayerGroup,
  FaSearch,
  FaChevronRight
} from 'react-icons/fa';

const CONFIDENCE_OPTS = [
  { value: 'Beginner', icon: FaSeedling, label: 'Beginner' },
  { value: 'Fair', icon: FaBookOpen, label: 'Fair' },
  { value: 'Good', icon: FaLightbulb, label: 'Good' },
  { value: 'Great', icon: FaRocket, label: 'Great' },
  { value: 'Expert', icon: FaTrophy, label: 'Expert' },
];

export default function FlashcardSubjectSelect({ state, onStart, onBack }) {
  const [step, setStep] = useState(0);
  const [confidence, setConf] = useState(null);
  const [topic, setTopic] = useState('');
  const [topicInput, setTopicInput] = useState('');
  const [decks, setDecks] = useState([]);
  const [loading, setLoading] = useState(false);

  const isPharmacy = state.selected_discipline === 'Pharmacy';
  const topicLabel = isPharmacy ? 'course unit' : 'topic';

  const suggestions = [...new Set(decks.map(d => d.title))].slice(0, 8);

  useEffect(() => {
    if (step === 1) loadDecks();
  }, [step]);

  async function loadDecks() {
    setLoading(true);
    try {
      const data = await getAdaptiveFlashcardDecks();
      setDecks(data || []);
    } catch {
      setDecks([]);
    }
    setLoading(false);
  }

  function handleConfNext() {
    if (!confidence) return;
    setStep(1);
  }

  function handleTopicChip(t) {
    setTopic(t);
    setTopicInput(t);
  }

  function handleRandom() {
    if (!decks.length) return;
    const pick = decks[Math.floor(Math.random() * decks.length)];
    setTopic(pick.title);
    setTopicInput(pick.title);
  }

  function handleTopicInputChange(e) {
    setTopicInput(e.target.value);
    setTopic(e.target.value);
  }

  function handleDeckSelect(deck) {
    onStart({ confidence, topic: topic || null, deck });
  }

  function progressPct() {
    return step === 0 ? 80 : 92;
  }

  const visibleDecks = topic
    ? decks.filter(d =>
        d.title?.toLowerCase().includes(topic.toLowerCase()) ||
        d.category?.toLowerCase().includes(topic.toLowerCase()) ||
        d.description?.toLowerCase().includes(topic.toLowerCase())
      )
    : decks;

  return (
    <div className="fc-page">
      <div className="fc-page-inner">
        <div className="fc-progress-track">
          <div className="fc-progress-fill" style={{ width: `${progressPct()}%` }} />
        </div>

        {step === 0 && (
          <div className="fc-step">
            <span className="fc-step-label">Step 3 of 3</span>
            <h1 className="fc-step-title">
              How confident are you with {state.selected_discipline}?
            </h1>
            <p className="fc-step-subtitle">
              This helps us pick the right cards for you.
            </p>
            <div className="fc-confidence-grid">
              {CONFIDENCE_OPTS.map(c => {
                const Icon = c.icon;
                return (
                  <button
                    key={c.value}
                    className={`fc-confidence-btn ${confidence === c.value ? 'fc-selected' : ''}`}
                    onClick={() => setConf(c.value)}
                  >
                    <span className="fc-confidence-icon">
                      <Icon />
                    </span>
                    <span className="fc-confidence-label">{c.label}</span>
                  </button>
                );
              })}
            </div>
            <div style={{ marginTop: '1.5rem', display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button className="fc-btn fc-btn-ghost" onClick={onBack}>
                <FaArrowLeft /> Back
              </button>
              <button
                className="fc-btn fc-btn-primary"
                onClick={handleConfNext}
                disabled={!confidence}
              >
                Continue <FaArrowRight />
              </button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="fc-step">
            <span className="fc-step-label">Almost there</span>
            <h1 className="fc-step-title">
              What {topicLabel} would you like to study?
            </h1>
            <p className="fc-step-subtitle">
              Pick from the list, type your own, or let us choose for you.
            </p>

            <div className="fc-topic-wrap">
              <div className="fc-topic-input-row">
                <input
                  className="fc-topic-input"
                  placeholder={`Type a ${topicLabel}…`}
                  value={topicInput}
                  onChange={handleTopicInputChange}
                />
              </div>

              <div className="fc-topic-chips">
                {suggestions.map(s => (
                  <button
                    key={s}
                    className={`fc-chip ${topic === s ? 'fc-chip-active' : ''}`}
                    onClick={() => handleTopicChip(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>

              <button className="fc-random-btn" onClick={handleRandom} disabled={!decks.length}>
                <FaRandom />
                Let the system choose for me
              </button>
            </div>

            {loading && (
              <div className="fc-loading">
                <div className="fc-spinner"></div>
                Loading your decks…
              </div>
            )}

            {!loading && decks.length === 0 && (
              <div className="fc-empty">
                <FaLayerGroup />
                No decks found for {state.selected_class} {state.selected_discipline} yet.
                <br />
                <span style={{ fontSize: 'var(--text-sm)', marginTop: '0.5rem', display: 'block' }}>
                  Check back soon as more decks are added for your class.
                </span>
              </div>
            )}

            {!loading && decks.length > 0 && topic && visibleDecks.length === 0 && (
              <div className="fc-empty">
                <FaSearch />
                No decks match "{topic}" for your class.
                <br />
                <span style={{ fontSize: 'var(--text-sm)', marginTop: '0.5rem', display: 'block' }}>
                  Try a different {topicLabel} or pick from the list below.
                </span>
              </div>
            )}

            {!loading && visibleDecks.length > 0 && (
              <>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', letterSpacing: '0.15em', color: 'var(--clr-text-muted)', textAlign: 'center', marginTop: '1.5rem', marginBottom: '0.75rem', textTransform: 'uppercase' }}>
                  Available Decks
                </p>
                <div className="fc-deck-list">
                  {visibleDecks.slice(0, 8).map(deck => (
                    <button
                      key={deck.id}
                      className="fc-deck-card"
                      onClick={() => handleDeckSelect(deck)}
                    >
                      <div className="fc-deck-icon">
                        <FaLayerGroup />
                      </div>
                      <div className="fc-deck-info">
                        <div className="fc-deck-title">{deck.title}</div>
                        <div className="fc-deck-meta">
                          {deck.category} · {deck.level}
                          {deck.class_programme && ` · ${deck.class_programme}`}
                          {deck.difficulty_confidence && ` · ${deck.difficulty_confidence}`}
                        </div>
                      </div>
                      <FaChevronRight className="fc-deck-arrow" />
                    </button>
                  ))}
                </div>
              </>
            )}

            <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'center' }}>
              <button className="fc-btn fc-btn-ghost" onClick={() => setStep(0)}>
                <FaArrowLeft /> Back
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
