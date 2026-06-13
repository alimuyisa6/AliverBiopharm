import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  getAllSiteSections,
  getPastPapers,
  getPastPaperFilterOptions,
  getPastPaperDownloadUrl
} from '../api/client';

export default function PastPapers() {
  const { user, logout } = useAuth();
  const [sections, setSections] = useState(null);
  const [papers, setPapers] = useState([]);
  const [filterOptions, setFilterOptions] = useState({ levels: [], subjects: [], years: [], exam_boards: [], paper_types: [], topics: [] });
  const [filters, setFilters] = useState({ level: 'O-Level', subject: '', year: '', exam_board: '', paper_type: '', topic: '', search: '' });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [papersLoading, setPapersLoading] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);
  const [filterAccordions, setFilterAccordions] = useState({ subject: false, year: false, exam_board: false, paper_type: false });
  const [search, setSearch] = useState('');
  const [theme, setTheme] = useState('light');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authPrompt, setAuthPrompt] = useState(false);
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') { document.body.classList.add('dark-mode'); setTheme('dark'); }
    const init = async () => {
      try {
        const [siteData, opts] = await Promise.all([getAllSiteSections(), getPastPaperFilterOptions()]);
        setSections(siteData);
        setFilterOptions(opts);
      } catch (err) { console.error(err); }
      setLoading(false);
    };
    init();
  }, []);

  useEffect(() => {
    loadPapers();
  }, [filters, page]);

  async function loadPapers() {
    setPapersLoading(true);
    try {
      const params = { page, limit: 12 };
      if (filters.level) params.level = filters.level;
      if (filters.subject) params.subject = filters.subject;
      if (filters.year) params.year = filters.year;
      if (filters.exam_board) params.exam_board = filters.exam_board;
      if (filters.paper_type) params.paper_type = filters.paper_type;
      if (filters.topic) params.topic = filters.topic;
      if (filters.search) params.search = filters.search;
      const result = await getPastPapers(params);
      setPapers(result.papers || []);
      setTotalPages(result.total_pages || 1);
      setTotal(result.total || 0);
    } catch (err) { console.error(err); }
    setPapersLoading(false);
  }

  function setFilter(key, value) {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1);
  }

  function clearFilters() {
    setFilters({ level: filters.level, subject: '', year: '', exam_board: '', paper_type: '', topic: '', search: '' });
    setSearch('');
    setPage(1);
  }

  function handleSearchSubmit(e) {
    e.preventDefault();
    setFilter('search', search);
  }

  async function handleDownload(paper) {
    if (!user) { setAuthPrompt(true); return; }
    setDownloadingId(paper.id);
    try {
      const result = await getPastPaperDownloadUrl(paper.id);
      const a = document.createElement('a');
      a.href = result.url;
      a.download = paper.title + '.pdf';
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) { alert('Download failed: ' + err.message); }
    setDownloadingId(null);
  }

  function getLevelColor(level) {
    if (level === 'O-Level') return '#0ab5b5';
    if (level === 'A-Level') return '#b8873a';
    if (level === 'Pharmacy') return '#10b981';
    return 'var(--clr-cyan)';
  }

  const LEVELS = ['O-Level', 'A-Level', 'Pharmacy'];

  const activeFilterCount = [filters.subject, filters.year, filters.exam_board, filters.paper_type, filters.topic, filters.search].filter(Boolean).length;

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="pdf-loading-spinner">
          <div className="spinner-dot dot-magenta"></div>
          <div className="spinner-dot dot-cyan"></div>
          <div className="spinner-dot dot-orange"></div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="site-header">
        <div className="header-container">
          <a href="/" className="logo-link" aria-label="AliverBiopharm Home">
            {sections?.site_config?.logo_url ? (
              <img src={sections.site_config.logo_url} alt="AliverBiopharm" style={{ height: '70px', width: 'auto' }} />
            ) : 'AliverBiopharm'}
          </a>
          <nav aria-label="Main navigation">
            <ul className="main-nav">
              {sections?.navigation?.links?.map(link => (
                <li key={link.href}><a href={link.href}>{link.label}</a></li>
              )) || (
                <>
                  <li><a href="/">Home</a></li>
                  <li><a href="/quiz">Quizzes</a></li>
                  <li><a href="/past-papers" className="active">Past Papers</a></li>
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

      <main className="section" style={{ paddingTop: '100px', flex: 1 }}>
        <span className="sec-label">EXAM PREPARATION</span>
        <h1 className="section-title">Past Papers</h1>
        <p className="section-subtitle">Download past examination papers for O-Level, A-Level and Pharmacy. Practice with real exam questions.</p>

        <div className="breadcrumb">
          <a href="/">Home</a><span>›</span><span>Past Papers</span><span>›</span><span>{filters.level}</span>
        </div>

        {!user && (
          <div style={{ background: 'linear-gradient(135deg, rgba(184,135,58,0.15), rgba(10,181,181,0.1))', border: '1px solid var(--clr-magenta)', borderRadius: 'var(--radius-lg)', padding: '1.2rem 1.5rem', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <i className="fa-solid fa-lock" style={{ color: 'var(--clr-magenta)', fontSize: '1.4rem' }}></i>
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: 700, color: 'var(--clr-white)', marginBottom: '0.2rem' }}>Sign in to download papers</p>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-text-dim)' }}>You can browse all papers freely. Create a free account to download.</p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <a href="/login" className="btn-secondary" style={{ padding: '8px 18px', fontSize: 'var(--text-sm)' }}>Sign In</a>
              <a href="/register" className="btn-primary" style={{ padding: '8px 18px', fontSize: 'var(--text-sm)' }}>Register Free</a>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          {LEVELS.map(level => (
            <button key={level} onClick={() => { setFilter('level', level); clearFilters(); }} style={{ padding: '10px 28px', borderRadius: '50px', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', transition: 'all 0.25s ease', background: filters.level === level ? 'var(--gradient-magenta)' : 'transparent', border: filters.level === level ? '2px solid transparent' : '2px solid var(--clr-border-glow)', color: filters.level === level ? '#fff' : 'var(--clr-white)', boxShadow: filters.level === level ? '0 4px 15px rgba(184,135,58,0.35)' : 'none' }}>
              {level}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <form onSubmit={handleSearchSubmit} style={{ flex: 1, minWidth: '260px', display: 'flex', gap: '8px' }}>
            <input
              type="text"
              placeholder="Search papers, subjects, topics..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ flex: 1, padding: '0.7rem 1rem', borderRadius: '60px', border: '1px solid var(--clr-border-glow)', background: 'var(--clr-navy-light)', color: 'var(--clr-white)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-base)' }}
            />
            <button type="submit" className="btn-primary" style={{ padding: '0.7rem 1.2rem', borderRadius: '60px' }}>
              <i className="fa-solid fa-search"></i>
            </button>
          </form>

          <div style={{ position: 'relative' }}>
            <button className={`filter-toggle-btn ${filterDropdownOpen ? 'open' : ''}`} onClick={() => setFilterDropdownOpen(!filterDropdownOpen)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.7rem 1.2rem', background: 'var(--clr-navy-card)', border: '1px solid var(--clr-border-glow)', borderRadius: '60px', color: 'var(--clr-white)', fontFamily: 'var(--font-body)', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              <i className="fa-solid fa-filter" style={{ color: 'var(--clr-magenta)' }}></i>
              Filters {activeFilterCount > 0 && <span style={{ background: 'var(--clr-magenta)', color: '#fff', borderRadius: '50%', width: '20px', height: '20px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 800 }}>{activeFilterCount}</span>}
              <i className="fa-solid fa-chevron-down" style={{ fontSize: '0.75rem', transition: 'transform 0.3s', transform: filterDropdownOpen ? 'rotate(180deg)' : 'rotate(0)' }}></i>
            </button>

            {filterDropdownOpen && (
              <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 100, background: 'var(--clr-navy-card)', border: '1px solid var(--clr-border-glow)', borderRadius: 'var(--radius-lg)', padding: '1rem', minWidth: '260px', boxShadow: '0 12px 32px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {[
                  { key: 'subject', label: 'Subject', options: filterOptions.subjects },
                  { key: 'year', label: 'Year', options: filterOptions.years.map(String) },
                  { key: 'exam_board', label: 'Exam Board', options: filterOptions.exam_boards },
                  { key: 'paper_type', label: 'Paper Type', options: filterOptions.paper_types },
                ].map(({ key, label, options }) => (
                  <div key={key} className="filter-accordion" style={{ marginBottom: '4px' }}>
                    <button className={`filter-accordion-btn ${filterAccordions[key] ? 'open' : ''}`} onClick={() => setFilterAccordions(prev => ({ ...prev, [key]: !prev[key] }))}>
                      <span>{label}</span>
                      <span className="filter-selected">{filters[key] || 'All'}</span>
                      <i className="fa-solid fa-chevron-down"></i>
                    </button>
                    {filterAccordions[key] && (
                      <div className="filter-options open">
                        <label className="filter-option">
                          <input type="radio" name={key} checked={!filters[key]} onChange={() => setFilter(key, '')} /> All
                        </label>
                        {options.map(opt => (
                          <label key={opt} className="filter-option">
                            <input type="radio" name={key} checked={filters[key] === opt} onChange={() => setFilter(key, opt)} /> {opt}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {activeFilterCount > 0 && (
                  <button className="filter-clear-btn" onClick={() => { clearFilters(); setFilterDropdownOpen(false); }}>
                    <i className="fa-solid fa-xmark" style={{ marginRight: '6px' }}></i> Clear all filters
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-text-muted)', fontFamily: 'var(--font-mono)' }}>
            {papersLoading ? 'Loading...' : `${total} paper${total !== 1 ? 's' : ''} found`}
          </p>
          {activeFilterCount > 0 && (
            <button onClick={clearFilters} style={{ background: 'none', border: 'none', color: 'var(--clr-magenta)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', fontWeight: 600, cursor: 'pointer' }}>
              <i className="fa-solid fa-xmark" style={{ marginRight: '4px' }}></i> Clear filters
            </button>
          )}
        </div>

        {papersLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
            <div className="pdf-loading-spinner">
              <div className="spinner-dot dot-magenta"></div>
              <div className="spinner-dot dot-cyan"></div>
              <div className="spinner-dot dot-orange"></div>
            </div>
          </div>
        ) : papers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem 2rem', background: 'var(--clr-navy-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--clr-border-glow)' }}>
            <i className="fa-solid fa-file-pdf" style={{ fontSize: '3rem', color: 'var(--clr-text-muted)', marginBottom: '1rem', display: 'block' }}></i>
            <p style={{ fontWeight: 700, color: 'var(--clr-white)', marginBottom: '0.5rem' }}>No papers found</p>
            <p style={{ color: 'var(--clr-text-dim)', fontSize: 'var(--text-sm)' }}>Try adjusting your filters or search term.</p>
            <button onClick={clearFilters} className="btn-secondary" style={{ marginTop: '1rem' }}>Clear filters</button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem' }}>
            {papers.map(paper => (
              <div key={paper.id} style={{ background: 'var(--clr-navy-card)', border: '1px solid var(--clr-border-glow)', borderRadius: 'var(--radius-lg)', padding: '1.4rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', transition: 'all 0.3s ease', cursor: 'default', boxShadow: 'var(--shadow-card)' }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.borderColor = 'rgba(184,135,58,0.45)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(184,135,58,0.12)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'var(--clr-border-glow)'; e.currentTarget.style.boxShadow = 'var(--shadow-card)'; }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                  <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: `${getLevelColor(paper.level)}20`, border: `1.5px solid ${getLevelColor(paper.level)}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <i className="fa-solid fa-file-pdf" style={{ color: getLevelColor(paper.level), fontSize: '1.2rem' }}></i>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1rem', color: 'var(--clr-white)', lineHeight: 1.3, marginBottom: '0.25rem', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{paper.title}</h3>
                    <p style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-text-dim)' }}>{paper.subject}</p>
                  </div>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 700, fontFamily: 'var(--font-mono)', background: `${getLevelColor(paper.level)}20`, color: getLevelColor(paper.level), border: `1px solid ${getLevelColor(paper.level)}40` }}>{paper.level}</span>
                  {paper.year && <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 700, fontFamily: 'var(--font-mono)', background: 'rgba(184,135,58,0.1)', color: 'var(--clr-magenta)', border: '1px solid rgba(184,135,58,0.3)' }}>{paper.year}</span>}
                  {paper.paper_type && <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 600, fontFamily: 'var(--font-mono)', background: 'var(--clr-navy-light)', color: 'var(--clr-text-dim)', border: '1px solid var(--clr-border-glow)' }}>{paper.paper_type}</span>}
                  {paper.exam_board && <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 600, fontFamily: 'var(--font-mono)', background: 'var(--clr-navy-light)', color: 'var(--clr-text-dim)', border: '1px solid var(--clr-border-glow)' }}>{paper.exam_board}</span>}
                  {paper.topic && <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 600, fontFamily: 'var(--font-mono)', background: 'rgba(10,181,181,0.1)', color: 'var(--clr-cyan)', border: '1px solid rgba(10,181,181,0.3)' }}>{paper.topic}</span>}
                </div>

                {paper.download_count > 0 && (
                  <p style={{ fontSize: '0.7rem', color: 'var(--clr-text-muted)', fontFamily: 'var(--font-mono)' }}>
                    <i className="fa-solid fa-download" style={{ marginRight: '4px' }}></i>{paper.download_count} downloads
                  </p>
                )}

                <div style={{ marginTop: 'auto', display: 'flex', gap: '0.5rem' }}>
                  <button onClick={() => handleDownload(paper)} disabled={downloadingId === paper.id} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.65rem', borderRadius: '40px', border: 'none', background: user ? 'var(--gradient-cyan)' : 'var(--clr-navy-light)', color: user ? '#fff' : 'var(--clr-text-muted)', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 'var(--text-sm)', cursor: user ? 'pointer' : 'pointer', transition: 'all 0.2s ease', opacity: downloadingId === paper.id ? 0.7 : 1 }}>
                    {downloadingId === paper.id ? (
                      <><i className="fa-solid fa-spinner fa-spin"></i> Downloading...</>
                    ) : user ? (
                      <><i className="fa-solid fa-download"></i> Download</>
                    ) : (
                      <><i className="fa-solid fa-lock"></i> Sign in to Download</>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', marginTop: '2.5rem', flexWrap: 'wrap' }}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary" style={{ padding: '8px 16px', fontSize: 'var(--text-sm)', opacity: page === 1 ? 0.4 : 1 }}>
              <i className="fa-solid fa-chevron-left"></i>
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2).reduce((acc, p, idx, arr) => {
              if (idx > 0 && p - arr[idx - 1] > 1) acc.push('...');
              acc.push(p);
              return acc;
            }, []).map((p, idx) => p === '...' ? (
              <span key={`ellipsis-${idx}`} style={{ color: 'var(--clr-text-muted)', padding: '0 4px' }}>...</span>
            ) : (
              <button key={p} onClick={() => setPage(p)} style={{ width: '36px', height: '36px', borderRadius: '50%', border: p === page ? 'none' : '1px solid var(--clr-border-glow)', background: p === page ? 'var(--gradient-magenta)' : 'transparent', color: p === page ? '#fff' : 'var(--clr-white)', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 'var(--text-sm)', cursor: 'pointer', transition: 'all 0.2s' }}>{p}</button>
            ))}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="btn-secondary" style={{ padding: '8px 16px', fontSize: 'var(--text-sm)', opacity: page === totalPages ? 0.4 : 1 }}>
              <i className="fa-solid fa-chevron-right"></i>
            </button>
          </div>
        )}
      </main>

      {authPrompt && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setAuthPrompt(false)}>
          <div style={{ background: 'var(--clr-navy-card)', padding: '2rem', borderRadius: 'var(--radius-lg)', maxWidth: '400px', width: '90%', textAlign: 'center', border: '1px solid var(--clr-magenta)' }} onClick={e => e.stopPropagation()}>
            <i className="fa-solid fa-lock" style={{ fontSize: '2.5rem', color: 'var(--clr-magenta)', marginBottom: '1rem', display: 'block' }}></i>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--clr-white)', marginBottom: '0.5rem' }}>Sign in to Download</h3>
            <p style={{ color: 'var(--clr-text-dim)', fontSize: 'var(--text-sm)', marginBottom: '1.5rem' }}>Create a free account to download past papers and track your progress.</p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <a href="/login" className="btn-secondary">Sign In</a>
              <a href="/register" className="btn-primary">Register Free</a>
            </div>
          </div>
        </div>
      )}

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
    </div>
  );
}
