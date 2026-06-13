import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  getAllSiteSections,
  getNoteContent,
  getNoteReactions,
  toggleNoteReaction,
  getResourceInteractions,
  commentResource,
  saveReadingProgress,
  getReadingProgress
} from '../api/client';

export default function NoteDetail() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const subtopicId = searchParams.get('id');
  const [sections, setSections] = useState(null);
  const [note, setNote] = useState(null);
  const [reactions, setReactions] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentInput, setCommentInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState('light');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [readProgress, setReadProgress] = useState(0);
  const [progressSaved, setProgressSaved] = useState(false);
  const contentRef = useRef(null);
  const progressTimer = useRef(null);
  const startTime = useRef(Date.now());
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') { document.body.classList.add('dark-mode'); setTheme('dark'); }
    if (!subtopicId) { navigate('/notes'); return; }
    const init = async () => {
      try {
        const [siteData, content, reactionData, interactions] = await Promise.all([
          getAllSiteSections(),
          getNoteContent(subtopicId),
          getNoteReactions(subtopicId),
          getResourceInteractions(subtopicId)
        ]);
        setSections(siteData);
        setNote(content);
        setReactions(reactionData);
        setComments(interactions?.comments || []);
        if (user) {
          const progress = await getReadingProgress(subtopicId);
          if (progress?.scroll_position) {
            setTimeout(() => window.scrollTo({ top: progress.scroll_position, behavior: 'smooth' }), 500);
          }
        }
       } catch (err) { 
  document.title = 'ERR: ' + err.message; 
  setLoading(false);
  return;
      }
    };
    init();
    return () => { if (progressTimer.current) clearTimeout(progressTimer.current); };
  }, [subtopicId]);

  useEffect(() => {
    if (!user || !note) return;
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const pct = docHeight > 0 ? Math.round((scrollTop / docHeight) * 100) : 0;
      setReadProgress(pct);
      if (progressTimer.current) clearTimeout(progressTimer.current);
      progressTimer.current = setTimeout(async () => {
        const timeSpent = Math.round((Date.now() - startTime.current) / 1000);
        try {
          await saveReadingProgress(subtopicId, pct, scrollTop, timeSpent, pct >= 90);
          setProgressSaved(true);
          setTimeout(() => setProgressSaved(false), 2000);
        } catch (err) { console.error(err); }
      }, 1500);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [user, note, subtopicId]);

  async function handleReaction(reactionType) {
    if (!user) { navigate('/login'); return; }
    try {
      await toggleNoteReaction(subtopicId, reactionType);
      const updated = await getNoteReactions(subtopicId);
      setReactions(updated);
    } catch (err) { console.error(err); }
  }

  async function handleComment() {
    if (!user) { navigate('/login'); return; }
    if (!commentInput.trim()) return;
    try {
      await commentResource(subtopicId, commentInput);
      setCommentInput('');
      const interactions = await getResourceInteractions(subtopicId);
      setComments(interactions?.comments || []);
    } catch (err) { console.error(err); }
  }

  function handleBack() {
    navigate(`/notes?highlight=${subtopicId}`);
  }

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
      <div style={{ position: 'fixed', top: 0, left: 0, height: '3px', width: `${readProgress}%`, background: 'var(--gradient-cyan)', zIndex: 200, transition: 'width 0.3s ease' }}></div>

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
              ))}
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
                    <a href="/login" className="mobile-signin-btn">Sign In</a>
                    <a href="/register" className="mobile-signup-btn">Create Account</a>
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

      <main style={{ paddingTop: '80px', flex: 1 }}>
        <div style={{ maxWidth: '780px', margin: '0 auto', padding: '2rem 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
            <button onClick={handleBack} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'none', border: '1.5px solid var(--clr-cyan)', color: 'var(--clr-cyan)', padding: '8px 18px', borderRadius: '30px', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 'var(--text-sm)', cursor: 'pointer', transition: 'all 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--clr-cyan)'; e.currentTarget.style.color = '#012c2c'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--clr-cyan)'; }}
            >
              <i className="fa-solid fa-arrow-left"></i> Back to Notes
            </button>
            {user && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: 'var(--text-xs)', color: 'var(--clr-text-muted)', fontFamily: 'var(--font-mono)' }}>
                <i className="fa-solid fa-circle-check" style={{ color: progressSaved ? '#10b981' : 'var(--clr-border-glow)' }}></i>
                {readProgress}% read {progressSaved && '· saved'}
              </div>
            )}
          </div>

          <div className="breadcrumb" style={{ marginBottom: '2rem' }}>
            <a href="/">Home</a><span>›</span>
            <a href="/notes" style={{ color: 'var(--clr-cyan)', textDecoration: 'none' }}>Notes</a><span>›</span>
            {note?.level && <><span>{note.level}</span><span>›</span></>}
            {note?.topic && <><span>{note.topic}</span><span>›</span></>}
            <span>{note?.title || note?.subtopic_name || 'Note'}</span>
          </div>

          <article ref={contentRef}>
            <div style={{ marginBottom: '2rem' }}>
              {note?.level && (
                <span style={{ padding: '4px 14px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 700, fontFamily: 'var(--font-mono)', background: 'rgba(184,135,58,0.1)', color: 'var(--clr-magenta)', border: '1px solid rgba(184,135,58,0.3)', marginRight: '8px' }}>{note.level}</span>
              )}
              {note?.topic && (
                <span style={{ padding: '4px 14px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 700, fontFamily: 'var(--font-mono)', background: 'rgba(10,181,181,0.1)', color: 'var(--clr-cyan)', border: '1px solid rgba(10,181,181,0.3)' }}>{note.topic}</span>
              )}
            </div>

            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', fontWeight: 900, color: 'var(--clr-white)', lineHeight: 1.2, marginBottom: '2rem' }}>
              {note?.title || note?.subtopic_name}
            </h1>

            <div className="notes-content-container" style={{ background: 'none', padding: 0, borderRadius: 0 }} dangerouslySetInnerHTML={{ __html: note?.content || '<p>Content not available.</p>' }} />
          </article>

          <div style={{ marginTop: '3rem', paddingTop: '2rem', borderTop: '2px solid var(--clr-border-glow)' }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--clr-text-muted)', marginBottom: '1rem', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Was this helpful?</p>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              {[{ type: 'like', icon: 'fa-thumbs-up', label: 'Helpful' }, { type: 'love', icon: 'fa-heart', label: 'Love it' }, { type: 'helpful', icon: 'fa-lightbulb', label: 'Insightful' }].map(({ type, icon, label }) => (
                <button key={type} onClick={() => handleReaction(type)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '8px 20px', borderRadius: '40px', border: '1.5px solid var(--clr-border-glow)', background: 'var(--clr-navy-light)', color: 'var(--clr-text-dim)', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 'var(--text-sm)', cursor: 'pointer', transition: 'all 0.2s' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--clr-magenta)'; e.currentTarget.style.color = 'var(--clr-magenta)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--clr-border-glow)'; e.currentTarget.style.color = 'var(--clr-text-dim)'; }}
                >
                  <i className={`fa-regular ${icon}`}></i> {label} <span style={{ color: 'var(--clr-cyan)', fontWeight: 700 }}>{reactions?.counts?.[type] || 0}</span>
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginTop: '2.5rem', paddingTop: '2rem', borderTop: '1px solid var(--clr-border-glow)' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.2rem', color: 'var(--clr-white)', marginBottom: '1.25rem' }}>
              <i className="fa-regular fa-comments" style={{ color: 'var(--clr-cyan)', marginRight: '8px' }}></i>
              Discussion {comments.length > 0 && `(${comments.length})`}
            </h3>
            {user ? (
              <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
                <input type="text" placeholder="Share a thought or ask a question..." value={commentInput} onChange={e => setCommentInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleComment()} style={{ flex: 1, padding: '0.75rem 1rem', borderRadius: '40px', border: '1px solid var(--clr-border-glow)', background: 'var(--clr-navy-light)', color: 'var(--clr-white)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)' }} />
                <button onClick={handleComment} className="btn-primary" style={{ padding: '0.75rem 1.2rem', borderRadius: '40px', whiteSpace: 'nowrap' }}>Post</button>
              </div>
            ) : (
              <div style={{ background: 'var(--clr-navy-light)', border: '1px solid var(--clr-border-glow)', borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1.5rem', textAlign: 'center' }}>
                <p style={{ color: 'var(--clr-text-dim)', fontSize: 'var(--text-sm)', marginBottom: '0.75rem' }}>Sign in to join the discussion</p>
                <a href="/login" className="btn-primary" style={{ padding: '8px 20px', fontSize: 'var(--text-sm)' }}>Sign In</a>
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {comments.length === 0 ? (
                <p style={{ color: 'var(--clr-text-muted)', fontSize: 'var(--text-sm)', textAlign: 'center', padding: '1.5rem' }}>No comments yet. Be the first to share your thoughts.</p>
              ) : comments.map((c, idx) => (
                <div key={idx} style={{ background: 'var(--clr-navy-card)', border: '1px solid var(--clr-border-glow)', borderRadius: 'var(--radius-md)', padding: '1rem 1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                    <strong style={{ color: 'var(--clr-cyan)', fontSize: 'var(--text-sm)' }}>{c.user_name}</strong>
                    <span style={{ fontSize: '0.7rem', color: 'var(--clr-text-muted)', fontFamily: 'var(--font-mono)' }}>{new Date(c.created_at).toLocaleDateString()}</span>
                  </div>
                  <p style={{ color: 'var(--clr-text-dim)', fontSize: 'var(--text-sm)', lineHeight: 1.6, margin: 0 }}>{c.comment}</p>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '3rem' }}>
            <button onClick={handleBack} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'none', border: '1.5px solid var(--clr-cyan)', color: 'var(--clr-cyan)', padding: '10px 24px', borderRadius: '30px', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 'var(--text-sm)', cursor: 'pointer', transition: 'all 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--clr-cyan)'; e.currentTarget.style.color = '#012c2c'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--clr-cyan)'; }}
            >
              <i className="fa-solid fa-arrow-left"></i> Back to Notes
            </button>
          </div>
        </div>
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

      <button className="back-to-top" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}><i className="fa-solid fa-arrow-up"></i></button>
    </div>
  );
}
