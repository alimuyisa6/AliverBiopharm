// components/recall/RecallProgressTab.jsx
import Icon from '../Icon/Icon';
import Card from '../Card/Card';
import ProgressBar from '../ProgressBar/ProgressBar';

export default function RecallProgressTab({ xpProgress, accuracy, rankTitle, achievementsList, masteryTopics }) {
  const topicEntries = Object.entries(masteryTopics)
    .filter(([topic]) => topic && topic !== 'null')
    .slice(0, 6);

  return (
    <div className="recall-tab-content">
      <div className="grid grid-cols-3 recall-cards-grid">
        <Card>
          <div className="recall-stat-card-inner">
            <Icon name="trophy" className="recall-stat-card-icon is-warm" />
            <h3 className="recall-stat-card-heading font-poppins">XP Progress</h3>
            <p className="recall-stat-card-sub font-source-sans">
              Level {xpProgress.level} · {rankTitle}
            </p>
            <ProgressBar value={xpProgress.xpIntoLevel} max={100} variant="gradient" />
            <p className="recall-stat-card-footer font-mono">
              {xpProgress.xpIntoLevel} / 100 XP to next level
            </p>
          </div>
        </Card>

        <Card>
          <div className="recall-stat-card-inner">
            <Icon name="bullseye" className="recall-stat-card-icon is-primary" />
            <h3 className="recall-stat-card-heading font-poppins">Accuracy</h3>
            <ProgressBar value={accuracy} max={100} variant="primary" />
            <p className="recall-stat-card-footer font-mono">
              {accuracy}% across all sessions
            </p>
          </div>
        </Card>

        <Card>
          <div className="recall-stat-card-inner">
            <Icon name="trophy" className="recall-stat-card-icon is-accent" />
            <h3 className="recall-stat-card-heading font-poppins">Achievements</h3>
            <div className="recall-badge-row">
              {achievementsList.slice(0, 6).map((achievement) => (
                <span
                  key={achievement.id}
                  className="badge badge-accent font-comfortaa"
                  title={achievement.name}
                >
                  <Icon
                    name={
                      achievement.icon === 'dna'
                        ? 'microscope'
                        : achievement.icon || 'medal'
                    }
                  />
                </span>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {topicEntries.length > 0 && (
        <div className="recall-topics-section">
          <h3 className="recall-section-heading font-poppins">Topic Mastery</h3>
          <div className="grid grid-cols-3">
            {topicEntries.map(([topic, mastery]) => (
              <Card key={topic}>
                <div className="recall-topic-card-inner">
                  <Icon name="book-open" className="recall-topic-card-icon" />
                  <h4 className="recall-topic-card-heading font-poppins">{topic}</h4>
                  <ProgressBar value={mastery} max={100} variant="success" />
                  <p className="recall-topic-card-pct font-mono">{Math.round(mastery)}%</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
