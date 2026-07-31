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

  if (!isReady || access.isPending) return <PendingApprovalScreen />;
  if (!access.canAccess) return <AccessDenied />;

  if (loading && !sessionActive && !showReport) {
    return (
      <div className="section" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <Spinner size="lg" />
      </div>
    );
  }

  const currentQuestion = sessionQuestions[currentIndex];
  const topicEntries = Object.entries(masteryTopics).filter(([t]) => t && t !== 'null').slice(0, 6);
  const levelName = displayName || level?.id || '';
  const classLabel = class_name || '';

  return (
    <div className="recall-page">
      <div className="section" style={{ paddingTop: 'var(--space-6)' }}>
        <nav className="breadcrumb">
          <Link to="/"><Icon name="home" className="breadcrumb-icon" /> Home</Link>
          <Icon name="chevron-right" className="breadcrumb-sep" />
          <span>Recall Practice</span>
        </nav>

        <div style={{ marginBottom: 'var(--space-8)' }}>
          <span className="sec-label">{level === 'Pharmacy' ? 'RecallRx' : 'BioRecall'}</span>
          <h1 className="section-title" style={{ textAlign: 'left', margin: '0 0 var(--space-2)' }}>
            {level === 'Pharmacy' ? 'RecallRx' : `BioRecall ${levelName}`}
          </h1>
          {levelName && (
            <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
              <span className="chip" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>
                {levelName}
              </span>
              {classLabel && <span className="chip" style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>{classLabel}</span>}
            </div>
          )}
        </div>

        {!sessionActive && !showReport && (
          <>
            <div className="card" style={{ padding: 'var(--space-8)', textAlign: 'center', marginBottom: 'var(--space-8)' }}>
              <Icon name="brain" style={{ fontSize: '3rem', color: 'var(--primary)', marginBottom: 'var(--space-4)' }} />
              <Button onClick={openTopicModal} size="lg">
                Continue to Topics{levelName ? ` in ${levelName}` : ''}
              </Button>
              <div style={{ marginTop: 'var(--space-4)', display: 'flex', justifyContent: 'center', gap: 'var(--space-8)' }}>
                <div>
                  <Icon name="fire" style={{ color: 'var(--warm)' }} />
                  <span style={{ marginLeft: 'var(--space-2)' }}>{streakDays} Day Streak</span>
                </div>
                <div>
                  <Icon name="star" style={{ color: 'var(--accent)' }} />
                  <span style={{ marginLeft: 'var(--space-2)' }}>Level {xpProgress.level} · {xpTotal} XP · {rankTitle}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3" style={{ marginBottom: 'var(--space-8)' }}>
              <Card>
                <div style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
                  <Icon name="trophy" style={{ fontSize: '2rem', color: 'var(--warm)' }} />
                  <h3 style={{ margin: 'var(--space-4) 0' }}>XP Progress</h3>
                  <p style={{ marginBottom: 'var(--space-4)' }}>Level {xpProgress.level} · {rankTitle}</p>
                  <ProgressBar value={xpProgress.xpIntoLevel} max={100} variant="gradient" />
                  <p style={{ marginTop: 'var(--space-2)', fontSize: 'var(--text-sm)' }}>{xpProgress.xpIntoLevel} / 100 XP to next level</p>
                </div>
              </Card>

              <Card>
                <div style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
                  <Icon name="brain" style={{ fontSize: '2rem', color: 'var(--primary)' }} />
                  <h3 style={{ margin: 'var(--space-4) 0' }}>Brain Energy</h3>
                  <ProgressBar value={brainEnergy} max={100} variant="primary" />
                  <p style={{ marginTop: 'var(--space-2)', fontSize: 'var(--text-sm)' }}>{brainEnergy}% remaining</p>
                </div>
              </Card>

              <Card>
                <div style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
                  <Icon name="trophy" style={{ fontSize: '2rem', color: 'var(--accent)' }} />
                  <h3 style={{ margin: 'var(--space-4) 0' }}>Achievements</h3>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', justifyContent: 'center' }}>
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
              <div style={{ marginBottom: 'var(--space-8)' }}>
                <h3 style={{ marginBottom: 'var(--space-6)' }}>
                  Topic Mastery {levelName ? `in ${levelName}` : ''}{classLabel ? ` – ${classLabel}` : ''}
                </h3>
                <div className="grid grid-cols-3">
                  {topicEntries.map(([topic, mastery]) => (
                    <Card key={topic}>
                      <div style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
                        <Icon name="book-open" style={{ fontSize: '2rem', color: 'var(--primary)' }} />
                        <h4 style={{ margin: 'var(--space-3) 0' }}>{topic}</h4>
                        <ProgressBar value={mastery} max={100} variant="success" />
                        <p style={{ marginTop: 'var(--space-2)', fontSize: 'var(--text-sm)' }}>{Math.round(mastery)}%</p>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            <div style={{ marginBottom: 'var(--space-8)' }}>
              <h3 style={{ marginBottom: 'var(--space-6)' }}>
                Leaderboard {levelName ? `– ${levelName}` : ''}
              </h3>
              {leaderboard.length === 0 ? (
                <p style={{ color: 'var(--text-dim)' }}>No data yet. Be the first!</p>
              ) : (
                leaderboard.map((entry, idx) => (
                  <div key={idx} className="card" style={{ padding: 'var(--space-4)', flexDirection: 'row', alignItems: 'center', gap: 'var(--space-4)', marginBottom: 'var(--space-2)' }}>
                    <span style={{ fontWeight: 700, color: idx === 0 ? 'var(--warm)' : idx === 1 ? 'var(--primary)' : idx === 2 ? 'var(--accent)' : 'var(--text-dim)' }}>
                      #{idx + 1}
                    </span>
                    <span style={{ flex: 1 }}>{entry.user_name || entry.email || 'Anonymous'}</span>
                    <span>{entry.total_xp} XP</span>
                    <span className="badge badge-primary">Level {entry.recall_level}</span>
                  </div>
                ))
              )}
            </div>

            <div style={{ textAlign: 'center' }}>
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
            <p style={{ textAlign: 'center', color: 'var(--text-dim)', margin: 'var(--space-4) 0' }}>
              Question {currentIndex + 1} of {sessionQuestions.length}
              {selectedTopic?.topic_name && <> – {selectedTopic.topic_name}</>}
            </p>

            <Card style={{ padding: 'var(--space-8)', marginBottom: 'var(--space-6)' }}>
              <h3 style={{ marginBottom: 'var(--space-6)' }}>{currentQuestion.question_text}</h3>
              <Input
                ref={answerInputRef}
                placeholder="Type your answer..."
                disabled={analyzing}
              />
              {analyzing && (
                <div style={{ textAlign: 'center', marginTop: 'var(--space-4)' }}>
                  <Spinner size="sm" />
                  <span style={{ marginLeft: 'var(--space-3)' }}>Checking...</span>
                </div>
              )}
              <div style={{ marginTop: 'var(--space-6)', display: 'flex', gap: 'var(--space-4)' }}>
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
              <Card style={{ padding: 'var(--space-8)', marginBottom: 'var(--space-6)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
                  <Icon
                    name={feedbackResult.strength === 'excellent' ? 'star' : feedbackResult.strength === 'strong' ? 'circle-check' : 'rotate'}
                    style={{
                      fontSize: '2rem',
                      color: feedbackResult.strength === 'excellent' ? 'var(--success)' : feedbackResult.strength === 'strong' ? 'var(--primary)' : 'var(--warm)'
                    }}
                  />
                  <div>
                    <h4>{feedbackResult.strength === 'excellent' ? 'Perfect!' : feedbackResult.strength === 'strong' ? 'Close!' : 'Needs Review'}</h4>
                    <p style={{ color: 'var(--text-dim)' }}>+{feedbackResult.xp_earned} XP</p>
                  </div>
                </div>
                <p><strong>Correct answer:</strong> {feedbackResult.correct_answer}</p>
                {feedbackResult.explanation && <p style={{ color: 'var(--text-dim)' }}>{feedbackResult.explanation}</p>}
              </Card>
            )}
          </div>
        )}

        {showReport && sessionReport && (
          <Card style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
            <Icon name="trophy" style={{ fontSize: '3rem', color: 'var(--warm)', marginBottom: 'var(--space-4)' }} />
            <h2>Session Complete</h2>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-8)', margin: 'var(--space-8) 0' }}>
              <div>
                <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 'var(--weight-black)', color: 'var(--success)' }}>
                  {sessionReport.excellent || 0}
                </div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-dim)' }}>Excellent</div>
              </div>
              <div>
                <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 'var(--weight-black)', color: 'var(--primary)' }}>
                  {sessionReport.strong || 0}
                </div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-dim)' }}>Strong</div>
              </div>
              <div>
                <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 'var(--weight-black)', color: 'var(--warm)' }}>
                  {sessionReport.developing || 0}
                </div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-dim)' }}>Needs Review</div>
              </div>
            </div>
            <p>Mastery Score: {sessionReport.mastery_score || 0}%</p>
            <div style={{ marginTop: 'var(--space-8)', display: 'flex', gap: 'var(--space-4)', justifyContent: 'center' }}>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {topicList.length === 0 && (
              <p style={{ color: 'var(--text-dim)' }}>No topics available for your level.</p>
            )}
            {topicList.map((topic) => (
              <button
                key={topic.unit_id}
                className="btn btn-secondary"
                onClick={() => handleStartSession(topic)}
                style={{ justifyContent: 'space-between' }}
              >
                <span>{topic.topic_name}</span>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{topic.question_count} questions</span>
              </button>
            ))}
          </div>
        </Modal>
      </div>
    </div>
  );
} 
