 /* pages/Recall.jsx */
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useRequireOnboarding } from '../hooks/useRequireOnboarding';
import { useLevelFilter } from '../hooks/useLevelFilter';
import { useContentAccess } from '../hooks/useContentAccess';
import { useLayout } from '../contexts/LayoutContext';
import { useToast } from '../components/Toast/Toast';
import {
  getRecallSession, checkRecallSession, getRecallStats,
  getRecallAchievements, getRecallDashboard, getRecallTopics,
  continueRecallSession, submitRecallAnswer, completeRecallSession,
  getLeaderboard,
} from '../api/cachedClient';
import { PendingApprovalScreen } from '../components/access/PendingApprovalScreen';
import { AccessDenied } from '../components/access/AccessDenied';
import Icon from '../components/Icon/Icon';
import Spinner from '../components/Spinner/Spinner';
import ProgressBar from '../components/ProgressBar/ProgressBar';
import Button from '../components/Button/Button';
import Card from '../components/Card/Card';
import Modal from '../components/Modal/Modal';
import Input from '../components/Input/Input';

let audioCtx = null;
async function getAudioContext() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; }
  }
  if (audioCtx.state === 'suspended') await audioCtx.resume();
  return audioCtx;
}

async function playTone(type) {
  try {
    const ctx = await getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.15, now);
    switch (type) {
      case 'excellent':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.setValueAtTime(659.25, now + 0.1);
        osc.frequency.setValueAtTime(783.99, now + 0.2);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        osc.start(now); osc.stop(now + 0.5);
        break;
      case 'strong':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.setValueAtTime(554.37, now + 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.start(now); osc.stop(now + 0.3);
        break;
      case 'developing':
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(330, now);
        osc.frequency.setValueAtTime(294, now + 0.15);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        osc.start(now); osc.stop(now + 0.4);
        break;
      default:
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc.start(now); osc.stop(now + 0.2);
    }
  } catch {}
}

export default function BioRecall() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { isReady } = useRequireOnboarding();
  const access = useContentAccess();
  const { level, class_name, showAll, displayName } = useLevelFilter();
  const { groups } = useLayout();
  const addToast = useToast();

  const [sessionQuestions, setSessionQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sessionActive, setSessionActive] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [userAnswersRecord, setUserAnswersRecord] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [xpTotal, setXpTotal] = useState(0);
  const [streakDays, setStreakDays] = useState(0);
  const [masteryTopics, setMasteryTopics] = useState({});
  const [brainEnergy, setBrainEnergy] = useState(100);
  const [showReport, setShowReport] = useState(false);
  const [sessionReport, setSessionReport] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [achievementsList, setAchievementsList] = useState([]);
  const [topicModalOpen, setTopicModalOpen] = useState(false);
  const [topicList, setTopicList] = useState([]);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [loading, setLoading] = useState(true);
  const [feedbackResult, setFeedbackResult] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [rankTitle, setRankTitle] = useState('Beginner');
  const [xpProgress, setXpProgress] = useState({ level: 1, xpIntoLevel: 0, xpToNext: 100, progressPercent: 0 });
  const [questionStartTime, setQuestionStartTime] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    try { return localStorage.getItem('bioRecall_sound') !== 'off'; } catch { return true; }
  });
  const answerInputRef = useRef(null);
  const isMounted = useRef(true);

  useEffect(() => {
    if (!isReady || !access.canAccess || access.isPending) return;
    loadUserProgress();
  }, [isReady, access.canAccess, access.isPending]);

  async function loadUserProgress() {
    setLoading(true);
    try {
      const [dash, stats, achievements, topics, lb] = await Promise.all([
        getRecallDashboard().catch(() => null),
        getRecallStats().catch(() => null),
        getRecallAchievements().catch(() => []),
        getRecallTopics(groups?.[0]?.id).catch(() => []),
        getLeaderboard(level || 'O-Level', 10).catch(() => []),
      ]);
      if (!isMounted.current) return;
      if (dash) {
        setDashboardData(dash);
        setXpTotal(dash.total_xp || 0);
        setStreakDays(dash.current_streak || 0);
        setRankTitle(dash.rank_title || 'Beginner');
        const prog = computeXpProgress(dash.total_xp || 0);
        setXpProgress(prog);
      }
      if (stats) {
        setMasteryTopics(stats.mastery_topics || {});
        setBrainEnergy(stats.brain_energy || 100);
      }
      setAchievementsList(Array.isArray(achievements) ? achievements : []);
      setTopicList(Array.isArray(topics) ? topics : []);
      setLeaderboard(Array.isArray(lb) ? lb : []);
    } catch {
      addToast('Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  }

  const openTopicModal = () => setTopicModalOpen(true);
  const closeTopicModal = () => setTopicModalOpen(false);

  async function handleStartSession(topic) {
    setSelectedTopic(topic);
    setTopicModalOpen(false);
    setLoading(true);
    try {
      const session = await getRecallSession(topic.unit_id);
      if (session?.questions?.length) {
        setSessionQuestions(session.questions);
        setSessionId(session.session_id);
        setCurrentIndex(0);
        setSessionActive(true);
        setUserAnswersRecord([]);
        setQuestionStartTime(new Date());
      } else {
        addToast('No questions available for this topic', 'warning');
      }
    } catch {
      addToast('Failed to start session', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmitAnswer() {
    const answer = answerInputRef.current?.value?.trim();
    if (!answer) return;
    setAnalyzing(true);
    try {
      const result = await submitRecallAnswer(
        sessionId,
        sessionQuestions[currentIndex].id,
        answer,
        '',
        questionStartTime?.toISOString()
      );
      const newRecord = {
        question_id: sessionQuestions[currentIndex].id,
        user_answer: answer,
        strength: result.strength,
        correct_answer: result.correct_answer,
        explanation: result.explanation,
        xp_earned: result.xp_earned,
      };
      setUserAnswersRecord(prev => [...prev, newRecord]);
      setFeedbackResult(result);
      if (soundEnabled) {
        if (result.strength === 'excellent') playTone('excellent');
        else if (result.strength === 'strong') playTone('strong');
        else playTone('developing');
      }
      if (result.xp_earned) {
        setXpTotal(prev => prev + result.xp_earned);
        const newXp = (xpTotal || 0) + result.xp_earned;
        const prog = computeXpProgress(newXp);
        setXpProgress(prog);
      }
    } catch {
      addToast('Failed to submit answer', 'error');
    } finally {
      setAnalyzing(false);
      if (answerInputRef.current) answerInputRef.current.value = '';
    }
  }

  function handleNextQuestion() {
    const nextIndex = currentIndex + 1;
    if (nextIndex < sessionQuestions.length) {
      setCurrentIndex(nextIndex);
      setFeedbackResult(null);
      setQuestionStartTime(new Date());
    } else {
      setSessionActive(false);
      setShowReport(true);
      handleCompleteSession();
    }
  }

  async function handleCompleteSession() {
    try {
      const result = await completeRecallSession(sessionId);
      setSessionReport(result?.report || null);
    } catch {}
  }

  function computeXpProgress(totalXp) {
    const xp = totalXp || 0;
    const lvl = Math.floor(xp / 100) + 1;
    const into = xp % 100;
    const toNext = 100 - into;
    const pct = into;
    return { level: lvl, xpIntoLevel: into, xpToNext: toNext, progressPercent: pct };
  }

  const toggleSound = () => {
    setSoundEnabled(prev => {
      const next = !prev;
      localStorage.setItem('bioRecall_sound', next ? 'on' : 'off');
      return next;
    });
  };

  if (!isReady || access.loading) return (
    <div className="fcd-loading-wrap">
      <Spinner size="lg" />
    </div>
  );
  if (access.isPending) return <PendingApprovalScreen />;
  if (!access.canAccess) return <AccessDenied />;

  if (loading && !sessionActive && !showReport) {
    return (
      <div className="section recall-loading-wrap">
        <Spinner size="lg" />
      </div>
    );
  }

  const currentQuestion = sessionQuestions[currentIndex];
  const topicEntries = Object.entries(masteryTopics).filter(([t]) => t && t !== 'null').slice(0, 6);
  const levelName = displayName || level?.id || '';
  const classLabel = class_name || '';

  function rankClass(idx) {
    if (idx === 0) return 'is-gold';
    if (idx === 1) return 'is-silver';
    if (idx === 2) return 'is-bronze';
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
          <span className="sec-label">{level === 'Pharmacy' ? 'RecallRx' : 'BioRecall'}</span>
          <h1 className="section-title recall-page-title">
            {level === 'Pharmacy' ? 'RecallRx' : `BioRecall ${levelName}`}
          </h1>
          {levelName && (
            <div className="recall-chips-row">
              <span className="chip recall-chip-level">{levelName}</span>
              {classLabel && <span className="chip recall-chip-class">{classLabel}</span>}
            </div>
          )}
        </div>

        {!sessionActive && !showReport && (
          <>
            <div className="card recall-intro-card">
              <Icon name="brain" className="recall-intro-icon" />
              <Button onClick={openTopicModal} size="lg">
                Continue to Topics{levelName ? ` in ${levelName}` : ''}
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
                  <Icon name="brain" className="recall-stat-card-icon is-primary" />
                  <h3 className="recall-stat-card-heading">Brain Energy</h3>
                  <ProgressBar value={brainEnergy} max={100} variant="primary" />
                  <p className="recall-stat-card-footer">{brainEnergy}% remaining</p>
                </div>
              </Card>

              <Card>
                <div className="recall-stat-card-inner">
                  <Icon name="trophy" className="recall-stat-card-icon is-accent" />
                  <h3 className="recall-stat-card-heading">Achievements</h3>
                  <div className="recall-badge-row">
                    {achievementsList.slice(0, 6).map((ach) => (
                      <span key={ach.key} className="badge badge-accent" title={ach.title}>
                        <Icon name={ach.icon || 'medal'} />
                      </span>
                    ))}
                  </div>
                </div>
              </Card>
            </div>

            {topicEntries.length > 0 && (
              <div className="recall-topics-section">
                <h3 className="recall-section-heading">
                  Topic Mastery {levelName ? `in ${levelName}` : ''}{classLabel ? ` – ${classLabel}` : ''}
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
                leaderboard.map((entry, idx) => (
                  <div key={idx} className="card recall-leaderboard-row">
                    <span className={`recall-rank ${rankClass(idx)}`}>
                      #{idx + 1}
                    </span>
                    <span className="recall-entry-name">{entry.user_name || entry.email || 'Anonymous'}</span>
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

        {sessionActive && currentQuestion && (
          <div>
            <ProgressBar value={currentIndex + 1} max={sessionQuestions.length} variant="gradient" />
            <p className="quiz-progress-label">
              Question {currentIndex + 1} of {sessionQuestions.length}
              {selectedTopic?.topic_name && <> – {selectedTopic.topic_name}</>}
            </p>

            <Card className="recall-question-card">
              <h3 className="recall-question-heading">{currentQuestion.question_text}</h3>
              <Input
                ref={answerInputRef}
                placeholder="Type your answer..."
                disabled={analyzing}
              />
              {analyzing && (
                <div className="recall-analyzing-row">
                  <Spinner size="sm" />
                  <span className="recall-analyzing-label">Checking...</span>
                </div>
              )}
              <div className="recall-answer-actions">
                {!feedbackResult ? (
                  <Button onClick={handleSubmitAnswer} disabled={analyzing} loading={analyzing}>
                    <Icon name="paper-plane" /> Submit
                  </Button>
                ) : (
                  <Button onClick={handleNextQuestion}>
                    {currentIndex + 1 < sessionQuestions.length ? 'Next Question' : 'Finish Session'} <Icon name="arrow-right" />
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
                    <h4>{feedbackResult.strength === 'excellent' ? 'Perfect!' : feedbackResult.strength === 'strong' ? 'Close!' : 'Needs Review'}</h4>
                    <p className="recall-feedback-xp">+{feedbackResult.xp_earned} XP</p>
                  </div>
                </div>
                <p><strong>Correct answer:</strong> {feedbackResult.correct_answer}</p>
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
                <div className="recall-report-value is-success">
                  {sessionReport.excellent || 0}
                </div>
                <div className="recall-report-label">Excellent</div>
              </div>
              <div>
                <div className="recall-report-value is-primary">
                  {sessionReport.strong || 0}
                </div>
                <div className="recall-report-label">Strong</div>
              </div>
              <div>
                <div className="recall-report-value is-warm">
                  {sessionReport.developing || 0}
                </div>
                <div className="recall-report-label">Needs Review</div>
              </div>
            </div>
            <p>Mastery Score: {sessionReport.mastery_score || 0}%</p>
            <div className="recall-report-actions">
              <Button onClick={() => { setShowReport(false); setSessionActive(false); setTopicModalOpen(true); }}>
                <Icon name="rotate" /> Study Another Topic
              </Button>
              <Button variant="secondary" onClick={() => navigate('/')}>
                <Icon name="home" /> Home
              </Button>
            </div>
          </Card>
        )}

        <Modal open={topicModalOpen} onClose={closeTopicModal} title={`Select a Topic${levelName ? ` in ${levelName}` : ''}${classLabel ? ` – ${classLabel}` : ''}`}>
          <div className="recall-topic-modal-list">
            {topicList.length === 0 && (
              <p className="recall-topic-modal-empty">No topics available for your level.</p>
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
