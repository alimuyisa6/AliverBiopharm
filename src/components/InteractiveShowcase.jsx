 import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  FaDna, FaFileAlt, FaBrain, FaLayerGroup, FaTrophy,
  FaBookOpen, FaChartLine, FaSignal, FaWifi,
  FaBatteryFull, FaPlay, FaArrowRight, FaMousePointer
} from 'react-icons/fa';
import './InteractiveShowcase.css';

const getIconGradient = (itemKey) => {
  const gradients = {
    'Biology Notes': 'linear-gradient(135deg, #10b981, #14b8a6)',
    'Past Papers': 'linear-gradient(135deg, #ef4444, #f97316)',
    'Quiz System': 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
    'Flashcards': 'linear-gradient(135deg, #06b6d4, #2563eb)',
    'Weekly Challenge': 'linear-gradient(135deg, #f59e0b, #ea580c)',
    'Continue Reading': 'linear-gradient(135deg, #22c55e, #16a34a)',
    'Platform Statistics': 'linear-gradient(135deg, #ec4899, #e11d48)'
  };
  return gradients[itemKey];
};

const MenuIcon = ({ itemKey, icon: IconComponent }) => (
  <div className="menu-icon-container" style={{ background: getIconGradient(itemKey) }}>
    <IconComponent className="menu-icon" />
  </div>
);

const PreviewSkeleton = () => (
  <div className="preview-skeleton">
    <div className="skeleton-title"></div>
    <div className="skeleton-line"></div>
    <div className="skeleton-line short"></div>
  </div>
);

const StatsDashboard = ({ statsData }) => (
  <div className="stats-dashboard">
    <h4>Live Platform Metrics</h4>
    <div className="stats-grid">
      <div className="stat-card">
        <span className="stat-value">{statsData.totalNotes}</span>
        <span className="stat-label">Biology Notes</span>
      </div>
      <div className="stat-card">
        <span className="stat-value">{statsData.totalFlashcardDecks}</span>
        <span className="stat-label">Flashcard Decks</span>
      </div>
      <div className="stat-card">
        <span className="stat-value">{statsData.totalQuizTopics}</span>
        <span className="stat-label">Quiz Topics</span>
      </div>
      <div className="stat-card">
        <span className="stat-value">{statsData.totalPastPapers}</span>
        <span className="stat-label">Past Papers</span>
      </div>
    </div>
  </div>
);

// Timing constants — single source of truth for the demo loop
const CURSOR_MOVE_MS = 600;     // how long the pointer takes to glide to an item
const CLICK_PAUSE_MS = 350;     // small pause after arriving, before "clicking"
const DWELL_MS = 3200;          // how long the preview stays open before moving on
const SCROLL_DURATION_MS = 450; // how long the menu-list scroll animation takes

const InteractiveShowcase = () => {
  const [notesData, setNotesData] = useState([]);
  const [pastPapersData, setPastPapersData] = useState([]);
  const [quizTopicsData, setQuizTopicsData] = useState([]);
  const [flashcardsData, setFlashcardsData] = useState([]);
  const [continueReadingData, setContinueReadingData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedFeature, setExpandedFeature] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [isAutoDemoActive, setIsAutoDemoActive] = useState(true);
  const [cursorPosition, setCursorPosition] = useState({ x: 0, y: 0 });
  const [isCursorVisible, setIsCursorVisible] = useState(false);
  const [currentTime, setCurrentTime] = useState('');

  const menuItemsRef = useRef({});
  const menuListRef = useRef(null);
  const phoneContentRef = useRef(null);
  const autoDemoTimeoutRef = useRef(null);
  const cursorAnimationRef = useRef(null);
  const scrollAnimationRef = useRef(null);
  const cursorPositionRef = useRef({ x: 0, y: 0 });
  const isMountedRef = useRef(true);

  const menuItems = useMemo(() => [
    { key: 'Biology Notes', icon: FaDna },
    { key: 'Past Papers', icon: FaFileAlt },
    { key: 'Quiz System', icon: FaBrain },
    { key: 'Flashcards', icon: FaLayerGroup },
    { key: 'Weekly Challenge', icon: FaTrophy },
    { key: 'Continue Reading', icon: FaBookOpen },
    { key: 'Platform Statistics', icon: FaChartLine }
  ], []);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      setCurrentTime(`${hours}:${minutes}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchAllData = async () => {
      setIsLoading(true);
      try {
        const [notesRes, papersRes, quizRes, flashcardsRes, continueRes] = await Promise.all([
          fetch('/api/resources?path=get_resources').then(res => res.json()),
          fetch('/api/pastpapers?path=get_papers&limit=1').then(res => res.json()),
          fetch('/api/quiz?path=get_quiz_topics&level=A-Level').then(res => res.json()),
          fetch('/api/flashcards?path=decks').then(res => res.json()),
          fetch('/api/resources?path=get_continue_reading').then(res => res.json())
        ]);
        if (!isMountedRef.current) return;
        setNotesData(notesRes || []);
        setPastPapersData(papersRes?.papers || []);
        setQuizTopicsData(quizRes || []);
        setFlashcardsData(flashcardsRes || []);
        setContinueReadingData(continueRes || []);
      } catch (error) {
        console.error('API fetch error:', error);
      } finally {
        if (isMountedRef.current) setIsLoading(false);
      }
    };
    fetchAllData();
    return () => { isMountedRef.current = false; };
  }, []);

  const platformStats = useMemo(() => ({
    totalNotes: notesData.length,
    totalFlashcardDecks: flashcardsData.length,
    totalQuizTopics: quizTopicsData.length,
    totalPastPapers: pastPapersData.length
  }), [notesData, flashcardsData, quizTopicsData, pastPapersData]);

  // Keep a ref copy of cursor position so animation loops never need to
  // depend on (and re-create themselves around) the latest state value.
  useEffect(() => {
    cursorPositionRef.current = cursorPosition;
  }, [cursorPosition]);

  const buildPreviewFor = useCallback((featureKey) => {
    switch (featureKey) {
      case 'Biology Notes':
        return notesData[0] || null;
      case 'Past Papers':
        return pastPapersData[0] || null;
      case 'Quiz System':
        return quizTopicsData[0] || null;
      case 'Flashcards':
        return flashcardsData[0] || null;
      case 'Weekly Challenge':
        return { type: 'challenge' };
      case 'Continue Reading':
        if (continueReadingData.length === 0) {
          return { type: 'unauthenticated', message: 'Sign in to continue your biology learning journey.' };
        }
        return continueReadingData[0];
      case 'Platform Statistics':
        return { type: 'stats', stats: platformStats };
      default:
        return null;
    }
  }, [notesData, pastPapersData, quizTopicsData, flashcardsData, continueReadingData, platformStats]);

  const handleFeatureClick = useCallback((featureKey) => {
    setExpandedFeature(featureKey);
    setPreviewData(buildPreviewFor(featureKey));
  }, [buildPreviewFor]);

  // Smoothly scroll the menu list so `targetElement` becomes visible,
  // without ever changing the iPhone frame's own size/position.
  const scrollItemIntoView = useCallback((targetElement) => {
    return new Promise((resolve) => {
      const list = menuListRef.current;
      if (!list || !targetElement) {
        resolve();
        return;
      }

      const listRect = list.getBoundingClientRect();
      const itemRect = targetElement.getBoundingClientRect();

      let delta = 0;
      const margin = 8;
      if (itemRect.bottom > listRect.bottom - margin) {
        delta = itemRect.bottom - (listRect.bottom - margin);
      } else if (itemRect.top < listRect.top + margin) {
        delta = itemRect.top - (listRect.top + margin);
      }

      if (Math.abs(delta) < 1) {
        resolve();
        return;
      }

      if (scrollAnimationRef.current) cancelAnimationFrame(scrollAnimationRef.current);

      const startScroll = list.scrollTop;
      const targetScroll = Math.max(
        0,
        Math.min(startScroll + delta, list.scrollHeight - list.clientHeight)
      );
      const startTime = performance.now();

      const animateScroll = (now) => {
        const elapsed = now - startTime;
        const t = Math.min(1, elapsed / SCROLL_DURATION_MS);
        const ease = 1 - Math.pow(1 - t, 3);
        list.scrollTop = startScroll + (targetScroll - startScroll) * ease;
        if (t < 1) {
          scrollAnimationRef.current = requestAnimationFrame(animateScroll);
        } else {
          scrollAnimationRef.current = null;
          resolve();
        }
      };
      scrollAnimationRef.current = requestAnimationFrame(animateScroll);
    });
  }, []);

  // Glide the on-screen cursor to sit on top of `targetElement`.
  const moveCursorToElement = useCallback((targetElement) => {
    return new Promise((resolve) => {
      if (!targetElement || !phoneContentRef.current) {
        resolve();
        return;
      }
      const targetRect = targetElement.getBoundingClientRect();
      const containerRect = phoneContentRef.current.getBoundingClientRect();
      const targetX = targetRect.left + targetRect.width / 2 - containerRect.left;
      const targetY = targetRect.top + targetRect.height / 2 - containerRect.top;

      if (cursorAnimationRef.current) cancelAnimationFrame(cursorAnimationRef.current);

      const startX = cursorPositionRef.current.x;
      const startY = cursorPositionRef.current.y;
      const startTime = performance.now();

      setIsCursorVisible(true);

      const animate = (now) => {
        const elapsed = now - startTime;
        const t = Math.min(1, elapsed / CURSOR_MOVE_MS);
        const ease = 1 - Math.pow(1 - t, 3);
        const x = startX + (targetX - startX) * ease;
        const y = startY + (targetY - startY) * ease;
        setCursorPosition({ x, y });
        if (t < 1) {
          cursorAnimationRef.current = requestAnimationFrame(animate);
        } else {
          setCursorPosition({ x: targetX, y: targetY });
          cursorAnimationRef.current = null;
          resolve();
        }
      };
      cursorAnimationRef.current = requestAnimationFrame(animate);
    });
  }, []);

  const pulseClick = useCallback((targetElement) => {
    if (!targetElement || !phoneContentRef.current) return;
    const pulseDiv = document.createElement('div');
    pulseDiv.className = 'cursor-pulse';
    const rect = targetElement.getBoundingClientRect();
    const parentRect = phoneContentRef.current.getBoundingClientRect();
    pulseDiv.style.left = `${rect.left + rect.width / 2 - parentRect.left}px`;
    pulseDiv.style.top = `${rect.top + rect.height / 2 - parentRect.top}px`;
    phoneContentRef.current.appendChild(pulseDiv);
    setTimeout(() => pulseDiv.remove(), 400);
  }, []);

  const sleep = (ms) => new Promise((resolve) => {
    autoDemoTimeoutRef.current = setTimeout(resolve, ms);
  });

  // Main demo loop: for each item — scroll it into view, glide the cursor
  // to it, "click" it, show its preview, wait, then move to the next.
  const startAutoDemo = useCallback(async () => {
    let currentIndex = 0;

    while (isAutoDemoActive && isMountedRef.current) {
      const item = menuItems[currentIndex % menuItems.length];
      const targetElement = menuItemsRef.current[item.key];

      if (!targetElement) {
        await sleep(300);
        if (!isAutoDemoActive || !isMountedRef.current) break;
        currentIndex++;
        continue;
      }

      await scrollItemIntoView(targetElement);
      if (!isAutoDemoActive || !isMountedRef.current) break;

      await moveCursorToElement(targetElement);
      if (!isAutoDemoActive || !isMountedRef.current) break;

      await sleep(CLICK_PAUSE_MS);
      if (!isAutoDemoActive || !isMountedRef.current) break;

      pulseClick(targetElement);
      handleFeatureClick(item.key);

      await sleep(DWELL_MS);
      if (!isAutoDemoActive || !isMountedRef.current) break;

      currentIndex++;
    }
  }, [menuItems, scrollItemIntoView, moveCursorToElement, pulseClick, handleFeatureClick, isAutoDemoActive]);

  useEffect(() => {
    if (isAutoDemoActive && !isLoading) {
      startAutoDemo();
    }
    return () => {
      if (autoDemoTimeoutRef.current) clearTimeout(autoDemoTimeoutRef.current);
      if (cursorAnimationRef.current) cancelAnimationFrame(cursorAnimationRef.current);
      if (scrollAnimationRef.current) cancelAnimationFrame(scrollAnimationRef.current);
    };
  }, [isAutoDemoActive, isLoading, startAutoDemo]);

  const stopAutoDemo = useCallback(() => {
    setIsAutoDemoActive(false);
    if (autoDemoTimeoutRef.current) clearTimeout(autoDemoTimeoutRef.current);
    if (cursorAnimationRef.current) cancelAnimationFrame(cursorAnimationRef.current);
    if (scrollAnimationRef.current) cancelAnimationFrame(scrollAnimationRef.current);
    setIsCursorVisible(false);
  }, []);

  const handleManualClick = (featureKey) => {
    if (isAutoDemoActive) {
      stopAutoDemo();
    }
    handleFeatureClick(featureKey);
  };

  const restartDemo = () => {
    if (cursorAnimationRef.current) cancelAnimationFrame(cursorAnimationRef.current);
    if (scrollAnimationRef.current) cancelAnimationFrame(scrollAnimationRef.current);
    if (autoDemoTimeoutRef.current) clearTimeout(autoDemoTimeoutRef.current);
    setExpandedFeature(null);
    setPreviewData(null);
    setCursorPosition({ x: 0, y: 0 });
    if (menuListRef.current) menuListRef.current.scrollTop = 0;
    setIsAutoDemoActive(true);
  };

  const renderPreviewContent = () => {
    if (!expandedFeature) return <div className="preview-placeholder">Tap any feature to explore</div>;
    if (isLoading) return <PreviewSkeleton />;
    if (!previewData) return <div className="preview-error">Unable to load content</div>;

    switch(expandedFeature) {
      case 'Biology Notes':
        return (
          <div className="preview-card">
            <h4>{previewData.title}</h4>
            <span className="level-badge">{previewData.level}</span>
            <p>{previewData.description}</p>
            <div className="meta-info">Downloaded {previewData.download_count || 0} times</div>
          </div>
        );
      case 'Past Papers':
        return (
          <div className="preview-card">
            <h4>{previewData.title}</h4>
            <p><strong>Subject:</strong> {previewData.subject}</p>
            <p><strong>Year:</strong> {previewData.year}</p>
            <p><strong>Downloads:</strong> {(previewData.download_count || 0).toLocaleString()}</p>
          </div>
        );
      case 'Quiz System':
        return (
          <div className="preview-card">
            <h4>{previewData.topic_name}</h4>
            <p><strong>Questions:</strong> {previewData.question_count}</p>
            <p><strong>Blocks:</strong> {previewData.total_blocks}</p>
            <p><strong>Completed blocks:</strong> {previewData.completed_blocks?.length || 0}</p>
          </div>
        );
      case 'Flashcards':
        return (
          <div className="preview-card">
            <h4>{previewData.title}</h4>
            <p><strong>Category:</strong> {previewData.category}</p>
            <p><strong>Level:</strong> {previewData.level}</p>
            <p><strong>Author:</strong> {previewData.author || 'AliverBioPharm'}</p>
          </div>
        );
      case 'Weekly Challenge':
        return (
          <div className="preview-card challenge">
            <h4>Weekly Biology Challenge</h4>
            <p>Challenge yourself with this week's featured question about cellular respiration and ATP synthesis.</p>
            <button className="challenge-btn">Start Challenge →</button>
          </div>
        );
      case 'Continue Reading':
        if (previewData.type === 'unauthenticated') {
          return (
            <div className="preview-card auth-message">
              <p>{previewData.message}</p>
              <button className="auth-btn">Sign In</button>
            </div>
          );
        }
        return (
          <div className="preview-card">
            <h4>{previewData.title}</h4>
            <p><strong>Topic:</strong> {previewData.topic}</p>
            <p><strong>Level:</strong> {previewData.level}</p>
            <div className="progress-bar"><div style={{ width: `${previewData.progress_percentage}%` }}></div></div>
            <p>Last accessed: {new Date(previewData.last_accessed).toLocaleDateString()}</p>
          </div>
        );
      case 'Platform Statistics':
        return <StatsDashboard statsData={previewData.stats} />;
      default:
        return null;
    }
  };

  return (
    <div className="showcase-wrapper">
      <div className="iphone-container">
        <div className="iphone-frame">
          <div className="side-buttons">
            <div className="volume-up"></div>
            <div className="volume-down"></div>
            <div className="action-button"></div>
          </div>

          <div className="iphone-screen" ref={phoneContentRef}>
            <div className="dynamic-island">
              <div className="time">{currentTime}</div>
              <div className="status-icons">
                <FaSignal />
                <FaWifi />
                <FaBatteryFull />
              </div>
            </div>

            <div className="app-header">
              <h1>AliverBioPharm</h1>
              <p>Learn Biology Smarter</p>
            </div>

            <div className="menu-container" ref={menuListRef}>
              {menuItems.map((item) => (
                <div
                  key={item.key}
                  ref={el => menuItemsRef.current[item.key] = el}
                  className={`menu-item ${expandedFeature === item.key ? 'active' : ''}`}
                  onClick={() => handleManualClick(item.key)}
                >
                  <MenuIcon itemKey={item.key} icon={item.icon} />
                  <span className="menu-label">{item.key}</span>
                </div>
              ))}
            </div>

            <div className="preview-panel">
              {renderPreviewContent()}
            </div>

            {isCursorVisible && isAutoDemoActive && (
              <div
                className="demo-cursor"
                style={{ transform: `translate(${cursorPosition.x}px, ${cursorPosition.y}px)` }}
              >
                <FaMousePointer className="cursor-icon" />
              </div>
            )}

            <div className="dna-helix-bg"></div>
          </div>
        </div>
      </div>

      <div className="marketing-content">
        <h2>Master Biology <br />With Confidence</h2>
        <div className="feature-list">
          <span>Biology Notes</span>
          <span>Past Papers</span>
          <span>Quiz System</span>
          <span>Flashcards</span>
          <span>Weekly Challenges</span>
          <span>Continue Reading</span>
        </div>
        <p className="trusted-text">Trusted by learners, educators and future healthcare professionals.</p>
        <div className="cta-buttons">
          <button className="primary-cta">Start Free Trial <FaArrowRight /></button>
          <button className="secondary-cta" onClick={restartDemo}><FaPlay /> Watch Demo</button>
        </div>
      </div>
    </div>
  );
};

export default InteractiveShowcase;
