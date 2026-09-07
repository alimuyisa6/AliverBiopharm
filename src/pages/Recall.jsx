 import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useRequireOnboarding } from '../hooks/useRequireOnboarding';
import { useLevelFilter } from '../hooks/useLevelFilter';
import { useContentAccess } from '../hooks/useContentAccess';
import { useSecurityUiLock } from '../hooks/useSecurityUiLock';
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
  getLeaderboard,
  getRecallDueQueue,
  submitRecallConfidence
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
import RecallAnalyticsHub from '../components/recall/RecallAnalyticsHub';
import RecallProgressTab from '../components/recall/RecallProgressTab';
import RecallInsightsTab from '../components/recall/RecallInsightsTab';
import RecallLeaderboardTab from '../components/recall/RecallLeaderboardTab';

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

const CONFIDENCE_LEVELS = [
  { key: 'again', label: 'Again', icon: 'rotate', variant: 'danger' },
  { key: 'hard', label: 'Hard', icon: 'wrench', variant: 'warm' },
  { key: 'good', label: 'Good', icon: 'check', variant: 'primary' },
  { key: 'easy', label: 'Easy', icon: 'star', variant: 'success' }
];

export default function BioRecall() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { isReady } = useRequireOnboarding();
  const access = useContentAccess();
  const { locked, reason } = useSecurityUiLock();
  const { level, class_name, displayName } = useLevelFilter();
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
  const [xpProgress, setXpProgress] = useState({
    level: 1,
    xpIntoLevel: 0,
    xpToNext: 100,
    progressPercent: 0
  });
  const [dueQueue, setDueQueue] = useState([]);
  const [dueTotal, setDueTotal] = useState(0);
  const [dueQueueOpen, setDueQueueOpen] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);
  const [reviewQuestion, setReviewQuestion] = useState(null);
  const [submittingConfidence, setSubmittingConfidence] = useState(false);
  const [clozeAnswer, setClozeAnswer] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(() => {
    try {
      return localStorage.getItem('bioRecall_sound') !== 'off';
    } catch {
      return true;
    }
  });
  const [activeTab, setActiveTab] = useState('progress');
  const [isTabView, setIsTabView] = useState(false);

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
    loadDueQueue();
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
        setXpProgress(
          dash.xp_progress ||
            computeXpProgress(dash.total_xp || 0)
        );

        if (dash.level_meta) {
          setLevelMeta(dash.level_meta);
        }

        if (typeof dash.accuracy === 'number') {
          setAccuracy(dash.accuracy);
        }
      }

      if (stats) {
        setMasteryTopics(stats.mastery_topics || {});

        if (typeof stats.accuracy === 'number') {
          setAccuracy(stats.accuracy);
        }
      }

      setAchievementsList(
        Array.isArray(achievements) ? achievements : []
      );

      setTopicList(
        Array.isArray(topicsRes?.units) ? topicsRes.units : []
      );

      if (topicsRes?.level) {
        setLevelMeta((prev) => prev || topicsRes.level);
      }

      setLeaderboard(
        Array.isArray(lb) ? lb : []
      );
    } catch {
      addToast('Failed to load data', 'error');
    } finally {
      setLoading(false);
      setSectionLoading(false);
    }
  }

  async function loadDueQueue() {
    try {
      const result = await getRecallDueQueue(20);

      if (!isMounted.current) return;

      setDueQueue(
        Array.isArray(result?.items) ? result.items : []
      );

      setDueTotal(result?.total || 0);
    } catch {}
  }

  const openTopicModal = () => setTopicModalOpen(true);
  const closeTopicModal = () => setTopicModalOpen(false);
  const openDueQueue = () => setDueQueueOpen(true);
  const closeDueQueue = () => setDueQueueOpen(false);

  async function handleStartSession(topic) {
    if (locked) {
      addToast(
        reason || 'Action temporarily disabled',
        'error'
      );
      return;
    }

    setSelectedTopic(topic);
    setTopicModalOpen(false);
    setLoading(true);

    try {
      const started = await startRecallSession(
        topic.unit_id
      );

      if (
        !started?.session_id ||
        !started?.current_question
      ) {
        addToast(
          'No questions available for this topic',
          'warning'
        );
        return;
      }

      setSessionId(started.session_id);
      setTotalQuestions(
        started.total_questions || 0
      );
      setCurrentIndex(
        started.current_index || 0
      );
      setCurrentQuestion(
        started.current_question
      );
      setSessionQuote(
        started.quote || null
      );

      if (started.level) {
        setLevelMeta(started.level);
      }

      setFeedbackResult(null);
      setClozeAnswer('');
      setReviewMode(false);
      setSessionActive(true);
      setIsTabView(false);
    } catch {
      addToast(
        'Failed to start session',
        'error'
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleStartReview(item) {
    if (locked) {
      addToast(
        reason || 'Action temporarily disabled',
        'error'
      );
      return;
    }

    setDueQueueOpen(false);
    setReviewMode(true);
    setReviewQuestion(item);
    setFeedbackResult(null);
    setSessionActive(false);
    setIsTabView(false);

    setCurrentQuestion({
      id: item.question_id,
      question_text: item.question_text,
      question_type: 'open_ended'
    });
  }

  async function handleReviewConfidence(confidence) {
    if (!reviewQuestion) return;

    setSubmittingConfidence(true);

    try {
      await submitRecallConfidence(
        'review-queue',
        reviewQuestion.question_id,
        confidence
      );

      addToast(
        `Marked as ${confidence}`,
        'success'
      );

      setReviewQuestion(null);
      setFeedbackResult(null);
      loadDueQueue();
    } catch {
      addToast(
        'Failed to update review',
        'error'
      );
    } finally {
      setSubmittingConfidence(false);
    }
  }

  async function handleSubmitAnswer() {
    if (locked) {
      addToast(
        reason || 'Action temporarily disabled',
        'error'
      );
      return;
    }

    let answer = '';

    if (
      currentQuestion?.question_type === 'cloze'
    ) {
      answer = clozeAnswer.trim();
    } else {
      answer =
        answerInputRef.current?.value?.trim();
    }

    if (!answer || !currentQuestion) return;

    setAnalyzing(true);

    try {
      const result = await submitRecallAnswer(
        sessionId,
        currentQuestion.id,
        answer
      );

      setFeedbackResult(result);

      if (
        typeof result.total_xp === 'number'
      ) {
        setXpTotal(result.total_xp);
        setXpProgress(
          computeXpProgress(result.total_xp)
        );
      } else if (result.xp_earned) {
        setXpTotal((prev) => {
          const newTotal =
            (prev || 0) + result.xp_earned;

          setXpProgress(
            computeXpProgress(newTotal)
          );

          return newTotal;
        });
      }
    } catch {
      addToast(
        'Failed to submit answer',
        'error'
      );
    } finally {
      setAnalyzing(false);

      if (answerInputRef.current) {
        answerInputRef.current.value = '';
      }

      setClozeAnswer('');
    }
  }

  async function handleSessionConfidence(confidence) {
    if (
      locked ||
      !currentQuestion ||
      !sessionId
    ) {
      return;
    }

    setSubmittingConfidence(true);

    try {
      await submitRecallConfidence(
        sessionId,
        currentQuestion.id,
        confidence
      );

      if (confidence === 'again') {
        addToast(
          'Will show again soon',
          'info'
        );
      } else {
        addToast(
          'Scheduled for review',
          'success'
        );
      }

      loadDueQueue();
    } catch {
      addToast(
        'Failed to record confidence',
        'error'
      );
    } finally {
      setSubmittingConfidence(false);
    }
  }

  async function handleNextQuestion() {
    if (
      locked ||
      !feedbackResult
    ) {
      return;
    }

    if (feedbackResult.is_complete) {
      setLoading(true);

      try {
        const result =
          await completeRecallSession(
            sessionId
          );

        setSessionReport(
          result?.report || null
        );

        setNewlyAwarded(
          Array.isArray(result?.newly_awarded)
            ? result.newly_awarded
            : []
        );

        if (
          result?.streak_info?.current_streak !=
          null
        ) {
          setStreakDays(
            result.streak_info.current_streak
          );
        }
      } catch {
        addToast(
          'Failed to complete session',
          'error'
        );
      } finally {
        setSessionActive(false);
        setShowReport(true);
        setLoading(false);
      }

      return;
    }

    setLoading(true);

    try {
      const cont =
        await continueRecallSession(
          sessionId
        );

      setCurrentQuestion(
        cont.current_question || null
      );

      setCurrentIndex(
        cont.current_index || 0
      );

      setTotalQuestions(
        cont.total_questions ||
          totalQuestions
      );

      setFeedbackResult(null);
      setClozeAnswer('');
    } catch {
      addToast(
        'Failed to load next question',
        'error'
      );
    } finally {
      setLoading(false);
    }
  }

  function toggleSound() {
    setSoundEnabled((prev) => {
      const next = !prev;

      try {
        localStorage.setItem(
          'bioRecall_sound',
          next ? 'on' : 'off'
        );
      } catch {}

      return next;
    });
  }

  if (!isReady || access.loading) {
    return (
      <div className="fcd-loading-wrap">
        <Spinner size="lg" />
      </div>
    );
  }

  if (access.isPending) {
    return <PendingApprovalScreen />;
  }

  if (!access.canAccess) {
    return <AccessDenied />;
  }

  if (
    loading &&
    !sessionActive &&
    !showReport &&
    !reviewMode &&
    !isTabView
  ) {
    return (
      <div className="section recall-loading-wrap">
        <Spinner size="lg" />
      </div>
    );
  }

  const topicEntries = Object.entries(
    masteryTopics
  )
    .filter(
      ([topic]) =>
        topic &&
        topic !== 'null'
    )
    .slice(0, 6);

  const levelName =
    levelMeta?.display_name ||
    displayName ||
    level?.id ||
    '';

  const unitLabel =
    levelMeta?.unit_label ||
    'Topic';

  const groupLabel =
    levelMeta?.group_label ||
    'Class';

  const classLabel =
    class_name || '';

  const levelIcon =
    levelMeta?.icon === 'dna'
      ? 'microscope'
      : levelMeta?.icon ||
        'microscope';

  function rankClass(index) {
    if (index === 0) return 'is-gold';
    if (index === 1) return 'is-silver';
    if (index === 2) return 'is-bronze';

    return 'is-default';
  }

  const renderTabBar = () => (
    <div className="recall-tab-bar">
      <button
        className={`recall-tab ${
          activeTab === 'progress' ? 'is-active' : ''
        }`}
        onClick={() => setActiveTab('progress')}
      >
        Your Progress
      </button>
      <button
        className={`recall-tab ${
          activeTab === 'insights' ? 'is-active' : ''
        }`}
        onClick={() => setActiveTab('insights')}
      >
        Insights & Analytics
      </button>
      <button
        className={`recall-tab ${
          activeTab === 'leaderboard' ? 'is-active' : ''
        }`}
        onClick={() => setActiveTab('leaderboard')}
      >
        Leaderboard
      </button>
    </div>
  );

  if (isTabView) {
    return (
      <div className="recall-tab-fullscreen">
        <div className="recall-tab-fullscreen-header">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsTabView(false)}
          >
            <Icon name="arrow-left" />
            Back
          </Button>
          {renderTabBar()}
        </div>
        <div className="recall-tab-fullscreen-content">
          {activeTab === 'progress' && (
            <RecallProgressTab
              xpProgress={xpProgress}
              accuracy={accuracy}
              rankTitle={rankTitle}
              achievementsList={achievementsList}
              masteryTopics={masteryTopics}
            />
          )}
          {activeTab === 'insights' && <RecallInsightsTab />}
          {activeTab === 'leaderboard' && (
            <RecallLeaderboardTab leaderboard={leaderboard} />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="recall-page">
      <div className="section recall-page-section">
        <nav className="breadcrumb font-mono">
          <Link to="/">
            <Icon
              name="home"
              className="breadcrumb-icon"
            />
            Home
          </Link>

          <Icon
            name="chevron-right"
            className="breadcrumb-sep"
          />

          <span className="font-maven-pro">
            Recall Practice
          </span>
        </nav>

        <div className="recall-page-header">
          <span className="sec-label font-mono">
            BioRecall
          </span>

          <h1 className="section-title recall-page-title font-fraunces">
            {levelName || 'Master Biology with Active Recall'}
          </h1>

          <p className="recall-page-intro">
            Welcome{displayName ? `, ${displayName}` : ''}! 🧠<br />
            Strengthen your long‑term memory through spaced repetition. 
            Answer questions, earn XP, and track your mastery across every topic.
            <span className="highlight"> Consistent practice builds lasting knowledge.</span>
          </p>

          {levelName && (
            <div className="recall-chips-row">
              <span className="chip recall-chip-level font-maven-pro">
                {levelName}
              </span>

              {classLabel && (
                <span className="chip recall-chip-class font-maven-pro">
                  {groupLabel}: {classLabel}
                </span>
              )}
            </div>
          )}
        </div>

        {dueTotal > 0 &&
          !sessionActive &&
          !showReport &&
          !reviewMode && (
            <div className="recall-due-banner">
              <div className="recall-due-banner-content">
                <Icon
                  name="calendar-clock"
                  className="recall-due-banner-icon"
                />

                <div>
                  <h3 className="recall-due-banner-title font-poppins">
                    {dueTotal} reviews due
                  </h3>

                  <p className="recall-due-banner-text font-source-sans">
                    Review these while they're fresh
                  </p>
                </div>
              </div>

              <Button
                variant="warm"
                size="sm"
                onClick={openDueQueue}
              >
                <Icon name="layer-group" />
                Review Now
              </Button>
            </div>
          )}

        {!sessionActive &&
          !showReport &&
          !reviewMode && (
            <>
              {sectionLoading ? (
                <div className="recall-skeleton">
                  <Skeleton height={140} />

                  <div className="recall-skeleton-grid">
                    <Skeleton height={100} />
                    <Skeleton height={100} />
                    <Skeleton height={100} />
                  </div>
                </div>
              ) : (
                <>
                  <div className="card recall-intro-card">
                    <Icon
                      name={levelIcon}
                      className="recall-intro-icon"
                    />

                    <Button
                      onClick={openTopicModal}
                      size="lg"
                      disabled={locked}
                    >
                      Continue to Topics
                    </Button>

                    <div className="recall-intro-stats">
                      <div>
                        <Icon
                          name="fire"
                          className="recall-intro-stat-icon is-warm"
                        />

                        <span className="recall-intro-stat-text font-source-sans">
                          {streakDays} Day Streak
                        </span>
                      </div>

                      <div>
                        <Icon
                          name="star"
                          className="recall-intro-stat-icon is-accent"
                        />

                        <span className="recall-intro-stat-text font-source-sans">
                          Level {xpProgress.level} · {xpTotal} XP · {rankTitle}
                        </span>
                      </div>
                    </div>
                  </div>

                  {renderTabBar()}

                  <div className="recall-tab-preview-hint">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsTabView(true)}
                    >
                      <Icon name="expand" />
                      Open Full Screen
                    </Button>
                  </div>

                  <div className="recall-sound-toggle-wrap">
                    <h3 className="recall-section-heading font-poppins">
                      Study Preferences
                    </h3>

                    <Button
                      variant="ghost"
                      onClick={toggleSound}
                    >
                      <Icon
                        name={
                          soundEnabled
                            ? 'volume-high'
                            : 'volume-xmark'
                        }
                      />
                      Sound:{' '}
                      {soundEnabled ? 'On' : 'Off'}
                    </Button>
                  </div>
                </>
              )}
            </>
          )}

        {sessionActive &&
          currentQuestion && (
            <div>
              <ProgressBar
                value={currentIndex + 1}
                max={totalQuestions}
                variant="gradient"
              />

              <p className="quiz-progress-label font-source-sans">
                Question {currentIndex + 1} of{' '}
                {totalQuestions}

                {selectedTopic?.topic_name && (
                  <>
                    {' '}
                    – {selectedTopic.topic_name}
                  </>
                )}
              </p>

              {sessionQuote && (
                <p className="recall-quote font-fraunces">
                  "{sessionQuote.quote}"
                  {sessionQuote.author
                    ? ` — ${sessionQuote.author}`
                    : ''}
                </p>
              )}

              <Card className="recall-question-card">
                {currentQuestion.question_type ===
                  'cloze' &&
                currentQuestion.cloze_template ? (
                  <div className="recall-cloze-container">
                    <p className="recall-cloze-template font-source-sans">
                      {currentQuestion.cloze_template
                        .split('___')
                        .map(
                          (
                            part,
                            index,
                            array
                          ) => (
                            <span key={index}>
                              {part}

                              {index <
                                array.length -
                                  1 && (
                                <input
                                  className="recall-cloze-blank"
                                  value={
                                    clozeAnswer
                                  }
                                  onChange={(e) =>
                                    setClozeAnswer(
                                      e.target
                                        .value
                                    )
                                  }
                                  disabled={
                                    analyzing ||
                                    locked
                                  }
                                  placeholder="..."
                                  aria-label="Fill in the blank"
                                />
                              )}
                            </span>
                          )
                        )}
                    </p>
                  </div>
                ) : (
                  <>
                    <h3 className="recall-question-heading font-poppins">
                      {
                        currentQuestion.question_text
                      }
                    </h3>

                    <Input
                      ref={answerInputRef}
                      placeholder="Type your answer..."
                      disabled={
                        analyzing || locked
                      }
                    />
                  </>
                )}

                {analyzing && (
                  <div className="recall-analyzing-row">
                    <Spinner size="sm" />

                    <span className="recall-analyzing-label font-maven-pro">
                      Checking
                    </span>
                  </div>
                )}

                <div className="recall-answer-actions">
                  {!feedbackResult ? (
                    <Button
                      onClick={
                        handleSubmitAnswer
                      }
                      disabled={
                        analyzing || locked
                      }
                      loading={analyzing}
                    >
                      <Icon name="paper-plane" />
                      Submit
                    </Button>
                  ) : (
                    <Button
                      onClick={
                        handleNextQuestion
                      }
                      loading={loading}
                      disabled={
                        loading || locked
                      }
                    >
                      {feedbackResult.is_complete
                        ? 'Finish Session'
                        : 'Next Question'}

                      <Icon name="arrow-right" />
                    </Button>
                  )}
                </div>
              </Card>

              {feedbackResult && (
                <Card className="recall-feedback-card">
                  <div className="recall-feedback-header">
                    <Icon
                      name={
                        feedbackResult.strength ===
                        'excellent'
                          ? 'star'
                          : feedbackResult.strength ===
                            'strong'
                          ? 'circle-check'
                          : 'rotate'
                      }
                      className={`recall-feedback-icon ${
                        feedbackResult.strength ===
                        'excellent'
                          ? 'is-excellent'
                          : feedbackResult.strength ===
                            'strong'
                          ? 'is-strong'
                          : 'is-developing'
                      }`}
                    />

                    <div>
                      <h4 className="font-poppins">
                        {feedbackResult.strength ===
                        'excellent'
                          ? 'Perfect'
                          : feedbackResult.strength ===
                            'strong'
                          ? 'Close'
                          : 'Needs Review'}
                      </h4>

                      <p className="recall-feedback-xp font-mono">
                        +{feedbackResult.xp_earned} XP
                      </p>
                    </div>
                  </div>

                  <p className="font-source-sans">
                    <strong>
                      Correct answer:
                    </strong>{' '}
                    {
                      feedbackResult.correct_answer
                    }
                  </p>

                  {feedbackResult.note && (
                    <p className="recall-feedback-note font-open-sans">
                      {feedbackResult.note}
                    </p>
                  )}

                  {feedbackResult.explanation && (
                    <p className="recall-feedback-explanation font-open-sans">
                      {
                        feedbackResult.explanation
                      }
                    </p>
                  )}

                  <div className="recall-confidence-section">
                    <span className="recall-confidence-label font-poppins">
                      How well did you recall this?
                    </span>

                    <div className="recall-confidence-buttons">
                      {CONFIDENCE_LEVELS.map(
                        (item) => (
                          <Button
                            key={item.key}
                            variant={
                              item.variant
                            }
                            size="sm"
                            loading={
                              submittingConfidence
                            }
                            onClick={() =>
                              handleSessionConfidence(
                                item.key
                              )
                            }
                          >
                            <Icon
                              name={item.icon}
                            />
                            {item.label}
                          </Button>
                        )
                      )}
                    </div>
                  </div>
                </Card>
              )}
            </div>
          )}

        {reviewMode &&
          reviewQuestion && (
            <div>
              <Card className="recall-question-card">
                <div className="recall-review-badge font-comfortaa">
                  <Icon name="calendar-clock" />
                  Due Review
                </div>

                <h3 className="recall-question-heading font-poppins">
                  {reviewQuestion.question_text}
                </h3>

                <p className="recall-review-answer font-source-sans">
                  <strong>Answer:</strong>{' '}
                  {reviewQuestion.correct_answer}
                </p>

                {reviewQuestion.explanation && (
                  <p className="recall-review-explanation font-open-sans">
                    {
                      reviewQuestion.explanation
                    }
                  </p>
                )}

                <div className="recall-confidence-section">
                  <span className="recall-confidence-label font-poppins">
                    How well did you recall this?
                  </span>

                  <div className="recall-confidence-buttons">
                    {CONFIDENCE_LEVELS.map(
                      (item) => (
                        <Button
                          key={item.key}
                          variant={item.variant}
                          size="sm"
                          loading={
                            submittingConfidence
                          }
                          onClick={() =>
                            handleReviewConfidence(
                              item.key
                            )
                          }
                        >
                          <Icon
                            name={item.icon}
                          />
                          {item.label}
                        </Button>
                      )
                    )}
                  </div>
                </div>

                <div className="recall-answer-actions">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setReviewMode(false);
                      setReviewQuestion(null);
                    }}
                  >
                    <Icon name="xmark" />
                    Close
                  </Button>
                </div>
              </Card>
            </div>
          )}

        {showReport &&
          sessionReport && (
            <Card className="recall-report-card">
              <Icon
                name="trophy"
                className="recall-report-icon"
              />

              <h2 className="font-fraunces">
                Session Complete
              </h2>

              <div className="recall-report-stats">
                <div>
                  <div className="recall-report-value is-success font-poppins">
                    {sessionReport.excellent ||
                      0}
                  </div>

                  <div className="recall-report-label font-source-sans">
                    Excellent
                  </div>
                </div>

                <div>
                  <div className="recall-report-value is-primary font-poppins">
                    {sessionReport.strong ||
                      0}
                  </div>

                  <div className="recall-report-label font-source-sans">
                    Strong
                  </div>
                </div>

                <div>
                  <div className="recall-report-value is-warm font-poppins">
                    {sessionReport.developing ||
                      0}
                  </div>

                  <div className="recall-report-label font-source-sans">
                    Needs Review
                  </div>
                </div>
              </div>

              <p className="font-source-sans">
                Mastery Score:{' '}
                {sessionReport.mastery_score ||
                  0}
                %
              </p>

              <p className="recall-report-time font-mono">
                Total time:{' '}
                {
                  sessionReport.total_time_formatted
                }{' '}
                · Avg:{' '}
                {
                  sessionReport.avg_time_formatted
                }{' '}
                per question
              </p>

              {newlyAwarded.length > 0 && (
                <div className="recall-report-achievements">
                  <h4 className="font-poppins">
                    New Achievements
                  </h4>

                  <div className="recall-badge-row">
                    {newlyAwarded.map(
                      (achievement) => (
                        <span
                          key={achievement.id}
                          className="badge badge-accent font-comfortaa"
                          title={
                            achievement.description ||
                            achievement.name
                          }
                        >
                          <Icon
                            name={
                              achievement.icon ===
                              'dna'
                                ? 'microscope'
                                : achievement.icon ||
                                  'medal'
                            }
                          />
                          {achievement.name}
                        </span>
                      )
                    )}
                  </div>
                </div>
              )}

              <div className="recall-report-actions">
                <Button
                  onClick={() => {
                    setShowReport(false);
                    setSessionActive(false);
                    setNewlyAwarded([]);
                    loadUserProgress();
                    setTopicModalOpen(true);
                  }}
                  disabled={locked}
                >
                  <Icon name="rotate" />
                  Study Another {unitLabel}
                </Button>

                <Button
                  variant="secondary"
                  onClick={() =>
                    navigate('/')
                  }
                >
                  <Icon name="home" />
                  Home
                </Button>
              </div>
            </Card>
          )}

        <Modal
          open={topicModalOpen}
          onClose={closeTopicModal}
          title={`Select a ${unitLabel}`}
        >
          <div className="recall-topic-modal-list">
            {topicList.length === 0 && (
              <p className="recall-topic-modal-empty font-open-sans">
                No {unitLabel.toLowerCase()}s
                available for your level.
              </p>
            )}

            {topicList.map((topic) => (
              <button
                key={topic.unit_id}
                className="btn btn-secondary recall-topic-modal-btn font-outfit"
                onClick={() =>
                  handleStartSession(topic)
                }
                disabled={locked}
              >
                <span>
                  {topic.topic_name}
                </span>

                <span className="recall-topic-modal-count font-mono">
                  {topic.question_count}{' '}
                  questions
                </span>
              </button>
            ))}
          </div>
        </Modal>

        <Modal
          open={dueQueueOpen}
          onClose={closeDueQueue}
          title={`Review Queue (${dueTotal} due)`}
        >
          <div className="recall-due-modal-list">
            {dueQueue.length === 0 ? (
              <p className="recall-topic-modal-empty font-open-sans">
                No reviews due. Great job!
              </p>
            ) : (
              dueQueue.map((item) => (
                <button
                  key={item.question_id}
                  className={`btn btn-secondary recall-topic-modal-btn recall-due-queue-btn font-outfit ${
                    item.is_weak_concept ? 'is-weak' : 'is-strong'
                  }`}
                  onClick={() =>
                    handleStartReview(item)
                  }
                  disabled={locked}
                >
                  <span className="recall-due-modal-question font-source-sans">
                    {item.question_text}
                  </span>

                  <span
                    className={`badge font-comfortaa ${
                      item.is_weak_concept
                        ? 'badge-warm'
                        : 'badge-primary'
                    }`}
                  >
                    {item.is_weak_concept
                      ? 'Weak'
                      : `${item.repetitions} reps`}
                  </span>
                </button>
              ))
            )}
          </div>
        </Modal>
      </div>
    </div>
  );
}
