import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  FaDna, FaFileAlt, FaBrain, FaLayerGroup, FaTrophy,
  FaBookOpen, FaChartLine, FaSignal, FaWifi,
  FaBatteryFull, FaPlay, FaArrowRight
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
  const phoneContentRef = useRef(null);
  const autoDemoTimeoutRef = useRef(null);

  const menuItems = [
    { key: 'Biology Notes', icon: FaDna },
    { key: 'Past Papers', icon: FaFileAlt },
    { key: 'Quiz System', icon: FaBrain },
    { key: 'Flashcards', icon: FaLayerGroup },
    { key: 'Weekly Challenge', icon: FaTrophy },
    { key: 'Continue Reading', icon: FaBookOpen },
    { key: 'Platform Statistics', icon: FaChartLine }
  ];

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
        setNotesData(notesRes || []);
        setPastPapersData(papersRes?.papers || []);
        setQuizTopicsData(quizRes || []);
        setFlashcardsData(flashcardsRes || []);
        setContinueReadingData(continueRes || []);
      } catch (error) {
        console.error('API fetch error:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAllData();
  }, []);

  const platformStats = useMemo(() => ({
    totalNotes: notesData.length,
    totalFlashcardDecks: flashcardsData.length,
    totalQuizTopics: quizTopicsData.length,
    totalPastPapers: pastPapersData.length
  }), [notesData, flashcardsData, quizTopicsData, pastPapersData]);

  const handleFeatureClick = useCallback((featureKey) => {
    if (!isAutoDemoActive) return;
    setExpandedFeature(null);
    setPreviewData(null);
    setTimeout(() => {
      setExpandedFeature(featureKey);
      switch(featureKey) {
        case 'Biology Notes':
          setPreviewData(notesData[0] || null);
          break;
        case 'Past Papers':
          setPreviewData(pastPapersData[0] || null);
          break;
        case 'Quiz System':
          setPreviewData(quizTopicsData[0] || null);
          break;
        case 'Flashcards':
          setPreviewData(flashcardsData[0] || null);
          break;
        case 'Weekly Challenge':
          setPreviewData({ type: 'challenge' });
          break;
        case 'Continue Reading':
          if (continueReadingData.length === 0) {
            setPreviewData({ type: 'unauthenticated', message: 'Sign in to continue your biology learning journey.' });
          } else {
            setPreviewData(continueReadingData[0]);
          }
          break;
        case 'Platform Statistics':
          setPreviewData({ type: 'stats', stats: platformStats });
          break;
        default:
          setPreviewData(null);
      }
    }, 150);
  }, [notesData, pastPapersData, quizTopicsData, flashcardsData, continueReadingData, platformStats, isAutoDemoActive]);

  const moveCursorToElement = useCallback((element) => {
    if (!element || !phoneContentRef.current) return;
    const elementRect = element.getBoundingClientRect();
    const containerRect = phoneContentRef.current.getBoundingClientRect();
    const x = elementRect.left + elementRect.width / 2 - containerRect.left;
    const y = elementRect.top + elementRect.height / 2 - containerRect.top;
    setCursorPosition({ x, y });
    setIsCursorVisible(true);
  }, []);

  const simulateClickOnItem = useCallback((itemKey) => {
    const element = menuItemsRef.current[itemKey];
    if (element) {
      const pulseDiv = document.createElement('div');
      pulseDiv.className = 'cursor-pulse';
      const rect = element.getBoundingClientRect();
      const parentRect = phoneContentRef.current.getBoundingClientRect();
      pulseDiv.style.left = `${rect.left + rect.width/2 - parentRect.left}px`;
      pulseDiv.style.top = `${rect.top + rect.height/2 - parentRect.top}px`;
      phoneContentRef.current.appendChild(pulseDiv);
      setTimeout(() => pulseDiv.remove(), 400);
      handleFeatureClick(itemKey);
    }
  }, [handleFeatureClick]);

  const startAutoDemo = useCallback(() => {
    if (autoDemoTimeoutRef.current) clearTimeout(autoDemoTimeoutRef.current);
    let currentIndex = 0;
    const runNext = () => {
      if (!isAutoDemoActive) return;
      const item = menuItems[currentIndex % menuItems.length];
      const targetElement = menuItemsRef.current[item.key];
      if (targetElement) {
        moveCursorToElement(targetElement);
        setTimeout(() => {
          simulateClickOnItem(item.key);
          currentIndex++;
          autoDemoTimeoutRef.current = setTimeout(runNext, 3800);
        }, 300);
      } else {
        autoDemoTimeoutRef.current = setTimeout(runNext, 500);
      }
    };
    runNext();
  }, [menuItems, moveCursorToElement, simulateClickOnItem, isAutoDemoActive]);

  useEffect(() => {
    if (isAutoDemoActive && !isLoading) {
      startAutoDemo();
    }
    return () => {
      if (autoDemoTimeoutRef.current) clearTimeout(autoDemoTimeoutRef.current);
    };
  }, [isAutoDemoActive, isLoading, startAutoDemo]);

  const handleManualClick = (featureKey) => {
    if (isAutoDemoActive) {
      setIsAutoDemoActive(false);
      if (autoDemoTimeoutRef.current) clearTimeout(autoDemoTimeoutRef.current);
    }
    handleFeatureClick(featureKey);
  };

  const restartDemo = () => {
    setIsAutoDemoActive(true);
    setExpandedFeature(null);
    setPreviewData(null);
    startAutoDemo();
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

            <div className="menu-container">
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
              />
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
