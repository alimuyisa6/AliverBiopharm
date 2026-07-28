import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useRequireOnboarding } from '../hooks/useRequireOnboarding';
import { useLevelFilter } from '../hooks/useLevelFilter';
import { useContentAccess } from '../hooks/useContentAccess';
import { useLayout } from '../contexts/LayoutContext';
import DOMPurify from 'dompurify';
import {
  getQuizTopics,
  getQuizBlock,
  checkDailyRetry,
  checkQuizAnswer,
  recordDailyVisit,
  getUserStreak,
  getUserAchievements,
  saveAchievement,
  saveQuizState,
  getQuizState,
  clearQuizState,
  trackEvent,
  getLeaderboard,
  startQuizSession,
  trackTabSwitch,
  submitQuizWithSession,
  getUnits
} from '../api/cachedClient';
import QuizHero from '../components/quiz/QuizHero';
import QuizDashboard from '../components/quiz/QuizDashboard';
import QuizChallenges from '../components/quiz/QuizChallenges';
import QuizLearningPath from '../components/quiz/QuizLearningPath';
import QuizWeakAreas from '../components/quiz/QuizWeakAreas';
import { PendingApprovalScreen } from '../components/access/PendingApprovalScreen';
import {
  FaHouse,
  FaMagnifyingGlass,
  FaXmark,
  FaTrophy,
  FaLock,
  FaCircleCheck,
  FaCircleXmark,
  FaTriangleExclamation,
  FaFire,
  FaLightbulb,
  FaBookOpen,
  FaLink,
  FaShieldHalved,
  FaSpinner,
  FaArrowLeft,
  FaArrowRight
} from 'react-icons/fa6';

const SOUND_CORRECT = typeof window !== 'undefined' ? (() => { try { const ctx = new (window.AudioContext || window.webkitAudioContext)(); return () => { const o = ctx.createOscillator(); const g = ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.frequency.setValueAtTime(520, ctx.currentTime); o.frequency.setValueAtTime(660, ctx.currentTime + 0.1); g.gain.setValueAtTime(0.15, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3); o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.3); }; } catch { return () => {}; } })() : () => {};

const SOUND_INCORRECT = typeof window !== 'undefined' ? (() => { try { const ctx = new (window.AudioContext || window.webkitAudioContext)(); return () => { const o = ctx.createOscillator(); const g = ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.type = 'sawtooth'; o.frequency.setValueAtTime(260, ctx.currentTime); g.gain.setValueAtTime(0.1, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25); o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.25); }; } catch { return () => {}; } })() : () => {};

const REDIRECT_SECONDS = 10;
const MAX_TAB_SWITCHES = 3;

function QuizErrorBoundary({ children }) {
  const [hasError, setHasError] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const handler = (event) => {
      setHasError(true);
      setError(event.error);
    };
    window.addEventListener('error', handler);
    return () => window.removeEventListener('error', handler);
  }, []);

  if (hasError) {
    return (
      <div className="quiz-error-boundary">
        <h2>Something went wrong</h2>
        <button className="quiz-error-reload" onClick={() => window.location.reload()}>
          Reload Page
        </button>
      </div>
    );
  }
  return children;
}

export default function Quiz() {
  const { user } = useAuth();
  const { isReady } = useRequireOnboarding();
  const access = useContentAccess();
  const { level, class_name, showAll } = useLevelFilter();
  const { groups } = useLayout();

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
  const [spinnerWord, setSpinnerWord] = useState('');
  const [showingSpinner, setShowingSpinner] = useState(false);
  const [glossaryMap, setGlossaryMap] = useState({});
  const [adaptivePath, setAdaptivePath] = useState(null);
  const [earnedBadges, setEarnedBadges] = useState([]);
  const [streak, setStreak] = useState(0);
  const [topicSearch, setTopicSearch] = useState('');
  const [toast, setToast] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [resumeData, setResumeData] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem('quiz_sound') !== 'off');
  const [confidence, setConfidence] = useState([]);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [questionTransition, setQuestionTransition] = useState(false);
  const [tabWarning, setTabWarning] = useState(false);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [answerSubmitting, setAnswerSubmitting] = useState(false);
  const [sessionActive, setSessionActive] = useState(true);
  const [blockTabSwitch, setBlockTabSwitch] = useState(false);
  const [integrityOverlay, setIntegrityOverlay] = useState(false);
  const [integrityCountdown, setIntegrityCountdown] = useState(REDIRECT_SECONDS);

  const spinnerTimeout = useRef(null);
  const saveDebounceRef = useRef(null);
  const touchStartX = useRef(null);
  const confettiTimers = useRef([]);
  const tabSwitchLock = useRef(false);
  const integrityIntervalRef = useRef(null);

  const SPINNER_WORDS = [
    'Reviewing your selection...',
    'Checking your answer...',
    'Analyzing...',
    'Verifying...',
    'Processing...',
    'One moment...'
  ];

  const showToast = useCallback((message, type = 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const getFirstUnansweredIndex = useCallback((answers) => answers.findIndex(a => a === null), []);

  const canNavigateTo = useCallback((targetIndex, answers) => {
    if (answers[targetIndex] !== null) return true;
    return targetIndex === answers.findIndex(a => a === null);
  }, []);

  const navigateTo = useCallback((idx) => {
    setQuestionTransition(true);
    setTimeout(() => { setCurrentIndex(idx); setQuestionTransition(false); }, 200);
  }, []);

  const goToNextUnanswered = useCallback((answers, currentIdx) => {
    const first = answers.findIndex(a => a === null);
    if (first !== -1 && first !== currentIdx) {
      setQuestionTransition(true);
      setTimeout(() => { setCurrentIndex(first); setQuestionTransition(false); }, 200);
    }
  }, []);

  const saveQuizStateToStorage = useCallback(() => {
    if (quizQuestions.length > 0 && userAnswers.some(a => a !== null)) {
      const state = {
        unitId: activeUnitId,
        topic: currentTopic,
        block: currentBlock,
        totalBlocks,
        answers: userAnswers,
        index: currentIndex,
        startTime: quizStartTime,
        questions: quizQuestions,
        totalQuestions: quizQuestions.length
      };
      sessionStorage.setItem('quiz_resume', JSON.stringify(state));
    }
  }, [quizQuestions, userAnswers, currentTopic, activeUnitId, currentBlock, totalBlocks, currentIndex, quizStartTime]);

  const saveQuizStateToBackend = useCallback(() => {
    if (!user) return;
    if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
    saveDebounceRef.current = setTimeout(async () => {
      try {
        await saveQuizState({
          unitId: activeUnitId,
          topic: currentTopic,
          block: currentBlock,
          totalBlocks,
          answers: userAnswers,
          index: currentIndex,
          startTime: quizStartTime,
          questions: quizQuestions,
          totalQuestions: quizQuestions.length
        });
      } catch {}
    }, 2000);
  }, [user, activeUnitId, currentTopic, currentBlock, totalBlocks, userAnswers, currentIndex, quizStartTime, quizQuestions]);

  const handleResume = useCallback(() => {
    if (!resumeData) return;
    const state = resumeData;
    setActiveUnitId(state.unitId || null);
    setCurrentTopic(state.topic || '');
    setCurrentBlock(state.block !== undefined ? state.block : 0);
    setTotalBlocks(state.totalBlocks || 0);
    setQuizQuestions(state.questions || []);
    setUserAnswers(state.answers || new Array((state.questions || []).length).fill(null));
    setConfidence(new Array((state.questions || []).length).fill(null));
    setCurrentIndex(state.index !== undefined ? state.index : 0);
    setQuizStartTime(state.startTime ? new Date(state.startTime) : new Date());
    setResumeData(null);
    setShowResumeModal(false);
    sessionStorage.removeItem('quiz_resume');
  }, [resumeData]);

  const handleDiscardResume = useCallback(() => {
    setResumeData(null);
    setShowResumeModal(false);
    sessionStorage.removeItem('quiz_resume');
  }, []);

  useEffect(() => {
    return () => {
      confettiTimers.current.forEach(timer => clearTimeout(timer));
      confettiTimers.current = [];
      if (integrityIntervalRef.current) clearInterval(integrityIntervalRef.current);
    };
  }, []);

  // Determine active unit id from the user's active group
  useEffect(() => {
    if (!groups || !Array.isArray(groups) || groups.length === 0) return;
    const groupId = user?.profile?.active_group_id || groups[0]?.id;
    if (!groupId) return;
    getUnits({ group_id: groupId }).then(units => {
      if (units && units.length > 0) {
        setActiveUnitId(units[0].id);
      }
    }).catch(() => {});
  }, [groups, user]);

  useEffect(() => {
    if (!isReady || !access.canAccess || access.isPending || !activeUnitId) return;

    const load = async () => {
      try {
        setLoading(true);
        const glossary = {};
        setGlossaryMap(glossary);

        const topics = await getQuizTopics(activeUnitId);
        setAllTopics(Array.isArray(topics) ? topics : []);

        if (user) {
          await recordDailyVisit();
          const [streakData, badges, savedState] = await Promise.all([
            getUserStreak(),
            getUserAchievements(),
            getQuizState()
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

        const saved = sessionStorage.getItem('quiz_resume');
        if (saved) {
          const state = JSON.parse(saved);
          setResumeData(state);
          setShowResumeModal(true);
        }
        setLoading(false);
      } catch (err) {
        console.error(err);
        showToast('Failed to load initial data', 'error');
        setLoading(false);
      }
    };
    load();
  }, [isReady, access.canAccess, access.isPending, activeUnitId, user]);

  useEffect(() => {
    if (!isReady || !access.canAccess || access.isPending || !activeUnitId) return;
    const loadTopics = async () => {
      try {
        const topics = await getQuizTopics(activeUnitId);
        setAllTopics(Array.isArray(topics) ? topics : []);
      } catch {
        showToast('Failed to load topics', 'error');
      }
    };
    loadTopics();
  }, [isReady, access.canAccess, access.isPending, activeUnitId]);

  // Keyboard and swipe listeners unchanged (they depend on quizQuestions, userAnswers, etc.)
  useEffect(() => {
    if (!quizQuestions.length) return;
    const handleKey = (e) => {
      if (answerSubmitting || integrityOverlay) return;
      if (['a','b','c','d'].includes(e.key.toLowerCase())) selectAnswer(e.key.toUpperCase());
      if (e.key === 'ArrowRight') {
        const first = getFirstUnansweredIndex(userAnswers);
        if (first !== -1 && first !== currentIndex) navigateTo(first);
        else if (currentIndex < quizQuestions.length - 1 && userAnswers[currentIndex] !== null) {
          if (canNavigateTo(currentIndex + 1, userAnswers)) navigateTo(currentIndex + 1);
        }
      }
      if (e.key === 'ArrowLeft' && currentIndex > 0) navigateTo(currentIndex - 1);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [quizQuestions, currentIndex, userAnswers, answerSubmitting, integrityOverlay]);

  useEffect(() => {
    if (!quizQuestions.length || !sessionActive) return;
    let warningTimeout = null;

    const handleTabAway = async () => {
      if (tabSwitchLock.current) return;
      tabSwitchLock.current = true;
      setTimeout(() => { tabSwitchLock.current = false; }, 1000);

      try {
        const result = await trackTabSwitch(activeUnitId, currentBlock);
        if (!result.success && result.auto_submitted) {
          setSessionActive(false);
          triggerIntegrityLock(result.message);
          return;
        }
        if (result.success) {
          setTabSwitchCount(result.tab_switches);
          setTabWarning(true);
          setBlockTabSwitch(true);
          warningTimeout = setTimeout(() => {
            setTabWarning(false);
            setBlockTabSwitch(false);
          }, 4000);
          if (result.remaining <= 1) {
            showToast(`Warning: ${result.remaining} tab switch${result.remaining > 1 ? 'es' : ''} remaining before auto-submit!`, 'warning');
          }
        }
      } catch (error) {
        console.error('Failed to track tab switch:', error);
      }
    };

    const handleVisibility = () => { if (document.hidden) handleTabAway(); };
    const handleBlur = () => { handleTabAway(); };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('blur', handleBlur);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('blur', handleBlur);
      if (warningTimeout) clearTimeout(warningTimeout);
    };
  }, [quizQuestions.length, activeUnitId, currentBlock, sessionActive]);

  useEffect(() => {
    if (quizStartTime && quizQuestions.length && !integrityOverlay) {
      const interval = setInterval(() => {
        const elapsed = Math.floor((new Date() - new Date(quizStartTime)) / 1000);
        const remaining = Math.max(0, 600 - elapsed);
        setTimeLeft(remaining);
        if (remaining === 0) {
          clearInterval(interval);
          showToast('Time is up! Submitting your answers.', 'warning');
          submitBlockWithSession();
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [quizStartTime, quizQuestions.length, integrityOverlay]);

  useEffect(() => {
    saveQuizStateToStorage();
    saveQuizStateToBackend();
  }, [userAnswers, currentIndex, quizQuestions, currentTopic, activeUnitId, currentBlock, quizStartTime]);

  useEffect(() => {
    if (!quizQuestions.length) return;
    const el = document.querySelector('.question-card');
    if (el) {
      el.addEventListener('touchstart', handleTouchStart, { passive: true });
      el.addEventListener('touchend', handleTouchEnd, { passive: true });
    }
    return () => {
      if (el) {
        el.removeEventListener('touchstart', handleTouchStart);
        el.removeEventListener('touchend', handleTouchEnd);
      }
    };
  }, [quizQuestions.length, currentIndex, userAnswers]);

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        const first = userAnswers.findIndex(a => a === null);
        if (first !== -1 && first !== currentIndex) navigateTo(first);
        else if (currentIndex < quizQuestions.length - 1 && userAnswers[currentIndex] !== null) navigateTo(currentIndex + 1);
      } else {
        if (currentIndex > 0) navigateTo(currentIndex - 1);
      }
    }
    touchStartX.current = null;
  };

  const renderGlossary = useMemo(() => (text) => {
    if (!text) return text;
    let escaped = String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const terms = Object.keys(glossaryMap).sort((a, b) => b.length - a.length);
    for (let term of terms) {
      const regex = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
      escaped = escaped.replace(regex, match => `<span class="glossary-term">${match}<span class="glossary-tooltip">${glossaryMap[term]}</span></span>`);
    }
    return DOMPurify.sanitize(escaped, { ALLOWED_TAGS: ['span'], ALLOWED_ATTR: ['class'] });
  }, [glossaryMap]);

  async function openTopicBlocks(topic, total) {
    setCurrentTopic(topic);
    setTotalBlocks(Number(total) || 0);
    setQuizQuestions([]);
    setResultData(null);
  }

  async function startBlock(blockNum) {
    if (!user) { showToast('Please sign in.', 'error'); return; }
    try {
      const retry = await checkDailyRetry(activeUnitId, blockNum);
      if (!retry.can_retry) { showToast(retry.reason || 'Block locked until tomorrow.', 'error'); return; }
    } catch {
      showToast('Failed to check retry status', 'error');
    }
    setPendingBlock(blockNum);
    setShowRulesModal(true);
  }

  async function confirmStartBlock() {
    setShowRulesModal(false);
    const blockNum = pendingBlock;
    setCurrentBlock(blockNum);
    setLoading(true);

    try {
      const sessionResult = await startQuizSession(activeUnitId, blockNum);
      if (!sessionResult.success) {
        if (sessionResult.auto_submitted) {
          showToast(sessionResult.message || 'Quiz auto-submitted. Please start a new block.', 'warning');
          setCurrentTopic('');
          setQuizQuestions([]);
          setLoading(false);
          return;
        }
        showToast('Failed to start quiz session', 'error');
        setLoading(false);
        return;
      }

      setTabSwitchCount(sessionResult.tab_switches || 0);
      setSessionActive(true);

      const data = await getQuizBlock(activeUnitId, blockNum);
      if (!data || !data.questions || !data.questions.length) {
        showToast('No questions available.', 'error');
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
      setLoading(false);
    } catch (err) {
      showToast('Failed to load quiz: ' + err.message, 'error');
      setLoading(false);
    }
  }

  async function selectAnswer(optionLetter) {
    if (userAnswers[currentIndex] !== null || answerSubmitting || integrityOverlay) return;
    setAnswerSubmitting(true);
    setShowingSpinner(true);
    setSpinnerWord(SPINNER_WORDS[Math.floor(Math.random() * SPINNER_WORDS.length)]);
    if (spinnerTimeout.current) clearTimeout(spinnerTimeout.current);
    const q = quizQuestions[currentIndex];
    try {
      const result = await checkQuizAnswer({
        question_id: q.id,
        selected_option: optionLetter
      });
      const newAnswers = [...userAnswers];
      newAnswers[currentIndex] = {
        selected: optionLetter,
        correct: result.correct,
        correct_option: result.correct_option,
        correct_answer_text: result.correct_answer_text
      };
      setUserAnswers(newAnswers);
      if (soundEnabled) { result.correct ? SOUND_CORRECT() : SOUND_INCORRECT(); }
      spinnerTimeout.current = setTimeout(() => { setShowingSpinner(false); setAnswerSubmitting(false); }, 800);
      goToNextUnanswered(newAnswers, currentIndex);
    } catch (err) {
      showToast('Failed to verify answer: ' + err.message, 'error');
      setShowingSpinner(false);
      setAnswerSubmitting(false);
    }
  }

  function setConfidenceForCurrent(level) {
    const next = [...confidence];
    next[currentIndex] = level;
    setConfidence(next);
  }

  function nextQuestion() {
    const first = getFirstUnansweredIndex(userAnswers);
    if (first !== -1 && first !== currentIndex) navigateTo(first);
    else if (currentIndex < quizQuestions.length - 1 && userAnswers[currentIndex] !== null) {
      if (canNavigateTo(currentIndex + 1, userAnswers)) navigateTo(currentIndex + 1);
    }
  }

  function prevQuestion() {
    if (currentIndex > 0) navigateTo(currentIndex - 1);
  }

  function triggerIntegrityLock(message) {
    setTabWarning(false);
    setBlockTabSwitch(false);
    setIntegrityOverlay(true);
    setIntegrityCountdown(REDIRECT_SECONDS);
    showToast(message || 'Quiz auto-submitted due to tab switching', 'warning');

    submitBlockWithSession();

    if (integrityIntervalRef.current) clearInterval(integrityIntervalRef.current);
    integrityIntervalRef.current = setInterval(() => {
      setIntegrityCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(integrityIntervalRef.current);
          returnToBlockList();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  function returnToBlockList() {
    if (integrityIntervalRef.current) clearInterval(integrityIntervalRef.current);
    setIntegrityOverlay(false);
    setQuizQuestions([]);
    setResultData(null);
    setUserAnswers([]);
    setTimeLeft(null);
    setTabSwitchCount(0);
    const loadTopics = async () => {
      try {
        const topics = await getQuizTopics(activeUnitId);
        setAllTopics(Array.isArray(topics) ? topics : []);
      } catch {}
    };
    loadTopics();
  }

  async function submitBlockWithSession() {
    if (quizQuestions.length === 0) return;

    const answersPayload = quizQuestions.map((q, idx) => ({
      id: q.id,
      selectedOption: userAnswers[idx]?.selected || 'X'
    }));

    const timeTaken = Math.round((new Date() - new Date(quizStartTime)) / 1000);
    setLoading(true);

    try {
      const result = await submitQuizWithSession(
        activeUnitId,
        currentBlock,
        answersPayload,
        timeTaken
      );

      sessionStorage.removeItem('quiz_resume');
      clearQuizState().catch(() => {});

      if (result.auto_submitted) {
        setLoading(false);
        return;
      }

      if (!result.success) {
        showToast('Submission failed: ' + (result.message || 'Unknown error'), 'error');
        setLoading(false);
        return;
      }

      setResultData(result);

      trackEvent('quiz_complete', {
        unitId: activeUnitId,
        topic: currentTopic,
        block: currentBlock,
        score: result.percentage,
        passed: result.passed,
        tab_switches: result.tab_switches || 0
      });

      const newBadges = [];
      if (result.percentage >= 100 && !earnedBadges.includes('perfect_block')) {
        newBadges.push({ id: 'perfect_block', label: 'Perfect Score' });
      }
      if (!earnedBadges.includes('first_block')) {
        newBadges.push({ id: 'first_block', label: 'First Block Done' });
      }
      for (let b of newBadges) await saveAchievement({ id: b.id, label: b.label });
      setEarnedBadges(prev => [...prev, ...newBadges.map(b => b.id)]);
      if (streak >= 10 && !earnedBadges.includes('streak_10')) {
        await saveAchievement({ id: 'streak_10', label: '10-Day Streak' });
        setEarnedBadges(prev => [...prev, 'streak_10']);
      }

      let rule = null;
      if (result.percentage >= 90) {
        rule = { message: "Excellent! You're ready for more advanced material.", action: null };
      } else if (result.percentage < 70) {
        rule = { message: 'Review key concepts from this block before moving on.', action: 'review_block' };
      }
      setAdaptivePath(rule);
      const topics = await getQuizTopics(activeUnitId);
      setAllTopics(Array.isArray(topics) ? topics : []);
      setLoading(false);
      if (result.passed && result.percentage >= 90) showConfetti();
    } catch (err) {
      showToast('Submission failed: ' + err.message, 'error');
      setLoading(false);
    }
  }

  async function loadLeaderboard() {
    setLeaderboardLoading(true);
    try {
      const data = await getLeaderboard(level || 'O-Level', 10);
      setLeaderboard(Array.isArray(data) ? data : []);
    } catch {
      setLeaderboard([]);
    }
    setLeaderboardLoading(false);
  }

  function showConfetti() {
    if (typeof document === 'undefined') return;
    const colors = ['#0ab5b5', '#b8873a', '#e2c06a', '#10b981', '#f59e0b'];
    const particles = [];
    for (let i = 0; i < 50; i++) {
      const p = document.createElement('div');
      p.style.cssText = `position:fixed;width:8px;height:8px;background:${colors[Math.floor(Math.random() * colors.length)]};left:${Math.random() * 100}%;top:-10px;border-radius:50%;z-index:9999;pointer-events:none;animation:confettiFall ${2 + Math.random() * 3}s linear forwards`;
      document.body.appendChild(p);
      particles.push(p);
    }
    const timer = setTimeout(() => {
      particles.forEach(p => {
        if (p && p.parentNode) {
          p.parentNode.removeChild(p);
        }
      });
      confettiTimers.current = confettiTimers.current.filter(t => t !== timer);
    }, 4000);
    confettiTimers.current.push(timer);
  }

  const filteredTopics = useMemo(() => {
    if (!Array.isArray(allTopics)) return [];
    return allTopics.filter(topic => !topicSearch || topic.topic_name?.toLowerCase().includes(topicSearch.toLowerCase()));
  }, [allTopics, topicSearch]);

  if (!isReady || access.isPending) {
    return <PendingApprovalScreen />;
  }

  if (!access.canAccess) {
    return <div className="quiz-access-denied">Access restricted. Please contact support.</div>;
  }

  if (loading && !quizQuestions.length && !resultData && !currentTopic) {
    return (
      <div className="quiz-loading-grid">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="quiz-loading-skeleton">
            <div className="quiz-skeleton-line" style={{ '--line-width': `${60 + i * 10}%` }} />
            <div className="quiz-skeleton-line-short" style={{ '--line-width': '40%' }} />
          </div>
        ))}
      </div>
    );
  }

  const firstUnanswered = getFirstUnansweredIndex(userAnswers);
  const allAnswered = userAnswers.length > 0 && userAnswers.every(a => a !== null);
  const timerPercent = timeLeft !== null ? (timeLeft / 600) * 100 : 100;
  const timerColor = timerPercent > 50 ? '#10b981' : timerPercent > 20 ? '#f59e0b' : '#ef4444';

  return (
    <QuizErrorBoundary>
      <div className="quiz-page">
        <span className="sec-label">ASSESSMENTS</span>
        <h1 className="section-title">Knowledge Quizzes</h1>

        {user && streak > 0 && (
          <div className="streak-badge">
            <FaFire className="streak-badge-icon" />
            {streak}-day streak
          </div>
        )}

        <div className="breadcrumb">
          <Link to="/"><FaHouse className="breadcrumb-icon" /> Home</Link>
          <span>›</span>
          <span>Quizzes</span>
          {currentTopic && (<><span>›</span><span>{currentTopic}</span></>)}
          {currentTopic && resultData && (<><span>›</span><span>Results</span></>)}
        </div>

        {tabWarning && quizQuestions.length > 0 && (
          <div className="tab-warning">
            <FaTriangleExclamation className="tab-warning-icon" />
            Tab switch detected ({tabSwitchCount}/{MAX_TAB_SWITCHES}). {tabSwitchCount >= MAX_TAB_SWITCHES ? 'Quiz will auto-submit!' : 'Stay focused!'}
          </div>
        )}

        {blockTabSwitch && quizQuestions.length > 0 && tabSwitchCount < MAX_TAB_SWITCHES && (
          <div className="tab-warning tab-warning-danger">
            <FaTriangleExclamation className="tab-warning-icon" />
            Warning: Tab switching is not allowed during the quiz. ({tabSwitchCount}/{MAX_TAB_SWITCHES})
          </div>
        )}

        {!currentTopic && (
          <>
            <QuizHero />
            {user && <QuizDashboard user={user} />}
            {user && <QuizChallenges user={user} />}
            <QuizLearningPath level={level || 'O-Level'} />
            <QuizWeakAreas user={user} onRecommend={(topic, block) => { setCurrentTopic(topic); startBlock(block); }} />
          </>
        )}

        {!currentTopic ? (
          <>
            <div className="quiz-topic-controls">
              <div className="topic-search">
                <input
                  type="text"
                  placeholder="Search topics..."
                  value={topicSearch}
                  onChange={e => setTopicSearch(e.target.value)}
                />
              </div>
              <button className="btn-secondary" onClick={() => { setShowLeaderboard(true); loadLeaderboard(); }}>
                <FaTrophy className="btn-icon" /> Leaderboard
              </button>
            </div>

            <div className="topic-grid">
              {filteredTopics.length === 0 && (
                <div className="topic-empty">
                  <FaMagnifyingGlass className="topic-empty-icon" />
                  No topics match your search.
                </div>
              )}
              {filteredTopics.map(topic => {
                const hasQuestions = (topic.question_count || 0) > 0 && (topic.total_blocks || 0) > 0;
                const allDone = hasQuestions && topic.completed_blocks?.length === topic.total_blocks;
                if (hasQuestions && !allDone) {
                  return (
                    <div key={topic.topic_name} className="topic-card clickable" onClick={() => openTopicBlocks(topic.topic_name, topic.total_blocks)}>
                      <h3 className="topic-card-title">{topic.topic_name}</h3>
                      <span className="topic-card-count ready">{topic.question_count} questions • {topic.total_blocks} blocks</span>
                      <small className="topic-card-action">Tap to start →</small>
                    </div>
                  );
                } else {
                  return (
                    <div key={topic.topic_name} className="topic-card">
                      <h3 className="topic-card-title">{topic.topic_name}</h3>
                      <span className="topic-card-count">{topic.question_count} questions</span>
                      <small className="topic-card-status">{allDone ? 'All blocks done!' : 'Questions being added'}</small>
                    </div>
                  );
                }
              })}
            </div>
          </>
        ) : resultData ? (
          <div className="quiz-result-container">
            <div className="question-card quiz-result-card">
              {resultData.passed ? <FaTrophy className="result-icon" /> : <FaBookOpen className="result-icon" />}
              <h2 className="result-title">{resultData.passed ? `Congratulations, ${user?.full_name || user?.email?.split('@')[0] || 'Learner'}!` : 'Block Complete'}</h2>
              <div className="result-score">{resultData.percentage}%</div>
              <p className="result-detail">{resultData.score}/{resultData.total} correct</p>
              <p className="result-message">{resultData.passed ? 'Outstanding! You really know this!' : 'Keep studying! Every expert was once a beginner.'}</p>
              <span className={`status-badge ${resultData.passed ? 'status-pass' : 'status-fail'}`}>
                {resultData.passed ? <FaCircleCheck /> : <FaCircleXmark />}
                {resultData.passed ? 'Passed' : 'Not passed'}
              </span>
              {tabSwitchCount > 0 && (
                <p className="result-tab-warning">
                  <FaTriangleExclamation />
                  {tabSwitchCount} tab switch{tabSwitchCount > 1 ? 'es' : ''} recorded
                </p>
              )}
              <div className="share-buttons">
                <button className="share-btn" onClick={() => navigator.clipboard.writeText(`I scored ${resultData.percentage}% on ${currentTopic} Block ${currentBlock + 1} at AliverBiopharm!`)}>
                  <FaLink />
                </button>
              </div>
            </div>

            {adaptivePath && (
              <div className="adaptive-path-card">
                <div className="adaptive-path-icon"><FaLightbulb /></div>
                <div className="adaptive-path-content">
                  <h4>{resultData.passed ? 'Great Progress!' : 'Keep Going!'}</h4>
                  <p>{adaptivePath.message}</p>
                </div>
              </div>
            )}

            <div className="quiz-result-review">
              <h3>Block {currentBlock + 1} Review</h3>
            </div>
            {(resultData.answers || []).map((a, idx) => (
              <div key={idx} className="question-card quiz-review-card">
                <div className="review-header">
                  {a.isCorrect ? <FaCircleCheck className="review-icon-correct" /> : <FaCircleXmark className="review-icon-incorrect" />}
                  <p className="review-number">Q{idx + 1}</p>
                  {confidence[idx] && (
                    <span className={`review-confidence ${confidence[idx] === 'sure' ? 'review-sure' : 'review-unsure'}`}>
                      {confidence[idx] === 'sure' ? 'Was sure' : 'Was unsure'}
                    </span>
                  )}
                </div>
                <p className="review-question" dangerouslySetInnerHTML={{ __html: renderGlossary(a.question) }} />
                <p className="review-answer">Your answer: <span className={a.isCorrect ? 'review-correct' : 'review-incorrect'}>{a.userAnswerText}</span></p>
                {!a.isCorrect && <p className="review-correct-answer">Correct: <span className="review-correct">{a.correctAnswerText}</span></p>}
                <div className="review-explanation" dangerouslySetInnerHTML={{ __html: renderGlossary(a.explanation) }} />
              </div>
            ))}

            <div className="quiz-result-actions">
              {currentBlock + 1 < totalBlocks && <button className="btn-primary" onClick={() => startBlock(currentBlock + 1)}>Next Block →</button>}
              <button className="btn-secondary" onClick={() => { setCurrentTopic(''); setResultData(null); }}>← All Topics</button>
            </div>
          </div>
        ) : quizQuestions.length > 0 ? (
          <div className="quiz-session-container">
            <div className="question-palette">
              {quizQuestions.map((_, idx) => {
                let bgClass = 'palette-unanswered';
                if (userAnswers[idx]) {
                  bgClass = userAnswers[idx].correct ? 'palette-correct' : 'palette-incorrect';
                }
                const isDisabled = !canNavigateTo(idx, userAnswers);
                return (
                  <button
                    key={idx}
                    className={`question-palette-btn ${idx === currentIndex ? 'active' : ''} ${bgClass}`}
                    onClick={() => {
                      if (canNavigateTo(idx, userAnswers)) navigateTo(idx);
                      else showToast('Please answer previous questions first.', 'warning');
                    }}
                    disabled={isDisabled}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            {timeLeft !== null && (
              <div className="quiz-timer">
                <div className="quiz-timer-row">
                  <span className="quiz-timer-label">Time remaining</span>
                  <span className="quiz-timer-value" style={{ color: timerColor }}>
                    {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                  </span>
                </div>
                <div className="quiz-timer-track">
                  <div className="quiz-timer-fill" style={{ width: `${timerPercent}%`, backgroundColor: timerColor }} />
                </div>
              </div>
            )}

            <div className="progress-bar"><div className="progress-fill" style={{ '--progress-width': `${((currentIndex + 1) / quizQuestions.length) * 100}%` }} /></div>
            <p className="quiz-progress-text">Block {currentBlock + 1} • Q {currentIndex + 1}/{quizQuestions.length}</p>
            <p className="quiz-topic-label">{currentTopic}</p>

            <div className={`spinner-top-container ${showingSpinner ? 'visible' : ''}`}>
              <span className="answer-spinner"></span>
              <span className="spinner-text">{spinnerWord}</span>
            </div>

            <div className={`question-card ${questionTransition ? 'fade-out' : ''}`}>
              <h2 className="question-text" dangerouslySetInnerHTML={{ __html: renderGlossary(quizQuestions[currentIndex].question_text) }} />

              {['A','B','C','D'].map(opt => {
                const answered = userAnswers[currentIndex] !== null;
                const selected = userAnswers[currentIndex]?.selected;
                const correctOpt = userAnswers[currentIndex]?.correct_option;
                let cls = '';
                if (answered) {
                  if (opt === correctOpt) cls = 'correct';
                  else if (opt === selected) cls = 'incorrect';
                }
                return (
                  <button key={opt} className={`option-btn ${cls}`} disabled={answered || answerSubmitting || integrityOverlay} onClick={() => selectAnswer(opt)}>
                    <span className="option-letter">{opt}</span>
                    <span dangerouslySetInnerHTML={{ __html: renderGlossary(quizQuestions[currentIndex][`option_${opt.toLowerCase()}`]) }} />
                    {answered && opt === correctOpt && <FaCircleCheck className="option-icon-correct" />}
                    {answered && opt === selected && opt !== correctOpt && <FaCircleXmark className="option-icon-incorrect" />}
                  </button>
                );
              })}

              {userAnswers[currentIndex] === null && (
                <div className="confidence-btns">
                  <span>Confidence:</span>
                  <button onClick={() => setConfidenceForCurrent('sure')} className={`confidence-btn ${confidence[currentIndex] === 'sure' ? 'sure-active' : ''}`}>Sure</button>
                  <button onClick={() => setConfidenceForCurrent('unsure')} className={`confidence-btn ${confidence[currentIndex] === 'unsure' ? 'unsure-active' : ''}`}>Unsure</button>
                </div>
              )}
            </div>

            <div className="quiz-nav">
              {currentIndex > 0 && <button className="btn-secondary" onClick={prevQuestion}>← Prev</button>}
              {userAnswers[currentIndex] !== null && (
                firstUnanswered !== -1 && firstUnanswered !== currentIndex ? (
                  <button className="btn-primary" onClick={nextQuestion}>Next →</button>
                ) : currentIndex < quizQuestions.length - 1 && userAnswers[currentIndex] !== null ? (
                  <button className="btn-primary" onClick={nextQuestion}>Next →</button>
                ) : allAnswered ? (
                  <button className="btn-primary" onClick={submitBlockWithSession}>Submit Block</button>
                ) : null
              )}
            </div>
            <div className="keyboard-hint">💡 Press A B C D keys • ← → to navigate • Swipe on mobile</div>
          </div>
        ) : (
          <div className="quiz-block-select">
            <h2 className="block-title">{currentTopic}</h2>
            <div className="block-nav">
              {totalBlocks === 0 ? (
                <p className="block-empty">No blocks available for this topic.</p>
              ) : (
                Array.from({ length: totalBlocks }).map((_, i) => {
                  const topicData = allTopics.find(t => t.topic_name === currentTopic);
                  const locked = topicData?.locked_blocks?.includes(i);
                  const completed = topicData?.completed_blocks?.includes(i);
                  let icon = null;
                  let cls = '';
                  if (locked) {
                    cls = 'locked';
                    icon = <FaLock className="block-icon-locked" />;
                  } else if (completed) {
                    cls = 'completed';
                    icon = <FaCircleCheck className="block-icon-completed" />;
                  } else {
                    icon = <FaCircleCheck className="block-icon-available" />;
                  }
                  return (
                    <button key={i} className={`block-nav-btn ${cls}`} disabled={locked} onClick={() => startBlock(i)}>
                      {icon} Block {i + 1}
                    </button>
                  );
                })
              )}
            </div>
            <button className="btn-secondary" onClick={() => setCurrentTopic('')}>← Back</button>
          </div>
        )}

        {showRulesModal && (
          <div className="modal-overlay" onClick={() => setShowRulesModal(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
              <h3 className="modal-title">Quiz Rules</h3>
              <ul className="modal-rules">
                <li><FaCircleCheck className="rule-icon" /> 10 questions per block</li>
                <li><FaCircleCheck className="rule-icon" /> 70% to pass</li>
                <li><FaCircleCheck className="rule-icon" /> Immediate feedback per question</li>
                <li><FaCircleCheck className="rule-icon" /> Full explanations on review</li>
                <li><FaCircleCheck className="rule-icon" /> 10-minute time limit</li>
                <li><FaCircleCheck className="rule-icon" /> Block locks for 24h after completion</li>
                <li><FaTriangleExclamation className="rule-icon-warning" /> Tab switches are recorded</li>
                <li><FaTriangleExclamation className="rule-icon-danger" /> {MAX_TAB_SWITCHES} tab switches auto-submits and locks this block for 48 hours</li>
              </ul>
              <button className="btn-primary modal-confirm" onClick={confirmStartBlock}>I understand, let's begin!</button>
            </div>
          </div>
        )}

        {showResumeModal && resumeData && (
          <div className="modal-overlay" onClick={handleDiscardResume}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
              <h3 className="modal-title">Resume Previous Quiz</h3>
              <p className="resume-detail"><strong>Topic:</strong> {resumeData.topic || 'Unknown'}</p>
              <p className="resume-detail"><strong>Block:</strong> {resumeData.block !== undefined ? resumeData.block + 1 : '?'}</p>
              <p className="resume-detail"><strong>Question:</strong> {(resumeData.index !== undefined ? resumeData.index : 0) + 1} of {resumeData.totalQuestions || resumeData.questions?.length || '?'}</p>
              <p className="resume-question">Would you like to continue where you left off?</p>
              <div className="resume-actions">
                <button className="btn-primary" onClick={handleResume}>Resume</button>
                <button className="btn-secondary" onClick={handleDiscardResume}>Start Fresh</button>
              </div>
            </div>
          </div>
        )}

        {showLeaderboard && (
          <div className="modal-overlay" onClick={() => setShowLeaderboard(false)}>
            <div className="leaderboard-modal" onClick={e => e.stopPropagation()}>
              <div className="leaderboard-header">
                <h3><FaTrophy className="leaderboard-trophy" />Leaderboard — {level || 'O-Level'}</h3>
                <button className="leaderboard-close" onClick={() => setShowLeaderboard(false)}><FaXmark /></button>
              </div>
              {leaderboardLoading ? (
                <p className="leaderboard-empty">Loading...</p>
              ) : leaderboard.length === 0 ? (
                <p className="leaderboard-empty">No data yet. Be the first!</p>
              ) : (
                leaderboard.map((entry, idx) => (
                  <div key={idx} className="leaderboard-entry">
                    <span className={`leaderboard-rank ${idx === 0 ? 'gold' : idx === 1 ? 'silver' : idx === 2 ? 'bronze' : 'other'}`}>{idx + 1}</span>
                    <span className="leaderboard-name">{entry.user_name || entry.email?.split('@')[0] || 'Learner'}</span>
                    <span className="leaderboard-score">{entry.avg_score || entry.percentage || 0}%</span>
                    <span className="leaderboard-attempts">{entry.total_attempts || entry.attempts || 0} attempts</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {integrityOverlay && (
          <div className="integrity-overlay">
            <div className="integrity-card">
              <FaShieldHalved className="integrity-icon" />
              <h2 className="integrity-title">Quiz Auto-Submitted</h2>
              <p className="integrity-text">
                To maintain academic integrity on AliverBiopharm, switching away from this tab during a timed
                assessment is not permitted. Your answers have been submitted based on your progress so far, and
                this block is now locked for <strong>48 hours</strong>.
              </p>
              <p className="integrity-countdown">
                Returning to Block selection in <strong className="countdown-highlight">{integrityCountdown}s</strong>...
              </p>
              <button className="btn-primary integrity-back" onClick={returnToBlockList}>
                Back to Blocks Now
              </button>
            </div>
          </div>
        )}

        {toast && (
          <div className={`toast toast-${toast.type}`}>
            {toast.message}
          </div>
        )}
      </div>
    </QuizErrorBoundary>
  );
}
