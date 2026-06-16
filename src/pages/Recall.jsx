 import React, { useState, useEffect, useRef } from 'react';
import {
  FaBrain, FaLock, FaCheck, FaTrophy, FaFire, FaStar, FaChartLine,
  FaPencil, FaArrowLeft, FaInfoCircle, FaExclamationTriangle, FaExclamationCircle,
  FaMicroscope, FaDna, FaCapsules, FaBook, FaBookOpen, FaBullseye,
  FaLeaf, FaFlask, FaTree, FaSeedling, FaGem, FaCrown, FaBolt,
  FaStarOfLife, FaChartSimple, FaCalendarDay, FaCircleCheck, FaLink
} from 'react-icons/fa6';
import {
  getUser,
  getRecallSession,
  checkRecallSession,
  getRecallStats,
  getRecallAchievements,
  getRecallDashboard,
  getRecallTopics,
  getSelectedLevel,
  setSelectedLevel,
  continueRecallSession,
  submitRecallAnswer,
  completeRecallSession
} from '../api/client';
import '../styles/recall.css';   


const levelSpinMessages = {
  'O-Level': ['Checking...', 'Reviewing biology...', 'Comparing terms...', 'Feedback ready'],
  'A-Level': ['Reviewing pathways...', 'Analyzing science...', 'Evaluating precision...', 'Feedback ready'],
  'Pharmacy': ['Analyzing pharmacology...', 'Reviewing terminology...', 'Evaluating recall...', 'Feedback ready']
};

function escapeHtml(unsafe) {
  if (!unsafe) return '';
  return unsafe.replace(/[&<>"']/g, (m) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  }[m]));
}

function BioRecall() {
  const [currentUser, setCurrentUser] = useState(null);
  const [currentLevel, setCurrentLevel] = useState(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [sessionQuestions, setSessionQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sessionActive, setSessionActive] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [userAnswersRecord, setUserAnswersRecord] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [xpTotal, setXpTotal] = useState(0);
  const [recallLevel, setRecallLevel] = useState(1);
  const [streakDays, setStreakDays] = useState(0);
  const [masteryTopics, setMasteryTopics] = useState({});
  const [topicXpMap, setTopicXpMap] = useState({});
  const [topicStreakMap, setTopicStreakMap] = useState({});
  const [brainEnergy, setBrainEnergy] = useState(100);
  const [hasMoreQuestions, setHasMoreQuestions] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [dashboardData, setDashboardData] = useState(null);
  const [achievementsList, setAchievementsList] = useState([]);
  const [topicModalOpen, setTopicModalOpen] = useState(false);
  const [topicList, setTopicList] = useState([]);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [feedbackResult, setFeedbackResult] = useState(null);
  const [showLevelInput, setShowLevelInput] = useState(true);
  const [levelInputValue, setLevelInputValue] = useState('');
  const [settingLevel, setSettingLevel] = useState(false);
  const [message, setMessage] = useState(null);
  const [offlineQueue, setOfflineQueue] = useState([]);
  const [showConfirm, setShowConfirm] = useState(null);
  const countdownRef = useRef(null);
  const answerInputRef = useRef(null);
  const [countdown, setCountdown] = useState(8);
  const [spinnerMessage, setSpinnerMessage] = useState('');
  const [floatingCards, setFloatingCards] = useState(false);

  // Apply theme based on level
  useEffect(() => {
    document.body.classList.remove('theme-olevel', 'theme-alevel', 'theme-pharmacy');
    if (currentLevel === 'O-Level') document.body.classList.add('theme-olevel');
    else if (currentLevel === 'A-Level') document.body.classList.add('theme-alevel');
    else if (currentLevel === 'Pharmacy') document.body.classList.add('theme-pharmacy');
  }, [currentLevel]);

  // Check auth and load level on mount
  useEffect(() => {
    (async () => {
      try {
        const user = await getUser();
        if (user?.user) {
          setCurrentUser(user.user);
          const { selected_level, is_super_admin } = await getSelectedLevel();
          if (selected_level) {
            setCurrentLevel(selected_level);
            setIsSuperAdmin(is_super_admin);
            setShowLevelInput(false);
            await loadUserProgress(selected_level);
            await restoreActiveSession(selected_level);
            await fetchDashboardAndAchievements();
          } else {
            setShowLevelInput(true);
          }
        } else {
          setCurrentUser(null);
        }
      } catch (e) {
        console.error(e);
        setMessage({ text: 'Failed to authenticate. Please sign in.', type: 'warning' });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const loadUserProgress = async (level) => {
    if (!level) return;
    try {
      const stats = await getRecallStats();
      if (stats) {
        setXpTotal(stats.total_xp || 0);
        setRecallLevel(Math.floor((stats.total_xp || 0) / 100) + 1);
        setStreakDays(stats.streak_days || 0);
        setMasteryTopics(stats.topic_mastery || {});
        setTopicXpMap(stats.topic_xp || {});
        setTopicStreakMap(stats.topic_streak || {});
      }
    } catch (e) {
      console.error('loadUserProgress', e);
      setMessage({ text: 'Could not load your progress. Please refresh.', type: 'warning' });
    }
  };

  const restoreActiveSession = async (level) => {
    try {
      const session = await getRecallSession({ level });
      if (session && session.questions?.length && session.session_id) {
        setSessionQuestions(session.questions);
        setHasMoreQuestions(session.has_more === true);
        setSessionId(session.session_id);
        setCurrentIndex(session.current_index || 0);
        setUserAnswersRecord(session.user_answers || []);
        setSessionActive(true);
        setShowLevelInput(false);
        setShowReport(false);
        setMessage({ text: 'Your previous session was restored.', type: 'info' });
        return true;
      }
    } catch (e) {
      console.warn('No active session to restore', e);
    }
    return false;
  };

  const fetchDashboardAndAchievements = async () => {
    try {
      const [dash, ach] = await Promise.all([getRecallDashboard(), getRecallAchievements()]);
      setDashboardData(dash);
      setAchievementsList(ach);
    } catch (e) {
      console.error('Dashboard fetch failed', e);
    }
  };

  const handleSetLevel = async () => {
    const level = validateAndNormalizeLevel(levelInputValue);
    if (!level) {
      setMessage({ text: 'Please enter a valid level (O-Level, A-Level, Pharmacy)', type: 'warning' });
      return;
    }
    setSettingLevel(true);
    try {
      await setSelectedLevel(level);
      setCurrentLevel(level);
      setShowLevelInput(false);
      applyTheme(level);
      await loadUserProgress(level);
      await fetchDashboardAndAchievements();
      setMessage({ text: `Level set to ${level}.`, type: 'info' });
    } catch (e) {
      setMessage({ text: e.message, type: 'error' });
    } finally {
      setSettingLevel(false);
    }
  };

  const validateAndNormalizeLevel = (input) => {
    const raw = input.trim().toLowerCase();
    if (raw === 'olevel' || raw === 'o-level') return 'O-Level';
    if (raw === 'alevel' || raw === 'a-level') return 'A-Level';
    if (raw === 'pharmacy') return 'Pharmacy';
    return null;
  };

  const applyTheme = (level) => {
    document.body.classList.remove('theme-olevel', 'theme-alevel', 'theme-pharmacy');
    if (level === 'O-Level') document.body.classList.add('theme-olevel');
    else if (level === 'A-Level') document.body.classList.add('theme-alevel');
    else if (level === 'Pharmacy') document.body.classList.add('theme-pharmacy');
  };

  const openTopicModal = async () => {
    try {
      const topics = await getRecallTopics(currentLevel);
      setTopicList(topics || []);
      setTopicModalOpen(true);
    } catch (e) {
      setTopicList([]);
      setTopicModalOpen(true);
    }
  };

  const startSession = async (topic = null) => {
    setLoading(true);
    try {
      await checkRecallSession({ level: currentLevel, topic });
    } catch (e) {
      setMessage({ text: e.message === 'Daily session already completed' ? 'You have already completed today’s session. Come back tomorrow!' : e.message, type: 'warning' });
      setLoading(false);
      return;
    }
    try {
      const session = await getRecallSession({ level: currentLevel, topic });
      if (session && session.questions?.length) {
        setSessionQuestions(session.questions);
        setHasMoreQuestions(session.has_more === true);
        setSessionId(session.session_id);
        setCurrentIndex(session.current_index || 0);
        setUserAnswersRecord(session.user_answers || []);
        setSessionActive(true);
        setSelectedTopic(topic);
        setShowReport(false);
        setFeedbackResult(null);
        // Trigger floating cards animation
        setFloatingCards(true);
        setTimeout(() => setFloatingCards(false), 2800);
      } else {
        setMessage({ text: 'No recall questions available for this level and topic yet.', type: 'warning' });
      }
    } catch (e) {
      setMessage({ text: e.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerSubmission = async () => {
    if (analyzing || !sessionActive || !currentUser) return;
    const answer = answerInputRef.current?.value.trim();
    if (!answer) return;
    const question = sessionQuestions[currentIndex];
    setAnalyzing(true);
    setFeedbackResult(null);
    // Show spinner
    const spinPool = levelSpinMessages[currentLevel] || levelSpinMessages['O-Level'];
    let idx = 0;
    setSpinnerMessage(spinPool[0]);
    const spinnerInterval = setInterval(() => {
      idx = (idx + 1) % spinPool.length;
      setSpinnerMessage(spinPool[idx]);
    }, 1500);
    try {
      const result = await submitRecallAnswer({
        session_id: sessionId,
        question_id: question.id,
        user_answer: answer,
        nonce: crypto.randomUUID?.() || Math.random().toString(36)
      });
      clearInterval(spinnerInterval);
      setFeedbackResult(result);
      const newAnswersRecord = [...userAnswersRecord, { strength: result.strength, topic: question.topic }];
      setUserAnswersRecord(newAnswersRecord);
      setBrainEnergy(Math.max(0, brainEnergy - 5));
      if (result.xp) {
        setXpTotal(prev => prev + result.xp);
        setRecallLevel(prev => Math.floor((xpTotal + result.xp) / 100) + 1);
      }
      await loadUserProgress(currentLevel);
      await fetchDashboardAndAchievements();
    } catch (err) {
      clearInterval(spinnerInterval);
      if (err.message === 'Question already answered') {
        setMessage({ text: 'You have already answered this question. Moving to the next one...', type: 'warning' });
        moveToNextQuestion();
      } else {
        setOfflineQueue(prev => [...prev, { questionId: question.id, answer, timestamp: Date.now() }]);
        setMessage({ text: 'Connection issue. Your answer is saved and will be submitted when you\'re back online.', type: 'warning' });
      }
    } finally {
      setAnalyzing(false);
    }
  };

  const moveToNextQuestion = () => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    setFeedbackResult(null);
    if (currentIndex + 1 < sessionQuestions.length) {
      setCurrentIndex(prev => prev + 1);
      if (answerInputRef.current) {
        answerInputRef.current.value = '';
        answerInputRef.current.focus();
      }
    } else {
      if (hasMoreQuestions) {
        setShowConfirm({
          message: 'You have completed 5 questions. Would you like to continue with 5 more questions? You will receive +5 XP bonus.',
          onConfirm: async () => {
            try {
              const result = await continueRecallSession({ session_id: sessionId });
              if (result && result.questions?.length) {
                setSessionQuestions(prev => [...prev, ...result.questions]);
                setHasMoreQuestions(result.has_more);
                setCurrentIndex(prev => prev + 1); // move to next after concat
                setXpTotal(prev => prev + 5); // bonus XP
              } else {
                await endSession();
              }
            } catch (e) {
              setMessage({ text: 'Failed to load more questions.', type: 'error' });
            }
          },
          onCancel: () => endSession()
        });
      } else {
        endSession();
      }
    }
  };

  const endSession = async () => {
    setSessionActive(false);
    if (sessionId) {
      await completeRecallSession({ session_id: sessionId }).catch(() => {});
    }
    // Build report
    setShowReport(true);
    await loadUserProgress(currentLevel);
    setBrainEnergy(100);
  };

  const startSessionFromTopicModal = (topic) => {
    setTopicModalOpen(false);
    startSession(topic);
  };

  // Offline queue sync
  useEffect(() => {
    const syncOffline = async () => {
      while (offlineQueue.length) {
        const item = offlineQueue.shift();
        try {
          await submitRecallAnswer({
            session_id: sessionId,
            question_id: item.questionId,
            user_answer: item.answer,
            nonce: crypto.randomUUID?.()
          });
          setMessage({ text: 'Your saved answer has been submitted!', type: 'info' });
        } catch (e) {
          console.warn('sync failed', e);
        }
      }
      setOfflineQueue([]);
    };
    if (offlineQueue.length && navigator.onLine) {
      syncOffline();
    }
    const handleOnline = () => syncOffline();
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [offlineQueue, sessionId]);

  // Cleanup intervals on unmount
  useEffect(() => {
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  // Render helpers
  const renderLevelInput = () => (
    <div className="level-input-area">
      <p>
        <FaLock className="lock-icon" /> Choose your level once.<br />You cannot change it later.
      </p>
      <input
        type="text"
        value={levelInputValue}
        onChange={(e) => setLevelInputValue(e.target.value)}
        placeholder="Type: O-Level, A-Level or Pharmacy"
        onKeyDown={(e) => e.key === 'Enter' && handleSetLevel()}
      />
      <button
        className="retry-level-btn"
        onClick={handleSetLevel}
        disabled={settingLevel}
      >
        {settingLevel ? 'Setting...' : 'Set Level'}
      </button>
      {message && <div className={`user-message ${message.type}`}>{message.text}</div>}
    </div>
  );

  const renderDashboard = () => {
    if (!dashboardData) return null;
    const topicEntries = Object.entries(masteryTopics).filter(([t]) => t && t !== 'null').slice(0, 6);
    return (
      <div className="dashboard-grid">
        <div className="dashboard-card">
          <div className="card-title"><FaChartSimple size="2.5rem" color="var(--primary)" /> XP Progress</div>
          <div>Level {dashboardData.level}</div>
          <div className="xp-progress">{dashboardData.xp % 100} / 100 XP to next level</div>
          <div className="progress-bar-bg"><div className="progress-bar-fill" style={{ width: `${dashboardData.progressPercent}%` }} /></div>
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
        <div className="dashboard-card">
          <div className="card-title"><FaCalendarDay size="2.5rem" color="#2ecc71" /> Daily Challenge</div>
          <div><FaBullseye /> Complete 10 Recall Questions</div>
          <div>Progress: {dashboardData.dailyChallenge.completed} / 10</div>
          <div className="progress-bar-bg"><div className="progress-bar-fill" style={{ width: `${dashboardData.dailyChallenge.progressPercent}%` }} /></div>
          <div>Reward: +50 XP</div>
        </div>
        <div className="dashboard-card">
          <div className="card-title"><FaBrain size="2.5rem" color="#9b59b6" /> Brain Energy</div>
          <div className="progress-bar-bg"><div className="progress-bar-fill" style={{ width: `${brainEnergy}%` }} /></div>
          <div>{brainEnergy}% energy remaining</div>
        </div>
        <div className="dashboard-card">
          <div className="card-title"><FaLeaf size="2.5rem" color="#27ae60" /> Memory Garden</div>
          <div className="memory-garden">
            {dashboardData.gardenStage === 'tree' ? <FaTree size="3rem" /> : <FaSeedling size="3rem" />}
          </div>
          <div>{dashboardData.streak} day streak</div>
        </div>
        <div className="dashboard-card">
          <div className="card-title"><FaFlask size="2.5rem" color="#3498db" /> Subject</div>
          <div className="subject-illustration">
            <i className={`fa-solid ${dashboardData.subjectIllustration}`}></i>
          </div>
          <div>{currentLevel}</div>
        </div>
        <div className="dashboard-card">
          <div className="card-title"><FaStarOfLife size="2.5rem" color="var(--primary)" /> Topic Mastery</div>
          <div className="topic-icon-grid">
            {topicEntries.map(([topic, mastery]) => (
              <div key={topic} className="topic-icon-card">
                <div className="topic-big-icon"><FaBook /></div>
                <div className="topic-name">{escapeHtml(topic)}</div>
                <div className="topic-mastery">{Math.round(mastery)}%</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderReport = () => {
    const e = userAnswersRecord.filter(r => r.strength === 'excellent').length;
    const s = userAnswersRecord.filter(r => r.strength === 'strong').length;
    const d = userAnswersRecord.filter(r => r.strength === 'developing').length;
    const masteryScore = sessionQuestions.length ? Math.round(((e * 100 + s * 70) / (sessionQuestions.length * 100)) * 100) : 0;
    return (
      <div className="report-screen">
        <div className="recall-card" style={{ textAlign: 'center' }}>
          <FaChartSimple size="3rem" color="var(--primary)" />
          <h2>Today's Recall Report</h2>
          <p>Reviewed: {sessionQuestions.length}</p>
          <p>Excellent: {e} Strong: {s} Developing: {d}</p>
          <p>Mastery: {masteryScore}%</p>
          <p>Top Topic: {Object.entries(userAnswersRecord.reduce((acc, r) => { acc[r.topic] = (acc[r.topic] || 0) + 1; return acc; }, {})).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A'}</p>
          <p><FaFire color="#e67e22" /> Streak: {streakDays} days</p>
          <button className="btn-check" style={{ width: 'auto', marginTop: '2rem' }} onClick={() => { setShowReport(false); setSessionActive(false); }}>See You Tomorrow</button>
        </div>
      </div>
    );
  };

  const renderFeedback = () => {
    if (!feedbackResult) return null;
    const { strength, xp, matched, feedback, common_mistake_explanation, study_note } = feedbackResult;
    const strengthClass = strength === 'excellent' ? 'strength-excellent' : strength === 'strong' ? 'strength-strong' : 'strength-developing';
    const strengthLabel = strength === 'excellent' ? 'Excellent' : strength === 'strong' ? 'Strong' : 'Developing';
    return (
      <div className="feedback-area">
        <div className={`recall-strength ${strengthClass}`}>Recall Strength: {strengthLabel}</div>
        <div>Matched: {escapeHtml(matched)}</div>
        <div><FaTrophy color="#f1c40f" /> +{xp} XP</div>
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
            <h4><FaExclamationTriangle color="#e74c3c" /> Common Confusion</h4>
            <div>{escapeHtml(common_mistake_explanation)}</div>
          </div>
        )}
        {study_note && (
          <div className="study-note"><FaInfoCircle /> Study Note: {escapeHtml(study_note)}</div>
        )}
      </div>
    );
  };

  const renderQuestion = () => {
    const question = sessionQuestions[currentIndex];
    return (
      <>
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
        <button className="btn-check" onClick={handleAnswerSubmission} disabled={analyzing || !sessionActive}>
          <FaPencil /> Check
        </button>
        {analyzing && !feedbackResult && (
          <div className="spinner-overlay">{spinnerMessage} <span className="dot-spin"></span><span className="dot-spin"></span><span className="dot-spin"></span></div>
        )}
        {renderFeedback()}
        {!analyzing && feedbackResult && (
          <div className="next-timer" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem' }}>
            <div className="countdown">Next in {countdown}s</div>
            <button className="next-btn" onClick={moveToNextQuestion}>Next</button>
          </div>
        )}
      </>
    );
  };

  const renderFloatingCards = () => {
    if (!floatingCards) return null;
    const concepts = {
      'O-Level': ['Cell', 'Nucleus', 'Mitochondria'],
      'A-Level': ['DNA', 'Enzyme', 'Chromosome'],
      'Pharmacy': ['Insulin', 'CYP450', 'Statins']
    };
    const items = concepts[currentLevel] || concepts['O-Level'];
    const cards = Array.from({ length: 12 }, (_, i) => {
      const icon = currentLevel === 'O-Level' ? <FaMicroscope /> : currentLevel === 'A-Level' ? <FaDna /> : <FaCapsules />;
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
        <h3 style={{ color: 'var(--primary)', marginBottom: '1rem' }}>Choose a topic for {currentLevel}</h3>
        <div style={{ marginBottom: '1rem' }}>
          {topicList.length === 0 ? <p>Loading topics...</p> : topicList.map(t => (
            <button key={t.name} className="option-btn" onClick={() => startSessionFromTopicModal(t.name)}>{t.name}</button>
          ))}
        </div>
        <button className="option-btn" onClick={() => { setTopicModalOpen(false); startSession(null); }}>All topics (any order)</button>
        <button className="btn-check" style={{ width: 'auto', marginTop: '0.5rem' }} onClick={() => setTopicModalOpen(false)}>Cancel</button>
      </div>
    </div>
  );

  const renderConfirm = () => {
    if (!showConfirm) return null;
    return (
      <div className="modal-overlay">
        <div className="modal-content">
          <p>{showConfirm.message}</p>
          <button className="option-btn" onClick={() => { showConfirm.onConfirm(); setShowConfirm(null); }}>Yes, continue</button>
          <button className="option-btn" onClick={() => { showConfirm.onCancel(); setShowConfirm(null); }}>No, finish</button>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="loading-spinner" style={{ display: 'flex' }}>
        <div className="spinner-colors">
          <div className="spinner-dot-color"></div>
          <div className="spinner-dot-color"></div>
          <div className="spinner-dot-color"></div>
          <div className="spinner-dot-color"></div>
        </div>
        <div style={{ fontWeight: 600, color: 'var(--primary)' }}>Preparing your session...</div>
      </div>
    );
  }

  return (
    <div className="recall-container">
      <div className="recall-header">
        <h1>{currentLevel === 'Pharmacy' ? 'RecallRx' : `BioRecall ${currentLevel || ''}`}</h1>
        {currentLevel && <span className="level-badge">{currentLevel}</span>}
      </div>

      {!sessionActive && !showReport && (
        <div className="entrance-screen">
          <div className="recall-card" style={{ textAlign: 'center' }}>
            <FaBrain size="3rem" color="var(--primary)" />
            {!currentUser ? (
              <p style={{ marginTop: '0.5rem', color: 'var(--primary)' }}>
                <a href="/" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>Sign in or Create an account</a> to start your recall journey.
              </p>
            ) : showLevelInput ? (
              renderLevelInput()
            ) : (
              <>
                <p><FaLock /> Your level is locked:</p>
                <div className="locked-level">{currentLevel}</div>
                <button className="continue-btn" onClick={openTopicModal}>Continue to Topics</button>
                {isSuperAdmin && <button className="admin-change-btn" onClick={() => setShowLevelInput(true)}>Change level (admin)</button>}
              </>
            )}
            {currentUser && (
              <p style={{ marginTop: '0.5rem' }}><FaFire color="#e67e22" /> {streakDays} Day Recall Streak</p>
            )}
            {currentUser && (
              <p style={{ marginTop: '0.5rem' }}><FaStar color="#f1c40f" /> Recall Level {recallLevel} · {xpTotal} XP</p>
            )}
            {message && <div className={`user-message ${message.type}`}>{message.text}</div>}
          </div>
          {currentUser && currentLevel && !showLevelInput && renderDashboard()}
        </div>
      )}

      {sessionActive && (
        <div className="session-screen">
          <div className="recall-card">
            {renderQuestion()}
          </div>
          <div className="analytics-row">
            <div className="stat-card"><FaChartLine size="1.8rem" color="var(--primary)" /> <span>E:{userAnswersRecord.filter(r => r.strength === 'excellent').length} S:{userAnswersRecord.filter(r => r.strength === 'strong').length} D:{userAnswersRecord.filter(r => r.strength === 'developing').length}</span></div>
            <div className="stat-card"><FaTrophy size="1.8rem" color="var(--primary)" /> Mastery: <span>{Object.values(masteryTopics).length ? Math.round(Object.values(masteryTopics).reduce((a, b) => a + b, 0) / Object.values(masteryTopics).length) : 0}%</span></div>
            <div className="stat-card"><FaFire size="1.8rem" color="var(--primary)" /> Streak: <span>{streakDays} days</span></div>
          </div>
          {/* Mastery map, radar, etc. could be added here as in original, but omitted for brevity */}
        </div>
      )}

      {showReport && renderReport()}
      {topicModalOpen && renderTopicModal()}
      {renderFloatingCards()}
      {showConfirm && renderConfirm()}
    </div>
  );
}

export default BioRecall;
