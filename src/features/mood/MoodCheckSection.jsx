/* features/mood/MoodCheckSection.jsx */
import Icon from '../../components/Icon/Icon';
import Button from '../../components/Button/Button';

const MOODS = [
  { key: 'struggling', icon: 'circle-xmark', label: 'Struggling' },
  { key: 'confused', icon: 'circle-info', label: 'Confused' },
  { key: 'okay', icon: 'circle', label: 'Okay' },
  { key: 'good', icon: 'circle-check', label: 'Good' },
  { key: 'great', icon: 'star', label: 'Great' }
];

export function MoodCheckSection({
  moodSelected,
  moodMessage,
  moodSubmitted,
  onMoodSelect,
  onMessageChange,
  onSubmit
}) {
  return (
    <section className="section reveal">
      <span className="sec-label">Mood Check</span>
      <h2 className="section-title">
        How Are You<br />Feeling Today?
      </h2>
      <p className="section-subtitle">
        Your feedback helps us improve your learning experience.
      </p>

      <div className="card card-amber mood-card">
        <div className="mood-emoji-row">
          {MOODS.map((mood) => (
            <Button
              key={mood.key}
              variant={moodSelected === mood.key ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => onMoodSelect(mood.key)}
              icon={mood.icon}
            >
              {mood.label}
            </Button>
          ))}
        </div>

        {moodSelected && !moodSubmitted && (
          <div>
            <textarea
              className="form-textarea mood-textarea"
              placeholder="Tell us more (optional)..."
              value={moodMessage}
              onChange={(event) => onMessageChange(event.target.value)}
              rows={3}
            />
            <Button onClick={onSubmit} icon="paper-plane">Submit</Button>
          </div>
        )}

        {moodSubmitted && (
          <p className="mood-success">
            <Icon name="circle-check" /> Thanks for sharing!
          </p>
        )}
      </div>
    </section>
  );
} 
