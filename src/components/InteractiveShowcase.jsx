 import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  FaDna, FaFileAlt, FaBrain, FaLayerGroup, FaTrophy,
  FaBookOpen, FaChartLine, FaSignal, FaWifi,
  FaBatteryFull, FaPlay, FaArrowRight, FaMousePointer, FaLock
} from 'react-icons/fa';
import { getUser, getResources, getPastPapers, getQuizTopics, getFlashcardDecks, getContinueReading, getPublicStats } from '../api/client';
import './InteractiveShowcase.css';

const apiCache = {
  notes: null,
  papers: null,
  quiz: null,
  flashcards: null,
  continue: null,
  stats: null,
};

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

const LoggedOutOverlay = () => (
  <div className="auth-gate-overlay">
    <FaLock className="auth-gate-icon" />
    <p>Sign in to watch the live demo</p>
  </div>
);

const CURSOR_MOVE_MS = 600;
const CLICK_PAUSE_MS = 350;
const DWELL_MS = 3200;
const SCROLL_DURATION_MS = 450;
const MODE_TRANSITION_MS = 450;

const InteractiveShowcase = () => {
  const [notesData, setNotesData] = useState([]);
  const [pastPapersData, setPastPapersData] = useState([]);
  const [quizTopicsData, setQuizTopicsData] = useState([]);
  const [flashcardsData, setFlashcardsData] = useState([]);
  const [continueReadingData, setContinueReadingData] = useState([]);
  const [publicStats, setPublicStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(null);
  const [expandedFeature, setExpandedFeature] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [isAutoDemoActive, setIsAutoDemoActive] = useState(false);
  const [cursorPosition, setCursorPosition] = useState({ x: 0, y: 0 });
  const [isCursorVisible, setIsCursorVisible] = useState(false);
  const [currentTime, setCurrentTime] = useState('');
  const [menuMode, setMenuMode] = useState('list');

  const menuItemsRef = useRef({});
  const menuListRef = useRef(null);
  const phoneContentRef = useRef(null);
  const autoDemoTimeoutRef = useRef(null);
  const cursorAnimationRef = useRef(null);
  const scrollAnimationRef = useRef(null);
  const cursorPositionRef = useRef({ x: 0, y: 0 });
  const isMountedRef = useRef(true);
  const isAutoDemoActiveRef = useRef(false);
  const menuModeRef = useRef('list');

  const menuItems = useMemo(() => [
    { key: 'Biology Notes', icon: FaDna },
    { key: 'Past Papers', icon: FaFileAlt },
    { key: 'Quiz System', icon: FaBrain },
    { key: 'Flashcards', icon: FaLayerGroup },
    { key: 'Weekly Challenge', icon: FaTrophy },
    { key: 'Continue Reading', icon: FaBookOpen },
    { key: 'Platform Statistics', icon: FaChartLine }
  ], []);

  const updateMenuMode = useCallback((mode) => {
    menuModeRef.current = mode;
    setMenuMode(mode);
  }, []);

  useEffect(() => {
    isAutoDemoActiveRef.current = isAutoDemoActive;
  }, [isAutoDemoActive]);

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
    const checkAuth = async () => {
      try {
        const result = await getUser();
        if (!isMountedRef.current) return;
        setIsAuthenticated(!!result?.user);
      } catch {
        if (isMountedRef.current) setIsAuthenticated(false);
      }
    };
    checkAuth();
    return () => { isMountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (isAuthenticated === null) return;

    const fetchAllData = async () => {
      const haveCorePublicData = apiCache.notes && apiCache.papers && apiCache.quiz && apiCache.flashcards && apiCache.stats;
      const needContinue = isAuthenticated && !apiCache.continue;

      if (haveCorePublicData && !needContinue) {
        setNotesData(apiCache.notes);
        setPastPapersData(apiCache.papers);
        setQuizTopicsData(apiCache.quiz);
        setFlashcardsData(apiCache.flashcards);
        setPublicStats(apiCache.stats);
        setContinueReadingData(isAuthenticated ? (apiCache.continue || []) : []);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const tasks = [
          apiCache.notes ? Promise.resolve(apiCache.notes) : getResources({ level: 'A-Level' }).catch(() => []),
          apiCache.papers ? Promise.resolve(apiCache.papers) : getPastPapers({ limit: 1 }).then(r => r?.papers || []).catch(() => []),
          apiCache.quiz ? Promise.resolve(apiCache.quiz) : getQuizTopics({ level: 'A-Level' }).catch(() => []),
          apiCache.flashcards ? Promise.resolve(apiCache.flashcards) : getFlashcardDecks().catch(() => []),
          apiCache.stats ? Promise.resolve(apiCache.stats) : getPublicStats().catch(() => null),
          isAuthenticated ? getContinueReading(10).catch(() => []) : Promise.resolve([])
        ];

        const [notesRes, papersRes, quizRes, flashcardsRes, statsRes, continueRes] = await Promise.all(tasks);

        apiCache.notes = Array.isArray(notesRes) ? notesRes : [];
        apiCache.papers = Array.isArray(papersRes) ? papersRes : [];
        apiCache.quiz = Array.isArray(quizRes) ? quizRes : [];
        apiCache.flashcards = Array.isArray(flashcardsRes) ? flashcardsRes : [];
        apiCache.stats = statsRes || null;
        if (isAuthenticated) apiCache.continue = Array.isArray(continueRes) ? continueRes : [];

        if (!isMountedRef.current) return;
        setNotesData(apiCache.notes);
        setPastPapersData(apiCache.papers);
        setQuizTopicsData(apiCache.quiz);
        setFlashcardsData(apiCache.flashcards);
        setPublicStats(apiCache.stats);
        setContinueReadingData(isAuthenticated ? (apiCache.continue || []) : []);
      } catch (error) {
        console.error('API fetch error:', error);
      } finally {
        if (isMountedRef.current) setIsLoading(false);
      }
    };
    fetchAllData();
  }, [isAuthenticated]);

  const platformStats = useMemo(() => ({
    totalNotes: publicStats?.resources_count ?? notesData.length,
    totalFlashcardDecks: flashcardsData.length,
    totalQuizTopics: quizTopicsData.length,
    totalPastPapers: pastPapersData.length
  }), [publicStats, notesData, flashcardsData, quizTopicsData, pastPapersData]);

  useEffect(() => {
    cursorPositionRef.current = cursorPosition;
  }, [cursorPosition]);

  const buildPreviewFor = useCallback((featureKey) => {
    switch (featureKey) {
      case 'Biology Notes':
        return notesData.length > 0
          ? notesData[0]
          : { type: 'empty', message: 'New biology notes are added regularly — check back soon.' };
      case 'Past Papers':
        return pastPapersData.length > 0
          ? pastPapersData[0]
          : { type: 'empty', message: 'Past papers are being added for this level.' };
      case 'Quiz System':
        return quizTopicsData.length > 0
          ? quizTopicsData[0]
          : { type: 'empty', message: 'Quiz topics for A-Level are coming soon.' };
      case 'Flashcards':
        return flashcardsData.length > 0
          ? flashcardsData[0]
          : { type: 'empty', message: 'Flashcard decks are being prepared.' };
      case 'Weekly Challenge':
        return { type: 'challenge' };
      case 'Continue Reading':
        if (!isAuthenticated) {
          return { type: 'unauthenticated', message: 'Sign in to continue your biology learning journey.' };
        }
        return continueReadingData.length > 0
          ? continueReadingData[0]
          : { type: 'empty', message: 'Start reading any note to see your progress here.' };
      case 'Platform Statistics':
        return { type: 'stats', stats: platformStats };
      default:
        return null;
    }
  }, [notesData, pastPapersData, quizTopicsData, flashcardsData, continueReadingData, platformStats, isAuthenticated]);

  const handleFeatureClick = useCallback((featureKey) => {
    setExpandedFeature(featureKey);
    setPreviewData(buildPreviewFor(featureKey));
  }, [buildPreviewFor]);

  const sleep = (ms) => new Promise((resolve) => {
    autoDemoTimeoutRef.current = setTimeout(resolve, ms);
  });

  const scrollItemIntoView = useCallback((targetElement, mode) => {
    return new Promise((resolve) => {
      const list = menuListRef.current;
      if (!list || !targetElement) {
        resolve();
        return;
      }

      const listRect = list.getBoundingClientRect();
      const itemRect = targetElement.getBoundingClientRect();
      const margin = 8;

      if (mode === 'compact') {
        let delta = 0;
        if (itemRect.right > listRect.right - margin) {
          delta = itemRect.right - (listRect.right - margin);
        } else if (itemRect.left < listRect.left + margin) {
          delta = itemRect.left - (listRect.left + margin);
        }
        if (Math.abs(delta) < 1) {
          resolve();
          return;
        }
        if (scrollAnimationRef.current) cancelAnimationFrame(scrollAnimationRef.current);
        const startScroll = list.scrollLeft;
        const targetScroll = Math.max(0, Math.min(startScroll + delta, list.scrollWidth - list.clientWidth));
        const startTime = performance.now();
        const animateScroll = (now) => {
          const elapsed = now - startTime;
          const t = Math.min(1, elapsed / SCROLL_DURATION_MS);
          const ease = 1 - Math.pow(1 - t, 3);
          list.scrollLeft = startScroll + (targetScroll - startScroll) * ease;
          if (t < 1) {
            scrollAnimationRef.current = requestAnimationFrame(animateScroll);
          } else {
            scrollAnimationRef.current = null;
            resolve();
          }
        };
        scrollAnimationRef.current = requestAnimationFrame(animateScroll);
        return;
      }

      let delta = 0;
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
      const targetScroll = Math.max(0, Math.min(startScroll + delta, list.scrollHeight - list.clientHeight));
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

  const startAutoDemo = useCallback(async () => {
    let currentIndex = 0;

    while (isAutoDemoActiveRef.current && isMountedRef.current) {
      const isCycleStart = currentIndex > 0 && currentIndex % menuItems.length === 0;

      if (isCycleStart) {
        updateMenuMode('list');
        setExpandedFeature(null);
        setPreviewData(null);
        setIsCursorVisible(false);
        if (menuListRef.current) {
          menuListRef.current.scrollTop = 0;
          menuListRef.current.scrollLeft = 0;
        }
        await sleep(MODE_TRANSITION_MS + 200);
        if (!isAutoDemoActiveRef.current || !isMountedRef.current) break;
      }

      const item = menuItems[currentIndex % menuItems.length];
      const targetElement = menuItemsRef.current[item.key];

      if (!targetElement) {
        await sleep(300);
        if (!isAutoDemoActiveRef.current || !isMountedRef.current) break;
        currentIndex++;
        continue;
      }

      await scrollItemIntoView(targetElement, menuModeRef.current);
      if (!isAutoDemoActiveRef.current || !isMountedRef.current) break;

      await moveCursorToElement(targetElement);
      if (!isAutoDemoActiveRef.current || !isMountedRef.current) break;

      await sleep(CLICK_PAUSE_MS);
      if (!isAutoDemoActiveRef.current || !isMountedRef.current) break;

      pulseClick(targetElement);
      handleFeatureClick(item.key);
      setIsCursorVisible(false);

      if (menuModeRef.current === 'list') {
        await sleep(300);
        if (!isAutoDemoActiveRef.current || !isMountedRef.current) break;
        updateMenuMode('compact');
        await sleep(MODE_TRANSITION_MS);
        if (!isAutoDemoActiveRef.current || !isMountedRef.current) break;
      }

      await sleep(DWELL_MS);
      if (!isAutoDemoActiveRef.current || !isMountedRef.current) break;

      currentIndex++;
    }
  }, [menuItems, scrollItemIntoView, moveCursorToElement, pulseClick, handleFeatureClick, updateMenuMode]);

  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      setIsAutoDemoActive(true);
    } else {
      setIsAutoDemoActive(false);
      setIsCursorVisible(false);
      updateMenuMode('list');
      setExpandedFeature(null);
      setPreviewData(null);
    }
  }, [isAuthenticated, isLoading, updateMenuMode]);

  useEffect(() => {
    if (isAutoDemoActive) {
      startAutoDemo();
    }
    return () => {
      if (autoDemoTimeoutRef.current) clearTimeout(autoDemoTimeoutRef.current);
      if (cursorAnimationRef.current) cancelAnimationFrame(cursorAnimationRef.current);
      if (scrollAnimationRef.current) cancelAnimationFrame(scrollAnimationRef.current);
    };
  }, [isAutoDemoActive, startAutoDemo]);

  const restartDemo = () => {
    if (!isAuthenticated) return;
    if (cursorAnimationRef.current) cancelAnimationFrame(cursorAnimationRef.current);
    if (scrollAnimationRef.current) cancelAnimationFrame(scrollAnimationRef.current);
    if (autoDemoTimeoutRef.current) clearTimeout(autoDemoTimeoutRef.current);
    updateMenuMode('list');
    setExpandedFeature(null);
    setPreviewData(null);
    setCursorPosition({ x: 0, y: 0 });
    setIsCursorVisible(false);
    if (menuListRef.current) {
      menuListRef.current.scrollTop = 0;
      menuListRef.current.scrollLeft = 0;
    }
    setIsAutoDemoActive(false);
    setTimeout(() => setIsAutoDemoActive(true), 0);
  };

  const previewContent = useMemo(() => {
    if (!isAuthenticated) {
      return <div className="preview-placeholder">Sign in to start the live demo</div>;
    }
    if (!expandedFeature) return <div className="preview-placeholder">Demo starting…</div>;
    if (isLoading) return <PreviewSkeleton />;
    if (!previewData) return <PreviewSkeleton />;

    if (previewData.type === 'empty') {
      return <div className="preview-empty">{previewData.message}</div>;
    }

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
            <button className="challenge-btn" disabled>Start Challenge →</button>
          </div>
        );
      case 'Continue Reading':
        if (previewData.type === 'unauthenticated') {
          return (
            <div className="preview-card auth-message">
              <p>{previewData.message}</p>
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
  }, [isAuthenticated, expandedFeature, isLoading, previewData]);

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

            <div className="phone-viewport">
              <div
                className={`menu-container ${menuMode === 'compact' ? 'menu-container-compact' : ''}`}
                ref={menuListRef}
              >
                {menuItems.map((item) => (
                  <div
                    key={item.key}
                    ref={el => menuItemsRef.current[item.key] = el}
                    className={`menu-item ${expandedFeature === item.key ? 'active' : ''} ${menuMode === 'compact' ? 'menu-item-compact' : ''}`}
                  >
                    <MenuIcon itemKey={item.key} icon={item.icon} />
                    <span className="menu-label">{item.key}</span>
                  </div>
                ))}
              </div>

              <div className={`preview-screen ${menuMode === 'compact' ? 'preview-screen-expanded' : ''}`}>
                <div className="preview-screen-inner">
                  {previewContent}
                </div>
              </div>

              {!isAuthenticated && <LoggedOutOverlay />}

              {isCursorVisible && isAutoDemoActive && isAuthenticated && (
                <div
                  className="demo-cursor"
                  style={{ transform: `translate(${cursorPosition.x}px, ${cursorPosition.y}px)` }}
                >
                  <FaMousePointer className="cursor-icon" />
                </div>
              )}
            </div>

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
          <button className="secondary-cta" onClick={restartDemo} disabled={!isAuthenticated}>
            <FaPlay /> Watch Demo
          </button>
        </div>
      </div>
    </div>
  );
};

export default React.memo(InteractiveShowcase);
