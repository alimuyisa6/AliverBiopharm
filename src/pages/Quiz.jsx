 import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
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
  const [error, setError] = useState(null);
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
  const spinnerTimeout = useRef(null);

  const SPINNER_WORDS = ['Reviewing your selection...','Checking your answer...','Analyzing...','Verifying...','Processing...','One moment...'];

   useEffect(() => {
  const load = async () => {
    try {
      setLoading(true);

      const siteData = await getAllSiteSections();
      setSections(siteData);

      const glossary = Array.isArray(siteData?.glossary?.data)
        ? siteData.glossary.data
        : [];

      const map = {};

      glossary.forEach(g => {
        if (g?.term) {
          map[g.term.toLowerCase()] = g.definition;
        }
      });

      setGlossaryMap(map);

      const topics = await getQuizTopics({ level: currentLevel });
      setAllTopics(Array.isArray(topics) ? topics : []);

      if (user) {
        await recordDailyVisit();

        const streakData = await getUserStreak();
        setStreak(streakData?.count || 0);

        const badges = await getUserAchievements();
        setEarnedBadges(
          Array.isArray(badges)
            ? badges.map(b => b.badge)
            : []
        );
      }

      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  load();
}, []);

  async function loadTopics() {
    try {
      const topics = await getQuizTopics({ level: currentLevel });
      setAllTopics(Array.isArray(topics) ? topics : []);
    } catch (err) { setError(err.message); }
  }

  async function openTopicBlocks(topic, total) {
    setCurrentTopic(topic);
    setTotalBlocks(total);
    setQuizQuestions([]);
    setResultData(null);
  }

  async function startBlock(blockNum) {
    if (!user) { alert('Please sign in.'); return; }
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
      spinnerTimeout.current = setTimeout(() => setShowingSpinner(false), 800);
    } catch (err) {
      alert('Failed to verify answer: ' + err.message);
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
      const newBadges = [];
      if (result.percentage >= 100 && !earnedBadges.includes('perfect_block')) newBadges.push({ id: 'perfect_block', label: 'Perfect Score' });
      if (!earnedBadges.includes('first_block')) newBadges.push({ id: 'first_block', label: 'First Block Done' });
      for (let b of newBadges) { await saveAchievement({ id: b.id, label: b.label }); }
      setEarnedBadges([...earnedBadges, ...newBadges.map(b => b.id)]);
      if (streak >= 10 && !earnedBadges.includes('streak_10')) {
        await saveAchievement({ id: 'streak_10', label: '10-Day Streak' });
        setEarnedBadges([...earnedBadges, 'streak_10']);
      }
      let rule = null;
      if (result.percentage >= 90) rule = { message: 'Excellent! You\'re ready for more.', action: null };
      else if (result.percentage < 70) rule = { message: 'Review key concepts before moving on.', action: 'review_block' };
      setAdaptivePath(rule);
      setLoading(false);
    } catch (err) {
      alert('Submission failed: ' + err.message);
      setLoading(false);
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

  if (error) {
    return (
      <div className="section" style={{ padding: '2rem', textAlign: 'center' }}>
        <div style={{ background: '#fee', color: '#c00', padding: '1rem', borderRadius: '8px' }}>
          <h2>Error loading quiz</h2>
          <pre>{error}</pre>
        </div>
        <Link to="/" className="btn-primary" style={{ marginTop: '1rem' }}>Back to Home</Link>
      </div>
    );
  }

  if (loading && !quizQuestions.length && !resultData) {
    return <div className="section"><p style={{ textAlign: 'center' }}>Loading quiz...</p></div>;
  }

  return (
    <div className="quiz-page">
      <header className="site-header">
        <div className="header-container">
          <Link to="/" className="logo-link">Aliver<span className="g-text">Biopharm</span></Link>
        </div>
      </header>
      <main className="section">
        <span className="sec-label">ASSESSMENTS</span>
        <h1 className="section-title">Knowledge Quizzes</h1>

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
                        <label className="filter-option"><input type="radio" name="level" value="O-Level" checked={currentLevel === 'O-Level'} onChange={() => { setCurrentLevel('O-Level'); loadTopics(); }} /> O-Level</label>
                        <label className="filter-option"><input type="radio" name="level" value="A-Level" checked={currentLevel === 'A-Level'} onChange={() => { setCurrentLevel('A-Level'); loadTopics(); }} /> A-Level</label>
                        <label className="filter-option"><input type="radio" name="level" value="Pharmacy" checked={currentLevel === 'Pharmacy'} onChange={() => { setCurrentLevel('Pharmacy'); loadTopics(); }} /> Pharmacy</label>
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
              <i className={`fa-solid ${resultData.passed ? 'fa-trophy' : 'fa-book-open'} result-icon`}></i>
              <h2>{resultData.passed ? `Congratulations, ${user?.email?.split('@')[0] || 'Learner'}!` : 'Block Complete'}</h2>
              <div className="result-score">{resultData.percentage}%</div>
              <p>{resultData.score}/{resultData.total} correct</p>
              <span className={`status-badge ${resultData.passed ? 'status-pass' : 'status-fail'}`}>{resultData.passed ? '✓ Passed' : '✗ Not passed'}</span>
            </div>
            {adaptivePath && (
              <div className="adaptive-path-card">
                <i className="fa-solid fa-lightbulb"></i>
                <h4>{resultData.passed ? 'Great Progress!' : 'Keep Going!'}</h4>
                <p>{adaptivePath.message}</p>
              </div>
            )}
            <h3>Block {currentBlock+1} Review</h3>
            {(resultData.answers || []).map((a, idx) => (
              <div key={idx} className="question-card">
                <div>{a.isCorrect ? <i className="fa-solid fa-circle-check" style={{ color: '#10b981' }}></i> : <i className="fa-solid fa-circle-xmark" style={{ color: '#ef4444' }}></i>} Q{idx+1}</div>
                <p dangerouslySetInnerHTML={{ __html: renderGlossary(a.question) }} />
                <p>Your answer: <span style={{ color: a.isCorrect ? '#10b981' : '#ef4444' }}>{a.userAnswerText}</span></p>
                {!a.isCorrect && <p>Correct: {a.correctAnswerText}</p>}
                <div className="explanation-box" dangerouslySetInnerHTML={{ __html: renderGlossary(a.explanation) }} />
              </div>
            ))}
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '2rem' }}>
              {currentBlock+1 < totalBlocks && <button className="btn-primary" onClick={() => startBlock(currentBlock+1)}>Next Block →</button>}
              <button className="btn-secondary" onClick={() => { setCurrentTopic(''); setResultData(null); loadTopics(); }}>← All Blocks</button>
            </div>
          </div>
        ) : quizQuestions.length > 0 ? (
          <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div className="progress-bar"><div className="progress-fill" style={{ width: `${((currentIndex+1)/quizQuestions.length)*100}%` }}></div></div>
            <p>Block {currentBlock+1} • Q {currentIndex+1}/{quizQuestions.length}</p>
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
            <h2>{currentTopic}</h2>
            <div className="block-nav">
              {Array.from({ length: totalBlocks }).map((_, i) => {
                const topicData = allTopics.find(t => t.topic_name === currentTopic);
                const locked = topicData?.locked_blocks?.includes(i);
                const completed = topicData?.completed_blocks?.includes(i);
                let icon = null, cls = '';
                if (locked) { cls = 'locked'; icon = <i className="fa-solid fa-lock" style={{ marginRight: '6px', color: '#ef4444' }}></i>; }
                else if (completed) { cls = 'completed'; icon = <i className="fa-solid fa-check-circle" style={{ marginRight: '6px', color: '#10b981' }}></i>; }
                else { icon = <i className="fa-regular fa-circle" style={{ marginRight: '6px', color: 'var(--clr-cyan)' }}></i>; }
                return (
                  <button key={i} className={`block-nav-btn ${cls}`} disabled={locked} onClick={() => startBlock(i)}>
                    {icon} Block {i+1}
                  </button>
                );
              })}
            </div>
            <button className="btn-secondary" onClick={() => { setCurrentTopic(''); loadTopics(); }}>← Back</button>
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
    </div>
  );
}
