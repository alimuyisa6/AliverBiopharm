 import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import {
  getAllSiteSections,
  getGlossaryTerms,
  getGlossaryCategories,
  getGlossaryTerm
} from '../api/client';

const pageVariants = {
  initial: {
    opacity: 0,
    y: 20,
  },
  in: {
    opacity: 1,
    y: 0,
  },
  out: {
    opacity: 0,
    y: -20,
  }
};

const pageTransition = {
  type: 'tween',
  ease: 'easeInOut',
  duration: 0.3
};

export default function Glossary() {
  const { user, logout } = useAuth();
  const [sections, setSections] = useState(null);
  const [selectedLevel, setSelectedLevel] = useState('O-Level');
  const [terms, setTerms] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTerm, setActiveTerm] = useState(null);
  const [termContent, setTermContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [termLoading, setTermLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [theme, setTheme] = useState('light');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const currentYear = new Date().getFullYear();

  const levels = ['O-Level', 'A-Level', 'Pharmacy'];

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') { document.body.classList.add('dark-mode'); setTheme('dark'); }
    const init = async () => {
      try {
        const siteData = await getAllSiteSections();
        setSections(siteData);
      } catch (err) { console.error(err); }
      setLoading(false);
    };
    init();
  }, []);

  useEffect(() => {
    setLoading(true);
    getGlossaryTerms(selectedLevel, selectedCategory || undefined, searchQuery || undefined)
      .then(data => setTerms(data?.terms || data || []))
      .catch(() => setTerms([]))
      .finally(() => setLoading(false));
  }, [selectedLevel, selectedCategory, searchQuery]);

  useEffect(() => {
    getGlossaryCategories(selectedLevel)
      .then(data => setCategories(data?.categories || data || []))
      .catch(() => setCategories([]));
  }, [selectedLevel]);

  const groupedTerms = terms.reduce((acc, term) => {
    const cat = term.category || 'Uncategorized';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(term);
    return acc;
  }, {});

  function getLevelColor(level) {
    if (level === 'O-Level') return '#0ab5b5';
    if (level === 'A-Level') return '#b8873a';
    if (level === 'Pharmacy') return '#10b981';
    return 'var(--clr-cyan)';
  }

  async function handleTermClick(term) {
    setActiveTerm(term);
    setTermLoading(true);
    try {
      const data = await getGlossaryTerm(term.slug || term.id, selectedLevel);
      setTermContent(data);
    } catch (e) {
      setTermContent(null);
    }
    setTermLoading(false);
  }

  if (loading) {
    return (
      <motion.div
        style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div className="pdf-loading-spinner">
          <div className="spinner-dot dot-magenta"></div>
          <div className="spinner-dot dot-cyan"></div>
          <div className="spinner-dot dot-orange"></div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}
      initial="initial"
      animate="in"
      exit="out"
      variants={pageVariants}
      transition={pageTransition}
    >
      <header className="site-header">
        <div className="header-container">
          <Link to="/" className="logo-link" aria-label="AliverBiopharm Home">
            {sections?.site_config?.logo_url ? (
              <img src={sections.site_config.logo_url} alt="AliverBiopharm" style={{ height: '70px', width: 'auto' }} />
            ) : 'AliverBiopharm'}
          </Link>
          <nav aria-label="Main navigation">
            <ul className="main-nav">
              {(sections?.navigation?.links || [
                { href: '/', label: 'Home' },
                { href: '/quiz', label: 'Quizzes' },
                { href: '/glossary', label: 'Glossary' },
                { href: '#contact', label: 'Contact' }
              ]).filter(Boolean).map(link => (
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
            <div className="nav-icons-group" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button className="theme-toggle" onClick={() => {
                const dark = document.body.classList.toggle('dark-mode');
                localStorage.setItem('theme', dark ? 'dark' : 'light');
                setTheme(dark ? 'dark' : 'light');
              }}>
                <i className={`fa-solid ${theme === 'dark' ? 'fa-sun' : 'fa-moon'}`}></i>
              </button>
            </div>
            <button className="mobile-toggle" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              <i className="fa-solid fa-bars"></i>
            </button>
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
                    <Link to="/login" className="mobile-signin-btn">Sign In</Link>
                    <Link to="/register" className="mobile-signup-btn">Create Account</Link>
                  </>
                )}
              </div>
              <button className="mobile-close-btn" onClick={() => setMobileMenuOpen(false)}><i className="fa-solid fa-xmark"></i></button>
            </div>
          </div>
          <nav className="mobile-nav-links">
            {(sections?.navigation?.links || []).filter(Boolean).map(link => (
              link.href.startsWith('#') || link.href.startsWith('http') ? (
                <a key={link.href} href={link.href}>{link.label}</a>
              ) : (
                <Link key={link.href} to={link.href} onClick={() => setMobileMenuOpen(false)}>{link.label}</Link>
              )
            ))}
          </nav>
        </div>
      </div>
      <div className={`mobile-nav-overlay ${mobileMenuOpen ? 'active' : ''}`} onClick={() => setMobileMenuOpen(false)}></div>

      <main style={{ flex: 1 }}>
        <div className="glossary-page" style={{ paddingTop: '80px' }}>
          <div className="glossary-header">
            <div className="glossary-header-inner">
              <h1 className="glossary-main-title">
                <span className="title-word magenta-word">Biology</span>
                <span className="title-word cyan-word">Glossary</span>
              </h1>
              <p className="glossary-subtitle">
                Master every term with linked quizzes, notes, flashcards, and past papers — all in one place.
              </p>
            </div>
          </div>

          <div className="glossary-level-bar">
            {levels.map(level => (
              <button
                key={level}
                className={`glossary-level-btn ${selectedLevel === level ? 'active' : ''}`}
                onClick={() => { setSelectedLevel(level); setSelectedCategory(''); setActiveTerm(null); setTermContent(null); }}
                style={{
                  borderColor: selectedLevel === level ? getLevelColor(level) : 'var(--clr-border-glow)',
                  background: selectedLevel === level ? getLevelColor(level) : 'transparent',
                  color: selectedLevel === level ? '#fff' : 'var(--clr-white)'
                }}
              >
                {level}
              </button>
            ))}
          </div>

          <div className="glossary-main-layout">
            <button
              className="glossary-sidebar-toggle"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
            >
              <i className={`fa-solid fa-${sidebarOpen ? 'chevron-left' : 'chevron-right'}`}></i>
              <span>{sidebarOpen ? 'Hide' : 'Show'} Terms</span>
            </button>

            <div className={`glossary-sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
              <div className="glossary-sidebar-inner">
                <div className="glossary-search-area">
                  <div className="glossary-search-input-wrap">
                    <i className="fa-solid fa-magnifying-glass glossary-search-icon"></i>
                    <input
                      type="text"
                      className="glossary-search-input"
                      placeholder="Search terms..."
                      value={searchQuery}
                      onChange={e => { setSearchQuery(e.target.value); setActiveTerm(null); setTermContent(null); }}
                    />
                    {searchQuery && (
                      <button
                        className="glossary-search-clear"
                        onClick={() => { setSearchQuery(''); setActiveTerm(null); setTermContent(null); }}
                        aria-label="Clear search"
                      >
                        <i className="fa-solid fa-xmark"></i>
                      </button>
                    )}
                  </div>

                  <div className="glossary-category-filter">
                    <select
                      className="glossary-category-select"
                      value={selectedCategory}
                      onChange={e => { setSelectedCategory(e.target.value); setActiveTerm(null); setTermContent(null); }}
                    >
                      <option value="">All Categories</option>
                      {categories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="glossary-terms-list">
                  {loading ? (
                    <div className="glossary-loading-state">
                      <div className="glossary-loading-spinner">
                        <div className="spinner-dot dot-magenta"></div>
                        <div className="spinner-dot dot-cyan"></div>
                        <div className="spinner-dot dot-orange"></div>
                      </div>
                      <p>Loading terms...</p>
                    </div>
                  ) : Object.keys(groupedTerms).length === 0 ? (
                    <div className="glossary-empty-state">
                      <i className="fa-solid fa-book-open"></i>
                      <p>No terms found{searchQuery ? ` for "${searchQuery}"` : ''}.</p>
                      {searchQuery && (
                        <button className="btn-primary" onClick={() => { setSearchQuery(''); setActiveTerm(null); setTermContent(null); }}>
                          Clear Search
                        </button>
                      )}
                    </div>
                  ) : (
                    Object.entries(groupedTerms).map(([category, categoryTerms]) => (
                      <div key={category} className="glossary-term-group">
                        <h3 className="glossary-category-heading">{category}</h3>
                        {categoryTerms.map(term => (
                          <button
                            key={term.id}
                            className={`glossary-term-btn ${activeTerm?.id === term.id ? 'active' : ''}`}
                            onClick={() => handleTermClick(term)}
                            style={{
                              borderLeftColor: activeTerm?.id === term.id
                                ? getLevelColor(selectedLevel)
                                : 'transparent'
                            }}
                          >
                            <span className="glossary-term-btn-text">{term.term}</span>
                            <span className="glossary-term-btn-arrow">
                              <i className="fa-solid fa-chevron-right"></i>
                            </span>
                          </button>
                        ))}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className={`glossary-content ${sidebarOpen ? 'with-sidebar' : 'full-width'}`}>
              {!activeTerm ? (
                <div className="glossary-welcome">
                  <div className="glossary-welcome-icon">
                    <i className="fa-solid fa-dna"></i>
                  </div>
                  <h2>Select a term to begin</h2>
                  <p>Choose any term from the sidebar to see its definition, linked quizzes, study notes, flashcards, and more.</p>
                  <div className="glossary-welcome-stats">
                    <div className="glossary-welcome-stat">
                      <span className="glossary-welcome-stat-number">{terms.length}</span>
                      <span className="glossary-welcome-stat-label">Terms</span>
                    </div>
                    <div className="glossary-welcome-stat">
                      <span className="glossary-welcome-stat-number">{Object.keys(groupedTerms).length}</span>
                      <span className="glossary-welcome-stat-label">Categories</span>
                    </div>
                    <div className="glossary-welcome-stat">
                      <span className="glossary-welcome-stat-number">{selectedLevel}</span>
                      <span className="glossary-welcome-stat-label">Level</span>
                    </div>
                  </div>
                </div>
              ) : termLoading ? (
                <div className="glossary-loading-state glossary-term-loading">
                  <div className="glossary-loading-spinner">
                    <div className="spinner-dot dot-magenta"></div>
                    <div className="spinner-dot dot-cyan"></div>
                    <div className="spinner-dot dot-orange"></div>
                  </div>
                  <p>Loading {activeTerm.term}...</p>
                </div>
              ) : termContent ? (
                <div className="glossary-term-detail">
                  <div className="glossary-term-hero">
                    <div className="glossary-term-breadcrumb">
                      <span className="glossary-term-category-badge">
                        {termContent.term.category}
                      </span>
                      {termContent.term.pronunciation && (
                        <span className="glossary-term-pronunciation">
                          <i className="fa-solid fa-volume-high"></i> {termContent.term.pronunciation}
                        </span>
                      )}
                    </div>

                    <h2 className="glossary-term-title">{termContent.term.term}</h2>

                    <div className="glossary-term-definitions">
                      <div className="glossary-definition-plain">
                        <p>{termContent.term.plain_definition}</p>
                      </div>
                      {termContent.term.technical_definition && (
                        <div className="glossary-definition-technical">
                          <h4>
                            <i className="fa-solid fa-microscope"></i> Technical Definition
                          </h4>
                          <p>{termContent.term.technical_definition}</p>
                        </div>
                      )}
                    </div>

                    {(termContent.term.etymology || termContent.term.mnemonic) && (
                      <div className="glossary-term-meta">
                        {termContent.term.etymology && (
                          <div className="glossary-meta-item">
                            <span className="glossary-meta-label">
                              <i className="fa-solid fa-language"></i> Etymology
                            </span>
                            <span className="glossary-meta-value">{termContent.term.etymology}</span>
                          </div>
                        )}
                        {termContent.term.mnemonic && (
                          <div className="glossary-meta-item">
                            <span className="glossary-meta-label">
                              <i className="fa-solid fa-lightbulb"></i> Memory Aid
                            </span>
                            <span className="glossary-meta-value">{termContent.term.mnemonic}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="glossary-routes">
                    {termContent.content.quizzes.length > 0 && (
                      <div className="glossary-route-section">
                        <div className="glossary-route-header">
                          <i className="fa-solid fa-circle-question"></i>
                          <h3>Quizzes</h3>
                          <span className="glossary-route-count">{termContent.content.quizzes.length}</span>
                        </div>
                        <div className="glossary-route-grid">
                          {termContent.content.quizzes.map(quiz => (
                            <Link
                              key={quiz.id}
                              to={`/quiz?topic=${encodeURIComponent(quiz.subject || quiz.category)}`}
                              className="glossary-route-card"
                            >
                              <div className="glossary-route-card-icon quiz-icon">
                                <i className="fa-solid fa-circle-question"></i>
                              </div>
                              <div className="glossary-route-card-body">
                                <h4>{quiz.title}</h4>
                                <span className="glossary-route-card-meta">
                                  {quiz.difficulty && `${quiz.difficulty} · `}{quiz.subject || quiz.category}
                                </span>
                              </div>
                              <i className="fa-solid fa-arrow-right glossary-route-card-arrow"></i>
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}

                    {termContent.content.pdfs.length > 0 && (
                      <div className="glossary-route-section">
                        <div className="glossary-route-header">
                          <i className="fa-solid fa-file-pdf"></i>
                          <h3>PDF Resources</h3>
                          <span className="glossary-route-count">{termContent.content.pdfs.length}</span>
                        </div>
                        <div className="glossary-route-grid">
                          {termContent.content.pdfs.map(pdf => (
                            <a
                              key={pdf.id}
                              href={pdf.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="glossary-route-card"
                            >
                              <div className="glossary-route-card-icon pdf-icon">
                                <i className="fa-solid fa-file-pdf"></i>
                              </div>
                              <div className="glossary-route-card-body">
                                <h4>{pdf.title}</h4>
                                <span className="glossary-route-card-meta">
                                  {pdf.author && `${pdf.author} · `}{pdf.topic}
                                </span>
                              </div>
                              <i className="fa-solid fa-download glossary-route-card-arrow"></i>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {termContent.content.notes.length > 0 && (
                      <div className="glossary-route-section">
                        <div className="glossary-route-header">
                          <i className="fa-solid fa-file-lines"></i>
                          <h3>Study Notes</h3>
                          <span className="glossary-route-count">{termContent.content.notes.length}</span>
                        </div>
                        <div className="glossary-route-grid">
                          {termContent.content.notes.map(note => (
                            <Link
                              key={note.subtopic_id}
                              to={`/notes/read?id=${note.subtopic_id}`}
                              className="glossary-route-card"
                            >
                              <div className="glossary-route-card-icon note-icon">
                                <i className="fa-solid fa-file-lines"></i>
                              </div>
                              <div className="glossary-route-card-body">
                                <h4>{note.subtopic_name}</h4>
                                <span className="glossary-route-card-meta">
                                  {note.topic}{note.read_time && ` · ${note.read_time}`}
                                </span>
                              </div>
                              <i className="fa-solid fa-arrow-right glossary-route-card-arrow"></i>
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}

                    {termContent.content.flashcards.length > 0 && (
                      <div className="glossary-route-section">
                        <div className="glossary-route-header">
                          <i className="fa-solid fa-layer-group"></i>
                          <h3>Flashcard Decks</h3>
                          <span className="glossary-route-count">{termContent.content.flashcards.length}</span>
                        </div>
                        <div className="glossary-route-grid">
                          {termContent.content.flashcards.map(deck => (
                            <Link
                              key={deck.id}
                              to="/#flashcards"
                              className="glossary-route-card"
                            >
                              <div className="glossary-route-card-icon flashcard-icon">
                                <i className="fa-solid fa-layer-group"></i>
                              </div>
                              <div className="glossary-route-card-body">
                                <h4>{deck.title}</h4>
                                <span className="glossary-route-card-meta">{deck.category}</span>
                              </div>
                              <i className="fa-solid fa-arrow-right glossary-route-card-arrow"></i>
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}

                    {termContent.content.past_papers.length > 0 && (
                      <div className="glossary-route-section">
                        <div className="glossary-route-header">
                          <i className="fa-solid fa-file-signature"></i>
                          <h3>Past Papers</h3>
                          <span className="glossary-route-count">{termContent.content.past_papers.length}</span>
                        </div>
                        <div className="glossary-route-grid">
                          {termContent.content.past_papers.map(paper => (
                            <Link
                              key={paper.id}
                              to="/past-papers"
                              className="glossary-route-card"
                            >
                              <div className="glossary-route-card-icon paper-icon">
                                <i className="fa-solid fa-file-signature"></i>
                              </div>
                              <div className="glossary-route-card-body">
                                <h4>{paper.title}</h4>
                                <span className="glossary-route-card-meta">
                                  {paper.subject} · {paper.year}
                                </span>
                              </div>
                              <i className="fa-solid fa-arrow-right glossary-route-card-arrow"></i>
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}

                    {termContent.content.recall_questions.length > 0 && (
                      <div className="glossary-route-section">
                        <div className="glossary-route-header">
                          <i className="fa-solid fa-brain"></i>
                          <h3>Recall Practice</h3>
                          <span className="glossary-route-count">{termContent.content.recall_questions.length}</span>
                        </div>
                        <div className="glossary-route-grid">
                          {termContent.content.recall_questions.map(q => (
                            <Link
                              key={q.id}
                              to={`/recall?topic=${encodeURIComponent(q.topic)}`}
                              className="glossary-route-card"
                            >
                              <div className="glossary-route-card-icon recall-icon">
                                <i className="fa-solid fa-brain"></i>
                              </div>
                              <div className="glossary-route-card-body">
                                <h4>{q.question_text.length > 80 ? q.question_text.substring(0, 77) + '...' : q.question_text}</h4>
                                <span className="glossary-route-card-meta">
                                  {q.topic}{q.difficulty && ` · ${q.difficulty}`}
                                </span>
                              </div>
                              <i className="fa-solid fa-arrow-right glossary-route-card-arrow"></i>
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}

                    {termContent.term.related_terms_data && termContent.term.related_terms_data.length > 0 && (
                      <div className="glossary-route-section">
                        <div className="glossary-route-header">
                          <i className="fa-solid fa-link"></i>
                          <h3>Related Terms</h3>
                        </div>
                        <div className="glossary-related-terms">
                          {termContent.term.related_terms_data.map(related => (
                            <button
                              key={related.slug}
                              className="glossary-related-term-btn"
                              onClick={() => {
                                const relatedTerm = {
                                  id: related.slug,
                                  term: related.term,
                                  slug: related.slug,
                                  plain_definition: related.plain_definition
                                };
                                handleTermClick(relatedTerm);
                              }}
                            >
                              <span>{related.term}</span>
                              <i className="fa-solid fa-arrow-right"></i>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </main>

      <footer className="footer-fat">
        <div style={{ maxWidth: 'var(--max-width)', margin: '0 auto', display: 'flex', justifyContent: 'space-between', gap: '40px', flexWrap: 'wrap' }}>
          <div style={{ maxWidth: '260px' }}>
            <Link to="/" className="logo-link" style={{ marginBottom: '14px', display: 'inline-flex' }}>
              {sections?.site_config?.logo_url ? <img src={sections.site_config.logo_url} alt="AliverBiopharm" style={{ height: '50px' }} /> : 'AliverBiopharm'}
            </Link>
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

      <button className="back-to-top" id="back-to-top" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}><i className="fa-solid fa-arrow-up"></i></button>
    </motion.div>
  );
}
