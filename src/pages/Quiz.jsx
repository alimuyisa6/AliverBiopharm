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

class QuizErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, errorInfo: null };
  }
  componentDidCatch(error, errorInfo) {
    this.setState({ error, errorInfo });
  }
  render() {
    if (this.state.error) {
      return React.createElement('div', { style: { padding: '2rem', textAlign: 'center', background: '#fee', color: '#c00', fontFamily: 'monospace' } },
        React.createElement('h2', {}, 'Quiz Error'),
        React.createElement('pre', {}, this.state.error.toString()),
        React.createElement('details', {},
          React.createElement('summary', {}, 'Stack trace'),
          React.createElement('pre', {}, this.state.errorInfo?.componentStack)
        ),
        React.createElement(Link, { to: '/', className: 'btn-primary', style: { marginTop: '1rem', display: 'inline-block' } }, 'Back to Home')
      );
    }
    return this.props.children;
  }
}

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
        const glossary = siteData?.glossary || [];
        const map = {};
        glossary.forEach(g => { if (g.term) map[g.term.toLowerCase()] = g.definition; });
        setGlossaryMap(map);
        const topics = await getQuizTopics({ level: currentLevel });
        setAllTopics(topics || []);
        if (user) {
          await recordDailyVisit();
          const streakData = await getUserStreak();
          setStreak(streakData?.count || 0);
          const badges = await getUserAchievements();
          setEarnedBadges((badges || []).map(b => b.badge));
        }
        setLoading(false);
      } catch (err) {
        setError(err.message || 'Failed to load quiz');
        setLoading(false);
      }
    };
    load();
  }, []);

  async function loadTopics() {
    try {
      const topics = await getQuizTopics({ level: currentLevel });
      setAllTopics(topics || []);
    } catch (err) {
      setError(err.message);
    }
  }

  async function openTopicBlocks(topic, total) {
    setCurrentTopic(topic);
    setTotalBlocks(total);
    setCurrentBlock(0);
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
      if (result.percentage >= 90) rule = { message: 'Excellent! You\'re ready for more advanced material.', action: null };
      else if (result.percentage < 70) rule = { message: 'Review key concepts from this block before moving on.', action: 'review_block' };
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
    return <div className="section"><pre style={{ color: 'red', background: '#ffe0e0', padding: '1rem' }}>Error: {error}</pre><Link to="/">Back</Link></div>;
  }

  if (loading && !quizQuestions.length && !resultData) {
    return <div className="section"><p style={{ textAlign: 'center' }}>Loading quiz...</p></div>;
  }

  return React.createElement(QuizErrorBoundary, null,
    React.createElement('div', { className: 'quiz-page' },
      React.createElement('header', { className: 'site-header' },
        React.createElement('div', { className: 'header-container' },
          React.createElement(Link, { to: '/', className: 'logo-link' }, 'Aliver', React.createElement('span', { className: 'g-text' }, 'Biopharm'))
        )
      ),
      React.createElement('main', { className: 'section' },
        React.createElement('span', { className: 'sec-label' }, 'ASSESSMENTS'),
        React.createElement('h1', { className: 'section-title' }, 'Knowledge Quizzes'),
        !currentTopic ? (
          React.createElement(React.Fragment, null,
            React.createElement('div', { className: 'topic-search' },
              React.createElement('input', { type: 'text', placeholder: 'Search topics...', value: topicSearch, onChange: e => setTopicSearch(e.target.value) })
            ),
            React.createElement('div', { className: 'filter-bar' },
              React.createElement('button', { className: `filter-toggle-btn ${filterDropdownOpen ? 'open' : ''}`, onClick: () => setFilterDropdownOpen(!filterDropdownOpen) },
                React.createElement('i', { className: 'fa-solid fa-filter' }), ' Filter ', React.createElement('i', { className: 'fa-solid fa-chevron-down chevron' })
              ),
              filterDropdownOpen && React.createElement('div', { className: 'filter-dropdown' },
                React.createElement('div', { className: 'filter-accordion' },
                  React.createElement('button', { className: `filter-accordion-btn ${filterAccordions.level ? 'open' : ''}`, onClick: () => setFilterAccordions({ ...filterAccordions, level: !filterAccordions.level }) },
                    React.createElement('span', null, 'Level'),
                    React.createElement('span', { className: 'filter-selected' }, currentLevel),
                    React.createElement('i', { className: 'fa-solid fa-chevron-down' })
                  ),
                  filterAccordions.level && React.createElement('div', { className: 'filter-options open' },
                    React.createElement('label', { className: 'filter-option' }, React.createElement('input', { type: 'radio', name: 'level', value: 'O-Level', checked: currentLevel === 'O-Level', onChange: () => { setCurrentLevel('O-Level'); loadTopics(); } }), ' O-Level'),
                    React.createElement('label', { className: 'filter-option' }, React.createElement('input', { type: 'radio', name: 'level', value: 'A-Level', checked: currentLevel === 'A-Level', onChange: () => { setCurrentLevel('A-Level'); loadTopics(); } }), ' A-Level'),
                    React.createElement('label', { className: 'filter-option' }, React.createElement('input', { type: 'radio', name: 'level', value: 'Pharmacy', checked: currentLevel === 'Pharmacy', onChange: () => { setCurrentLevel('Pharmacy'); loadTopics(); } }), ' Pharmacy')
                  )
                )
              )
            ),
            React.createElement('div', { className: 'topic-grid' },
              allTopics.filter(t => !topicSearch || t.topic_name.toLowerCase().includes(topicSearch.toLowerCase())).map(topic => {
                const hasQuestions = (topic.question_count || 0) > 0 && (topic.total_blocks || 0) > 0;
                const allDone = hasQuestions && topic.completed_blocks?.length === topic.total_blocks;
                if (hasQuestions && !allDone) {
                  return React.createElement('div', { key: topic.topic_name, className: 'topic-card clickable', onClick: () => openTopicBlocks(topic.topic_name, topic.total_blocks) },
                    React.createElement('h3', null, topic.topic_name),
                    React.createElement('span', { className: 'q-count ready' }, topic.question_count, ' questions • ', topic.total_blocks, ' blocks'),
                    React.createElement('small', null, 'Tap to start →')
                  );
                } else {
                  return React.createElement('div', { key: topic.topic_name, className: 'topic-card' },
                    React.createElement('h3', null, topic.topic_name),
                    React.createElement('span', { className: 'q-count' }, topic.question_count, ' questions'),
                    React.createElement('small', null, allDone ? 'All blocks done!' : 'Questions being added')
                  );
                }
              })
            )
          )
        ) : resultData ? (
          React.createElement('div', { style: { maxWidth: '800px', margin: '0 auto' } },
            React.createElement('div', { className: 'question-card', style: { textAlign: 'center' } },
              React.createElement('i', { className: `fa-solid ${resultData.passed ? 'fa-trophy' : 'fa-book-open'} result-icon` }),
              React.createElement('h2', null, resultData.passed ? `Congratulations, ${user?.email?.split('@')[0] || 'Learner'}!` : 'Block Complete'),
              React.createElement('div', { className: 'result-score' }, resultData.percentage, '%'),
              React.createElement('p', null, resultData.score, '/', resultData.total, ' correct'),
              React.createElement('span', { className: `status-badge ${resultData.passed ? 'status-pass' : 'status-fail'}` }, resultData.passed ? '✓ Passed' : '✗ Not passed')
            ),
            adaptivePath && React.createElement('div', { className: 'adaptive-path-card' },
              React.createElement('i', { className: 'fa-solid fa-lightbulb' }),
              React.createElement('h4', null, resultData.passed ? 'Great Progress!' : 'Keep Going!'),
              React.createElement('p', null, adaptivePath.message)
            ),
            React.createElement('h3', null, 'Block ', currentBlock + 1, ' Review'),
            resultData.answers.map((a, idx) =>
              React.createElement('div', { key: idx, className: 'question-card' },
                React.createElement('div', null,
                  a.isCorrect ? React.createElement('i', { className: 'fa-solid fa-circle-check', style: { color: '#10b981' } }) : React.createElement('i', { className: 'fa-solid fa-circle-xmark', style: { color: '#ef4444' } }),
                  ' Q', idx + 1
                ),
                React.createElement('p', { dangerouslySetInnerHTML: { __html: renderGlossary(a.question) } }),
                React.createElement('p', null, 'Your answer: ', React.createElement('span', { style: { color: a.isCorrect ? '#10b981' : '#ef4444' } }, a.userAnswerText)),
                !a.isCorrect && React.createElement('p', null, 'Correct: ', a.correctAnswerText),
                React.createElement('div', { className: 'explanation-box', dangerouslySetInnerHTML: { __html: renderGlossary(a.explanation) } })
              )
            ),
            React.createElement('div', { style: { display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '2rem' } },
              currentBlock + 1 < totalBlocks && React.createElement('button', { className: 'btn-primary', onClick: () => startBlock(currentBlock + 1) }, 'Next Block →'),
              React.createElement('button', { className: 'btn-secondary', onClick: () => { setCurrentTopic(''); setResultData(null); loadTopics(); } }, '← All Blocks')
            )
          )
        ) : quizQuestions.length > 0 ? (
          React.createElement('div', { style: { maxWidth: '800px', margin: '0 auto' } },
            React.createElement('div', { className: 'progress-bar' },
              React.createElement('div', { className: 'progress-fill', style: { width: `${((currentIndex + 1) / quizQuestions.length) * 100}%` } })
            ),
            React.createElement('p', null, 'Block ', currentBlock + 1, ' • Q ', currentIndex + 1, '/', quizQuestions.length),
            React.createElement('div', { className: 'spinner-top-container', style: { display: showingSpinner ? 'flex' : 'none' } },
              React.createElement('span', { className: 'answer-spinner' }),
              React.createElement('span', { className: 'spinner-text' }, spinnerWord)
            ),
            React.createElement('div', { className: 'question-card' },
              React.createElement('h2', { dangerouslySetInnerHTML: { __html: renderGlossary(quizQuestions[currentIndex].question_text) } }),
              ['A', 'B', 'C', 'D'].map(opt => {
                const answered = userAnswers[currentIndex] !== null;
                const selected = userAnswers[currentIndex]?.selected;
                const correctOpt = userAnswers[currentIndex]?.correct_option;
                let cls = '';
                let icon = null;
                if (answered) {
                  if (opt === correctOpt) {
                    cls = ' correct';
                    icon = React.createElement('i', { className: 'fa-solid fa-circle-check', style: { color: '#10b981', marginLeft: 'auto' } });
                  } else if (opt === selected) {
                    cls = ' incorrect';
                    icon = React.createElement('i', { className: 'fa-solid fa-circle-xmark', style: { color: '#ef4444', marginLeft: 'auto' } });
                  }
                }
                return React.createElement('button', { key: opt, className: `option-btn${cls}`, disabled: answered, onClick: () => selectAnswer(opt) },
                  React.createElement('span', { className: 'option-letter' }, opt),
                  React.createElement('span', { dangerouslySetInnerHTML: { __html: renderGlossary(quizQuestions[currentIndex][`option_${opt.toLowerCase()}`]) } }),
                  icon
                );
              })
            ),
            React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', marginTop: '1rem' } },
              currentIndex > 0 && React.createElement('button', { className: 'btn-secondary', onClick: prevQuestion }, '← Prev'),
              userAnswers[currentIndex] !== null && (currentIndex < quizQuestions.length - 1 ?
                React.createElement('button', { className: 'btn-primary', onClick: nextQuestion }, 'Next →') :
                React.createElement('button', { className: 'btn-primary', onClick: submitBlock }, 'Submit Block'))
            ),
            React.createElement('div', { className: 'keyboard-hint' }, '💡 Press A B C D keys • ← → to navigate')
          )
        ) : (
          React.createElement('div', { style: { maxWidth: '800px', margin: '0 auto', textAlign: 'center' } },
            React.createElement('h2', null, currentTopic),
            React.createElement('div', { className: 'block-nav' },
              Array.from({ length: totalBlocks }).map((_, i) => {
                const topicData = allTopics.find(t => t.topic_name === currentTopic);
                const locked = topicData?.locked_blocks?.includes(i);
                const completed = topicData?.completed_blocks?.includes(i);
                let icon = null;
                let cls = '';
                if (locked) {
                  cls = 'locked';
                  icon = React.createElement('i', { className: 'fa-solid fa-lock', style: { marginRight: '6px', color: '#ef4444' } });
                } else if (completed) {
                  cls = 'completed';
                  icon = React.createElement('i', { className: 'fa-solid fa-check-circle', style: { marginRight: '6px', color: '#10b981' } });
                } else {
                  icon = React.createElement('i', { className: 'fa-regular fa-circle', style: { marginRight: '6px', color: 'var(--clr-cyan)' } });
                }
                return React.createElement('button', { key: i, className: `block-nav-btn ${cls}`, disabled: locked, onClick: () => startBlock(i) }, icon, ' Block ', i + 1);
              })
            ),
            React.createElement('button', { className: 'btn-secondary', onClick: () => { setCurrentTopic(''); loadTopics(); } }, '← Back')
          )
        ),
        showRulesModal && React.createElement('div', { className: 'modal-overlay', style: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 } },
          React.createElement('div', { style: { background: 'var(--clr-navy-card)', padding: '2rem', borderRadius: 'var(--radius-lg)', maxWidth: '420px', width: '90%' } },
            React.createElement('h3', null, 'Quiz Rules'),
            React.createElement('ul', { style: { listStyle: 'none' } },
              React.createElement('li', null, React.createElement('i', { className: 'fa-solid fa-check-circle', style: { color: '#10b981', marginRight: '8px' } }), ' 10 questions per block'),
              React.createElement('li', null, React.createElement('i', { className: 'fa-solid fa-check-circle', style: { color: '#10b981', marginRight: '8px' } }), ' 70% to pass'),
              React.createElement('li', null, React.createElement('i', { className: 'fa-solid fa-check-circle', style: { color: '#10b981', marginRight: '8px' } }), ' Immediate feedback'),
              React.createElement('li', null, React.createElement('i', { className: 'fa-solid fa-check-circle', style: { color: '#10b981', marginRight: '8px' } }), ' Full explanations'),
              React.createElement('li', null, React.createElement('i', { className: 'fa-solid fa-check-circle', style: { color: '#10b981', marginRight: '8px' } }), ' Block locks for 24h after completion')
            ),
            React.createElement('button', { className: 'btn-primary', style: { width: '100%' }, onClick: confirmStartBlock }, 'I understand, let\'s begin!')
          )
        )
      )
    )
  );
}
