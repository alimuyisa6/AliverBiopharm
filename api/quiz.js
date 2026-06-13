import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  getAllSiteSections,
  getQuizTopics,
  getQuizBlock,
  checkDailyRetry,
  checkQuizAnswer,
  submitQuizBlock,
  recordDailyVisit,
  getUserStreak,
  getUserAchievements,
  saveAchievement,
  saveQuizState,
  getQuizState,
  trackEvent
} from '../api/client';

class QuizErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error, info) { console.error('Quiz error:', error, info); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="section">
          <h2>Something went wrong.</h2>
          <button onClick={() => window.location.reload()}>Reload Page</button>
        </div>
      );
    }
    return this.props.children;
  }
}

function Quiz() {
  const { user, logout } = useAuth();
  const [sections, setSections] = useState(null);
  const [currentLevel, setCurrentLevel] = useState('O-Level');
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
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);
  const [filterAccordions, setFilterAccordions] = useState({ level: false });
  const [topicSearch, setTopicSearch] = useState('');
  const [theme, setTheme] = useState('light');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);
  const spinnerTimeout = useRef(null);

  const SPINNER_WORDS = [
    'Reviewing your selection...', 'Checking your answer...', 'Analyzing...',
    'Verifying...', 'Processing...', 'One moment...'
  ];

  const showToast = (message, type = 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const saveQuizStateToStorage = () => {
    if (quizQuestions.length > 0 && userAnswers.some(a => a !== null)) {
      const state = {
        topic: currentTopic,
        level: currentLevel,
        block: currentBlock,
        answers: userAnswers,
        index: currentIndex,
        startTime: quizStartTime,
        questions: quizQuestions
      };
      sessionStorage.setItem('quiz_resume', JSON.stringify(state));
    }
  };

  const saveQuizStateToBackend = async () => {
    if (!user) return;
    try {
      await saveQuizState({
        level: currentLevel,
        topic: currentTopic,
        block: currentBlock,
        answers: userAnswers,
        index: currentIndex,
        startTime: quizStartTime,
        questions: quizQuestions
      });
    } catch (err) {}
  };

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      document.body.classList.add('dark-mode');
      setTheme('dark');
    }
    const load = async () => {
      try {
        setLoading(true);
        const siteData = await getAllSiteSections();
        setSections(siteData);
        const glossary = siteData?.glossary?.data || [];
        const map = {};
        glossary.forEach(g => { if (g.term) map[g.term.toLowerCase()] = g.definition; });
        setGlossaryMap(map);
        const topics = await getQuizTopics({ level: 'O-Level' });
        setAllTopics(Array.isArray(topics) ? topics : []);
        if (user) {
          await recordDailyVisit();
          const streakData = await getUserStreak();
          setStreak(streakData?.count || 0);
          const badges = await getUserAchievements();
          setEarnedBadges(Array.isArray(badges) ? badges.map(b => b.badge) : []);
          const savedState = await getQuizState();
          if (savedState?.state && !currentTopic && !quizQuestions.length) {
            const state = savedState.state;
            if (window.confirm(`Resume ${state.topic} Block ${state.block+1}? You were on question ${state.index+1}.`)) {
              setCurrentTopic(state.topic);
              setCurrentLevel(state.level);
              setCurrentBlock(state.block);
              setQuizQuestions(state.questions);
              setUserAnswers(state.answers);
              setCurrentIndex(state.index);
              setQuizStartTime(state.startTime);
            }
          }
        }
        const saved = sessionStorage.getItem('quiz_resume');
        if (saved && !currentTopic && !quizQuestions.length) {
          const state = JSON.parse(saved);
          if (window.confirm(`Resume ${state.topic} Block ${state.block+1}? You were on question ${state.index+1}.`)) {
            setCurrentTopic(state.topic);
            setCurrentLevel(state.level);
            setCurrentBlock(state.block);
            setQuizQuestions(state.questions);
            setUserAnswers(state.answers);
            setCurrentIndex(state.index);
            setQuizStartTime(state.startTime);
            sessionStorage.removeItem('quiz_resume');
          } else {
            sessionStorage.removeItem('quiz_resume');
          }
        }
        setLoading(false);
      } catch (err) {
        console.error(err);
        showToast('Failed to load initial data', 'error');
        setLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    loadTopics(currentLevel);
  }, [currentLevel]);

  useEffect(() => {
    if (!quizQuestions.length) return;
    function handleKey(e) {
      if (['a','b','c','d'].includes(e.key.toLowerCase())) selectAnswer(e.key.toUpperCase());
      if (e.key === 'ArrowRight') nextQuestion();
      if (e.key === 'ArrowLeft') prevQuestion();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [quizQuestions, currentIndex, userAnswers]);

  useEffect(() => {
    if (quizStartTime && quizQuestions.length) {
      const interval = setInterval(() => {
        const elapsed = Math.floor((new Date() - quizStartTime) / 1000);
        const remaining = Math.max(0, 600 - elapsed);
        setTimeLeft(remaining);
        if (remaining === 0) {
          clearInterval(interval);
          if (userAnswers.every(a => a !== null)) submitBlock();
          else showToast('Time is up! Submitting your answers.', 'warning');
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [quizStartTime, quizQuestions.length]);

  useEffect(() => {
    saveQuizStateToStorage();
    if (user) saveQuizStateToBackend();
  }, [userAnswers, currentIndex, quizQuestions, currentTopic, currentLevel, currentBlock, quizStartTime]);

  async function loadTopics(level) {
    try {
      const topics = await getQuizTopics({ level: level || currentLevel });
      setAllTopics(Array.isArray(topics) ? topics : []);
    } catch (err) { showToast('Failed to load topics', 'error'); }
  }

  async function openTopicBlocks(topic, total) {
    setCurrentTopic(topic);
    setTotalBlocks(Number(total) || 0);
    setQuizQuestions([]);
    setResultData(null);
  }

  async function startBlock(blockNum) {
    if (!user) { showToast('Please sign in.', 'error'); return; }
    try {
      const retry = await checkDailyRetry({ level: currentLevel, topic: currentTopic, block_number: blockNum });
      if (!retry.can_retry) {
        showToast(retry.reason || 'Block locked until tomorrow.', 'error');
        return;
      }
    } catch (e) { showToast('Failed to check retry status', 'error'); }
    setPendingBlock(blockNum);
    setShowRulesModal(true);
  }

  async function confirmStartBlock() {
    setShowRulesModal(false);
    const blockNum = pendingBlock;
    setCurrentBlock(blockNum);
    setLoading(true);
    try {
      const data = await getQuizBlock({ level: currentLevel, topic: currentTopic, block_number: blockNum });
      if (!data || !data.questions || !data.questions.length) {
        showToast('No questions available.', 'error');
        setLoading(false);
        return;
      }
      setQuizQuestions(data.questions);
      setUserAnswers(new Array(data.questions.length).fill(null));
      setCurrentIndex(0);
      setQuizStartTime(new Date());
      setResultData(null);
      setTimeLeft(600);
      trackEvent('quiz_start', { level: currentLevel, topic: currentTopic, block: blockNum });
      setLoading(false);
    } catch (err) {
      showToast('Failed to load quiz: ' + err.message, 'error');
      setLoading(false);
    }
  }

  async function selectAnswer(optionLetter) {
    if (userAnswers[currentIndex] !== null) return;
    setShowingSpinner(true);
    const word = SPINNER_WORDS[Math.floor(Math.random() * SPINNER_WORDS.length)];
    setSpinnerWord(word);
    if (spinnerTimeout.current) clearTimeout(spinnerTimeout.current);
    const q = quizQuestions[currentIndex];
    try {
      const result = await checkQuizAnswer({ question_id: q.id, selected_option: optionLetter });
      const newAnswers = [...userAnswers];
      newAnswers[currentIndex] = { selected: optionLetter, correct: result.correct, correct_option: result.correct_option, correct_answer_text: result.correct_answer_text };
      setUserAnswers(newAnswers);
      spinnerTimeout.current = setTimeout(() => setShowingSpinner(false), 800);
    } catch (err) {
      showToast('Failed to verify answer: ' + err.message, 'error');
      setShowingSpinner(false);
    }
  }

  function nextQuestion() { if (currentIndex < quizQuestions.length - 1) setCurrentIndex(currentIndex + 1); }
  function prevQuestion() { if (currentIndex > 0) setCurrentIndex(currentIndex - 1); }

  async function submitBlock() {
    if (quizQuestions.length === 0) return;
    const answersPayload = quizQuestions.map((q, idx) => ({ id: q.id, selectedOption: userAnswers[idx]?.selected || 'X' }));
    const timeTaken = Math.round((new Date() - quizStartTime) / 1000);
    setLoading(true);
    try {
      const result = await submitQuizBlock({ level: currentLevel, topic: currentTopic, block_number: currentBlock, answers: answersPayload, time_taken: timeTaken });
      setResultData(result);
      trackEvent('quiz_complete', { level: currentLevel, topic: currentTopic, block: currentBlock, score: result.percentage, passed: result.passed });
      const newBadges = [];
      if (result.percentage >= 100 && !earnedBadges.includes('perfect_block')) newBadges.push({ id: 'perfect_block', label: 'Perfect Score' });
      if (!earnedBadges.includes('first_block')) newBadges.push({ id: 'first_block', label: 'First Block Done' });
      for (let b of newBadges) await saveAchievement({ id: b.id, label: b.label });
      setEarnedBadges(prev => [...prev, ...newBadges.map(b => b.id)]);
      if (streak >= 10 && !earnedBadges.includes('streak_10')) {
        await saveAchievement({ id: 'streak_10', label: '10-Day Streak' });
        setEarnedBadges(prev => [...prev, 'streak_10']);
      }
      let rule = null;
      if (result.percentage >= 90) rule = { message: "Excellent! You're ready for more advanced material.", action: null };
      else if (result.percentage < 70) rule = { message: 'Review key concepts from this block before moving on.', action: 'review_block' };
      setAdaptivePath(rule);
      setLoading(false);
      if (result.passed && result.percentage >= 90) showConfetti();
    } catch (err) {
      showToast('Submission failed: ' + err.message, 'error');
      setLoading(false);
    }
  }

  function showConfetti() {
    const colors = ['#0ab5b5', '#b8873a', '#e2c06a', '#10b981', '#f59e0b'];
    for (let i = 0; i < 50; i++) {
      const p = document.createElement('div');
      p.style.cssText = `position:fixed;width:8px;height:8px;background:${colors[Math.floor(Math.random() * colors.length)]};left:${Math.random() * 100}%;top:-10px;border-radius:50%;z-index:9999;pointer-events:none;animation:confettiFall ${2 + Math.random() * 3}s linear forwards`;
      document.body.appendChild(p);
      setTimeout(() => p.remove(), 4000);
    }
  }

  function renderGlossary(text) {
    if (!text) return text;
    let escaped = String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const terms = Object.keys(glossaryMap).sort((a,b) => b.length - a.length);
    for (let term of terms) {
      const regex = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
      escaped = escaped.replace(regex, match => `<span class="glossary-term">${match}<span class="glossary-tooltip">${glossaryMap[term]}</span></span>`);
    }
    return escaped;
  }

  const currentYear = new Date().getFullYear();

  if (loading && !quizQuestions.length && !resultData && !currentTopic) {
    return <div className="section"><p style={{ textAlign: 'center', padding: '3rem' }}>Loading topics...</p></div>;
  }

  return (
    <div className="quiz-page">
      <header className="site-header">
        <div className="header-container">
          <a href="/" className="logo-link" aria-label="AliverBiopharm Home">
            {sections?.site_config?.logo_url ? (
              <img src={sections.site_config.logo_url} alt="AliverBiopharm" style={{ height: '70px', width: 'auto' }} />
            ) : (
              'AliverBiopharm'
            )}
          </a>
          <nav aria-label="Main navigation">
            <ul className="main-nav">
              {sections?.navigation?.links?.map(link => (
                <li key={link.href}><a href={link.href}>{link.label}</a></li>
              )) || (
                <>
                  <li><a href="/">Home</a></li>
                  <li><a href="/quiz">Quizzes</a></li>
                  <li><a href="#contact">Contact</a></li>
                </>
              )}
            </ul>
          </nav>
          <div className="nav-actions">
            <button className="theme-toggle" onClick={() => {
              const dark = document.body.classList.toggle('dark-mode');
              localStorage.setItem('theme', dark ? 'dark' : 'light');
              setTheme(dark ? 'dark' : 'light');
            }}>
              <i className={`fa-solid ${theme === 'dark' ? 'fa-sun' : 'fa-moon'}`}></i>
            </button>
            <button className="mobile-toggle" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}><i className="fa-solid fa-bars"></i></button>
          </div>
        </div>
      </header>

      <div className={`mobile-nav-panel ${mobileMenuOpen ? 'active' : ''}`}>
        <div className="mobile-nav-panel-inner">
          <div className="mobile-nav-header">
            <div className="mobile-nav-header-row">
              <div className="mobile-auth-top">
                {user ? (
                  <button className="mobile-signout-btn" onClick={logout}><i className="fa-solid fa-right-from-bracket"></i> Sign Out</button>
                ) : (
                  <>
                    <a href="#" className="mobile-signin-btn" onClick={() => window.location.href = '/login'}>Sign In</a>
                    <a href="#" className="mobile-signup-btn" onClick={() => window.location.href = '/register'}>Create Account</a>
                  </>
                )}
              </div>
              <button className="mobile-close-btn" onClick={() => setMobileMenuOpen(false)}><i className="fa-solid fa-xmark"></i></button>
            </div>
          </div>
          <nav className="mobile-nav-links">
            {(sections?.navigation?.links || []).map(link => (
              <a key={link.href} href={link.href}>{link.label}</a>
            ))}
          </nav>
        </div>
      </div>
      <div className={`mobile-nav-overlay ${mobileMenuOpen ? 'active' : ''}`} onClick={() => setMobileMenuOpen(false)}></div>

      <main className="section">
        <span className="sec-label">ASSESSMENTS</span>
        <h1 className="section-title">Knowledge Quizzes</h1>
        <div className="breadcrumb">
          <a href="/">Home</a><span>›</span><span>Quizzes</span>
          {currentTopic && (<><span>›</span><span>{currentTopic}</span></>)}
          {currentTopic && resultData && (<><span>›</span><span>Results</span></>)}
        </div>

        {!currentTopic ? (
          <>
            <div className="topic-search">
              <input type="text" placeholder="Search topics..." value={topicSearch} onChange={e => setTopicSearch(e.target.value)} />
            </div>
            <div className="filter-bar">
              <button className={`filter-toggle-btn ${filterDropdownOpen ? 'open' : ''}`} onClick={() => setFilterDropdownOpen(!filterDropdownOpen)}>
                <i className="fa-solid fa-filter"></i> Filter <i className="fa-solid fa-chevron-down chevron"></i>
              </button>
              {filterDropdownOpen && (
                <div className="filter-dropdown">
                  <div className="filter-accordion">
                    <button className={`filter-accordion-btn ${filterAccordions.level ? 'open' : ''}`} onClick={() => setFilterAccordions({ ...filterAccordions, level: !filterAccordions.level })}>
                      <span>Level</span><span className="filter-selected">{currentLevel}</span><i className="fa-solid fa-chevron-down"></i>
                    </button>
                    {filterAccordions.level && (
                      <div className="filter-options open">
                        <label className="filter-option"><input type="radio" name="level" value="O-Level" checked={currentLevel === 'O-Level'} onChange={() => setCurrentLevel('O-Level')} /> O-Level</label>
                        <label className="filter-option"><input type="radio" name="level" value="A-Level" checked={currentLevel === 'A-Level'} onChange={() => setCurrentLevel('A-Level')} /> A-Level</label>
                        <label className="filter-option"><input type="radio" name="level" value="Pharmacy" checked={currentLevel === 'Pharmacy'} onChange={() => setCurrentLevel('Pharmacy')} /> Pharmacy</label>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="topic-grid">
              {allTopics.filter(t => !topicSearch || t.topic_name.toLowerCase().includes(topicSearch.toLowerCase())).map(topic => {
                const hasQuestions = (topic.question_count || 0) > 0 && (topic.total_blocks || 0) > 0;
                const allDone = hasQuestions && topic.completed_blocks?.length === topic.total_blocks;
                if (hasQuestions && !allDone) {
                  return (
                    <div key={topic.topic_name} className="topic-card clickable" onClick={() => openTopicBlocks(topic.topic_name, topic.total_blocks)}>
                      <h3>{topic.topic_name}</h3>
                      <span className="q-count ready">{topic.question_count} questions • {topic.total_blocks} blocks</span>
                      <small>Tap to start →</small>
                    </div>
                  );
                } else {
                  return (
                    <div key={topic.topic_name} className="topic-card">
                      <h3>{topic.topic_name}</h3>
                      <span className="q-count">{topic.question_count} questions</span>
                      <small>{allDone ? 'All blocks done!' : 'Questions being added'}</small>
                    </div>
                  );
                }
              })}
            </div>
          </>
        ) : resultData ? (
          <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div className="question-card" style={{ textAlign: 'center' }}>
              <i className={`fa-solid ${resultData.passed ? 'fa-trophy' : 'fa-book-open'} result-icon`} style={{ fontSize: '3rem', color: resultData.passed ? '#f59e0b' : '#6b7280' }}></i>
              <h2>{resultData.passed ? `Congratulations, ${user?.email?.split('@')[0] || 'Learner'}!` : 'Block Complete'}</h2>
              <div className="result-score">{resultData.percentage}%</div>
              <p>{resultData.score}/{resultData.total} correct</p>
              <p style={{ fontStyle: 'italic' }}>{resultData.passed ? 'Outstanding! You really know this!' : 'Keep studying! Every expert was once a beginner.'}</p>
              <span className={`status-badge ${resultData.passed ? 'status-pass' : 'status-fail'}`}>{resultData.passed ? '✓ Passed' : '✗ Not passed'}</span>
              <div className="share-buttons">
                <button className="share-btn-sm" onClick={() => navigator.clipboard.writeText(`I scored ${resultData.percentage}% on ${currentTopic} Block ${currentBlock+1} at AliverBiopharm!`)}><i className="fa-solid fa-link" style={{ color: '#3b82f6' }}></i></button>
              </div>
            </div>
            {adaptivePath && (
              <div className="adaptive-path-card">
                <div className="ap-icon"><i className="fa-solid fa-lightbulb" style={{ color: '#fbbf24' }}></i></div>
                <h4>{resultData.passed ? 'Great Progress!' : 'Keep Going!'}</h4>
                <p>{adaptivePath.message}</p>
              </div>
            )}
            <h3>Block {currentBlock+1} Review</h3>
            {(resultData.answers || []).map((a, idx) => (
              <div key={idx} className="question-card" style={{ padding: '1.2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  {a.isCorrect ? <i className="fa-solid fa-circle-check" style={{ color: '#10b981' }}></i> : <i className="fa-solid fa-circle-xmark" style={{ color: '#ef4444' }}></i>}
                  <p style={{ fontWeight: 600, color: 'var(--clr-white)' }}>Q{idx+1}</p>
                </div>
                <p style={{ color: 'var(--clr-white)', marginBottom: '0.75rem' }} dangerouslySetInnerHTML={{ __html: renderGlossary(a.question) }} />
                <p style={{ fontSize: '0.85rem' }}>Your answer: <span style={{ color: a.isCorrect ? '#10b981' : '#ef4444', fontWeight: 600 }}>{a.userAnswerText}</span></p>
                {!a.isCorrect && <p style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>Correct: <span style={{ color: '#10b981', fontWeight: 600 }}>{a.correctAnswerText}</span></p>}
                <div className="explanation-box" dangerouslySetInnerHTML={{ __html: renderGlossary(a.explanation) }} />
              </div>
            ))}
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '2rem', flexWrap: 'wrap' }}>
              {currentBlock+1 < totalBlocks && <button className="btn-primary" onClick={() => startBlock(currentBlock+1)}>Next Block →</button>}
              <button className="btn-secondary" onClick={() => { setCurrentTopic(''); setResultData(null); }}>← All Blocks</button>
              <button className="btn-secondary" onClick={() => { setCurrentTopic(''); setResultData(null); }}>← Topics</button>
            </div>
          </div>
        ) : quizQuestions.length > 0 ? (
          <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div className="question-palette" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '1rem', justifyContent: 'center' }}>
              {quizQuestions.map((_, idx) => {
                let bgColor = '#3b3b5e';
                if (userAnswers[idx]) bgColor = userAnswers[idx].correct ? '#10b981' : '#ef4444';
                return (
                  <button
                    key={idx}
                    onClick={() => setCurrentIndex(idx)}
                    style={{
                      width: '36px', height: '36px', borderRadius: '50%',
                      background: bgColor, color: 'white', border: idx === currentIndex ? '2px solid #0ab5b5' : 'none',
                      cursor: 'pointer', fontSize: '0.9rem', fontWeight: 'bold'
                    }}
                  >
                    {idx+1}
                  </button>
                );
              })}
            </div>
            {timeLeft !== null && (
              <div style={{ textAlign: 'right', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                ⏱️ Time left: {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2,'0')}
              </div>
            )}
            <div className="progress-bar"><div className="progress-fill" style={{ width: `${((currentIndex+1)/quizQuestions.length)*100}%` }}></div></div>
            <p style={{ fontSize: '0.8rem', color: 'var(--clr-text-muted)', marginBottom: '0.5rem' }}>Block {currentBlock+1} • Q {currentIndex+1}/{quizQuestions.length}</p>
            <p style={{ fontSize: '0.75rem', color: 'var(--clr-text-muted)', marginBottom: '1rem' }}>{currentTopic}</p>
            <div className="spinner-top-container" style={{ display: showingSpinner ? 'flex' : 'none' }}>
              <span className="answer-spinner"></span><span className="spinner-text">{spinnerWord}</span>
            </div>
            <div className="question-card">
              <h2 dangerouslySetInnerHTML={{ __html: renderGlossary(quizQuestions[currentIndex].question_text) }} />
              {['A','B','C','D'].map(opt => {
                const answered = userAnswers[currentIndex] !== null;
                const selected = userAnswers[currentIndex]?.selected;
                const correctOpt = userAnswers[currentIndex]?.correct_option;
                let cls = '', icon = null;
                if (answered) {
                  if (opt === correctOpt) { cls = ' correct'; icon = <i className="fa-solid fa-circle-check" style={{ color: '#10b981', marginLeft: 'auto' }}></i>; }
                  else if (opt === selected) { cls = ' incorrect'; icon = <i className="fa-solid fa-circle-xmark" style={{ color: '#ef4444', marginLeft: 'auto' }}></i>; }
                }
                return (
                  <button key={opt} className={`option-btn${cls}`} disabled={answered} onClick={() => selectAnswer(opt)}>
                    <span className="option-letter">{opt}</span>
                    <span dangerouslySetInnerHTML={{ __html: renderGlossary(quizQuestions[currentIndex][`option_${opt.toLowerCase()}`]) }} />
                    {icon}
                  </button>
                );
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}>
              {currentIndex > 0 && <button className="btn-secondary" onClick={prevQuestion}>← Prev</button>}
              {userAnswers[currentIndex] !== null && (currentIndex < quizQuestions.length-1 ? <button className="btn-primary" onClick={nextQuestion}>Next →</button> : <button className="btn-primary" onClick={submitBlock}>Submit Block</button>)}
            </div>
            <div className="keyboard-hint">💡 Press A B C D keys • ← → to navigate</div>
          </div>
        ) : (
          <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.5rem', color: 'var(--clr-white)' }}>{currentTopic}</h2>
            <div className="block-nav">
              {totalBlocks === 0 ? (
                <p>No blocks available for this topic.</p>
              ) : (
                Array.from({ length: totalBlocks }).map((_, i) => {
                  const topicData = allTopics.find(t => t.topic_name === currentTopic);
                  const locked = topicData?.locked_blocks?.includes(i);
                  const completed = topicData?.completed_blocks?.includes(i);
                  let icon = null, cls = '';
                  if (locked) { cls = 'locked'; icon = <i className="fa-solid fa-lock" style={{ marginRight: '6px', color: '#ef4444' }}></i>; }
                  else if (completed) { cls = 'completed'; icon = <i className="fa-solid fa-check-circle" style={{ marginRight: '6px', color: '#10b981' }}></i>; }
                  else { icon = <i className="fa-regular fa-circle" style={{ marginRight: '6px', color: '#0ab5b5' }}></i>; }
                  return (
                    <button key={i} className={`block-nav-btn ${cls}`} disabled={locked} onClick={() => startBlock(i)}>
                      {icon} Block {i+1}
                    </button>
                  );
                })
              )}
            </div>
            <button className="btn-secondary" onClick={() => setCurrentTopic('')}>← Back</button>
          </div>
        )}

        {showRulesModal && (
          <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: 'var(--clr-navy-card)', padding: '2rem', borderRadius: 'var(--radius-lg)', maxWidth: '420px', width: '90%' }}>
              <h3>Quiz Rules</h3>
              <ul style={{ listStyle: 'none' }}>
                <li><i className="fa-solid fa-check-circle" style={{ color: '#10b981', marginRight: '8px' }}></i> 10 questions per block</li>
                <li><i className="fa-solid fa-check-circle" style={{ color: '#10b981', marginRight: '8px' }}></i> 70% to pass</li>
                <li><i className="fa-solid fa-check-circle" style={{ color: '#10b981', marginRight: '8px' }}></i> Immediate feedback</li>
                <li><i className="fa-solid fa-check-circle" style={{ color: '#10b981', marginRight: '8px' }}></i> Full explanations</li>
                <li><i className="fa-solid fa-check-circle" style={{ color: '#10b981', marginRight: '8px' }}></i> Block locks for 24h after completion</li>
              </ul>
              <button className="btn-primary" style={{ width: '100%' }} onClick={confirmStartBlock}>I understand, let's begin!</button>
            </div>
          </div>
        )}
      </main>

      <footer className="footer-fat">
        <div style={{ maxWidth: 'var(--max-width)', margin: '0 auto', display: 'flex', justifyContent: 'space-between', gap: '40px', flexWrap: 'wrap' }}>
          <div style={{ maxWidth: '260px' }}>
            <a href="/" className="logo-link" style={{ marginBottom: '14px', display: 'inline-flex' }}>
              {sections?.site_config?.logo_url ? <img src={sections.site_config.logo_url} alt="AliverBiopharm" style={{ height: '50px' }} /> : 'AliverBiopharm'}
            </a>
            <p style={{ fontSize: '.85rem', lineHeight: 1.7, color: 'var(--clr-text-dim)' }}>Advancing biology and pharmacy education for every learner.</p>
            <div className="footer-social">
              {(sections?.footer?.social_links || []).map(s => (
                <a key={s.platform} href={s.url} target="_blank" rel="noopener noreferrer"><i className={s.icon}></i></a>
              ))}
            </div>
          </div>
          <div className="footer-grid">
            {(sections?.footer?.columns || []).map(col => (
              <div key={col.heading}>
                <h4 style={{ fontWeight: 700, color: 'var(--clr-white)', fontSize: '0.9rem', marginBottom: '16px' }}>{col.heading}</h4>
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {col.items?.map(item => (
                    <li key={item.label}><a href={item.href} style={{ fontSize: '0.875rem', color: 'var(--clr-text-dim)' }}>{item.icon && <i className={item.icon} style={{ marginRight: '0.5rem' }}></i>}{item.label}</a></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div style={{ maxWidth: 'var(--max-width)', margin: '2rem auto 0', paddingTop: '1.5rem', borderTop: '1px solid var(--clr-border-glow)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <p style={{ fontSize: '.75rem', color: 'var(--clr-text-muted)' }}>&copy; {currentYear} AliverBiopharm. All rights reserved.</p>
          <nav style={{ display: 'flex', gap: '22px' }}>
            <a href="/privacy" style={{ fontSize: '.875rem', color: 'var(--clr-text-dim)' }}>Privacy Policy</a>
            <a href="/terms" style={{ fontSize: '.875rem', color: 'var(--clr-text-dim)' }}>Terms of Use</a>
            <a href="/accessibility" style={{ fontSize: '.875rem', color: 'var(--clr-text-dim)' }}>Accessibility</a>
          </nav>
        </div>
      </footer>

      <button className="back-to-top" id="back-to-top" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}><i className="fa-solid fa-arrow-up"></i></button>
      <a href="#pricing" className="sticky-cta"><i className="fa-solid fa-rocket"></i> Start Learning</a>

      {toast && (
        <div className={`toast toast-${toast.type}`} style={{
          position: 'fixed', bottom: '20px', right: '20px', zIndex: 10000,
          background: toast.type === 'error' ? '#ef4444' : (toast.type === 'warning' ? '#f59e0b' : '#10b981'),
          color: 'white', padding: '12px 20px', borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)', animation: 'slideIn 0.3s ease'
        }}>
          {toast.message}
        </div>
      )}
    </div>
  );
}

export default function QuizWithBoundary() {
  return (
    <QuizErrorBoundary>
      <Quiz />
    </QuizErrorBoundary>
  );
}
