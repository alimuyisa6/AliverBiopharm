/* pages/Quiz.jsx */
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLayout } from '../contexts/LayoutContext';
import { useRequireOnboarding } from '../hooks/useRequireOnboarding';
import { useLevelFilter } from '../hooks/useLevelFilter';
import { useContentAccess } from '../hooks/useContentAccess';
import { useToast } from '../components/Toast/Toast';
import {
  getQuizTopics, getQuizBlock, checkDailyRetry, checkQuizAnswer,
  recordDailyVisit, getUserStreak, getUserAchievements, saveAchievement,
  saveQuizState, getQuizState, clearQuizState, trackEvent,
  getLeaderboard, startQuizSession, trackTabSwitch, submitQuizWithSession, getUnits,
} from '../api/cachedClient';
import { PendingApprovalScreen } from '../components/access/PendingApprovalScreen';
import { AccessDenied } from '../components/access/AccessDenied';
import QuizHero from '../features/quiz/QuizHero';
import QuizDashboard from '../features/quiz/QuizDashboard';
import QuizChallenges from '../features/quiz/QuizChallenges';
import QuizLearningPath from '../features/quiz/QuizLearningPath';
import QuizWeakAreas from '../features/quiz/QuizWeakAreas';
import Icon from '../components/Icon/Icon';
import Spinner from '../components/Spinner/Spinner';
import ProgressBar from '../components/ProgressBar/ProgressBar';
import Button from '../components/Button/Button';
import Modal from '../components/Modal/Modal';
import Input from '../components/Input/Input';
import DOMPurify from 'dompurify';

const MAX_TAB_SWITCHES = 3;
const REDIRECT_SECONDS = 10;

export default function Quiz() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { isReady } = useRequireOnboarding();
  const access = useContentAccess();
  const { level, class_name, showAll, displayName } = useLevelFilter();
  const { groups } = useLayout();
  const addToast = useToast();

  const [activeUnitId, setActiveUnitId] = useState(null);
  const [currentTopic, setCurrentTopic] = useState('');
  const [allTopics, setAllTopics] = useState([]);
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [userAnswers, setUserAnswers] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [quizStartTime, setQuizStartTime] = useState(null);
  const [currentBlock, setCurrentBlock] = useState(0);
  const [totalBlocks, setTotalBlocks] = useState(0);
  const [resultData, setResultData] = useState(null);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [pendingBlock, setPendingBlock] = useState(null);
  const [loading, setLoading] = useState(true);
  const [glossaryMap, setGlossaryMap] = useState({});
  const [earnedBadges, setEarnedBadges] = useState([]);
  const [streak, setStreak] = useState(0);
  const [topicSearch, setTopicSearch] = useState('');
  const [timeLeft, setTimeLeft] = useState(null);
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [resumeData, setResumeData] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem('quiz_sound') !== 'off');
  const [confidence, setConfidence] = useState([]);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [answerSubmitting, setAnswerSubmitting] = useState(false);
  const [sessionActive, setSessionActive] = useState(true);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [blockTabSwitch, setBlockTabSwitch] = useState(false);
  const [integrityOverlay, setIntegrityOverlay] = useState(false);
  const [integrityCountdown, setIntegrityCountdown] = useState(REDIRECT_SECONDS);
  const touchStartX = useRef(null);
  const integrityIntervalRef = useRef(null);

  const SPINNER_WORDS = ['Reviewing...', 'Checking...', 'Analyzing...', 'Verifying...', 'Processing...'];

  useEffect(() => {
    if (!isReady || !access.canAccess || access.isPending) return;
    const load = async () => {
      try {
        setLoading(true);
        if (user) {
          await recordDailyVisit();
          const [streakData, badges, savedState] = await Promise.all([
            getUserStreak(),
            getUserAchievements(),
            getQuizState(),
          ]);
          setStreak(streakData?.count || 0);
          setEarnedBadges(Array.isArray(badges) ? badges.map(b => b.badge) : []);
          if (savedState?.state) {
            setResumeData(savedState.state);
            setShowResumeModal(true);
            setLoading(false);
            return;
          }
        }
        setLoading(false);
      } catch {
        addToast('Failed to load data', 'error');
        setLoading(false);
      }
    };
    load();
  }, [isReady, access.canAccess, access.isPending, user]);

  useEffect(() => {
    if (!groups?.length || !user) return;
    const groupId = user.profile?.active_group_id || groups[0]?.id;
    if (!groupId) return;
    getUnits({ group_id: groupId }).then(units => {
      if (units?.length) setActiveUnitId(units[0].id);
    }).catch(() => {});
  }, [groups, user]);

  useEffect(() => {
    if (!activeUnitId) return;
    getQuizTopics(activeUnitId).then(topics => setAllTopics(Array.isArray(topics) ? topics : [])).catch(() => {});
  }, [activeUnitId]);

  const filteredTopics = useMemo(() => {
    if (!Array.isArray(allTopics)) return [];
    return allTopics.filter(topic =>
      !topicSearch || topic.topic_name?.toLowerCase().includes(topicSearch.toLowerCase())
    );
  }, [allTopics, topicSearch]);

  const getFirstUnansweredIndex = useCallback((answers) => answers.findIndex(a => a === null), []);
  const canNavigateTo = useCallback((targetIndex, answers) => {
    if (answers[targetIndex] !== null) return true;
    return targetIndex === answers.findIndex(a => a === null);
  }, []);

  const navigateTo = (idx) => setCurrentIndex(idx);

  const selectAnswer = async (optionLetter) => {
    if (userAnswers[currentIndex] !== null || answerSubmitting || integrityOverlay) return;
    setAnswerSubmitting(true);
    const q = quizQuestions[currentIndex];
    try {
      const result = await checkQuizAnswer({ question_id: q.id, selected_option: optionLetter });
      const newAnswers = [...userAnswers];
      newAnswers[currentIndex] = {
        selected: optionLetter,
        correct: result.correct,
        correct_option: result.correct_option,
        correct_answer_text: result.correct_answer_text,
      };
      setUserAnswers(newAnswers);
      if (soundEnabled) {
        if (result.correct) playCorrectSound();
        else playIncorrectSound();
      }
      goToNextUnanswered(newAnswers, currentIndex);
    } catch {
      addToast('Failed to verify answer', 'error');
    } finally {
      setAnswerSubmitting(false);
    }
  };

  const setConfidenceForCurrent = (lvl) => {
    const next = [...confidence];
    next[currentIndex] = lvl;
    setConfidence(next);
  };

  const submitBlockWithSession = async () => {
    if (!quizQuestions.length) return;
    const answersPayload = quizQuestions.map((q, idx) => ({
      id: q.id,
      selectedOption: userAnswers[idx]?.selected || 'X',
    }));
    const timeTaken = Math.round((Date.now() - new Date(quizStartTime).getTime()) / 1000);
    setLoading(true);
    try {
      const result = await submitQuizWithSession(activeUnitId, currentBlock, answersPayload, timeTaken);
      sessionStorage.removeItem('quiz_resume');
      clearQuizState().catch(() => {});
      if (result.auto_submitted) return;
      setResultData(result);
      trackEvent('quiz_complete', {
        unitId: activeUnitId,
        topic: currentTopic,
        block: currentBlock,
        score: result.percentage,
        passed: result.passed,
      });
      if (result.passed && result.percentage >= 90) showConfetti();
      const topics = await getQuizTopics(activeUnitId);
      setAllTopics(Array.isArray(topics) ? topics : []);
    } catch (err) {
      addToast('Submission failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showConfetti = () => {
    const colors = ['var(--primary)', 'var(--secondary)', 'var(--accent)', 'var(--warm)', 'var(--success)'];
    for (let i = 0; i < 50; i++) {
      const p = document.createElement('div');
      p.style.cssText = `position:fixed;width:8px;height:8px;background:${colors[Math.floor(Math.random()*colors.length)]};left:${Math.random()*100}%;top:-10px;border-radius:50%;z-index:9999;pointer-events:none;animation:confettiFall ${2+Math.random()*3}s linear forwards`;
      document.body.appendChild(p);
      setTimeout(() => p.remove(), 4000);
    }
  };

  const openTopicBlocks = (topic, total) => {
    setCurrentTopic(topic);
    setTotalBlocks(Number(total) || 0);
    setQuizQuestions([]);
    setResultData(null);
  };

  const startBlock = async (blockNum) => {
    if (!user) { addToast('Please sign in.', 'error'); return; }
    try {
      const retry = await checkDailyRetry(activeUnitId, blockNum);
      if (!retry.can_retry) { addToast(retry.reason || 'Block locked.', 'error'); return; }
    } catch {
      addToast('Failed to check retry status', 'error');
    }
    setPendingBlock(blockNum);
    setShowRulesModal(true);
  };

  const confirmStartBlock = async () => {
    setShowRulesModal(false);
    const blockNum = pendingBlock;
    setCurrentBlock(blockNum);
    setLoading(true);
    try {
      const sessionResult = await startQuizSession(activeUnitId, blockNum);
      if (!sessionResult.success) {
        if (sessionResult.auto_submitted) {
          addToast(sessionResult.message || 'Quiz auto-submitted.', 'warning');
          setCurrentTopic('');
          setQuizQuestions([]);
          setLoading(false);
          return;
        }
        addToast('Failed to start session', 'error');
        setLoading(false);
        return;
      }
      setTabSwitchCount(sessionResult.tab_switches || 0);
      setSessionActive(true);
      const data = await getQuizBlock(activeUnitId, blockNum);
      if (!data || !data.questions?.length) {
        addToast('No questions available.', 'error');
        setLoading(false);
        return;
      }
      setQuizQuestions(data.questions);
      setUserAnswers(new Array(data.questions.length).fill(null));
      setConfidence(new Array(data.questions.length).fill(null));
      setCurrentIndex(0);
      setQuizStartTime(new Date());
      setResultData(null);
      setTimeLeft(600);
      trackEvent('quiz_start', { unitId: activeUnitId, topic: currentTopic, block: blockNum });
    } catch (err) {
      addToast('Failed to load quiz: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadLeaderboard = async () => {
    setLeaderboardLoading(true);
    try {
      const data = await getLeaderboard(level || 'O-Level', 10);
      setLeaderboard(Array.isArray(data) ? data : []);
    } catch {
      setLeaderboard([]);
    }
    setLeaderboardLoading(false);
  };

  if (!isReady || access.isPending) return <PendingApprovalScreen />;
  if (!access.canAccess) return <AccessDenied />;

  if (loading && !quizQuestions.length && !resultData && !currentTopic) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <Spinner size="lg" />
      </div>
    );
  }

  const firstUnanswered = getFirstUnansweredIndex(userAnswers);
  const allAnswered = userAnswers.length > 0 && userAnswers.every(a => a !== null);
  const timerPercent = timeLeft !== null ? (timeLeft / 600) * 100 : 100;
  const timerColor = timerPercent > 50 ? 'var(--success)' : timerPercent > 20 ? 'var(--warning)' : 'var(--error)';

  return (
    <div className="quiz-page">
      <div className="section" style={{ paddingTop: 'var(--space-6)' }}>
        <span className="sec-label">Assessments</span>
        <h1 className="section-title" style={{ textAlign: 'left', margin: '0 0 var(--space-2)' }}>
          Knowledge Quizzes {displayName ? `– ${displayName}` : ''}
        </h1>
        {class_name && (
          <p style={{ color: 'var(--text-dim)', marginBottom: 'var(--space-4)' }}>
            Currently viewing: {class_name}
          </p>
        )}

        {user && streak > 0 && (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--space-4)' }}>
            <span className="badge badge-warm">
              <Icon name="fire" /> {streak}-day streak
            </span>
          </div>
        )}

        <nav className="breadcrumb">
          <Link to="/"><Icon name="home" className="breadcrumb-icon" /> Home</Link>
          <Icon name="chevron-right" className="breadcrumb-sep" />
          <span>Quizzes</span>
          {currentTopic && <><Icon name="chevron-right" className="breadcrumb-sep" /><span>{currentTopic}</span></>}
          {currentTopic && resultData && <><Icon name="chevron-right" className="breadcrumb-sep" /><span>Results</span></>}
        </nav>

        {!currentTopic && (
          <>
            <QuizHero level={level} className={class_name} />
            {user && <QuizDashboard user={user} level={level} />}
            {user && <QuizChallenges user={user} />}
            <QuizLearningPath level={level} />
            <QuizWeakAreas user={user} onRecommend={(topic, block) => { setCurrentTopic(topic); startBlock(block); }} />
          </>
        )}

        {!currentTopic ? (
          <>
            <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
              <div style={{ flex: 1 }}>
                <Input
                  placeholder="Search topics..."
                  value={topicSearch}
                  onChange={e => setTopicSearch(e.target.value)}
                  icon="magnifying-glass"
                />
              </div>
              <Button variant="secondary" onClick={() => { setShowLeaderboard(true); loadLeaderboard(); }}>
                <Icon name="trophy" /> Leaderboard
              </Button>
            </div>

            <div className="grid grid-cols-3">
              {filteredTopics.length === 0 && (
                <div style={{ textAlign: 'center', padding: 'var(--space-10)', color: 'var(--text-muted)' }}>
                  <Icon name="magnifying-glass" style={{ fontSize: '2rem', marginBottom: 'var(--space-4)', opacity: 0.4 }} />
                  <p>No topics match your search.</p>
                </div>
              )}
              {filteredTopics.map(topic => {
                const hasQuestions = (topic.question_count || 0) > 0 && (topic.total_blocks || 0) > 0;
                const allDone = hasQuestions && topic.completed_blocks?.length === topic.total_blocks;
                if (hasQuestions && !allDone) {
                  return (
                    <button key={topic.topic_name} className="card card-clickable" onClick={() => openTopicBlocks(topic.topic_name, topic.total_blocks)}>
                      <div className="card-body">
                        <h3 className="card-title">{topic.topic_name}</h3>
                        <p className="card-text">{topic.question_count} questions • {topic.total_blocks} blocks</p>
                      </div>
                      <div className="card-footer">
                        <span className="btn btn-primary btn-sm">Start</span>
                      </div>
                    </button>
                  );
                }
                return (
                  <div key={topic.topic_name} className="card">
                    <div className="card-body">
                      <h3 className="card-title">{topic.topic_name}</h3>
                      <p className="card-text">{topic.question_count} questions</p>
                      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                        {allDone ? 'All blocks done!' : 'Questions being added'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : resultData ? (
          <div className="quiz-result-container">
            <div className="card" style={{ textAlign: 'center', padding: 'var(--space-10)', marginBottom: 'var(--space-8)' }}>
              <Icon name={resultData.passed ? 'trophy' : 'book-open'} style={{ fontSize: '3rem', color: resultData.passed ? 'var(--warm)' : 'var(--primary)', marginBottom: 'var(--space-6)' }} />
              <h2>{resultData.passed ? `Congratulations, ${user?.full_name || 'Learner'}!` : 'Block Complete'}</h2>
              <div style={{ fontSize: 'var(--text-5xl)', fontWeight: 'var(--weight-black)', color: resultData.passed ? 'var(--success)' : 'var(--error)', marginBottom: 'var(--space-4)' }}>
                {resultData.percentage}%
              </div>
              <p>{resultData.score}/{resultData.total} correct</p>
              <span className={`badge ${resultData.passed ? 'badge-success' : 'badge-error'}`}>
                <Icon name={resultData.passed ? 'circle-check' : 'circle-xmark'} />
                {resultData.passed ? 'Passed' : 'Not passed'}
              </span>
              {tabSwitchCount > 0 && (
                <p style={{ marginTop: 'var(--space-4)', color: 'var(--warning)', fontSize: 'var(--text-sm)' }}>
                  <Icon name="exclamation-triangle" /> {tabSwitchCount} tab switch{tabSwitchCount > 1 ? 'es' : ''} recorded
                </p>
              )}
            </div>

            <div style={{ marginBottom: 'var(--space-8)' }}>
              <h3 style={{ marginBottom: 'var(--space-6)' }}>Block {currentBlock + 1} Review – {currentTopic}</h3>
              {(resultData.answers || []).map((a, idx) => (
                <div key={idx} className="card" style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-4)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                    <Icon name={a.isCorrect ? 'circle-check' : 'circle-xmark'} style={{ color: a.isCorrect ? 'var(--success)' : 'var(--error)' }} />
                    <span style={{ fontWeight: 600 }}>Q{idx + 1}</span>
                  </div>
                  <p dangerouslySetInnerHTML={{ __html: a.question }} />
                  <p style={{ color: a.isCorrect ? 'var(--success)' : 'var(--error)' }}>Your answer: {a.userAnswerText}</p>
                  {!a.isCorrect && <p style={{ color: 'var(--success)' }}>Correct: {a.correctAnswerText}</p>}
                  {a.explanation && <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-dim)', marginTop: 'var(--space-3)' }} dangerouslySetInnerHTML={{ __html: a.explanation }} />}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-4)', justifyContent: 'center' }}>
              {currentBlock + 1 < totalBlocks && (
                <Button onClick={() => startBlock(currentBlock + 1)}>Next Block <Icon name="arrow-right" /></Button>
              )}
              <Button variant="secondary" onClick={() => { setCurrentTopic(''); setResultData(null); }}>
                <Icon name="arrow-left" /> All Topics
              </Button>
            </div>
          </div>
        ) : quizQuestions.length > 0 ? (
          <div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginBottom: 'var(--space-6)' }}>
              {quizQuestions.map((_, idx) => {
                let cls = 'btn btn-sm btn-ghost';
                if (userAnswers[idx]) cls = userAnswers[idx].correct ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-danger';
                return (
                  <button
                    key={idx}
                    className={cls + (idx === currentIndex ? ' btn-accent' : '')}
                    onClick={() => { if (!canNavigateTo(idx, userAnswers)) addToast('Answer previous questions first', 'warning'); else navigateTo(idx); }}
                    disabled={!canNavigateTo(idx, userAnswers)}
                    style={{ minWidth: 40 }}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            {timeLeft !== null && (
              <div style={{ marginBottom: 'var(--space-6)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                  <span style={{ fontSize: 'var(--text-sm)' }}>Time remaining</span>
                  <span style={{ fontSize: 'var(--text-sm)', color: timerColor }}>
                    {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
                  </span>
                </div>
                <ProgressBar value={timeLeft} max={600} variant="primary" />
              </div>
            )}

            <ProgressBar value={currentIndex + 1} max={quizQuestions.length} variant="gradient" />
            <p style={{ textAlign: 'center', color: 'var(--text-dim)', margin: 'var(--space-2) 0' }}>
              Block {currentBlock + 1} • Q {currentIndex + 1}/{quizQuestions.length} – {currentTopic}
            </p>

            {answerSubmitting && (
              <div style={{ textAlign: 'center', margin: 'var(--space-4) 0' }}>
                <Spinner size="sm" />
                <span style={{ marginLeft: 'var(--space-3)' }}>{SPINNER_WORDS[Math.floor(Math.random() * SPINNER_WORDS.length)]}</span>
              </div>
            )}

            <div className="card" style={{ padding: 'var(--space-8)', marginBottom: 'var(--space-6)' }}>
              <h3 style={{ marginBottom: 'var(--space-6)' }} dangerouslySetInnerHTML={{ __html: quizQuestions[currentIndex].question_text }} />

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {['A','B','C','D'].map(opt => {
                  const answered = userAnswers[currentIndex] !== null;
                  const selected = userAnswers[currentIndex]?.selected;
                  const correctOpt = userAnswers[currentIndex]?.correct_option;
                  let cls = 'btn btn-secondary';
                  if (answered) {
                    if (opt === correctOpt) cls = 'btn-primary';
                    else if (opt === selected) cls = 'btn-danger';
                  }
                  return (
                    <button
                      key={opt}
                      className={cls}
                      onClick={() => selectAnswer(opt)}
                      disabled={answered || answerSubmitting}
                      style={{ textAlign: 'left', justifyContent: 'flex-start' }}
                    >
                      <span style={{ fontWeight: 700, marginRight: 'var(--space-3)' }}>{opt}.</span>
                      <span dangerouslySetInnerHTML={{ __html: quizQuestions[currentIndex][`option_${opt.toLowerCase()}`] }} />
                      {answered && opt === correctOpt && <Icon name="circle-check" style={{ marginLeft: 'auto', color: 'var(--text-inverse)' }} />}
                      {answered && opt === selected && opt !== correctOpt && <Icon name="circle-xmark" style={{ marginLeft: 'auto', color: 'var(--text-inverse)' }} />}
                    </button>
                  );
                })}
              </div>

              {userAnswers[currentIndex] === null && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', marginTop: 'var(--space-6)' }}>
                  <span style={{ fontSize: 'var(--text-sm)' }}>Confidence:</span>
                  <Button variant="ghost" size="sm" onClick={() => setConfidenceForCurrent('sure')}>
                    <Icon name={confidence[currentIndex] === 'sure' ? 'circle-check' : 'circle'} /> Sure
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setConfidenceForCurrent('unsure')}>
                    <Icon name={confidence[currentIndex] === 'unsure' ? 'circle-check' : 'circle'} /> Unsure
                  </Button>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
              <Button variant="secondary" onClick={() => { if (currentIndex > 0) navigateTo(currentIndex - 1); }} disabled={currentIndex === 0}>
                <Icon name="arrow-left" /> Prev
              </Button>
              {userAnswers[currentIndex] !== null && (
                firstUnanswered !== -1 && firstUnanswered !== currentIndex ? (
                  <Button onClick={() => navigateTo(firstUnanswered)}>Next <Icon name="arrow-right" /></Button>
                ) : currentIndex < quizQuestions.length - 1 ? (
                  <Button onClick={() => navigateTo(currentIndex + 1)}>Next <Icon name="arrow-right" /></Button>
                ) : allAnswered ? (
                  <Button onClick={submitBlockWithSession}>Submit Block</Button>
                ) : null
              )}
            </div>
            <p style={{ textAlign: 'center', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
              <Icon name="keyboard" /> Press A B C D keys • ← → to navigate
            </p>
          </div>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ marginBottom: 'var(--space-4)' }}>{currentTopic}</h2>
            <p style={{ color: 'var(--text-dim)', marginBottom: 'var(--space-8)' }}>
              {class_name ? `${class_name} – ` : ''}Select a block to start
            </p>
            {totalBlocks === 0 ? (
              <p style={{ color: 'var(--text-dim)' }}>No blocks available.</p>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)', justifyContent: 'center' }}>
                {Array.from({ length: totalBlocks }).map((_, i) => {
                  const topicData = allTopics.find(t => t.topic_name === currentTopic);
                  const locked = topicData?.locked_blocks?.includes(i);
                  const completed = topicData?.completed_blocks?.includes(i);
                  return (
                    <button
                      key={i}
                      className={`btn ${completed ? 'btn-primary' : locked ? 'btn-ghost' : 'btn-secondary'}`}
                      disabled={locked}
                      onClick={() => startBlock(i)}
                    >
                      {completed ? <Icon name="circle-check" /> : locked ? <Icon name="lock" /> : <Icon name="play" />}
                      Block {i + 1}
                    </button>
                  );
                })}
              </div>
            )}
            <Button variant="ghost" style={{ marginTop: 'var(--space-8)' }} onClick={() => setCurrentTopic('')}>
              <Icon name="arrow-left" /> Back
            </Button>
          </div>
        )}

        <Modal open={showRulesModal} onClose={() => setShowRulesModal(false)} title="Quiz Rules">
          <ul style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <li><Icon name="circle-check" style={{ color: 'var(--success)' }} /> 10 questions per block</li>
            <li><Icon name="circle-check" style={{ color: 'var(--success)' }} /> 70% to pass</li>
            <li><Icon name="circle-check" style={{ color: 'var(--success)' }} /> Immediate feedback</li>
            <li><Icon name="circle-check" style={{ color: 'var(--success)' }} /> Full explanations on review</li>
            <li><Icon name="circle-check" style={{ color: 'var(--success)' }} /> 10-minute time limit</li>
            <li><Icon name="exclamation-triangle" style={{ color: 'var(--warning)' }} /> Tab switches are recorded</li>
            <li><Icon name="exclamation-triangle" style={{ color: 'var(--error)' }} /> {MAX_TAB_SWITCHES} tab switches auto-submits and locks for 48 hours</li>
          </ul>
          <div style={{ marginTop: 'var(--space-6)' }}>
            <Button onClick={confirmStartBlock} style={{ width: '100%' }}>I understand, let's begin!</Button>
          </div>
        </Modal>
      </div>
    </div>
  );
} 
