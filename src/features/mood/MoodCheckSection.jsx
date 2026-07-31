 /* features/mood/MoodCheckSection.jsx */
import Icon from '../../components/Icon/Icon';
import Button from '../../components/Button/Button';

const MOODS = [
  { key: 'struggling', emoji: '😭' },
  { key: 'confused', emoji: '🤔' },
  { key: 'okay', emoji: '😐' },
  { key: 'good', emoji: '😊' },
  { key: 'great', emoji: '🚀' },
];

export function MoodCheckSection({ moodSelected, moodMessage, moodSubmitted, onMoodSelect, onMessageChange, onSubmit }) {
  return (
    <section className="section reveal">
      <span className="sec-label">Mood Check</span>
      <h2 className="section-title">How Are You Feeling Today?</h2>
      <p className="section-subtitle">Your feedback helps us improve your learning experience.</p>
      <div className="card" style={{ maxWidth: 500, margin: '0 auto', padding: 'var(--space-8)', textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
          {MOODS.map((m) => (
            <button
              key={m.key}
              className={`btn btn-ghost btn-icon ${moodSelected === m.key ? 'btn-primary' : ''}`}
              onClick={() => onMoodSelect(m.key)}
              style={{ fontSize: '1.5rem' }}
              aria-label={m.key}
            >
              {m.emoji}
            </button>
          ))}
        </div>
        {moodSelected && !moodSubmitted && (
          <div>
            <textarea
              className="form-textarea"
              placeholder="Tell us more (optional)..."
              value={moodMessage}
              onChange={(e) => onMessageChange(e.target.value)}
              rows={3}
              style={{ marginBottom: 'var(--space-4)' }}
            />
            <Button onClick={onSubmit} icon="paper-plane">Submit</Button>
          </div>
        )}
        {moodSubmitted && (
          <p style={{ color: 'var(--success)', fontWeight: 600 }}>
            <Icon name="circle-check" /> Thanks for sharing!
          </p>
        )}
      </div>
    </section>
  );
}
