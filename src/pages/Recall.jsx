import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  FaBrain,
  FaCheck,
  FaTrophy,
  FaFire,
  FaStar,
  FaChartLine,
  FaPencil,
  FaCircleInfo,
  FaMicroscope,
  FaDna,
  FaCapsules,
  FaBookOpen,
  FaBullseye,
  FaLeaf,
  FaFlask,
  FaTree,
  FaSeedling,
  FaStarOfLife,
  FaChartSimple,
  FaCalendarDay,
  FaCircleCheck,
  FaLink,
  FaTriangleExclamation,
  FaExclamation,
  FaDownload,
  FaClock,
  FaVolumeHigh,
  FaVolumeXmark,
  FaRotate,
  FaHouse,
  FaArrowLeft,
  FaArrowRight,
  FaSpinner
} from 'react-icons/fa6';
import { useAuth } from '../contexts/AuthContext';
import { useRequireOnboarding } from '../hooks/useRequireOnboarding';
import { useLevelFilter } from '../hooks/useLevelFilter';
import { useContentAccess } from '../hooks/useContentAccess';
import {
  getRecallSession,
  checkRecallSession,
  getRecallStats,
  getRecallAchievements,
  getRecallDashboard,
  getRecallTopics,
  continueRecallSession,
  submitRecallAnswer,
  completeRecallSession,
  getLeaderboard
} from '../api/cachedClient';
import { PendingApprovalScreen } from '../components/access/PendingApprovalScreen';
import useLoading from '../loading/useLoading';
import InlineSpinner from '../loading/components/InlineSpinner';


const strengthIcons = {
  excellent: FaStar,
  strong: FaCircleCheck,
  developing: FaRotate
};

function escapeHtml(unsafe) {
  if (!unsafe) return '';
  return unsafe.replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]));
}

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
        osc.start(now);
        osc.stop(now + 0.5);
        break;
      case 'strong':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.setValueAtTime(554.37, now + 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
        break;
      case 'developing':
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(330, now);
        osc.frequency.setValueAtTime(294, now + 0.15);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        osc.start(now);
        osc.stop(now + 0.4);
        break;
      case 'achievement':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.setValueAtTime(659.25, now + 0.12);
        osc.frequency.setValueAtTime(783.99, now + 0.24);
        osc.frequency.setValueAtTime(1046.5, now + 0.36);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
        osc.start(now);
        osc.stop(now + 0.6);
        break;
      default:
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
    }
  } catch {}
}

export default function BioRecall() {
  const { user } = useAuth();
  const { isReady } = useRequireOnboarding();
  const access = useContentAccess();
  const { level, showAll } = useLevelFilter();

  const [sessionQuestions, setSessionQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sessionActive, setSessionActive] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [userAnswersRecord, setUserAnswersRecord] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [xpTotal, setXpTotal] = useState(0);
  const [streakDays, setStreakDays] = useState(0);
  const [masteryTopics, setMasteryTopics] = useState({});
  const [topicXpMap, setTopicXpMap] = useState({});
  const [topicStreakMap, setTopicStreakMap] = useState({});
  const [brainEnergy, setBrainEnergy] = useState(100);
  const [hasMoreQuestions, setHasMoreQuestions] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [sessionReport, setSessionReport] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [achievementsList, setAchievementsList] = useState([]);
  const [topicModalOpen, setTopicModalOpen] = useState(false);
  const [topicList, setTopicList] = useState([]);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [loading, setLoading] = useState(true);
  const [feedbackResult, setFeedbackResult] = useState(null);
  const [message, setMessage] = useState(null);
  const [showConfirm, setShowConfirm] = useState(null);
  const [debugLog, setDebugLog] = useState([]);
  const countdownRef = useRef(null);
  const answerInputRef = useRef(null);
  const [countdown, setCountdown] = useState(8);
  const [spinnerMessage, setSpinnerMessage] = useState('');
  const [floatingCards, setFloatingCards] = useState(false);
  const [floatingConcepts, setFloatingConcepts] = useState([]);
  const { show, hide } = useLoading();
  const [leaderboard, setLeaderboard] = useState([]);
  const [heatmap, setHeatmap] = useState([]);
  const [showConfetti, setShowConfetti] = useState(false);
  const confettiCanvasRef = useRef(null);
  const [questionStartTime, setQuestionStartTime] = useState(null);
  const [rankTitle, setRankTitle] = useState('Beginner');
  const [xpProgress, setXpProgress] = useState({ level: 1, xpIntoLevel: 0, xpToNext: 100, progressPercent: 0 });
  const [masteryAverage, setMasteryAverage] = useState(0);
  const [spinMessages, setSpinMessages] = useState(['Checking...', 'Reviewing...', 'Feedback ready']);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    try { return localStorage.getItem('bioRecall_sound') !== 'off'; } catch { return true; }
  });
  const isMounted = useRef(true);

  useEffect(() => {
    const handleFirstInteraction = () => {
      getAudioContext();
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('touchstart', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
    };
    window.addEventListener('click', handleFirstInteraction);
    window.addEventListener('touchstart', handleFirstInteraction);
    window.addEventListener('keydown', handleFirstInteraction);
    return () => {
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('touchstart', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
    };
  }, []);

  const playSound = useCallback((type) => {
    if (!soundEnabled) return;
    playTone(type);
  }, [soundEnabled]);

  const toggleSound = () => {
    setSoundEnabled(prev => {
      const next = !prev;
      try { localStorage.setItem('bioRecall_sound', next ? 'on' : 'off'); } catch {}
      return next;
    });
  };

  const safeHide = useCallback(() => {
    if (isMounted.current) { try { hide(); } catch {} }
  }, [hide]);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; try { hide(); } catch {} };
  }, [hide]);

  const addDebug = (msg) => {
    setDebugLog(prev => [...prev.slice(-10), `${new Date().toISOString().slice(11, 19)} ${msg}`]);
  };

  useEffect(() => {
    document.body.classList.remove('theme-olevel', 'theme-alevel', 'theme-pharmacy');
    if (level === 'O-Level') document.body.classList.add('theme-olevel');
    else if (level === 'A-Level') document.body.classList.add('theme-alevel');
    else if (level === 'Pharmacy') document.body.classList.add('theme-pharmacy');
  }, [level]);

  useEffect(() => {
    if (!isReady || !access.canAccess || access.isPending || !level) return;
    (async () => {
      try {
        await loadUserProgress(level);
        if (!isMounted.current) return;
        await restoreActiveSession(level);
        if (!isMounted.current) return;
        await fetchDashboardAndAchievements(level);
      } catch (e) {
        console.error(e);
        if (isMounted.current) setMessage({ text: 'Could not load your progress. Please refresh.', type: 'warning' });
      } finally {
        if (isMounted.current) setLoading(false);
      }
    })();
  }, [isReady, access.canAccess, access.isPending, level]);

  const loadUserProgress = async (lvl) => {
    if (!lvl) return;
    try {
      const stats = await getRecallStats();
      if (!isMounted.current) return;
      if (stats) {
        setXpTotal(stats.total_xp || 0);
        setStreakDays(stats.streak_days || 0);
        setMasteryTopics(stats.topic_mastery || {});
        setTopicXpMap(stats.topic_xp || {});
        setTopicStreakMap(stats.topic_streak || {});
        setHeatmap(stats.heatmap || []);
        setRankTitle(stats.rank_title || 'Beginner');
        setXpProgress(stats.xp_progress || { level: 1, xpIntoLevel: 0, xpToNext: 100, progressPercent: 0 });
        setMasteryAverage(stats.mastery_average || 0);
      }
    } catch (e) {
      console.error('loadUserProgress', e);
      if (isMounted.current) setMessage({ text: 'Could not load your progress. Please refresh.', type: 'warning' });
    }
  };

  const restoreActiveSession = async (lvl) => {
    try {
      const session = await getRecallSession({ level: lvl });
      if (!isMounted.current) return false;
      if (session && session.questions?.length && session.session_id) {
        setSessionQuestions(session.questions);
        setHasMoreQuestions(session.has_more === true);
        setSessionId(session.session_id);
        setCurrentIndex(session.current_index || 0);
        setUserAnswersRecord(session.user_answers || []);
        setSessionActive(true);
        setShowReport(false);
        setQuestionStartTime(new Date());
        setMessage({ text: 'Your previous session was restored.', type: 'info' });
        return true;
      }
    } catch {
      return false;
    }
    return false;
  };

  const fetchDashboardAndAchievements = async (lvl) => {
    try {
      const [dash, ach, lb] = await Promise.all([
        getRecallDashboard(),
        getRecallAchievements(),
        getLeaderboard(lvl, 10).catch(() => [])
      ]);
      if (!isMounted.current) return;
      setDashboardData(dash);
      setAchievementsList(ach);
      setLeaderboard(Array.isArray(lb) ? lb : []);
      if (dash?.spin_messages) setSpinMessages(dash.spin_messages);
      if (dash?.floating_concepts) setFloatingConcepts(dash.floating_concepts);
      if (dash?.mastery_average !== undefined) setMasteryAverage(dash.mastery_average);
    } catch (e) {
      console.error('Dashboard fetch failed', e);
    }
  };

  const triggerConfetti = () => {
    setShowConfetti(true);
    setTimeout(() => { if (isMounted.current) setShowConfetti(false); }, 3000);
  };

  useEffect(() => {
    if (!showConfetti || !confettiCanvasRef.current) return;
    const canvas = confettiCanvasRef.current;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const particles = [];
    for (let i = 0; i < 120; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height - canvas.height,
        r: Math.random() * 6 + 2,
        d: Math.random() * 20 + 10,
        color: `hsl(${Math.random() * 360}, 80%, 60%)`,
        tilt: Math.random() * 10 - 5
      });
    }
    let animationId;
    const draw = () => {
      if (!isMounted.current) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;
      particles.forEach(p => {
        p.y += (p.d / 10);
        p.x += Math.sin(p.tilt);
        if (p.y > canvas.height + 10) return;
        alive = true;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
      });
      if (alive && showConfetti) animationId = requestAnimationFrame(draw);
      else if (isMounted.current) setShowConfetti(false);
    };
    draw();
    return () => { if (animationId) cancelAnimationFrame(animationId); };
  }, [showConfetti]);

  const openTopicModal = async () => {
    try {
      const topics = await getRecallTopics(level);
      if (!isMounted.current) return;
      setTopicList(topics || []);
      setTopicModalOpen(true);
    } catch {
      if (isMounted.current) { setTopicList([]); setTopicModalOpen(true); }
    }
  };

  const startSession = async (topic = null) => {
    setLoading(true);
    show('quiz', 'Preparing session...');
    try {
      await checkRecallSession({ level, topic });
    } catch (e) {
      if (isMounted.current) {
        setMessage({ text: e.message === 'Daily session already completed' ? "You've already completed today's session. Come back tomorrow!" : e.message, type: 'warning' });
        setLoading(false);
        safeHide();
      }
      return;
    }
    try {
      const session = await getRecallSession({ level, topic });
      if (!isMounted.current) return;
      if (session && session.questions?.length) {
        setSessionQuestions(session.questions);
        setHasMoreQuestions(session.has_more === true);
        setSessionId(session.session_id);
        setCurrentIndex(session.current_index || 0);
        setUserAnswersRecord(session.user_answers || []);
        setSessionActive(true);
        setSelectedTopic(topic);
        setShowReport(false);
        setSessionReport(null);
        setFeedbackResult(null);
        setDebugLog([]);
        setQuestionStartTime(new Date());
        setFloatingCards(true);
        setTimeout(() => { if (isMounted.current) setFloatingCards(false); }, 2800);
      } else {
        setMessage({ text: 'No recall questions available for this level and topic yet.', type: 'warning' });
      }
    } catch (e) {
      if (isMounted.current) setMessage({ text: e.message, type: 'error' });
    } finally {
      if (isMounted.current) setLoading(false);
      safeHide();
    }
  };

  const handleAnswerSubmission = async () => {
    if (analyzing || !sessionActive || !user) return;
    const answer = answerInputRef.current?.value.trim();
    if (!answer) return;
    const question = sessionQuestions[currentIndex];
    setAnalyzing(true);
    setFeedbackResult(null);
    setMessage(null);
    addDebug(`Submitting answer for question ${question?.id}`);
    show('quiz', 'Checking your answer...');
    if (navigator.vibrate) navigator.vibrate(50);
    const startedAt = questionStartTime ? questionStartTime.toISOString() : new Date().toISOString();
    let idx = 0;
    setSpinnerMessage(spinMessages[0]);
    const spinnerInterval = setInterval(() => {
      if (!isMounted.current) return;
      idx = (idx + 1) % spinMessages.length;
      setSpinnerMessage(spinMessages[idx]);
    }, 1500);
    try {
      addDebug('Calling submitRecallAnswer...');
      const result = await submitRecallAnswer({
        session_id: sessionId,
        question_id: question.id,
        user_answer: answer,
        nonce: crypto.randomUUID?.() || Math.random().toString(36),
        started_at: startedAt
      });
      clearInterval(spinnerInterval);
      if (!isMounted.current) return;
      addDebug(`Got result: strength=${result.strength}`);
      if (!result || typeof result !== 'object') {
        addDebug('ERROR: result is null or not an object');
        setMessage({ text: 'Server returned an empty response. Please try again.', type: 'error' });
        return;
      }
      setFeedbackResult(result);
      playSound(result.strength);
      if (result.strength === 'excellent') triggerConfetti();
      if (result.leveled_up) { triggerConfetti(); playSound('achievement'); }
      if (result.daily_quest_completed) { triggerConfetti(); playSound('achievement'); }
      if (result.xp_progress) setXpProgress(result.xp_progress);
      if (result.rank_title) setRankTitle(result.rank_title);
      if (result.mastery_average !== undefined) setMasteryAverage(result.mastery_average);
      setXpTotal(prev => prev + (result.xp || 0));
      setCountdown(8);
      if (countdownRef.current) clearInterval(countdownRef.current);
      countdownRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) { clearInterval(countdownRef.current); if (isMounted.current) moveToNextQuestion(); return 8; }
          return prev - 1;
        });
      }, 1000);
      safeHide();
      const detailedAnswer = {
        question: question.text,
        userAnswer: answer,
        correctAnswer: result.feedback?.correct_answer,
        strength: result.strength,
        xp: result.xp,
        feedback: result.feedback,
        commonMistakeExplanation: result.common_mistake_explanation,
        studyNote: result.study_note,
        topic: question.topic,
        answeredAt: new Date().toISOString(),
        timeTaken: result.time_taken_seconds || 0,
        timeTakenFormatted: result.time_taken_formatted || '0s'
      };
      setUserAnswersRecord(prev => [...prev, detailedAnswer]);
      setBrainEnergy(prev => Math.max(0, prev - 5));
      await loadUserProgress(level);
      await fetchDashboardAndAchievements(level);
    } catch (err) {
      clearInterval(spinnerInterval);
      safeHide();
      if (!isMounted.current) return;
      addDebug(`CATCH ERROR: ${err.message}`);
      if (err.message === 'Question already answered') {
        setMessage({ text: 'You have already answered this question. Moving to the next one...', type: 'warning' });
        moveToNextQuestion();
      } else {
        setMessage({ text: `Error: ${err.message || 'Unknown server error'}`, type: 'error' });
      }
    } finally {
      if (isMounted.current) setAnalyzing(false);
    }
  };

  const moveToNextQuestion = () => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    setFeedbackResult(null);
    setDebugLog([]);
    if (currentIndex + 1 < sessionQuestions.length) {
      setCurrentIndex(prev => prev + 1);
      setQuestionStartTime(new Date());
      if (answerInputRef.current) { answerInputRef.current.value = ''; answerInputRef.current.focus(); }
    } else {
      if (hasMoreQuestions) {
        setShowConfirm({
          message: 'You have completed 5 questions. Would you like to continue with 5 more? You will receive +5 XP bonus.',
          onConfirm: async () => {
            show('quiz', 'Loading more questions...');
            try {
              const result = await continueRecallSession({ session_id: sessionId });
              if (!isMounted.current) return;
              if (result && result.questions?.length) {
                setSessionQuestions(prev => [...prev, ...result.questions]);
                setHasMoreQuestions(result.has_more);
                setCurrentIndex(prev => prev + 1);
                setXpTotal(prev => prev + 5);
                setQuestionStartTime(new Date());
              } else { await endSession(); }
            } catch (e) {
              if (isMounted.current) setMessage({ text: 'Failed to load more questions.', type: 'error' });
            } finally { safeHide(); }
          },
          onCancel: () => endSession()
        });
      } else { endSession(); }
    }
  };

  const endSession = async () => {
    setSessionActive(false);
    show('form', 'Saving your progress...');
    try {
      if (sessionId) {
        const completeResult = await completeRecallSession({ session_id: sessionId });
        if (isMounted.current && completeResult?.report) {
          setSessionReport(completeResult.report);
        }
        if (isMounted.current && completeResult?.streak_days !== undefined) {
          setStreakDays(completeResult.streak_days);
        }
      }
    } catch (_) {}
    if (!isMounted.current) return;
    setShowReport(true);
    await loadUserProgress(level);
    setBrainEnergy(100);
    safeHide();
  };

  const startSessionFromTopicModal = (topic) => {
    setTopicModalOpen(false);
    startSession(topic);
  };

  const exportStudyNotes = () => {
    if (!userAnswersRecord.length) return;
    const totalTime = sessionReport?.total_time_formatted || '0s';
    let content = `BioRecall Study Notes \u2013 ${level}\nSession Date: ${new Date().toLocaleDateString()}\nTotal Questions: ${userAnswersRecord.length}\nTotal Time: ${totalTime}\n\n`;
    userAnswersRecord.forEach((item, idx) => {
      content += `Q${idx + 1}: ${item.question}\nYour answer: ${item.userAnswer}\nCorrect answer: ${item.correctAnswer}\nStrength: ${item.strength} (XP: ${item.xp})\nTime: ${item.timeTakenFormatted || '0s'}\n`;
      if (item.feedback?.answer_explanation) content += `Explanation: ${item.feedback.answer_explanation}\n`;
      if (item.studyNote) content += `Study Note: ${item.studyNote}\n`;
      if (item.commonMistakeExplanation) content += `Common Confusion: ${item.commonMistakeExplanation}\n`;
      content += '\n';
    });
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `BioRecall_notes_${new Date().toISOString().slice(0, 10)}.txt`;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      if (a.parentNode) {
        a.parentNode.removeChild(a);
      }
      URL.revokeObjectURL(url);
    }, 100);
  };

  const renderWeakTopicAlert = () => {
    if (!masteryTopics || !Object.keys(masteryTopics).length) return null;
    const weak = Object.entries(masteryTopics).filter(([, val]) => val <= 50);
    if (!weak.length) return null;
    return (
      <div className="weak-topic-alert">
        <FaTriangleExclamation />
        Weak Topics: {weak.map(([t, v]) => `${t} (${Math.round(v)}%)`).join(', ')}
        <span className="weak-topic-hint">Focus on these topics!</span>
      </div>
    );
  };

  const renderHeatmap = () => {
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 365);
    const days = [];
    for (let d = new Date(startDate); d <= today; d.setDate(d.getDate() + 1)) {
      days.push(d.toISOString().split('T')[0]);
    }
    const heatmapMap = {};
    heatmap.forEach(h => { heatmapMap[h.date] = h; });
    return (
      <div className="heatmap-container">
        <div className="heatmap-grid">
          {days.map(date => {
            const entry = heatmapMap[date];
            const intensity = entry?.intensity || 0;
            const count = entry?.count || 0;
            return (
              <div
                key={date}
                className={`heatmap-cell heatmap-level-${intensity}`}
                title={`${date}: ${count} questions`}
              />
            );
          })}
        </div>
      </div>
    );
  };

  const renderLeaderboard = () => {
    if (!leaderboard.length) return null;
    return (
      <div className="leaderboard-panel">
        <h3 className="leaderboard-title"><FaTrophy /> Leaderboard</h3>
        <table className="leaderboard-table">
          <thead>
            <tr><th>Rank</th><th>User</th><th>XP</th><th>Level</th></tr>
          </thead>
          <tbody>
            {leaderboard.map((entry, idx) => (
              <tr key={idx}>
                <td>{idx + 1}</td>
                <td>{escapeHtml(entry.username || entry.email || 'Anonymous')}</td>
                <td>{entry.total_xp}</td>
                <td>{entry.recall_level}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderConfettiCanvas = () => (
    <canvas ref={confettiCanvasRef} className="confetti-canvas" style={{ display: showConfetti ? 'block' : 'none' }} />
  );

  useEffect(() => {
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, []);

  const renderDebugPanel = () => {
    if (!debugLog.length) return null;
    return (
      <div className="debug-panel">
        {debugLog.map((line, i) => <div key={i}>{line}</div>)}
      </div>
    );
  };

  const renderDashboard = () => {
    if (!dashboardData) return null;
    const topicEntries = Object.entries(masteryTopics).filter(([t]) => t && t !== 'null').slice(0, 6);
    const daily = dashboardData.dailyChallenge || {};
    const isQuestComplete = daily.isCompleted || (daily.completed >= daily.target);
    return (
      <div className="dashboard-grid">
        <div className="dashboard-card">
          <div className="card-title">
            <FaBullseye size="2.5rem" color={isQuestComplete ? '#27ae60' : 'var(--primary)'} />
            Daily Challenge
            {isQuestComplete && <FaCheck color="#27ae60" />}
          </div>
          <div>{isQuestComplete ? 'Quest Complete!' : `Complete ${daily.target || 10} Recall Questions`}</div>
          <div>Progress: {daily.completed || 0} / {daily.target || 10}</div>
          <div className="progress-bar-bg">
            <div className="progress-bar-fill" style={{ width: `${Math.min(daily.progressPercent || 0, 100)}%` }} />
          </div>
          <div>Reward: +50 XP</div>
        </div>
        <div className="dashboard-card">
          <div className="card-title"><FaChartSimple size="2.5rem" color="var(--primary)" /> XP Progress</div>
          <div>Level {xpProgress.level} · <span className="rank-label">{rankTitle}</span></div>
          <div className="xp-progress">{xpProgress.xpIntoLevel} / 100 XP to next level</div>
          <div className="progress-bar-bg">
            <div className="progress-bar-fill" style={{ width: `${xpProgress.progressPercent}%` }} />
          </div>
        </div>
        <div className="dashboard-card">
          <div className="card-title"><FaTrophy size="2.5rem" color="gold" /> Achievements</div>
          <div className="achievement-grid">
            {achievementsList.map((ach) => (
              <div key={ach.key} className={`achievement-item ${ach.unlocked ? 'unlocked' : 'locked'}`}>
                <i className={`fa-solid ${ach.icon} achievement-icon`}></i>
                <div className="achievement-title">{ach.title}</div>
              </div>
            ))}
          </div>
        </div>
        {dashboardData.dueForReview > 0 && (
          <div className="dashboard-card">
            <div className="card-title"><FaClock size="2.5rem" color="#e67e22" /> Spaced Repetition</div>
            <div>{dashboardData.dueForReview} items due for review today</div>
          </div>
        )}
        <div className="dashboard-card">
          <div className="card-title"><FaBrain size="2.5rem" color="#9b59b6" /> Brain Energy</div>
          <div className="progress-bar-bg">
            <div className="progress-bar-fill" style={{ width: `${brainEnergy}%` }} />
          </div>
          <div>{brainEnergy}% energy remaining</div>
        </div>
        <div className="dashboard-card">
          <div className="card-title"><FaLeaf size="2.5rem" color="#27ae60" /> Memory Garden</div>
          <div className="memory-garden">
            {dashboardData.gardenStage === 'tree' ? <FaTree size="3rem" /> : <FaSeedling size="3rem" />}
          </div>
          <div>{dashboardData.streak} day streak</div>
        </div>
        <div className="dashboard-card" style={{ cursor: 'pointer' }} onClick={toggleSound}>
          <div className="card-title">
            {soundEnabled ? <FaVolumeHigh size="2.5rem" color="var(--primary)" /> : <FaVolumeXmark size="2.5rem" color="#999" />}
            Sound Effects
          </div>
          <div>{soundEnabled ? 'On' : 'Off'} (click to toggle)</div>
        </div>
        <div className="dashboard-card">
          <div className="card-title"><FaFlask size="2.5rem" color="#3498db" /> Subject</div>
          <div className="subject-illustration"><i className={`fa-solid ${dashboardData.subjectIllustration}`}></i></div>
          <div>{level}</div>
        </div>
        <div className="dashboard-card">
          <div className="card-title"><FaStarOfLife size="2.5rem" color="var(--primary)" /> Topic Mastery</div>
          <div className="topic-icon-grid">
            {topicEntries.map(([topic, mastery]) => (
              <div key={topic} className="topic-icon-card">
                <div className="topic-big-icon"><FaBookOpen /></div>
                <div className="topic-name">{escapeHtml(topic)}</div>
                <div className="topic-mastery">{Math.round(mastery)}%</div>
              </div>
            ))}
          </div>
        </div>
        <div className="dashboard-card">
          <div className="card-title"><FaBookOpen size="2.5rem" color="var(--primary)" /> Quote</div>
          <div className="quote-text">{dashboardData.quote}</div>
        </div>
        <div className="dashboard-card">
          <div className="card-title"><FaCalendarDay size="2.5rem" color="var(--primary)" /> Activity Heatmap</div>
          {renderHeatmap()}
        </div>
      </div>
    );
  };

  const renderReport = () => {
    const report = sessionReport || {};
    return (
      <div className="report-screen">
        <div className="recall-card">
          <FaChartSimple size="3rem" color="var(--primary)" />
          <h2>Today's Recall Report</h2>
          <p>Reviewed: {sessionQuestions.length}</p>
          <p>Excellent: {report.excellent || 0} · Strong: {report.strong || 0} · Developing: {report.developing || 0}</p>
          <p>Mastery: {report.mastery_score || 0}%</p>
          <p><FaClock /> Total time: {report.total_time_formatted || '0s'} | Avg per question: {report.avg_time_formatted || '0s'}</p>
          <p>Top Topic: {report.top_topic || 'N/A'}</p>
          <p><FaFire color="#e67e22" /> Streak: {streakDays} days</p>
          <div className="report-actions">
            <button className="btn-check" onClick={() => { setShowReport(false); setSessionActive(false); }}>See You Tomorrow</button>
            <button className="export-btn" onClick={exportStudyNotes}><FaDownload /> Export Notes</button>
          </div>
        </div>
      </div>
    );
  };

  const renderFeedback = () => {
    if (!feedbackResult) return null;
    const { strength, xp, matched, feedback, common_mistake_explanation, study_note, diff, strength_meaning } = feedbackResult;
    const strengthClass = strength === 'excellent' ? 'strength-excellent' : strength === 'strong' ? 'strength-strong' : 'strength-developing';
    const Icon = strengthIcons[strength] || FaCircleInfo;
    const label = strength_meaning?.label || strength;
    const description = strength_meaning?.description || '';
    const color = strength_meaning?.color || 'var(--primary)';
    return (
      <div className="feedback-area">
        <div className={`recall-strength ${strengthClass}`}>
          <Icon size="1.5rem" color={color} />
          <div>
            <div className="strength-label" style={{ color }}>{label}</div>
            <div className="strength-description">{description}</div>
          </div>
        </div>
        <div className="feedback-matched">Matched: <strong>{escapeHtml(matched)}</strong></div>
        <div className="feedback-xp"><FaTrophy color="#f1c40f" /> +{xp} XP</div>
        {diff && diff.your_answer && (
          <div className="feedback-comparison">
            <h4><FaExclamation color="#e67e22" /> Answer Comparison</h4>
            <div className="comparison-row">
              <div>Your answer: <span className="comparison-wrong">{escapeHtml(diff.your_answer)}</span></div>
              <div>Correct answer: <span className="comparison-correct">{escapeHtml(diff.correct_answer)}</span></div>
              {diff.was_common_mistake && <div className="common-mistake-tag">This is a common mistake. See explanation below.</div>}
            </div>
          </div>
        )}
        {feedback?.answer_explanation && (
          <div className="feedback-section">
            <h4><FaBookOpen color="var(--primary)" /> Explanation</h4>
            <div>{feedback.answer_explanation}</div>
          </div>
        )}
        {feedback?.related_concepts?.length > 0 && (
          <div className="feedback-section">
            <h4><FaLink color="var(--primary)" /> Related Concepts</h4>
            <ul className="concept-list">
              {feedback.related_concepts.map((c, i) => <li key={i}><strong>{escapeHtml(c)}</strong></li>)}
            </ul>
          </div>
        )}
        {common_mistake_explanation && (
          <div className="feedback-section">
            <h4><FaTriangleExclamation color="#e74c3c" /> Common Confusion</h4>
            <div>{escapeHtml(common_mistake_explanation)}</div>
          </div>
        )}
        {study_note && <div className="study-note"><FaCircleInfo /> Study Note: {escapeHtml(study_note)}</div>}
      </div>
    );
  };

  const renderQuestion = () => {
    const question = sessionQuestions[currentIndex];
    return (
      <div className={`flip-card ${feedbackResult ? 'flipped' : ''}`}>
        <div className="flip-card-inner">
          <div className="flip-card-front">
            <div className="progress-badge">Question {currentIndex + 1} of {sessionQuestions.length}</div>
            <div className="question-text">{escapeHtml(question?.text)}</div>
            <input
              type="text"
              className="answer-input"
              placeholder="Type your answer..."
              ref={answerInputRef}
              disabled={analyzing}
              onKeyDown={(e) => { if (e.key === 'Enter' && !analyzing && sessionActive) handleAnswerSubmission(); }}
            />
            <button
              className="btn-check"
              onClick={handleAnswerSubmission}
              disabled={analyzing || !sessionActive}
            >
              {analyzing ? <><InlineSpinner /> Checking...</> : <><FaPencil /> Check</>}
            </button>
            {analyzing && !feedbackResult && (
              <div className="spinner-overlay">
                {spinnerMessage}
                <span className="dot-spin"></span>
                <span className="dot-spin"></span>
                <span className="dot-spin"></span>
              </div>
            )}
            {message && <div className={`user-message ${message.type}`}>{message.text}</div>}
            {renderDebugPanel()}
          </div>
          <div className="flip-card-back">
            {renderFeedback()}
            {!analyzing && feedbackResult && (
              <div className="next-timer">
                <div className="countdown">Next in {countdown}s</div>
                <button className="next-btn" onClick={moveToNextQuestion}>Next</button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderFloatingCards = () => {
    if (!floatingCards) return null;
    const items = floatingConcepts.length ? floatingConcepts : ['Cell', 'DNA', 'Enzyme'];
    const icon = level === 'O-Level' ? <FaMicroscope /> : level === 'A-Level' ? <FaDna /> : <FaCapsules />;
    const cards = Array.from({ length: 12 }, (_, i) => {
      const text = items[Math.floor(Math.random() * items.length)];
      return (
        <div key={i} className="float-card" style={{ top: `${Math.random() * 70 + 10}%`, left: '-100px' }}>
          {icon} <span>{text}</span>
        </div>
      );
    });
    return <div className="floating-cards-area">{cards}</div>;
  };

  const renderTopicModal = () => (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3 className="modal-title">Choose a topic for {level}</h3>
        <div className="modal-topics">
          {topicList.length === 0 ? <p>Loading topics...</p> : topicList.map(t => (
            <button key={t.topic_name} className="option-btn" onClick={() => startSessionFromTopicModal(t.topic_name)}>
              {t.topic_name}
            </button>
          ))}
        </div>
        <button className="option-btn" onClick={() => { setTopicModalOpen(false); startSession(null); }}>All topics (any order)</button>
        <button className="modal-cancel" onClick={() => setTopicModalOpen(false)}>Cancel</button>
      </div>
    </div>
  );

  const renderConfirm = () => {
    if (!showConfirm) return null;
    return (
      <div className="modal-overlay">
        <div className="modal-content">
          <p className="confirm-message">{showConfirm.message}</p>
          <div className="confirm-actions">
            <button className="option-btn" onClick={() => { showConfirm.onConfirm(); setShowConfirm(null); }}>Yes, continue</button>
            <button className="option-btn" onClick={() => { showConfirm.onCancel(); setShowConfirm(null); }}>No, finish</button>
          </div>
        </div>
      </div>
    );
  };

  if (!isReady || access.isPending) {
    return <PendingApprovalScreen />;
  }

  if (!access.canAccess) {
    return <div className="recall-access-denied">Access restricted. Please contact support.</div>;
  }

  if (loading) {
    return (
      <div className="recall-loading">
        <div className="spinner-colors">
          <div className="spinner-dot-color"></div>
          <div className="spinner-dot-color"></div>
          <div className="spinner-dot-color"></div>
          <div className="spinner-dot-color"></div>
        </div>
        <div className="recall-loading-text">Preparing your session...</div>
      </div>
    );
  }

  return (
    <>
      {renderConfettiCanvas()}
      <div className="recall-container">
        <div className="breadcrumb">
          <Link to="/"><FaHouse className="breadcrumb-icon" /> Home</Link>
          <span>›</span>
          <span>Recall Practice</span>
        </div>

        <div className="recall-header">
          <h1>{level === 'Pharmacy' ? 'RecallRx' : `BioRecall ${level || ''}`}</h1>
          {level && <span className="level-badge">{level}</span>}
        </div>

        <div className="main-layout">
          <div className="main-content">
            {!sessionActive && !showReport && (
              <div className="entrance-screen">
                <div className="recall-card">
                  <FaBrain size="3rem" color="var(--primary)" />
                  <button className="continue-btn" onClick={openTopicModal}>Continue to Topics</button>
                  <p className="recall-streak-info"><FaFire color="#e67e22" /> {streakDays} Day Recall Streak</p>
                  <p className="recall-xp-info"><FaStar color="#f1c40f" /> Level {xpProgress.level} · {xpTotal} XP · {rankTitle}</p>
                  {message && <div className={`user-message ${message.type}`}>{message.text}</div>}
                </div>
                {renderWeakTopicAlert()}
                {renderDashboard()}
              </div>
            )}
            {sessionActive && (
              <div className="session-screen">
                <div className="recall-card">{renderQuestion()}</div>
                <div className="analytics-row">
                  <div className="stat-card">
                    <FaChartLine size="1.8rem" color="var(--primary)" />
                    <span>E:{userAnswersRecord.filter(r => r.strength === 'excellent').length} S:{userAnswersRecord.filter(r => r.strength === 'strong').length} D:{userAnswersRecord.filter(r => r.strength === 'developing').length}</span>
                  </div>
                  <div className="stat-card">
                    <FaTrophy size="1.8rem" color="var(--primary)" />
                    Mastery: <span>{masteryAverage}%</span>
                  </div>
                  <div className="stat-card">
                    <FaFire size="1.8rem" color="var(--primary)" />
                    Streak: <span>{streakDays} days</span>
                  </div>
                </div>
              </div>
            )}
            {showReport && renderReport()}
          </div>
          <div className="sidebar">
            {!sessionActive && !showReport && <>{renderLeaderboard()}</>}
          </div>
        </div>

        {topicModalOpen && renderTopicModal()}
        {renderFloatingCards()}
        {showConfirm && renderConfirm()}
      </div>
    </>
  );
}
