 /* components/Flashcardprogress.jsx */
import Icon from './Icon/Icon';
import Button from './Button/Button';

export default function FlashcardProgress({ result, onRestart, onHome }) {
  const { total = 0, correct = 0, incorrect = 0, score = 0 } = result || {};

  function scoreClass() {
    if (score >= 80) return 'is-high';
    if (score >= 50) return '';
    return 'is-low';
  }

  function message() {
    if (score >= 80) return 'Outstanding work!';
    if (score >= 60) return 'Good effort! Keep it up.';
    if (score >= 40) return 'Keep practising — you\'re getting there.';
    return 'Review the material and try again.';
  }

  return (
    <div className="flashcard-progress">
      <div className="section fcd-empty">
        <div className="card card-amber fcp-card">
          <Icon name="trophy" className="fcp-trophy" />
          <h2>Session Complete</h2>
          <p className="fcp-message">{message()}</p>

          <div className="fcp-stats-row">
            <div>
              <div className={`fcp-stat-value is-score ${scoreClass()}`}>{score}%</div>
              <div className="fcp-stat-label">Score</div>
            </div>
            <div>
              <div className="fcp-stat-value is-correct">{correct}</div>
              <div className="fcp-stat-label">Correct</div>
            </div>
            <div>
              <div className="fcp-stat-value is-missed">{incorrect}</div>
              <div className="fcp-stat-label">Missed</div>
            </div>
          </div>

          <div className="fcp-actions-row">
            <Button onClick={onRestart} icon="rotate-right">Study Again</Button>
            <Button variant="secondary" onClick={onHome} icon="home">Home</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
