 /* features/community/CommunitySection.jsx */
import Icon from '../../components/Icon/Icon';
import Button from '../../components/Button/Button';

export function CommunitySection({
  activity = [],
  weeklyChallenge,
  weeklyChallengeAnswer,
  onWeeklySubmit
}) {
  return (
    <>
      {weeklyChallenge?.question && (
        <section className="section reveal">
          <span className="sec-label">Challenge</span>
          <h2 className="section-title">
            Weekly<br />Challenge
          </h2>
          <p className="section-subtitle">
            Test your knowledge with this week's question.
          </p>

          <div className="card" style={{ maxWidth: 600, margin: '0 auto', padding: 'var(--space-8)' }}>
            <h3 style={{ marginBottom: 'var(--space-6)' }}>
              <Icon name="trophy" style={{ color: 'var(--warm)', marginRight: 'var(--space-3)' }} />
              {weeklyChallenge.question}
            </h3>

            {!weeklyChallengeAnswer ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {(weeklyChallenge.options || []).map((option, index) => (
                  <Button
                    key={index}
                    variant="secondary"
                    onClick={() => onWeeklySubmit(index, weeklyChallenge.correct, weeklyChallenge.explanation)}
                  >
                    {String.fromCharCode(65 + index)}) {option}
                  </Button>
                ))}
              </div>
            ) : (
              <div
                style={{
                  padding: 'var(--space-4)',
                  borderRadius: 'var(--radius-md)',
                  background: weeklyChallengeAnswer.correct ? 'var(--success-light)' : 'var(--error-light)'
                }}
              >
                <p style={{ fontWeight: 600, color: weeklyChallengeAnswer.correct ? 'var(--success)' : 'var(--error)' }}>
                  <Icon name={weeklyChallengeAnswer.correct ? 'circle-check' : 'circle-xmark'} />
                  {weeklyChallengeAnswer.correct ? ' Correct!' : ' Incorrect'}
                </p>
                <p style={{ fontSize: 'var(--text-sm)', marginTop: 'var(--space-2)' }}>
                  {weeklyChallengeAnswer.explanation}
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      {activity.length > 0 && (
        <section className="section reveal">
          <span className="sec-label">Community</span>
          <h2 className="section-title">
            Recent<br />Activity
          </h2>
          <p className="section-subtitle">
            See what other learners are doing.
          </p>

          <div style={{ maxWidth: 600, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {activity.slice(0, 8).map((item, index) => (
              <div
                key={index}
                className="card"
                style={{ padding: 'var(--space-4)', flexDirection: 'row', alignItems: 'center', gap: 'var(--space-4)' }}
              >
                <Icon
                  name={item.type === 'download' ? 'download' : 'graduation-cap'}
                  style={{ color: 'var(--primary)' }}
                />
                <span style={{ flex: 1, fontSize: 'var(--text-sm)' }}>{item.message}</span>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                  {new Date(item.time).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
