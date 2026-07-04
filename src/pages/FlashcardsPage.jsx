 import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import FlashcardOnboarding from '../components/FlashcardOnboarding';
import FlashcardWelcome from '../components/FlashcardWelcome';
import FlashcardSubjectSelect from '../components/FlashcardSubjectSelect';
import FlashcardDeckView from '../components/FlashcardDeckView';
import FlashcardProgress from '../components/Flashcardprogress';
import {
  getFlashcardOnboardingState,
  saveFlashcardOnboarding,
  completeFlashcardSession,
  getKnownFlashcards,
} from '../api/cachedClient';
import { getSections } from '../api/sections';
import { FaSpinner } from "react-icons/fa";
import { FaTriangleExclamation } from "react-icons/fa6";

const STAGE = {
  LOADING: 'loading',
  ONBOARDING: 'onboarding',
  WELCOME: 'welcome',
  SUBJECT: 'subject',
  STUDY: 'study',
  COMPLETE: 'complete',
};

const COLORS = {
  primary: '#b8873a',
  secondary: '#0ab5b5',
  accent: '#10b981',
  magenta: '#b8873a',
  cyan: '#0ab5b5',
  orange: '#f59e0b',
  red: '#ef4444',
  green: '#10b981',
  purple: '#8b5cf6',
  pink: '#ec4899',
  blue: '#3b82f6',
  white: '#ffffff',
  dim: '#94a3b8',
};

const pageVariants = {
  initial: {
    opacity: 0,
    y: 30,
  },
  in: {
    opacity: 1,
    y: 0,
  },
  out: {
    opacity: 0,
    y: -30,
  }
};

const pageTransition = {
  type: 'tween',
  ease: 'easeInOut',
  duration: 0.3
};

export default function FlashcardsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [stage, setStage] = useState(STAGE.LOADING);
  const [fcState, setFcState] = useState(null);
  const [selectedDeck, setSelectedDeck] = useState(null);
  const [sessionResult, setSessionResult] = useState(null);
  const [knownIds, setKnownIds] = useState([]);
  const [error, setError] = useState(null);
  const [sections, setSections] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    init();
    getSections().then(setSections);
  }, [user]);

  async function init() {
    try {
      const [stateData, knownData] = await Promise.all([
        getFlashcardOnboardingState(),
        getKnownFlashcards(),
      ]);
      setKnownIds(knownData || []);

      if (stateData?.onboarding_complete) {
        setFcState(stateData);
        setStage(STAGE.SUBJECT);
      } else {
        setStage(STAGE.ONBOARDING);
      }
    } catch (err) {
      setError('Failed to load. Please refresh.');
    }
  }

  async function handleOnboardingComplete(payload) {
    try {
      await saveFlashcardOnboarding({ ...payload, onboarding_complete: false });
      setFcState(prev => ({ ...prev, ...payload }));
      setStage(STAGE.WELCOME);
    } catch {
      setError('Failed to save your choices. Please try again.');
    }
  }

  async function handleWelcomeDone() {
    try {
      await saveFlashcardOnboarding({ onboarding_complete: true });
      setFcState(prev => ({ ...prev, onboarding_complete: true }));
      setStage(STAGE.SUBJECT);
    } catch {
      setStage(STAGE.SUBJECT);
    }
  }

  function handleSubjectStart({ confidence, topic, deck }) {
    saveFlashcardOnboarding({
      confidence_level: confidence,
      last_topic: topic || null,
      last_deck_id: deck.id,
    }).catch(() => {});
    setFcState(prev => ({ ...prev, confidence_level: confidence, last_topic: topic }));
    setSelectedDeck(deck);
    setStage(STAGE.STUDY);
  }

  async function handleStudyComplete({ sessionId, total }) {
    let result = { total, correct: 0, incorrect: 0, score: 0 };
    if (sessionId) {
      try {
        const data = await completeFlashcardSession(sessionId);
        result = {
          total: data.card_count ?? total,
          correct: data.correct ?? 0,
          incorrect: data.incorrect ?? 0,
          score: data.score ?? 0,
        };
      } catch {}
    }
    setSessionResult(result);
    setStage(STAGE.COMPLETE);
  }

  function handleRestart() {
    setSelectedDeck(null);
    setSessionResult(null);
    setStage(STAGE.SUBJECT);
  }

  function handleResetOnboarding() {
    setFcState(null);
    setSelectedDeck(null);
    setSessionResult(null);
    setStage(STAGE.ONBOARDING);
  }

  const currentYear = new Date().getFullYear();
  const navLinks = sections?.navigation?.links || [{ href: '/', label: 'Home' }];

  const renderHeader = () => (
    <header className="site-header" id="site-header">
      <div className="header-container">
        <Link to="/" className="logo-link" aria-label="AliverBiopharm Home">
          {sections?.site_config?.logo_url ? (
            <img src={sections.site_config.logo_url} alt="AliverBiopharm" style={{ height: '70px', width: 'auto' }} />
          ) : (
            'AliverBiopharm'
          )}
        </Link>
        <nav aria-label="Main navigation">
          <ul className="main-nav" id="main-nav">
            {navLinks.map(link => (
              <li key={link.href}>
                {link.href.startsWith('#') || link.href.startsWith('http') ? (
                  <a href={link.href}>{link.label}</a>
                ) : (
                  <Link to={link.href}>{link.label}</Link>
                )}
              </li>
            ))}
          </ul>
        </nav>
        <div className="nav-actions">
          <button
            className="theme-toggle"
            onClick={() => {
              const dark = document.body.classList.toggle('dark-mode');
              localStorage.setItem('theme', dark ? 'dark' : 'light');
              setTheme(dark ? 'dark' : 'light');
            }}
            aria-label="Toggle dark mode"
          >
            <i className={`fa-solid ${theme === 'dark' ? 'fa-sun' : 'fa-moon'}`}></i>
          </button>
          <button className="mobile-toggle" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="Open menu">
            <i className="fa-solid fa-bars"></i>
          </button>
        </div>
      </div>
    </header>
  );

  const renderMobileNav = () => (
    <>
      <div className={`mobile-nav-panel ${mobileMenuOpen ? 'active' : ''}`}>
        <div className="mobile-nav-panel-inner">
          <div className="mobile-nav-header">
            <div className="mobile-nav-header-row">
              <button className="mobile-close-btn" onClick={() => setMobileMenuOpen(false)}>
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
          </div>
          <nav className="mobile-nav-links">
            {navLinks.map(link =>
              link.href.startsWith('#') || link.href.startsWith('http') ? (
                <a key={link.href} href={link.href}>{link.label}</a>
              ) : (
                <Link key={link.href} to={link.href} onClick={() => setMobileMenuOpen(false)}>{link.label}</Link>
              )
            )}
          </nav>
        </div>
      </div>
      <div className={`mobile-nav-overlay ${mobileMenuOpen ? 'active' : ''}`} onClick={() => setMobileMenuOpen(false)}></div>
    </>
  );

  const renderFooter = () => (
    <footer className="footer-fat">
      <div style={{ maxWidth: 'var(--max-width)', margin: '0 auto', display: 'flex', justifyContent: 'space-between', gap: '40px', flexWrap: 'wrap' }}>
        <div style={{ maxWidth: '260px' }}>
          <Link to="/" className="logo-link" style={{ marginBottom: '14px', display: 'inline-flex' }}>
            {sections?.site_config?.logo_url ? (
              <img src={sections.site_config.logo_url} alt="AliverBiopharm" style={{ height: '50px' }} />
            ) : (
              'AliverBiopharm'
            )}
          </Link>
          <p style={{ fontSize: '.85rem', lineHeight: 1.7, color: 'var(--clr-text-dim)' }}>
            Advancing biology and pharmacy education for every learner.
          </p>
          <div className="footer-social">
            {(sections?.footer?.social_links || []).map(s => (
              <a key={s.platform} href={s.url} target="_blank" rel="noreferrer">
                <i className={s.icon}></i>
              </a>
            ))}
          </div>
        </div>
        <div className="footer-grid">
          {(sections?.footer?.columns || []).map(col => (
            <div key={col.heading}>
              <h4 style={{ fontWeight: 700, color: 'var(--clr-white)', fontSize: '0.9rem', marginBottom: '16px' }}>
                {col.heading}
              </h4>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {col.items?.map(item => (
                  <li key={item.label}>
                    {item.href.startsWith('#') || item.href.startsWith('http') ? (
                      <a href={item.href} style={{ fontSize: '0.875rem', color: 'var(--clr-text-dim)' }}>
                        {item.icon && <i className={item.icon} style={{ marginRight: '0.5rem' }}></i>}
                        {item.label}
                      </a>
                    ) : (
                      <Link to={item.href} style={{ fontSize: '0.875rem', color: 'var(--clr-text-dim)' }}>
                        {item.icon && <i className={item.icon} style={{ marginRight: '0.5rem' }}></i>}
                        {item.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div style={{ maxWidth: 'var(--max-width)', margin: '2rem auto 0', paddingTop: '1.5rem', borderTop: '1px solid var(--clr-border-glow)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <p style={{ fontSize: '.75rem', color: 'var(--clr-text-muted)' }}>&copy; {currentYear} AliverBiopharm. All rights reserved.</p>
        <nav style={{ display: 'flex', gap: '22px' }}>
          <Link to="/privacy" style={{ fontSize: '.875rem', color: 'var(--clr-text-dim)' }}>Privacy Policy</Link>
          <Link to="/terms" style={{ fontSize: '.875rem', color: 'var(--clr-text-dim)' }}>Terms of Use</Link>
          <Link to="/about" style={{ fontSize: '.875rem', color: 'var(--clr-text-dim)' }}>About Us</Link>
        </nav>
      </div>
    </footer>
  );

  if (error) {
    return (
      <motion.div
        className="homepage"
        initial="initial"
        animate="in"
        exit="out"
        variants={pageVariants}
        transition={pageTransition}
      >
        {renderHeader()}
        {renderMobileNav()}
        <div className="fc-page">
          <div className="fc-page-inner">
            <div className="fc-empty">
              <FaTriangleExclamation style={{ color: COLORS.red, fontSize: '3rem', marginBottom: '1rem' }} />
              <p style={{ color: COLORS.white }}>{error}</p>
              <button className="fc-btn fc-btn-primary" style={{ marginTop: '1rem' }} onClick={init}>
                Try Again
              </button>
            </div>
          </div>
        </div>
        {renderFooter()}
      </motion.div>
    );
  }

  if (stage === STAGE.LOADING) {
    return (
      <motion.div
        className="homepage"
        initial="initial"
        animate="in"
        exit="out"
        variants={pageVariants}
        transition={pageTransition}
      >
        {renderHeader()}
        {renderMobileNav()}
        <div className="fc-page">
          <div className="fc-page-inner">
            <div className="fc-loading">
              <FaSpinner className="icon-spin" style={{ color: COLORS.primary, fontSize: '2rem' }} />
              <p style={{ color: COLORS.dim, marginTop: '1rem' }}>Loading your flashcards…</p>
            </div>
          </div>
        </div>
        {renderFooter()}
      </motion.div>
    );
  }

  if (stage === STAGE.ONBOARDING) {
    return (
      <motion.div
        className="homepage"
        initial="initial"
        animate="in"
        exit="out"
        variants={pageVariants}
        transition={pageTransition}
      >
        {renderHeader()}
        {renderMobileNav()}
        <FlashcardOnboarding onComplete={handleOnboardingComplete} />
        {renderFooter()}
      </motion.div>
    );
  }

  if (stage === STAGE.WELCOME) {
    return (
      <motion.div
        className="homepage"
        initial="initial"
        animate="in"
        exit="out"
        variants={pageVariants}
        transition={pageTransition}
      >
        {renderHeader()}
        {renderMobileNav()}
        <FlashcardWelcome
          user={user}
          level={fcState?.selected_level}
          discipline={fcState?.selected_discipline}
          cls={fcState?.selected_class}
          onDone={handleWelcomeDone}
        />
        {renderFooter()}
      </motion.div>
    );
  }

  if (stage === STAGE.SUBJECT) {
    return (
      <motion.div
        className="homepage"
        initial="initial"
        animate="in"
        exit="out"
        variants={pageVariants}
        transition={pageTransition}
      >
        {renderHeader()}
        {renderMobileNav()}
        <FlashcardSubjectSelect
          state={fcState}
          onStart={handleSubjectStart}
          onBack={handleResetOnboarding}
        />
        {renderFooter()}
      </motion.div>
    );
  }

  if (stage === STAGE.STUDY && selectedDeck) {
    return (
      <motion.div
        className="homepage"
        initial="initial"
        animate="in"
        exit="out"
        variants={pageVariants}
        transition={pageTransition}
      >
        {renderHeader()}
        {renderMobileNav()}
        <FlashcardDeckView
          deck={selectedDeck}
          knownIds={knownIds}
          mode={fcState?.last_mode || 'flip'}
          onComplete={handleStudyComplete}
        />
        {renderFooter()}
      </motion.div>
    );
  }

  if (stage === STAGE.COMPLETE) {
    return (
      <motion.div
        className="homepage"
        initial="initial"
        animate="in"
        exit="out"
        variants={pageVariants}
        transition={pageTransition}
      >
        {renderHeader()}
        {renderMobileNav()}
        <FlashcardProgress
          result={sessionResult}
          onRestart={handleRestart}
          onHome={() => navigate('/')}
        />
        {renderFooter()}
      </motion.div>
    );
  }

  return null;
}
