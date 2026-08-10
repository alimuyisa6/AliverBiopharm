import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useRequireOnboarding } from '../hooks/useRequireOnboarding';
import { useLevelFilter } from '../hooks/useLevelFilter';
import { useContentAccess } from '../hooks/useContentAccess';
import { useToast } from '../components/Toast/Toast';
import {
  listQuizTopics, getQuizBlock, checkDailyRetry, checkQuizAnswer,
  recordDailyVisit, getUserStreak,
  getLeaderboard, startQuizSession, trackTabSwitch, submitQuizWithSession,
} from '../api/cachedClient';
import { PendingApprovalScreen } from '../components/access/PendingApprovalScreen';
import { AccessDenied } from '../components/access/AccessDenied';

import QuizHero from "../components/quiz/QuizHero";
import QuizDashboard from "../components/quiz/QuizDashboard";
import QuizChallenges from "../components/quiz/QuizChallenges";
import QuizLearningPath from "../components/quiz/QuizLearningPath";
import QuizWeakAreas from "../components/quiz/QuizWeakAreas";
import Icon from '../components/Icon/Icon';
import Spinner from '../components/Spinner/Spinner';
import ProgressBar from '../components/ProgressBar/ProgressBar';
import Button from '../components/Button/Button';
import Modal from '../components/Modal/Modal';
import Input from '../components/Input/Input';

export default function Quiz() {
  const { user } = useAuth();
  const { isReady } = useRequireOnboarding();
  const access = useContentAccess();
  const { level, class_name, displayName } = useLevelFilter();
  const addToast = useToast();

  const [activeUnitId, setActiveUnitId] = useState(null);
  const [currentTopic, setCurrentTopic] = useState('');
  const [allTopics, setAllTopics] = useState([]);
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [userAnswers, setUserAnswers] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentBlock, setCurrentBlock] = useState(0);
  const [totalBlocks, setTotalBlocks] = useState(0);
  const [resultData, setResultData] = useState(null);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [pendingBlock, setPendingBlock] = useState(null);
  const [loading, setLoading] = useState(true);
  const [streak, setStreak] = useState(0);
  const [topicSearch, setTopicSearch] = useState('');
  const [timeLeft, setTimeLeft] = useState(null);
  const [confidence, setConfidence] = useState([]);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);
  const [answerSubmitting, setAnswerSubmitting] = useState(false);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [maxTabSwitches, setMaxTabSwitches] = useState(3);
  const [integrityOverlay, setIntegrityOverlay] = useState(null);

  const SPINNER_WORDS = ['Reviewing...', 'Checking...', 'Analyzing...', 'Verifying...', 'Processing...'];

  useEffect(() => {
    if (!isReady || !access.canAccess || access.isPending) return;
    (async () => {
      try {
        setLoading(true);
        if (user) {
          await recordDailyVisit();
          const streakData = await getUserStreak();
          setStreak(streakData?.count || 0);
        }
      } catch {
        addToast('Failed to load data', 'error');
      } finally {
        setLoading(false);
      }
    })();
  }, [isReady, access.canAccess, access.isPending, user]);

  useEffect(() => {
    if (!isReady || !access.canAccess || access.isPending) return;
    listQuizTopics()
      .then(res => setAllTopics(Array.isArray(res?.topics) ? res.topics : []))
      .catch(() => {});
  }, [isReady, access.canAccess, access.isPending]);

  useEffect(() => {
    if (timeLeft === null || resultData) return;
    if (timeLeft <= 0) {
      submitBlock();
      return;
    }
    const id = setInterval(() => setTimeLeft(t => (t === null ? t : t - 1)), 1000);
    return () => clearInterval(id);
  }, [timeLeft, resultData]);

  useEffect(() => {
    if (!activeUnitId || !quizQuestions.length || resultData) return;
    const onVisibilityChange = async () => {
      if (document.visibilityState !== 'hidden') return;
      try {
        const result = await trackTabSwitch(activeUnitId, currentBlock);
        setTabSwitchCount(result.tab_switches ?? tabSwitchCount + 1);
        setMaxTabSwitches(result.max_allowed ?? maxTabSwitches);
        if (result.auto_submitted) {
          setIntegrityOverlay(result.message || 'Quiz locked due to a tab-switch violation.');
        }
      } catch {
        addToast('Failed to record tab switch', 'error');
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [activeUnitId, currentBlock, quizQuestions.length, resultData, tabSwitchCount, maxTabSwitches]);

  useEffect(() => {
    if (!integrityOverlay) return;
    const id = setTimeout(() => {
      setIntegrityOverlay(null);
      setCurrentTopic('');
      setQuizQuestions([]);
      setResultData(null);
    }, 10000);
    return () => clearTimeout(id);
  }, [integrityOverlay]);

  const filteredTopics = useMemo(() => {
    if (!Array.isArray(allTopics)) return [];
    return allTopics.filter(t =>
      !topicSearch || t.topic_name?.toLowerCase().includes(topicSearch.toLowerCase())
    );
  }, [allTopics, topicSearch]);

  const getFirstUnansweredIndex = useCallback((answers) => answers.findIndex(a => a === null), []);
  const canNavigateTo = useCallback((targetIndex, answers) => {
    if (answers[targetIndex] !== null) return true;
    return targetIndex === answers.findIndex(a => a === null);
  }, []);

  const navigateTo = (idx) => setCurrentIndex(idx);

  const setConfidenceForCurrent = (lvl) => {
    const next = [...confidence];
    next[currentIndex] = lvl;
    setConfidence(next);
  };

  const selectAnswer = async (optionLetter) => {
    if (userAnswers[currentIndex] !== null || answerSubmitting) return;
    setAnswerSubmitting(true);
    const q = quizQuestions[currentIndex];
    try {
      const result = await checkQuizAnswer({
        unit_id: activeUnitId,
        block_number: currentBlock,
        question_id: q.id,
        selected_option: optionLetter,
      });
      if (result.auto_submitted) {
        setIntegrityOverlay('Time limit exceeded. This block was auto-submitted.');
        return;
      }
      const newAnswers = [...userAnswers];
      newAnswers[currentIndex] = {
        selected: optionLetter,
        correct: result.correct,
        correct_option: result.correct_option,
        correct_answer_text: result.correct_answer_text,
      };
      setUserAnswers(newAnswers);
      goToNextUnanswered(newAnswers, currentIndex);
    } catch {
      addToast('Failed to verify answer', 'error');
    } finally {
      setAnswerSubmitting(false);
    }
  };

  const goToNextUnanswered = (answers, currentIdx) => {
    const first = answers.findIndex(a => a === null);
    if (first !== -1 && first !== currentIdx) navigateTo(first);
  };

  const submitBlock = async () => {
    if (!quizQuestions.length) return;
    const answersPayload = quizQuestions.map((q, idx) => ({
      id: q.id,
      selectedOption: userAnswers[idx]?.selected || 'X',
    }));
    setLoading(true);
    try {
      const result = await submitQuizWithSession(activeUnitId, currentBlock, answersPayload);
      setTimeLeft(null);
      setResultData(result);
      const topicsRes = await listQuizTopics();
      setAllTopics(Array.isArray(topicsRes?.topics) ? topicsRes.topics : []);
    } catch {
      addToast('Submission failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const openTopicBlocks = (topic) => {
    setCurrentTopic(topic.topic_name);
    setActiveUnitId(topic.unit_id);
    setTotalBlocks(Number(topic.total_blocks) || 0);
    setQuizQuestions([]);
    setResultData(null);
  };

  const startBlock = async (blockNum) => {
    if (!user) { addToast('Please sign in.', 'error'); return; }
    if (!activeUnitId) { addToast('Select a topic first.', 'error'); return; }
    const retry = await checkDailyRetry(activeUnitId, blockNum).catch(() => null);
    if (retry && !retry.can_retry) {
      addToast(retry.reason || 'Block locked.', 'error');
      return;
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
      const session = await startQuizSession(activeUnitId, blockNum);
      setTabSwitchCount(session.tab_switches || 0);
      setMaxTabSwitches(session.max_allowed || 3);
      const data = await getQuizBlock(activeUnitId, blockNum);
      if (!data?.questions?.length) {
        addToast('No questions available.', 'error');
        return;
      }
      setQuizQuestions(data.questions);
      const priorAnswers = (data.prior_answers || []).map(a => a ? { selected: a.selected, correct: a.correct } : null);
      setUserAnswers(priorAnswers.length === data.questions.length ? priorAnswers : new Array(data.questions.length).fill(null));
      setConfidence(new Array(data.questions.length).fill(null));
      setCurrentIndex(0);
      setResultData(null);
      setTimeLeft(data.time_left ?? 600);
    } catch {
      addToast('Failed to load block', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadLeaderboard = async () => {
    const data = await getLeaderboard(level || 'O-Level', 10).catch(() => []);
    setLeaderboard(Array.isArray(data) ? data : []);
  };

  if (!isReady || access.loading) return (
    <div className="fcd-loading-wrap">
      <Spinner size="lg" />
    </div>
  );
  if (access.isPending) return <PendingApprovalScreen />;
  if (!access.canAccess) return <AccessDenied />;

  if (loading && !quizQuestions.length && !resultData && !currentTopic) {
    return (
      <div className="fcd-loading-wrap">
        <Spinner size="lg" />
      </div>
    );
  }

  const firstUnanswered = getFirstUnansweredIndex(userAnswers);
  const allAnswered = userAnswers.length > 0 && userAnswers.every(a => a !== null);
  const timerPercent = timeLeft !== null ? (timeLeft / 600) * 100 : 100;
  const timerClass = timerPercent > 50 ? 'is-good' : timerPercent > 20 ? 'is-warn' : 'is-danger';

  return (
    <div className="quiz-page">
      <div className="section quiz-page-section">
        <span className="sec-label">Assessments</span>
        <h1 className="section-title quiz-page-title">
          Knowledge Quizzes {displayName ? `– ${displayName}` : ''}
        </h1>
        {class_name && (
          <p className="quiz-group-label">
            Current group: {class_name}
          </p>
        )}

        {user && streak > 0 && (
          <div className="quiz-streak-row">
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
            <QuizHero level={level} class_name={class_name} />
            {user && <QuizDashboard user={user} level={level} class_name={class_name} />}
            {user && <QuizChallenges user={user} />}
            <QuizLearningPath level={level} class_name={class_name} />
            <QuizWeakAreas
              user={user}
              onRecommend={(topicName, block) => {
                const match = allTopics.find(t => t.topic_name === topicName);
                if (!match) { addToast('That topic is not available right now.', 'error'); return; }
                openTopicBlocks(match);
                startBlock(block);
              }}
              level={level}
              class_name={class_name}
            />
          </>
        )}

        {!currentTopic ? (
          <>
            <div className="quiz-topic-controls">
              <Input
                placeholder="Search topics..."
                value={topicSearch}
                onChange={e => setTopicSearch(e.target.value)}
                icon="magnifying-glass"
              />
              <Button variant="secondary" onClick={() => { setShowLeaderboard(true); loadLeaderboard(); }}>
                <Icon name="trophy" /> Leaderboard
              </Button>
            </div>

            <div className="grid grid-cols-3">
              {filteredTopics.length === 0 && (
                <div className="quiz-empty-topics">
                  <Icon name="magnifying-glass" className="quiz-empty-icon" />
                  <p>No topics match your search.</p>
                </div>
              )}
              {filteredTopics.map(topic => {
                const hasQuestions = (topic.question_count || 0) > 0 && (topic.total_blocks || 0) > 0;
                const allDone = topic.all_done ?? (hasQuestions && topic.completed_blocks?.length === topic.total_blocks);
                if (hasQuestions && !allDone) {
                  return (
                    <button key={topic.unit_id} className="card card-clickable" onClick={() => openTopicBlocks(topic)}>
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
                  <div key={topic.unit_id} className="card">
                    <div className="card-body">
                      <h3 className="card-title">{topic.topic_name}</h3>
                      <p className="card-text">{topic.question_count} questions</p>
                      <p className="quiz-topic-status">
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
            <div className="card quiz-result-card">
              <Icon name={resultData.passed ? 'trophy' : 'book-open'} className={`quiz-result-icon ${resultData.passed ? 'is-pass' : 'is-fail'}`} />
              <h2>{resultData.passed ? `Congratulations, ${user?.full_name || 'Learner'}!` : 'Block Complete'}</h2>
              <div className={`quiz-result-score ${resultData.passed ? 'is-pass' : 'is-fail'}`}>
                {resultData.percentage}%
              </div>
              <p>{resultData.score}/{resultData.total} correct</p>
              <span className={`badge ${resultData.passed ? 'badge-success' : 'badge-error'}`}>
                <Icon name={resultData.passed ? 'circle-check' : 'circle-xmark'} />
                {resultData.passed ? 'Passed' : 'Not passed'}
              </span>
              {resultData.tab_switches > 0 && (
                <p className="quiz-tabswitch-warning">
                  <Icon name="exclamation-triangle" /> {resultData.tab_switches} tab switch{resultData.tab_switches > 1 ? 'es' : ''} recorded
                </p>
              )}
            </div>

            <div className="quiz-review-section">
              <h3 className="quiz-review-heading">Block {currentBlock + 1} Review – {currentTopic}</h3>
              {(resultData.answers || []).map((a, idx) => (
                <div key={idx} className="card quiz-review-card">
                  <div className="quiz-review-header">
                    <Icon name={a.isCorrect ? 'circle-check' : 'circle-xmark'} className={`icon ${a.isCorrect ? 'is-correct' : 'is-incorrect'}`} />
                    <span className="quiz-review-qnum">Q{idx + 1}</span>
                  </div>
                  <p dangerouslySetInnerHTML={{ __html: a.question }} />
                  <p className={`quiz-review-answer ${a.isCorrect ? 'is-correct' : 'is-incorrect'}`}>Your answer: {a.userAnswerText}</p>
                  {!a.isCorrect && <p className="quiz-review-correct-answer">Correct: {a.correctAnswerText}</p>}
                  {a.explanation && <p className="quiz-review-explanation" dangerouslySetInnerHTML={{ __html: a.explanation }} />}
                </div>
              ))}
            </div>

            <div className="quiz-result-actions">
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
            {integrityOverlay && (
              <div className="quiz-integrity-overlay">
                <Icon name="exclamation-triangle" />
                <p>{integrityOverlay}</p>
              </div>
            )}

            <div className="quiz-nav-pills">
              {quizQuestions.map((_, idx) => {
                let cls = 'btn btn-sm btn-ghost';
                if (userAnswers[idx]) cls = userAnswers[idx].correct ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-danger';
                return (
                  <button
                    key={idx}
                    className={cls + (idx === currentIndex ? ' btn-accent' : '') + ' quiz-nav-pill'}
                    onClick={() => {
                      if (!canNavigateTo(idx, userAnswers)) addToast('Answer previous questions first', 'warning');
                      else navigateTo(idx);
                    }}
                    disabled={!canNavigateTo(idx, userAnswers)}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            {timeLeft !== null && (
              <div className="quiz-timer-row">
                <div className="quiz-timer-header">
                  <span className="quiz-timer-label">Time remaining</span>
                  <span className={`quiz-timer-value ${timerClass}`}>
                    {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
                  </span>
                </div>
                <ProgressBar value={timeLeft} max={600} variant="primary" />
              </div>
            )}

            {tabSwitchCount > 0 && (
              <p className="quiz-tabswitch-warning">
                <Icon name="exclamation-triangle" /> {tabSwitchCount}/{maxTabSwitches} tab switches
              </p>
            )}

            <ProgressBar value={currentIndex + 1} max={quizQuestions.length} variant="gradient" />
            <p className="quiz-progress-label">
              Block {currentBlock + 1} • Q {currentIndex + 1}/{quizQuestions.length} – {currentTopic}
            </p>

            {answerSubmitting && (
              <div className="quiz-answering-indicator">
                <Spinner size="sm" />
                <span className="quiz-spinner-label">{SPINNER_WORDS[Math.floor(Math.random() * SPINNER_WORDS.length)]}</span>
              </div>
            )}

            <div className="card quiz-question-card">
              <h3 className="quiz-question-heading" dangerouslySetInnerHTML={{ __html: quizQuestions[currentIndex].question_text }} />

              <div className="quiz-options-list">
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
                      className={cls + ' quiz-option-btn'}
                      onClick={() => selectAnswer(opt)}
                      disabled={answered || answerSubmitting}
                    >
                      <span className="quiz-option-letter">{opt}.</span>
                      <span dangerouslySetInnerHTML={{ __html: quizQuestions[currentIndex][`option_${opt.toLowerCase()}`] }} />
                      {answered && opt === correctOpt && <Icon name="circle-check" className="quiz-option-icon" />}
                      {answered && opt === selected && opt !== correctOpt && <Icon name="circle-xmark" className="quiz-option-icon" />}
                    </button>
                  );
                })}
              </div>

              {userAnswers[currentIndex] === null && (
                <div className="quiz-confidence-row">
                  <span className="quiz-confidence-label">Confidence:</span>
                  <Button variant="ghost" size="sm" onClick={() => setConfidenceForCurrent('sure')}>
                    <Icon name={confidence[currentIndex] === 'sure' ? 'circle-check' : 'circle'} /> Sure
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setConfidenceForCurrent('unsure')}>
                    <Icon name={confidence[currentIndex] === 'unsure' ? 'circle-check' : 'circle'} /> Unsure
                  </Button>
                </div>
              )}
            </div>

            <div className="quiz-nav-buttons">
              <Button variant="secondary" onClick={() => { if (currentIndex > 0) navigateTo(currentIndex - 1); }} disabled={currentIndex === 0}>
                <Icon name="arrow-left" /> Prev
              </Button>
              {userAnswers[currentIndex] !== null && (
                firstUnanswered !== -1 && firstUnanswered !== currentIndex ? (
                  <Button onClick={() => navigateTo(firstUnanswered)}>Next <Icon name="arrow-right" /></Button>
                ) : currentIndex < quizQuestions.length - 1 ? (
                  <Button onClick={() => navigateTo(currentIndex + 1)}>Next <Icon name="arrow-right" /></Button>
                ) : allAnswered ? (
                  <Button onClick={submitBlock}>Submit Block</Button>
                ) : null
              )}
            </div>
          </div>
        ) : (
          <div className="quiz-blocks-page">
            <h2 className="quiz-blocks-heading">{currentTopic}</h2>
            <p className="quiz-blocks-sub">
              {class_name ? `${class_name} – ` : ''}Select a block to start
            </p>
            {totalBlocks === 0 ? (
              <p className="quiz-blocks-empty">No blocks available.</p>
            ) : (
              <div className="quiz-blocks-grid">
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
            <Button variant="ghost" className="quiz-back-btn" onClick={() => setCurrentTopic('')}>
              <Icon name="arrow-left" /> Back
            </Button>
          </div>
        )}

        <Modal open={showRulesModal} onClose={() => setShowRulesModal(false)} title="Quiz Rules">
          <ul className="quiz-rules-list">
            <li><Icon name="circle-check" className="quiz-rules-icon is-success" /> 10 questions per block</li>
            <li><Icon name="circle-check" className="quiz-rules-icon is-success" /> 70% to pass</li>
            <li><Icon name="circle-check" className="quiz-rules-icon is-success" /> Immediate feedback</li>
            <li><Icon name="circle-check" className="quiz-rules-icon is-success" /> Full explanations on review</li>
            <li><Icon name="circle-check" className="quiz-rules-icon is-success" /> 10-minute time limit</li>
            <li><Icon name="exclamation-triangle" className="quiz-rules-icon is-warning" /> Tab switches are recorded</li>
            <li><Icon name="exclamation-triangle" className="quiz-rules-icon is-error" /> 3 tab switches auto-submits and locks for 48 hours</li>
          </ul>
          <div className="quiz-rules-submit">
            <Button onClick={confirmStartBlock} className="quiz-rules-submit-btn">I understand, let's begin!</Button>
          </div>
        </Modal>
      </div>
    </div>
  );
}
