 /* pages/Recall.jsx */
import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useRequireOnboarding } from '../hooks/useRequireOnboarding';
import { useLevelFilter } from '../hooks/useLevelFilter';
import { useContentAccess } from '../hooks/useContentAccess';
import { useToast } from '../components/Toast/Toast';
import {
  getRecallStats,
  getRecallAchievements,
  getRecallDashboard,
  getRecallTopics,
  startRecallSession,
  continueRecallSession,
  submitRecallAnswer,
  completeRecallSession,
  getLeaderboard
} from '../api/cachedClient';
import { PendingApprovalScreen } from '../components/access/PendingApprovalScreen';
import { AccessDenied } from '../components/access/AccessDenied';
import Icon from '../components/Icon/Icon';
import Spinner from '../components/Spinner/Spinner';
import Skeleton from '../components/Skeleton/Skeleton';
import ProgressBar from '../components/ProgressBar/ProgressBar';
import Button from '../components/Button/Button';
import Card from '../components/Card/Card';
import Modal from '../components/Modal/Modal';
import Input from '../components/Input/Input';

function computeXpProgress(totalXp) {
  const xp = totalXp || 0;
  const level = Math.floor(xp / 100) + 1;
  const xpIntoLevel = xp % 100;
  const xpToNext = 100 - xpIntoLevel;

  return {
    level,
    xpIntoLevel,
    xpToNext,
    progressPercent: xpIntoLevel
  };
}

export default function BioRecall() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { isReady } = useRequireOnboarding();
  const access = useContentAccess();
  const { level, class_name, showAll, displayName } = useLevelFilter();
  const addToast = useToast();

  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [sessionActive, setSessionActive] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [sessionQuote, setSessionQuote] = useState(null);
  const [xpTotal, setXpTotal] = useState(0);
  const [streakDays, setStreakDays] = useState(0);
  const [masteryTopics, setMasteryTopics] = useState({});
  const [accuracy, setAccuracy] = useState(0);
  const [showReport, setShowReport] = useState(false);
  const [sessionReport, setSessionReport] = useState(null);
  const [newlyAwarded, setNewlyAwarded] = useState([]);
  const [achievementsList, setAchievementsList] = useState([]);
  const [topicModalOpen, setTopicModalOpen] = useState(false);
  const [topicList, setTopicList] = useState([]);
  const [levelMeta, setLevelMeta] = useState(null);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sectionLoading, setSectionLoading] = useState(false);
  const [feedbackResult, setFeedbackResult] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [rankTitle, setRankTitle] = useState('Beginner');
  const [xpProgress, setXpProgress] = useState({ level: 1, xpIntoLevel: 0, xpToNext: 100, progressPercent: 0 });
  const [soundEnabled, setSoundEnabled] = useState(() => {
    try {
      return localStorage.getItem('bioRecall_sound') !== 'off';
    } catch {
      return true;
    }
  });
  const answerInputRef = useRef(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;

    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!isReady || !access.canAccess || access.isPending) return;

    loadUserProgress();
  }, [isReady, access.canAccess, access.isPending]);

  async function loadUserProgress() {
    setLoading(true);
    setSectionLoading(true);

    try {
      const [dash, stats, achievements, topicsRes, lb] = await Promise.all([
        getRecallDashboard().catch(() => null),
        getRecallStats().catch(() => null),
        getRecallAchievements().catch(() => []),
        getRecallTopics().catch(() => ({ level: null, units: [] })),
        getLeaderboard(displayName || level || null, 10).catch(() => [])
      ]);

      if (!isMounted.current) return;

      if (dash) {
        setXpTotal(dash.total_xp || 0);
        setStreakDays(dash.current_streak || 0);
        setRankTitle(dash.rank_title || 'Beginner');
        setXpProgress(dash.xp_progress || computeXpProgress(dash.total_xp || 0));
        if (dash.level_meta) setLevelMeta(dash.level_meta);
        if (typeof dash.accuracy === 'number') setAccuracy(dash.accuracy);
      }

      if (stats) {
        setMasteryTopics(stats.mastery_topics || {});
        if (typeof stats.accuracy === 'number') setAccuracy(stats.accuracy);
      }

      setAchievementsList(Array.isArray(achievements) ? achievements : []);
      setTopicList(Array.isArray(topicsRes?.units) ? topicsRes.units : []);
      if (topicsRes?.level) setLevelMeta((prev) => prev || topicsRes.level);
      setLeaderboard(Array.isArray(lb) ? lb : []);
    } catch {
      addToast('Failed to load data', 'error');
    } finally {
      setLoading(false);
      setSectionLoading(false);
    }
  }

  const openTopicModal = () => setTopicModalOpen(true);
  const closeTopicModal = () => setTopicModalOpen(false);

  async function handleStartSession(topic) {
    setSelectedTopic(topic);
    setTopicModalOpen(false);
    setLoading(true);

    try {
      const started = await startRecallSession(topic.unit_id);

      if (!started?.session_id || !started?.current_question) {
        addToast('No questions available for this topic', 'warning');
        return;
      }

      setSessionId(started.session_id);
      setTotalQuestions(started.total_questions || 0);
      setCurrentIndex(started.current_index || 0);
      setCurrentQuestion(started.current_question);
      setSessionQuote(started.quote || null);
      if (started.level) setLevelMeta(started.level);
      setFeedbackResult(null);
      setSessionActive(true);
    } catch {
      addToast('Failed to start session', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmitAnswer() {
    const answer = answerInputRef.current?.value?.trim();

    if (!answer || !currentQuestion) return;

    setAnalyzing(true);

    try {
      const result = await submitRecallAnswer(sessionId, currentQuestion.id, answer);

      setFeedbackResult(result);

      if (typeof result.total_xp === 'number') {
        setXpTotal(result.total_xp);
        setXpProgress(computeXpProgress(result.total_xp));
      } else if (result.xp_earned) {
        setXpTotal((prev) => {
          const newTotal = (prev || 0) + result.xp_earned;
          setXpProgress(computeXpProgress(newTotal));
          return newTotal;
        });
      }
    } catch {
      addToast('Failed to submit answer', 'error');
    } finally {
      setAnalyzing(false);
      if (answerInputRef.current) answerInputRef.current.value = '';
    }
  }

  async function handleNextQuestion() {
    if (!feedbackResult) return;

    if (feedbackResult.is_complete) {
      setLoading(true);

      try {
        const result = await completeRecallSession(sessionId);

        setSessionReport(result?.report || null);
        setNewlyAwarded(Array.isArray(result?.newly_awarded) ? result.newly_awarded : []);

        if (result?.streak_info?.current_streak != null) {
          setStreakDays(result.streak_info.current_streak);
        }
      } catch {
        addToast('Failed to complete session', 'error');
      } finally {
        setSessionActive(false);
        setShowReport(true);
        setLoading(false);
      }

      return;
    }

    setLoading(true);

    try {
      const cont = await continueRecallSession(sessionId);

      setCurrentQuestion(cont.current_question || null);
      setCurrentIndex(cont.current_index || 0);
      setTotalQuestions(cont.total_questions || totalQuestions);
      setFeedbackResult(null);
    } catch {
      addToast('Failed to load next question', 'error');
    } finally {
      setLoading(false);
    }
  }

  const toggleSound = () => {
    setSoundEnabled((prev) => {
      const next = !prev;

      try {
        localStorage.setItem('bioRecall_sound', next ? 'on' : 'off');
      } catch {}

      return next;
    });
  };

  if (!isReady || access.loading) {
    return (
      <div className="fcd-loading-wrap">
        <Spinner size="lg" />
      </div>
    );
  }

  if (access.isPending) return <PendingApprovalScreen />;
  if (!access.canAccess) return <AccessDenied />;

  if (loading && !sessionActive && !showReport) {
    return (
      <div className="section recall-loading-wrap">
        <Spinner size="lg" />
      </div>
    );
  }

  const topicEntries = Object.entries(masteryTopics).filter(([topic]) => topic && topic !== 'null').slice(0, 6);
  const levelName = levelMeta?.display_name || displayName || level?.id || '';
  const unitLabel = levelMeta?.unit_label || 'Topic';
  const groupLabel = levelMeta?.group_label || 'Class';
  const classLabel = class_name || '';
  const levelIcon = levelMeta?.icon === 'dna' ? 'microscope' : levelMeta?.icon || 'microscope';

  function rankClass(index) {
    if (index === 0) return 'is-gold';
    if (index === 1) return 'is-silver';
    if (index === 2) return 'is-bronze';
    return 'is-default';
  }

  return (
    <div className="recall-page">
      <div className="section recall-page-section">
        <nav className="breadcrumb">
          <Link to="/"><Icon name="home" className="breadcrumb-icon" /> Home</Link>
          <Icon name="chevron-right" className="breadcrumb-sep" />
          <span>Recall Practice</span>
        </nav>

        <div className="recall-header">
          <span className="sec-label">BioRecall</span>
          <h1 className="section-title recall-page-title">
            BioRecall {levelName}
          </h1>

          {levelName && (
            <div className="recall-chips-row">
              <span className="chip recall-chip-level">{levelName}</span>
              {classLabel && <span className="chip recall-chip-class">{groupLabel}: {classLabel}</span>}
            </div>
          )}
        </div>

        {!sessionActive && !showReport && (
          <>
            {sectionLoading ? (
              <div className="recall-skeleton">
                <Skeleton height={140} style={{ marginBottom: 'var(--space-6)' }} />
                <div className="grid grid-cols-3">
                  <Skeleton height={100} />
                  <Skeleton height={100} />
                  <Skeleton height={100} />
                </div>
              </div>
            ) : (
              <>
                <div className="card recall-intro-card">
                  <Icon name={levelIcon} className="recall-intro-icon" />
                  <Button onClick={openTopicModal} size="lg">
                    Continue to {unitLabel}s{levelName ? ` in ${levelName}` : ''}
                  </Button>
                  <div className="recall-intro-stats">
                    <div>
                      <Icon name="fire" className="recall-intro-stat-icon is-warm" />
                      <span className="recall-intro-stat-text">{streakDays} Day Streak</span>
                    </div>
                    <div>
                      <Icon name="star" className="recall-intro-stat-icon is-accent" />
                      <span className="recall-intro-stat-text">Level {xpProgress.level} · {xpTotal} XP · {rankTitle}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 recall-cards-grid">
                  <Card>
                    <div className="recall-stat-card-inner">
                      <Icon name="trophy" className="recall-stat-card-icon is-warm" />
                      <h3 className="recall-stat-card-heading">XP Progress</h3>
                      <p className="recall-stat-card-sub">Level {xpProgress.level} · {rankTitle}</p>
                      <ProgressBar value={xpProgress.xpIntoLevel} max={100} variant="gradient" />
                      <p className="recall-stat-card-footer">{xpProgress.xpIntoLevel} / 100 XP to next level</p>
                    </div>
                  </Card>

                  <Card>
                    <div className="recall-stat-card-inner">
                      <Icon name="bullseye" className="recall-stat-card-icon is-primary" />
                      <h3 className="recall-stat-card-heading">Accuracy</h3>
                      <ProgressBar value={accuracy} max={100} variant="primary" />
                      <p className="recall-stat-card-footer">{accuracy}% across all sessions</p>
                    </div>
                  </Card>

                  <Card>
                    <div className="recall-stat-card-inner">
                      <Icon name="trophy" className="recall-stat-card-icon is-accent" />
                      <h3 className="recall-stat-card-heading">Achievements</h3>
                      <div className="recall-badge-row">
                        {achievementsList.slice(0, 6).map((achievement) => (
                          <span key={achievement.id} className="badge badge-accent" title={achievement.name}>
                            <Icon name={achievement.icon === 'dna' ? 'microscope' : achievement.icon || 'medal'} />
                          </span>
                        ))}
                      </div>
                    </div>
                  </Card>
                </div>

                {topicEntries.length > 0 && (
                  <div className="recall-topics-section">
                    <h3 className="recall-section-heading">
                      {unitLabel} Mastery {levelName ? `in ${levelName}` : ''}{classLabel ? ` – ${classLabel}` : ''}
                    </h3>
                    <div className="grid grid-cols-3">
                      {topicEntries.map(([topic, mastery]) => (
                        <Card key={topic}>
                          <div className="recall-topic-card-inner">
                            <Icon name="book-open" className="recall-topic-card-icon" />
                            <h4 className="recall-topic-card-heading">{topic}</h4>
                            <ProgressBar value={mastery} max={100} variant="success" />
                            <p className="recall-topic-card-pct">{Math.round(mastery)}%</p>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                <div className="recall-leaderboard-section">
                  <h3 className="recall-section-heading">
                    Leaderboard {levelName ? `– ${levelName}` : ''}
                  </h3>
                  {leaderboard.length === 0 ? (
                    <p className="recall-leaderboard-empty">No data yet. Be the first!</p>
                  ) : (
                    leaderboard.map((entry, index) => (
                      <div key={entry.user_id || index} className="card recall-leaderboard-row">
                        <span className={`recall-rank ${rankClass(index)}`}>#{index + 1}</span>
                        <span className="recall-entry-name">{entry.display_name || 'Anonymous Learner'}</span>
                        <span>{entry.total_xp} XP</span>
                        <span className="badge badge-primary">Level {entry.recall_level}</span>
                      </div>
                    ))
                  )}
                </div>

                <div className="recall-sound-toggle-wrap">
                  <Button variant="ghost" onClick={toggleSound}>
                    <Icon name={soundEnabled ? 'volume-high' : 'volume-xmark'} />
                    Sound: {soundEnabled ? 'On' : 'Off'}
                  </Button>
                </div>
              </>
            )}
          </>
        )}

        {sessionActive && currentQuestion && (
          <div>
            <ProgressBar value={currentIndex + 1} max={totalQuestions} variant="gradient" />
            <p className="quiz-progress-label">
              Question {currentIndex + 1} of {totalQuestions}
              {selectedTopic?.topic_name && <> – {selectedTopic.topic_name}</>}
            </p>

            {sessionQuote && (
              <p className="recall-quote">
                "{sessionQuote.quote}"{sessionQuote.author ? ` — ${sessionQuote.author}` : ''}
              </p>
            )}

            <Card className="recall-question-card">
              <h3 className="recall-question-heading">{currentQuestion.question_text}</h3>
              <Input ref={answerInputRef} placeholder="Type your answer..." disabled={analyzing} />

              {analyzing && (
                <div className="recall-analyzing-row">
                  <Spinner size="sm" />
                  <span className="recall-analyzing-label">Checking</span>
                </div>
              )}

              <div className="recall-answer-actions">
                {!feedbackResult ? (
                  <Button onClick={handleSubmitAnswer} disabled={analyzing} loading={analyzing}>
                    <Icon name="paper-plane" /> Submit
                  </Button>
                ) : (
                  <Button onClick={handleNextQuestion} loading={loading} disabled={loading}>
                    {feedbackResult.is_complete ? 'Finish Session' : 'Next Question'} <Icon name="arrow-right" />
                  </Button>
                )}
              </div>
            </Card>

            {feedbackResult && (
              <Card className="recall-feedback-card">
                <div className="recall-feedback-header">
                  <Icon
                    name={feedbackResult.strength === 'excellent' ? 'star' : feedbackResult.strength === 'strong' ? 'circle-check' : 'rotate'}
                    className={`recall-feedback-icon ${feedbackResult.strength === 'excellent' ? 'is-excellent' : feedbackResult.strength === 'strong' ? 'is-strong' : 'is-developing'}`}
                  />
                  <div>
                    <h4>{feedbackResult.strength === 'excellent' ? 'Perfect' : feedbackResult.strength === 'strong' ? 'Close' : 'Needs Review'}</h4>
                    <p className="recall-feedback-xp">+{feedbackResult.xp_earned} XP</p>
                  </div>
                </div>
                <p><strong>Correct answer:</strong> {feedbackResult.correct_answer}</p>
                {feedbackResult.note && <p className="recall-feedback-note">{feedbackResult.note}</p>}
                {feedbackResult.explanation && <p className="recall-feedback-explanation">{feedbackResult.explanation}</p>}
              </Card>
            )}
          </div>
        )}

        {showReport && sessionReport && (
          <Card className="recall-report-card">
            <Icon name="trophy" className="recall-report-icon" />
            <h2>Session Complete</h2>

            <div className="recall-report-stats">
              <div>
                <div className="recall-report-value is-success">{sessionReport.excellent || 0}</div>
                <div className="recall-report-label">Excellent</div>
              </div>
              <div>
                <div className="recall-report-value is-primary">{sessionReport.strong || 0}</div>
                <div className="recall-report-label">Strong</div>
              </div>
              <div>
                <div className="recall-report-value is-warm">{sessionReport.developing || 0}</div>
                <div className="recall-report-label">Needs Review</div>
              </div>
            </div>

            <p>Mastery Score: {sessionReport.mastery_score || 0}%</p>
            <p className="recall-report-time">Total time: {sessionReport.total_time_formatted} · Avg: {sessionReport.avg_time_formatted} per question</p>

            {newlyAwarded.length > 0 && (
              <div className="recall-report-achievements">
                <h4>New Achievements</h4>
                <div className="recall-badge-row">
                  {newlyAwarded.map((achievement) => (
                    <span key={achievement.id} className="badge badge-accent" title={achievement.description || achievement.name}>
                      <Icon name={achievement.icon === 'dna' ? 'microscope' : achievement.icon || 'medal'} /> {achievement.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="recall-report-actions">
              <Button onClick={() => { setShowReport(false); setSessionActive(false); setNewlyAwarded([]); loadUserProgress(); setTopicModalOpen(true); }}>
                <Icon name="rotate" /> Study Another {unitLabel}
              </Button>
              <Button variant="secondary" onClick={() => navigate('/')}>
                <Icon name="home" /> Home
              </Button>
            </div>
          </Card>
        )}

        <Modal open={topicModalOpen} onClose={closeTopicModal} title={`Select a ${unitLabel}${levelName ? ` in ${levelName}` : ''}${classLabel ? ` – ${classLabel}` : ''}`}>
          <div className="recall-topic-modal-list">
            {topicList.length === 0 && (
              <p className="recall-topic-modal-empty">No {unitLabel.toLowerCase()}s available for your level.</p>
            )}

            {topicList.map((topic) => (
              <button
                key={topic.unit_id}
                className="btn btn-secondary recall-topic-modal-btn"
                onClick={() => handleStartSession(topic)}
              >
                <span>{topic.topic_name}</span>
                <span className="recall-topic-modal-count">{topic.question_count} questions</span>
              </button>
            ))}
          </div>
        </Modal>
      </div>
    </div>
  );
}
