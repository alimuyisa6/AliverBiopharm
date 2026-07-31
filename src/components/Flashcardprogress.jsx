 /* components/Flashcardprogress.jsx */
import Icon from './Icon/Icon';
import Button from './Button/Button';

export default function FlashcardProgress({ result, onRestart, onHome }) {
  const { total = 0, correct = 0, incorrect = 0, score = 0 } = result || {};

  function scoreColor() {
    if (score >= 80) return 'var(--success)';
    if (score >= 50) return 'var(--primary)';
    return 'var(--error)';
  }

  function message() {
    if (score >= 80) return 'Outstanding work!';
    if (score >= 60) return 'Good effort! Keep it up.';
    if (score >= 40) return 'Keep practising — you\'re getting there.';
    return 'Review the material and try again.';
  }

  return (
    <div className="flashcard-progress">
      <div className="section" style={{ textAlign: 'center' }}>
        <div className="card" style={{ padding: 'var(--space-10)', maxWidth: 500, margin: '0 auto' }}>
          <Icon name="trophy" style={{ fontSize: '3rem', color: 'var(--warm)', marginBottom: 'var(--space-4)' }} />
          <h2>Session Complete</h2>
          <p style={{ color: 'var(--text-dim)', marginTop: 'var(--space-3)' }}>{message()}</p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-8)', margin: 'var(--space-8) 0' }}>
            <div>
              <div style={{ fontSize: 'var(--text-4xl)', fontWeight: 'var(--weight-black)', color: scoreColor() }}>
                {score}%
              </div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-dim)' }}>Score</div>
            </div>
            <div>
              <div style={{ fontSize: 'var(--text-4xl)', fontWeight: 'var(--weight-black)', color: 'var(--success)' }}>
                {correct}
              </div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-dim)' }}>Correct</div>
            </div>
            <div>
              <div style={{ fontSize: 'var(--text-4xl)', fontWeight: 'var(--weight-black)', color: 'var(--error)' }}>
                {incorrect}
              </div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-dim)' }}>Missed</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-4)', justifyContent: 'center' }}>
            <Button onClick={onRestart} icon="rotate-right">Study Again</Button>
            <Button variant="secondary" onClick={onHome} icon="home">Home</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
