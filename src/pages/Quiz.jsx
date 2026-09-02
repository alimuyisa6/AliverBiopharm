 // src/pages/Quiz.jsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useRequireOnboarding } from '../hooks/useRequireOnboarding';
import { useLevelFilter } from '../hooks/useLevelFilter';
import { useContentAccess } from '../hooks/useContentAccess';
import { useSecurityUiLock } from '../hooks/useSecurityUiLock';
import { useToast } from '../components/Toast/Toast';
import {
  listQuizTopics,
  getQuizBlock,
  checkDailyRetry,
  checkQuizAnswer,
  recordDailyVisit,
  getUserStreak,
  startQuizSession,
  trackTabSwitch,
  submitQuizWithSession
} from '../api/cachedClient';
import { apiCall } from '../api/client';
import { PendingApprovalScreen } from '../components/access/PendingApprovalScreen';
import { AccessDenied } from '../components/access/AccessDenied';
import QuizHero from '../components/quiz/QuizHero';
import QuizDashboard from '../components/quiz/QuizDashboard';
import QuizChallenges from '../components/quiz/QuizChallenges';
import QuizLearningPath from '../components/quiz/QuizLearningPath';
import QuizWeakAreas from '../components/quiz/QuizWeakAreas';
import Icon from '../components/Icon/Icon';
import Spinner from '../components/Spinner/Spinner';
import Skeleton from '../components/Skeleton/Skeleton';
import ProgressBar from '../components/ProgressBar/ProgressBar';
import Button from '../components/Button/Button';
import Card from '../components/Card/Card';
import Modal from '../components/Modal/Modal';

function createIdempotencyKey(prefix = 'quiz') {
  try {
    return `${prefix}_${crypto.randomUUID()}`;
  } catch {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  }
}

export default function Quiz() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { isReady } = useRequireOnboarding();
  const access = useContentAccess();
  const { locked, reason } = useSecurityUiLock();
  const { level, class_name, displayName } = useLevelFilter();
  const addToast = useToast();

  const activeGroupId = profile?.active_group_id;

  const [activeUnitId, setActiveUnitId] = useState(null);
  const [currentTopic, setCurrentTopic] = useState('');
  const [allTopics, setAllTopics] = useState([]);
  const [topicsLoading, setTopicsLoading] = useState(true);
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
  const [timeLeft, setTimeLeft] = useState(null);
  const [answerSubmitting, setAnswerSubmitting] = useState(false);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [maxTabSwitches, setMaxTabSwitches] = useState(3);
  const [integrityOverlay, setIntegrityOverlay] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [quizMode, setQuizMode] = useState('study');

  const heartbeatRef = useRef(null);

  useEffect(() => {
    setActiveUnitId(null);
    setCurrentTopic('');
    setQuizQuestions([]);
    setUserAnswers([]);
    setCurrentIndex(0);
    setCurrentBlock(0);
    setTotalBlocks(0);
    setResultData(null);
    setTimeLeft(null);
    setIntegrityOverlay(null);
    setAnswerSubmitting(false);
    setSessionId(null);
  }, [activeGroupId]);

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

    setTopicsLoading(true);

    listQuizTopics(activeGroupId)
      .then((res) => setAllTopics(Array.isArray(res?.topics) ? res.topics : []))
      .catch(() => {})
      .finally(() => setTopicsLoading(false));
  }, [isReady, access.canAccess, access.isPending, activeGroupId]);

  useEffect(() => {
    if (timeLeft === null || resultData) return;

    if (timeLeft <= 0) {
      submitBlock();
      return;
    }

    const id = setInterval(() => {
      setTimeLeft((current) => (current === null ? current : current - 1));
    }, 1000);

    return () => clearInterval(id);
  }, [timeLeft, resultData]);

  useEffect(() => {
    if (!sessionId || resultData) return;

    const sendHeartbeat = () => {
      apiCall('quiz', 'quiz_heartbeat', {
        session_id: sessionId,
        client_timestamp: new Date().toISOString(),
        idempotency_key: createIdempotencyKey('heartbeat')
      }).catch(() => {});
    };

    sendHeartbeat();

    heartbeatRef.current = setInterval(sendHeartbeat, 30000);

    return () => clearInterval(heartbeatRef.current);
  }, [sessionId, resultData]);

  useEffect(() => {
    if (!activeUnitId || !quizQuestions.length || resultData) return;

    const onVisibilityChange = async () => {
      if (document.visibilityState !== 'hidden') return;

      try {
        const result = await trackTabSwitch(activeUnitId, currentBlock, createIdempotencyKey('tab'));

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
      setSessionId(null);
    }, 10000);

    return () => clearTimeout(id);
  }, [integrityOverlay]);

  const getFirstUnansweredIndex = useCallback((answers) => {
    return answers.findIndex((answer) => answer === null);
  }, []);

  const canNavigateTo = useCallback((targetIndex, answers) => {
    if (answers[targetIndex] !== null) return true;

    return targetIndex === answers.findIndex((answer) => answer === null);
  }, []);

  const navigateTo = (index) => setCurrentIndex(index);

  const selectAnswer = async (optionLetter) => {
    if (locked || userAnswers[currentIndex] !== null || answerSubmitting) return;

    setAnswerSubmitting(true);

    const question = quizQuestions[currentIndex];

    try {
      const result = await checkQuizAnswer({
        unit_id: activeUnitId,
        block_number: currentBlock,
        question_id: question.id,
        selected_option: optionLetter,
        idempotency_key: createIdempotencyKey('answer')
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
        explanation: result.explanation || null
      };

      setUserAnswers(newAnswers);

      const firstUnanswered = newAnswers.findIndex((answer) => answer === null);

      if (firstUnanswered !== -1 && firstUnanswered !== currentIndex) {
        navigateTo(firstUnanswered);
      }
    } catch (error) {
      addToast(error.message || 'Failed to verify answer', 'error');
    } finally {
      setAnswerSubmitting(false);
    }
  };

  const submitBlock = async () => {
    if (locked || !quizQuestions.length) return;

    const answersPayload = quizQuestions.map((question, index) => ({
      id: question.id,
      selectedOption: userAnswers[index]?.selected || 'X'
    }));

    setLoading(true);

    try {
      const result = await submitQuizWithSession(
        activeUnitId,
        currentBlock,
        answersPayload,
        null,
        createIdempotencyKey('submit')
      );

      setTimeLeft(null);
      setResultData(result);
      setSessionId(null);

      const topicsRes = await listQuizTopics(activeGroupId);

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
    if (locked || !user) {
      addToast(locked ? reason || 'Action temporarily disabled' : 'Please sign in.', 'error');
      return;
    }

    if (!activeUnitId) {
      addToast('Select a topic first.', 'error');
      return;
    }

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
      const session = await startQuizSession(activeUnitId, blockNum, {
        mode: quizMode,
        idempotency_key: createIdempotencyKey('start')
      });

      setSessionId(session.session_id || null);
      setQuizMode(session.mode || 'study');
      setTabSwitchCount(session.tab_switches || 0);
      setMaxTabSwitches(session.max_allowed || 3);

      const data = await getQuizBlock(activeUnitId, blockNum);

      if (!data?.questions?.length) {
        addToast('No questions available.', 'error');
        return;
      }

      setQuizQuestions(data.questions);

      const priorAnswers = (data.prior_answers || []).map((answer) => (
        answer ? { selected: answer.selected, correct: answer.correct } : null
      ));

      setUserAnswers(
        priorAnswers.length === data.questions.length
          ? priorAnswers
          : new Array(data.questions.length).fill(null)
      );

      setCurrentIndex(0);
      setResultData(null);
      setTimeLeft(data.time_left ?? 600);
    } catch {
      addToast('Failed to load block', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!isReady || access.loading) {
    return (
      <div className="fcd-loading-wrap">
        <Spinner context="brand" size="lg" />
      </div>
    );
  }

  if (access.isPending) return <PendingApprovalScreen />;
  if (!access.canAccess) return <AccessDenied />;

  if (loading && !quizQuestions.length && !resultData && !currentTopic) {
    return (
      <div className="fcd-loading-wrap">
        <Spinner context="brand" size="lg" />
      </div>
    );
  }

  const firstUnanswered = getFirstUnansweredIndex(userAnswers);
  const allAnswered = userAnswers.length > 0 && userAnswers.every((answer) => answer !== null);
  const timerPercent = timeLeft !== null ? (timeLeft / 600) * 100 : 100;
  const timerClass = timerPercent > 50 ? 'is-good' : timerPercent > 20 ? 'is-warn' : 'is-danger';

  return (
    <div className="quiz-page">
      <div className="section quiz-page-section">
        <span className="eyebrow">Assessments</span>
        <h1 className="section-title quiz-page-title">
          Knowledge Quizzes<br />{displayName ? `– ${displayName}` : ''}
        </h1>

        <h2
          style={{
            fontSize: 'var(--text-base)',
            fontWeight: 'var(--weight-normal)',
            color: 'var(--text-dim)',
            lineHeight: 'var(--leading-relaxed)',
            marginBottom: 'var(--space-4)'
          }}
        >
          Test your understanding with subject‑specific quizzes. Each block contains 10 questions – answer them all and aim for 70% to pass. Review your answers and track your progress as you go.
        </h2>

        {class_name && <p className="quiz-group-label">Current group: {class_name}</p>}

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
        </nav>

        {!currentTopic && (
          <>
            <QuizHero level={level} class_name={class_name} />
            {user && <QuizDashboard user={user} level={level} class_name={class_name} groupId={activeGroupId} />}
            {user && <QuizChallenges user={user} groupId={activeGroupId} />}
            <QuizLearningPath level={level} class_name={class_name} groupId={activeGroupId} />
            <QuizWeakAreas user={user} level={level} class_name={class_name} groupId={activeGroupId} />
          </>
        )}

        {!currentTopic ? (
          <>
            <div className="quiz-section-heading" style={{ marginTop: 'var(--space-8)' }}>
              <Icon name="layer-group" />
              <span>Available Topics</span>
            </div>

            <h2
              style={{
                fontSize: 'var(--text-base)',
                fontWeight: 'var(--weight-normal)',
                color: 'var(--text-dim)',
                lineHeight: 'var(--leading-relaxed)',
                marginBottom: 'var(--space-5)'
              }}
            >
              Choose a topic to start a quiz block. Completed blocks are marked with a check.
            </h2>

            <div className="grid grid-cols-3">
              {topicsLoading ? (
                Array.from({ length: 6 }).map((_, index) => (
                  <Card key={index} variant="round" loading={true} loadingLines={2} />
                ))
              ) : allTopics.length === 0 ? (
                <div className="quiz-empty-topics" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 'var(--space-8)' }}>
                  <Icon name="layer-group" style={{ fontSize: '2rem', color: 'var(--text-muted)', marginBottom: 'var(--space-3)' }} />
                  <p style={{ color: 'var(--text-muted)' }}>No topics available at the moment.</p>
                </div>
              ) : (
                allTopics.map((topic) => {
                  const hasQuestions = (topic.question_count || 0) > 0 && (topic.total_blocks || 0) > 0;
                  const allDone = topic.all_done ?? (hasQuestions && topic.completed_blocks?.length === topic.total_blocks);

                  if (hasQuestions && !allDone) {
                    return (
                      <Card
                        key={topic.unit_id}
                        image={topic.topic_image_url}
                        title={topic.topic_name}
                        description={`${topic.question_count} questions • ${topic.total_blocks} blocks`}
                        footer={
                          <Button variant="primary" size="sm" onClick={() => openTopicBlocks(topic)} disabled={locked}>
                            Start
                          </Button>
                        }
                      />
                    );
                  }

                  return (
                    <Card
                      key={topic.unit_id}
                      image={topic.topic_image_url}
                      title={topic.topic_name}
                      description={`${topic.question_count} questions`}
                      className="card-compact"
                    />
                  );
                })
              )}
            </div>
          </>
        ) : resultData ? (
          <div className="quiz-result-container">
            <Card variant="flat" className="quiz-result-card">
              <Icon
                name={resultData.passed ? 'trophy' : 'book-open'}
                className={`quiz-result-icon ${resultData.passed ? 'is-pass' : 'is-fail'}`}
              />
              <h2>{resultData.passed ? `Congratulations, ${user?.full_name || 'Learner'}!` : 'Block Complete'}</h2>
              <div className={`quiz-result-score ${resultData.passed ? 'is-pass' : 'is-fail'}`}>
                {resultData.percentage}%
              </div>
              <p>{resultData.score}/{resultData.total} correct</p>

              {resultData.retry_available && (
                <Button variant="secondary" size="sm" onClick={() => openTopicBlocks({ topic_name: currentTopic, unit_id: activeUnitId, total_blocks: totalBlocks })}>
                  Retry Wrong Questions
                </Button>
              )}
            </Card>

            <div className="quiz-review-section">
              <h3 className="quiz-review-heading">Block {currentBlock + 1} Review – {currentTopic}</h3>

              {(resultData.answers || []).map((answer, idx) => (
                <Card key={idx} variant="flat" className="quiz-review-card">
                  <div className="quiz-review-header">
                    <Icon
                      name={answer.isCorrect ? 'circle-check' : 'circle-xmark'}
                      className={`icon ${answer.isCorrect ? 'is-correct' : 'is-incorrect'}`}
                    />
                    <span className="quiz-review-qnum">Q{idx + 1}</span>
                  </div>
                  <p>{answer.question}</p>
                  <p className={`quiz-review-answer ${answer.isCorrect ? 'is-correct' : 'is-incorrect'}`}>
                    Your answer: {answer.userAnswerText}
                  </p>
                  {!answer.isCorrect && <p className="quiz-review-correct-answer">Correct: {answer.correctAnswerText}</p>}
                  {answer.explanation && <p className="quiz-review-explanation">{answer.explanation}</p>}
                </Card>
              ))}
            </div>

            <div className="quiz-result-actions">
              {currentBlock + 1 < totalBlocks && (
                <Button variant="primary" onClick={() => startBlock(currentBlock + 1)} disabled={locked}>
                  Next Block <Icon name="arrow-right" />
                </Button>
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

                if (userAnswers[idx]) {
                  cls = userAnswers[idx].correct ? 'btn btn-sm btn-success' : 'btn btn-sm btn-danger';
                }

                return (
                  <button
                    key={idx}
                    className={`${cls} ${idx === currentIndex ? 'btn-secondary' : ''} quiz-nav-pill`}
                    onClick={() => {
                      if (!canNavigateTo(idx, userAnswers)) {
                        addToast('Answer previous questions first', 'warning');
                      } else {
                        navigateTo(idx);
                      }
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

            <ProgressBar value={currentIndex + 1} max={quizQuestions.length} variant="gradient" />
            <p className="quiz-progress-label">
              Block {currentBlock + 1} • Q {currentIndex + 1}/{quizQuestions.length} – {currentTopic}
            </p>

            {answerSubmitting && (
              <div className="quiz-answering-indicator">
                <Spinner context="conic" size="sm" />
                <span className="quiz-spinner-label">Checking</span>
              </div>
            )}

            <Card
              image={quizQuestions[currentIndex].image_url}
              className="quiz-question-card"
            >
              <h3 className="quiz-question-heading">{quizQuestions[currentIndex].question_text}</h3>

              <div className="quiz-options-list">
                {['A', 'B', 'C', 'D'].map((option) => {
                  const answered = userAnswers[currentIndex] !== null;
                  const selected = userAnswers[currentIndex]?.selected;
                  const correctOption = userAnswers[currentIndex]?.correct_option;

                  let cls = 'btn btn-secondary';

                  if (answered) {
                    if (option === correctOption) cls = 'btn btn-success';
                    else if (option === selected) cls = 'btn btn-danger';
                  }

                  return (
                    <button
                      key={option}
                      className={`${cls} quiz-option-btn`}
                      onClick={() => selectAnswer(option)}
                      disabled={answered || answerSubmitting || locked}
                    >
                      <span className="quiz-option-letter">{option}.</span>
                      <span>{quizQuestions[currentIndex][`option_${option.toLowerCase()}`]}</span>
                      {answered && option === correctOption && <Icon name="circle-check" className="quiz-option-icon" />}
                      {answered && option === selected && option !== correctOption && <Icon name="circle-xmark" className="quiz-option-icon" />}
                    </button>
                  );
                })}
              </div>

              {quizMode === 'study' && userAnswers[currentIndex]?.explanation && (
                <div className="quiz-review-explanation">
                  {userAnswers[currentIndex].explanation}
                </div>
              )}
            </Card>

            <div className="quiz-nav-buttons">
              <Button variant="secondary" onClick={() => { if (currentIndex > 0) navigateTo(currentIndex - 1); }} disabled={currentIndex === 0}>
                <Icon name="arrow-left" /> Prev
              </Button>

              {userAnswers[currentIndex] !== null && (
                firstUnanswered !== -1 && firstUnanswered !== currentIndex ? (
                  <Button variant="primary" onClick={() => navigateTo(firstUnanswered)}>Next <Icon name="arrow-right" /></Button>
                ) : currentIndex < quizQuestions.length - 1 ? (
                  <Button variant="primary" onClick={() => navigateTo(currentIndex + 1)}>Next <Icon name="arrow-right" /></Button>
                ) : allAnswered ? (
                  <Button variant="primary" onClick={submitBlock} disabled={locked}>Submit Block</Button>
                ) : null
              )}
            </div>
          </div>
        ) : (
          <div className="quiz-blocks-page">
            <h2 className="quiz-blocks-heading">{currentTopic}</h2>
            <p className="quiz-blocks-sub">{class_name ? `${class_name} – ` : ''}Select a block to start</p>

            {totalBlocks === 0 ? (
              <p className="quiz-blocks-empty">No blocks available.</p>
            ) : (
              <div className="quiz-blocks-grid">
                {Array.from({ length: totalBlocks }).map((_, index) => {
                  const topicData = allTopics.find((topic) => topic.topic_name === currentTopic);
                  const lockedBlock = topicData?.locked_blocks?.includes(index);
                  const completed = topicData?.completed_blocks?.includes(index);

                  return (
                    <button
                      key={index}
                      className={`btn ${completed ? 'btn-success' : lockedBlock ? 'btn-ghost' : 'btn-secondary'}`}
                      disabled={lockedBlock || locked}
                      onClick={() => startBlock(index)}
                    >
                      {completed ? <Icon name="circle-check" /> : lockedBlock ? <Icon name="lock" /> : <Icon name="play" />}
                      Block {index + 1}
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
            <li><Icon name="circle-check" className="quiz-rules-icon is-success" /> <span>10 questions per block</span></li>
            <li><Icon name="circle-check" className="quiz-rules-icon is-success" /> <span>70% to pass</span></li>
            <li><Icon name="circle-check" className="quiz-rules-icon is-success" /> <span>Immediate feedback</span></li>
            <li><Icon name="circle-check" className="quiz-rules-icon is-success" /> <span>Full explanations on review</span></li>
            <li><Icon name="circle-check" className="quiz-rules-icon is-success" /> <span>10-minute time limit</span></li>
            <li><Icon name="exclamation-triangle" className="quiz-rules-icon is-warning" /> <span>Tab switches are recorded</span></li>
            <li><Icon name="exclamation-triangle" className="quiz-rules-icon is-error" /> <span>3 tab switches auto-submits</span></li>
          </ul>
          <div className="quiz-rules-submit">
            <Button variant="primary" onClick={confirmStartBlock} className="quiz-rules-submit-btn">Start</Button>
          </div>
        </Modal>
      </div>
    </div>
  );
}
