import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
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
  saveAchievement
} from '../api/client';

export default function Quiz() {
  const { user } = useAuth();
  const navigate = useNavigate();
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
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);
  const [filterAccordions, setFilterAccordions] = useState({ level: false, category: false });
  const [selectedLevelFilter, setSelectedLevelFilter] = useState('O-Level');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('');
  const [categories, setCategories] = useState([]);
  const [topicSearch, setTopicSearch] = useState('');
  const [welcomeBanner, setWelcomeBanner] = useState(null);
  const [dailyQuote, setDailyQuote] = useState('');
  const [streak, setStreak] = useState(0);
  const [liveEvent, setLiveEvent] = useState(null);
  const [liveEventCountdown, setLiveEventCountdown] = useState('');
  const [earnedBadges, setEarnedBadges] = useState([]);
  const [showA11yPanel, setShowA11yPanel] = useState(false);
  const [a11ySettings, setA11ySettings] = useState({ highContrast: false, reduceMotion: false, focusMode: false, fontSizeMultiplier: 1.0 });
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [pendingBlock, setPendingBlock] = useState(null);
  const [loading, setLoading] = useState(false);
  const [resultData, setResultData] = useState(null);
  const [adaptivePath, setAdaptivePath] = useState(null);
  const [spinnerWord, setSpinnerWord] = useState('');
  const [showingSpinner, setShowingSpinner] = useState(false);
  const [glossaryMap, setGlossaryMap] = useState({});
  const [badgeConfig, setBadgeConfig] = useState([]);
  const [adaptiveConfig, setAdaptiveConfig] = useState([]);
  const liveEventInterval = useRef(null);
  const spinnerTimeout = useRef(null);

  const SPINNER_WORDS = ['Reviewing your selection...','Checking your answer, please wait...','Analyzing your response...','Verifying against the correct answer...','Processing your choice...','Comparing with the right solution...','One moment, evaluating...','Confirming your answer...'];

  useEffect(() => {
    loadSiteSections();
    loadGlossaryAndConfig();
    loadA11ySettings();
    if (user) {
      recordDailyVisit();
      fetchStreak();
      fetchAchievements();
    }
    return () => {
      if (liveEventInterval.current) clearInterval(liveEventInterval.current);
      if (spinnerTimeout.current) clearTimeout(spinnerTimeout.current);
    };
  }, []);

  useEffect(() => {
    if (sections?.welcome_banner) {
      updateWelcomeBanner();
    }
    if (sections?.motivation?.quotes) {
      updateDailyQuote();
    }
    if (sections?.live_quiz_event) {
      updateLiveEvent();
      if (liveEventInterval.current) clearInterval(liveEventInterval.current);
      liveEventInterval.current = setInterval(updateLiveEventCountdown, 1000);
    }
    if (sections?.learning_paths?.rules) {
      setAdaptiveConfig(sections.learning_paths.rules);
    }
  }, [sections, user]);

  useEffect(() => {
    if (currentLevel) {
      loadTopics();
    }
  }, [currentLevel, selectedCategoryFilter]);

  async function loadSiteSections() {
    try {
      const data = await getAllSiteSections();
      setSections(data);
      if (data?.filter_options?.categories) setCategories(data.filter_options.categories);
    } catch (err) { console.error(err); }
  }

  async function loadGlossaryAndConfig() {
    try {
      const data = await getAllSiteSections();
      const glossary = data?.glossary || [];
      const map = {};
      glossary.forEach(g => { if (g.term) map[g.term.toLowerCase()] = g.definition; });
      setGlossaryMap(map);
      const badges = data?.certificate_design?.badges || [{ id: 'perfect_block', icon: 'fa-star', threshold: 100, label: 'Perfect Score' }, { id: 'streak_10', icon: 'fa-fire', threshold: 10, label: '10-Day Streak' }, { id: 'first_block', icon: 'fa-medal', threshold: 1, label: 'First Block Done' }];
      setBadgeConfig(badges);
    } catch (err) { console.error(err); }
  }

  function loadA11ySettings() {
    const stored = localStorage.getItem('a11y-settings');
    const def = { highContrast: false, reduceMotion: false, focusMode: false, fontSizeMultiplier: 1.0 };
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setA11ySettings(parsed);
        applyA11y(parsed);
      } catch { setA11ySettings(def); }
    } else {
      setA11ySettings(def);
    }
  }

  function applyA11y(settings) {
    document.body.classList.toggle('high-contrast', settings.highContrast);
    document.body.classList.toggle('reduced-motion', settings.reduceMotion);
    document.body.classList.toggle('focus-mode', settings.focusMode);
    document.documentElement.style.fontSize = (settings.fontSizeMultiplier !== 1) ? (settings.fontSizeMultiplier * 100) + '%' : '';
  }

  function updateWelcomeBanner() {
    if (!sections.welcome_banner) return;
    const un = user ? user.email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'Learner';
    const isGuest = !user;
    const isNewUser = !localStorage.getItem('has-visited-before');
    if (!isGuest && isNewUser) localStorage.setItem('has-visited-before', '1');
    let configKey = 'guest';
    if (isGuest) configKey = 'guest';
    else if (isNewUser) configKey = 'new_user';
    else configKey = hasUnfinishedBlocks() ? 'returning' : 'returning';
    const banner = sections.welcome_banner[configKey] || null;
    if (banner) {
      setWelcomeBanner({ text: banner.text, cta: banner.cta, configKey });
    }
  }

  function hasUnfinishedBlocks() {
    if (!allTopics.length) return false;
    for (let t of allTopics) {
      if (t.completed_blocks?.length < t.total_blocks && (!t.locked_blocks || t.locked_blocks.length < t.total_blocks)) return true;
    }
    return false;
  }

  function updateDailyQuote() {
    const quotes = sections.motivation.quotes;
    const today = new Date();
    const dayIndex = Math.floor(today.getTime() / 86400000) % quotes.length;
    setDailyQuote(quotes[dayIndex]);
  }

  async function fetchStreak() {
    if (!user) return;
    try {
      const res = await getUserStreak();
      setStreak(res?.count || 0);
    } catch (e) {}
  }

  async function fetchAchievements() {
    if (!user) return;
    try {
      const res = await getUserAchievements();
      setEarnedBadges((res || []).map(a => a.badge));
    } catch (e) {}
  }

  function updateLiveEvent() {
    const evt = sections.live_quiz_event;
    if (!evt || !evt.enabled) {
      setLiveEvent(null);
      return;
    }
    setLiveEvent(evt);
    updateLiveEventCountdown();
  }

  function updateLiveEventCountdown() {
    if (!liveEvent) return;
    const parts = liveEvent.schedule.split(' ');
    const now = new Date();
    let next = new Date();
    const hour = parseInt(parts[1]) || 20;
    const minute = parseInt(parts[0]) || 0;
    const targetDay = parseInt(parts[4]) || 5;
    next.setUTCHours(hour, minute, 0, 0);
    let currentDay = next.getUTCDay();
    let daysUntil = targetDay - currentDay;
    if (daysUntil < 0) daysUntil += 7;
    if (daysUntil === 0 && next <= now) daysUntil = 7;
    next.setUTCDate(next.getUTCDate() + daysUntil);
    const diff = next - now;
    if (diff <= 0) {
      setLiveEventCountdown('Live now!');
      return;
    }
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    setLiveEventCountdown(`${hours}h ${minutes}m ${seconds}s`);
  }

  async function loadTopics() {
    setLoading(true);
    try {
      const topics = await getQuizTopics({ level: currentLevel });
      setAllTopics(topics || []);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setAllTopics([]);
      setLoading(false);
    }
  }

  function handleLevelChange(level) {
    setCurrentLevel(level);
    setSelectedLevelFilter(level);
    setCurrentTopic('');
    setQuizQuestions([]);
    setResultData(null);
  }

  function openTopicBlocks(topic, total) {
    setCurrentTopic(topic);
    setTotalBlocks(total);
    setCurrentBlock(0);
    setQuizQuestions([]);
    setResultData(null);
  }

  async function startBlock(blockNum) {
    if (!user) {
      alert('Please sign in to take quizzes.');
      return;
    }
    try {
      const retry = await checkDailyRetry({ level: currentLevel, topic: currentTopic, block_number: blockNum });
      if (!retry.can_retry) {
        alert(retry.reason || 'Block locked until tomorrow.');
        return;
      }
    } catch (e) { console.error(e); }
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
        alert('No questions available.');
        setLoading(false);
        return;
      }
      setQuizQuestions(data.questions);
      setUserAnswers(new Array(data.questions.length).fill(null));
      setCurrentIndex(0);
      setQuizStartTime(new Date());
      setResultData(null);
      setLoading(false);
    } catch (err) {
      alert('Failed to load quiz: ' + err.message);
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
      spinnerTimeout.current = setTimeout(() => {
        setShowingSpinner(false);
      }, 800);
    } catch (err) {
      alert('Failed to verify answer: ' + err.message);
      setShowingSpinner(false);
    }
  }

  function nextQuestion() {
    if (currentIndex < quizQuestions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  }

  function prevQuestion() {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  }

  async function submitBlock() {
    if (quizQuestions.length === 0) return;
    const answersPayload = quizQuestions.map((q, idx) => ({
      id: q.id,
      selectedOption: userAnswers[idx]?.selected || 'X'
    }));
    const timeTaken = Math.round((new Date() - quizStartTime) / 1000);
    setLoading(true);
    try {
      const result = await submitQuizBlock({
        level: currentLevel,
        topic: currentTopic,
        block_number: currentBlock,
        answers: answersPayload,
        time_taken: timeTaken
      });
      setResultData(result);
      const newlyEarned = checkAndAwardBadges(result.percentage);
      for (let badge of newlyEarned) {
        await saveAchievement({ id: badge.id, label: badge.label });
      }
      await fetchAchievements();
      await fetchStreak();
      generateAdaptivePath(result.percentage);
      setLoading(false);
    } catch (err) {
      alert('Submission failed: ' + err.message);
      setLoading(false);
    }
  }

  function checkAndAwardBadges(percentage) {
    const newBadges = [];
    for (let b of badgeConfig) {
      if (b.id === 'perfect_block' && percentage >= b.threshold && !earnedBadges.includes(b.id)) {
        newBadges.push(b);
      }
      if (b.id === 'first_block' && !earnedBadges.includes(b.id)) {
        newBadges.push(b);
      }
    }
    if (streak >= 10 && !earnedBadges.includes('streak_10')) {
      const streakBadge = badgeConfig.find(b => b.id === 'streak_10');
      if (streakBadge) newBadges.push(streakBadge);
    }
    return newBadges;
  }

  function generateAdaptivePath(percentage) {
    let rule = null;
    for (let r of adaptiveConfig) {
      if (r.condition) {
        const cond = r.condition.replace('score', '').trim();
        const op = cond.charAt(0);
        const val = parseFloat(cond.slice(1));
        if (op === '<' && percentage < val) rule = r;
        if (op === '>' && percentage > val) rule = r;
        if (op === '=' && percentage === val) rule = r;
        if (op === '≥' && percentage >= val) rule = r;
        if (op === '≤' && percentage <= val) rule = r;
      }
    }
    if (!rule && percentage >= 90) rule = adaptiveConfig.find(r => r.condition && r.condition.includes('90'));
    if (!rule && percentage < 70) rule = adaptiveConfig.find(r => r.condition && r.condition.includes('70'));
    setAdaptivePath(rule || null);
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

  if (loading && !resultData && quizQuestions.length === 0 && allTopics.length === 0) {
    return <div className="section"><p style={{ textAlign: 'center', padding: '3rem' }}>Loading...</p></div>;
  }

  return (
    <div className="quiz-page">
      <header className="site-header">
        <div className="header-container">
          <Link to="/" className="logo-link">
            <div className="logo-icon"><svg width="18" height="18" fill="none" stroke="#fff" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5"/></svg></div>
            Aliver<span className="g-text">Biopharm</span>
          </Link>
          <div className="header-actions">
            <button className="a11y-toggle" onClick={() => setShowA11yPanel(true)}><i className="fa-solid fa-universal-access"></i></button>
            <button className="theme-toggle" onClick={() => {
              const dark = document.body.classList.toggle('dark-mode');
              localStorage.setItem('theme', dark ? 'dark' : 'light');
              const icon = document.querySelector('.theme-toggle i');
              if (icon) icon.className = dark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
            }}><i className="fa-solid fa-moon"></i></button>
          </div>
        </div>
      </header>

      <main className="section" id="quiz-content">
        <span className="sec-label">ASSESSMENTS</span>
        <h1 className="section-title">Knowledge Quizzes</h1>
        <p style={{ textAlign: 'center', color: 'var(--clr-text-dim)', marginBottom: '0.5rem' }}>Choose your level and topic. Each topic has blocks of 10 questions.</p>
        <div className="breadcrumb">
          <Link to="/">Home</Link><span>›</span><span>Quizzes</span>
          {currentTopic && (<><span>›</span><span>{currentTopic}</span></>)}
          {currentTopic && resultData && (<><span>›</span><span>Results</span></>)}
        </div>

        {welcomeBanner && (
          <div className="welcome-banner">
            <div className="wb-icon"><i className="fa-solid fa-star"></i></div>
            <div className="wb-content"><h3>Hello, {user ? user.email.split('@')[0] : 'Guest'}!</h3><p>{welcomeBanner.text}</p></div>
            <button className="wb-cta" onClick={() => {
              if (welcomeBanner.configKey === 'guest') alert('Sign up to start learning');
              else document.getElementById('topic-search-input')?.focus();
            }}>{welcomeBanner.cta} <i className="fa-solid fa-arrow-right"></i></button>
          </div>
        )}
        {dailyQuote && <div className="daily-quote-card"><p className="quote-text">"{dailyQuote}"</p><p className="quote-streak">{streak > 1 ? `🔥 ${streak}-day learning streak!` : 'Start your learning streak today!'}</p></div>}
        {liveEvent && (
          <div className="live-event-banner">
            <div className="le-icon"><i className="fa-solid fa-calendar-check"></i></div>
            <div className="le-info"><h4>{liveEvent.title}</h4><p className="le-countdown">{liveEventCountdown}</p></div>
            <a href={liveEvent.registration_link} className="le-join" target="_blank">Set Reminder</a>
          </div>
        )}

        {!currentTopic ? (
          <>
            <div className="topic-search"><input type="text" id="topic-search-input" placeholder="Search topics..." value={topicSearch} onChange={e => setTopicSearch(e.target.value)} /></div>
            <div className="filter-bar">
              <button className={`filter-toggle-btn ${filterDropdownOpen ? 'open' : ''}`} onClick={() => setFilterDropdownOpen(!filterDropdownOpen)}>
                <i className="fa-solid fa-filter"></i> Filter Resources <i className="fa-solid fa-chevron-down chevron"></i>
              </button>
              <div className={`filter-dropdown ${filterDropdownOpen ? 'open' : ''}`}>
                <div className="filter-accordion">
                  <button className={`filter-accordion-btn ${filterAccordions.level ? 'open' : ''}`} onClick={() => setFilterAccordions({ ...filterAccordions, level: !filterAccordions.level })}>
                    <span>Level</span><span className="filter-selected">{selectedLevelFilter}</span><i className="fa-solid fa-chevron-down"></i>
                  </button>
                  {filterAccordions.level && (<div className="filter-options open">
                    <label className="filter-option"><input type="radio" name="level" value="" checked={selectedLevelFilter === ''} onChange={() => handleLevelChange('')} /> All Levels</label>
                    <label className="filter-option"><input type="radio" name="level" value="O-Level" checked={selectedLevelFilter === 'O-Level'} onChange={() => handleLevelChange('O-Level')} /> O-Level</label>
                    <label className="filter-option"><input type="radio" name="level" value="A-Level" checked={selectedLevelFilter === 'A-Level'} onChange={() => handleLevelChange('A-Level')} /> A-Level</label>
                    <label className="filter-option"><input type="radio" name="level" value="Pharmacy" checked={selectedLevelFilter === 'Pharmacy'} onChange={() => handleLevelChange('Pharmacy')} /> Pharmacy</label>
                  </div>)}
                </div>
                <div className="filter-accordion">
                  <button className={`filter-accordion-btn ${filterAccordions.category ? 'open' : ''}`} onClick={() => setFilterAccordions({ ...filterAccordions, category: !filterAccordions.category })}>
                    <span>Category</span><span className="filter-selected">{selectedCategoryFilter || 'All Categories'}</span><i className="fa-solid fa-chevron-down"></i>
                  </button>
                  {filterAccordions.category && (<div className="filter-options open">
                    <label className="filter-option"><input type="radio" name="category" value="" checked={selectedCategoryFilter === ''} onChange={() => setSelectedCategoryFilter('')} /> All Categories</label>
                    {categories.map(cat => (<label key={cat} className="filter-option"><input type="radio" name="category" value={cat} checked={selectedCategoryFilter === cat} onChange={() => setSelectedCategoryFilter(cat)} /> {cat}</label>))}
                  </div>)}
                </div>
                <button className="filter-apply-btn" onClick={() => loadTopics()}>Apply Filters</button>
                <button className="filter-clear-btn" onClick={() => { setSelectedLevelFilter('O-Level'); setSelectedCategoryFilter(''); setCurrentLevel('O-Level'); loadTopics(); }}>Clear All</button>
              </div>
            </div>
            <div className="topic-grid">
              {allTopics.filter(t => !topicSearch || t.topic_name.toLowerCase().includes(topicSearch.toLowerCase())).map(topic => {
                const hasQuestions = (topic.question_count || 0) > 0 && (topic.total_blocks || 0) > 0;
                const allDone = hasQuestions && topic.completed_blocks?.length === topic.total_blocks;
                if (hasQuestions && !allDone) {
                  return (<div key={topic.topic_name} className="topic-card clickable" onClick={() => openTopicBlocks(topic.topic_name, topic.total_blocks)}>
                    <h3>{topic.topic_name}</h3><span className="q-count ready">{topic.question_count} questions • {topic.total_blocks} blocks</span><small style={{ color: 'var(--clr-cyan)' }}>Tap to start →</small>
                  </div>);
                } else {
                  return (<div key={topic.topic_name} className="topic-card"><h3>{topic.topic_name}</h3><span className="q-count">{topic.question_count} questions</span><small>{allDone ? 'All blocks done!' : 'Questions being added'}</small></div>);
                }
              })}
            </div>
          </>
        ) : resultData ? (
          <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div className="question-card" style={{ textAlign: 'center' }}>
              <i className={`fa-solid ${resultData.passed ? 'fa-trophy' : 'fa-book-open'} result-icon`}></i>
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.5rem', color: 'var(--clr-white)' }}>{resultData.passed ? `Congratulations, ${user?.email?.split('@')[0] || 'Learner'}!` : 'Block Complete'}</h2>
              <div className="result-score">{resultData.percentage}%</div>
              <p>{resultData.score}/{resultData.total} correct</p>
              <p style={{ fontStyle: 'italic' }}>{resultData.passed ? 'Outstanding! You really know this!' : 'Keep studying! Every expert was once a beginner.'}</p>
              <span className={`status-badge ${resultData.passed ? 'status-pass' : 'status-fail'}`}>{resultData.passed ? '✓ Passed' : '✗ Not passed'}</span>
              <div className="share-buttons">
                <button className="share-btn-sm" onClick={() => navigator.clipboard.writeText(`I scored ${resultData.percentage}% on ${currentTopic} Block ${currentBlock+1} at AliverBiopharm!`)}><i className="fa-solid fa-link"></i></button>
              </div>
            </div>
            {adaptivePath && (
              <div className="adaptive-path-card">
                <div className="ap-icon"><i className="fa-solid fa-lightbulb"></i></div>
                <h4>{resultData.passed ? 'Great Progress!' : 'Keep Going!'}</h4>
                <p>{adaptivePath.message}</p>
                {adaptivePath.action === 'review_block' && <button className="btn-secondary" onClick={() => startBlock(currentBlock)}>📖 Review This Block</button>}
              </div>
            )}
            <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.2rem', color: 'var(--clr-white)', margin: '2rem 0 1rem' }}>Block {currentBlock+1} Review</h3>
            {resultData.answers.map((a, idx) => (
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
              {currentBlock + 1 < totalBlocks && <button className="btn-primary" onClick={() => startBlock(currentBlock + 1)}>Next Block →</button>}
              <button className="btn-secondary" onClick={() => { setCurrentTopic(''); setResultData(null); loadTopics(); }}>← All Blocks</button>
              <button className="btn-secondary" onClick={() => { setCurrentTopic(''); setResultData(null); setCurrentLevel('O-Level'); loadTopics(); }}>← Topics</button>
            </div>
          </div>
        ) : quizQuestions.length > 0 ? (
          <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div className="progress-bar"><div className="progress-fill" style={{ width: `${((currentIndex+1)/quizQuestions.length)*100}%` }}></div></div>
            <p style={{ fontSize: '0.8rem', color: 'var(--clr-text-muted)', marginBottom: '0.5rem' }}>Block {currentBlock+1} • Q {currentIndex+1}/{quizQuestions.length}</p>
            <p style={{ fontSize: '0.75rem', color: 'var(--clr-text-muted)', marginBottom: '1rem' }}>{currentTopic}</p>
            <div className="spinner-top-container" style={{ display: showingSpinner ? 'flex' : 'none', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px 8px', marginBottom: '8px' }}>
              <span className="answer-spinner"></span><span className="spinner-text"><span className="spinner-words">{spinnerWord}</span></span>
            </div>
            <div className="question-card">
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: '1.15rem', color: 'var(--clr-white)', marginBottom: '1.2rem' }} dangerouslySetInnerHTML={{ __html: renderGlossary(quizQuestions[currentIndex].question_text) }} />
              {['A','B','C','D'].map(opt => {
                const answered = userAnswers[currentIndex] !== null;
                const selected = userAnswers[currentIndex]?.selected;
                const correctOpt = userAnswers[currentIndex]?.correct_option;
                let cls = '';
                let icon = null;
                if (answered) {
                  if (opt === correctOpt) { cls = ' correct'; icon = <i className="fa-solid fa-circle-check" style={{ color: '#10b981', marginLeft: 'auto' }}></i>; }
                  else if (opt === selected) { cls = ' incorrect'; icon = <i className="fa-solid fa-circle-xmark" style={{ color: '#ef4444', marginLeft: 'auto' }}></i>; }
                }
                return (<button key={opt} className={`option-btn${cls}`} disabled={answered} onClick={() => selectAnswer(opt)}>
                  <span className="option-letter">{opt}</span>
                  <span dangerouslySetInnerHTML={{ __html: renderGlossary(quizQuestions[currentIndex][`option_${opt.toLowerCase()}`]) }} />
                  {icon}
                </button>);
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}>
              {currentIndex > 0 && <button className="btn-secondary" onClick={prevQuestion}>← Prev</button>}
              {userAnswers[currentIndex] !== null && (currentIndex < quizQuestions.length-1 ? <button className="btn-primary" onClick={nextQuestion}>Next →</button> : <button className="btn-primary" onClick={submitBlock}>Submit Block</button>)}
            </div>
            <div className="keyboard-hint">💡 Press <strong>A B C D</strong> keys to answer • <strong>← →</strong> to navigate</div>
          </div>
        ) : (
          <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.5rem', color: 'var(--clr-white)' }}>{currentTopic}</h2>
            <div className="block-nav">
              {Array.from({ length: totalBlocks }).map((_, i) => {
                const topicData = allTopics.find(t => t.topic_name === currentTopic);
                const locked = topicData?.locked_blocks?.includes(i);
                const completed = topicData?.completed_blocks?.includes(i);
                let icon = null;
                let cls = '';
                if (locked) {
                  cls = 'locked';
                  icon = <i className="fa-solid fa-lock" style={{ marginRight: '6px', color: '#ef4444' }}></i>;
                } else if (completed) {
                  cls = 'completed';
                  icon = <i className="fa-solid fa-check-circle" style={{ marginRight: '6px', color: '#10b981' }}></i>;
                } else {
                  icon = <i className="fa-regular fa-circle" style={{ marginRight: '6px', color: 'var(--clr-cyan)' }}></i>;
                }
                return (<button key={i} className={`block-nav-btn ${cls}`} disabled={locked} onClick={() => startBlock(i)}>{icon} Block {i+1}</button>);
              })}
            </div>
            <button className="btn-secondary" onClick={() => { setCurrentTopic(''); loadTopics(); }}>← Back</button>
          </div>
        )}
      </main>

      <footer className="footer-fat">
        <div style={{ maxWidth: 'var(--max-width)', margin: '0 auto', display: 'flex', justifyContent: 'space-between', gap: '40px', flexWrap: 'wrap' }}>
          <div><a href="/" className="logo-link">Aliver<span className="g-text">Biopharm</span></a><p style={{ fontSize: '0.85rem', color: 'var(--clr-text-dim)' }}>Advancing biology and pharmacy education.</p></div>
          <div className="footer-grid">
            {(sections?.footer?.columns || []).map(col => (
              <div key={col.heading}><h4 style={{ fontWeight: 700, color: 'var(--clr-white)' }}>{col.heading}</h4><ul>{col.items?.map(item => <li key={item.label}><a href={item.href}>{item.label}</a></li>)}</ul></div>
            ))}
          </div>
        </div>
        <div style={{ textAlign: 'center', marginTop: '2rem', borderTop: '1px solid var(--clr-border-glow)', paddingTop: '1.5rem' }}><p>&copy; {new Date().getFullYear()} AliverBiopharm</p></div>
      </footer>

      {showRulesModal && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.8)' }}>
          <div style={{ background: 'var(--clr-navy-card)', border: '2px solid var(--clr-cyan)', borderRadius: 'var(--radius-lg)', padding: '2rem', maxWidth: '420px', width: '90%' }}>
            <h3 style={{ color: 'var(--clr-cyan)' }}>Quiz Rules</h3>
            <ul style={{ listStyle: 'none', margin: '1rem 0' }}>
              <li><i className="fa-solid fa-check-circle" style={{ color: '#10b981', marginRight: '8px' }}></i> 10 questions per block</li>
              <li><i className="fa-solid fa-check-circle" style={{ color: '#10b981', marginRight: '8px' }}></i> 70% to pass</li>
              <li><i className="fa-solid fa-check-circle" style={{ color: '#10b981', marginRight: '8px' }}></i> See correct/incorrect immediately</li>
              <li><i className="fa-solid fa-check-circle" style={{ color: '#10b981', marginRight: '8px' }}></i> Full explanations after submission</li>
              <li><i className="fa-solid fa-check-circle" style={{ color: '#10b981', marginRight: '8px' }}></i> Block locks for 24 hours after completion</li>
            </ul>
            <button className="btn-primary" style={{ width: '100%' }} onClick={confirmStartBlock}>I understand, let's begin!</button>
          </div>
        </div>
      )}

      {showA11yPanel && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.8)' }}>
          <div style={{ background: 'var(--clr-navy-card)', border: '2px solid var(--clr-cyan)', borderRadius: 'var(--radius-lg)', padding: '2rem', maxWidth: '420px', width: '90%' }}>
            <h3><i className="fa-solid fa-universal-access"></i> Accessibility</h3>
            <label><input type="checkbox" checked={a11ySettings.highContrast} onChange={e => { const v = { ...a11ySettings, highContrast: e.target.checked }; setA11ySettings(v); applyA11y(v); localStorage.setItem('a11y-settings', JSON.stringify(v)); }} /> High Contrast Mode</label>
            <label><input type="checkbox" checked={a11ySettings.reduceMotion} onChange={e => { const v = { ...a11ySettings, reduceMotion: e.target.checked }; setA11ySettings(v); applyA11y(v); localStorage.setItem('a11y-settings', JSON.stringify(v)); }} /> Reduce Motion</label>
            <label><input type="checkbox" checked={a11ySettings.focusMode} onChange={e => { const v = { ...a11ySettings, focusMode: e.target.checked }; setA11ySettings(v); applyA11y(v); localStorage.setItem('a11y-settings', JSON.stringify(v)); }} /> Focus Mode</label>
            <label style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.3rem' }}>Font Size: <strong>{a11ySettings.fontSizeMultiplier}x</strong><input type="range" min="0.8" max="2.0" step="0.1" value={a11ySettings.fontSizeMultiplier} onChange={e => { const v = parseFloat(e.target.value); const newSettings = { ...a11ySettings, fontSizeMultiplier: v }; setA11ySettings(newSettings); applyA11y(newSettings); localStorage.setItem('a11y-settings', JSON.stringify(newSettings)); }} /></label>
            <button className="a11y-close-btn" onClick={() => setShowA11yPanel(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
