import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import { apiCall } from '../../services/apiService';
import PreparingMessage from '../../components/common/PreparingMessage';

export default function LevelNotesPage({ level, levelDisplay, heroIcon, heroTitle, heroSubtitle }) {
  const { isAuthenticated } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [allNotes, setAllNotes] = useState([]);
  const [filteredNotes, setFilteredNotes] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [showPreparing, setShowPreparing] = useState(false);
  const [preparingTitle, setPreparingTitle] = useState('');
  const redirectTimeoutRef = React.useRef(null);
  const logoUrl = document.querySelector('.logo-link img')?.src || '/favicon-32x32.png';

  const targetSubtopicId = searchParams.get('subtopic');
  const targetSubtopicTitle = searchParams.get('title') || '';

  useEffect(() => {
    if (!isAuthenticated) return;
    loadNotes();
  }, [isAuthenticated]);

  useEffect(() => {
    if (targetSubtopicId && !showPreparing && !loading) {
      // Auto‑open the note after notes are loaded
      const note = allNotes.find(n => String(n.id) === String(targetSubtopicId));
      if (note) {
        setPreparingTitle(note.title);
        setShowPreparing(true);
        redirectTimeoutRef.current = setTimeout(() => {
          navigate(`/note/${note.id}?level=${level}&return_to=${level.toLowerCase().replace('-', '')}&return_subtopic=${note.id}&return_title=${encodeURIComponent(note.title)}`);
        }, 6000);
      }
    }
    return () => {
      if (redirectTimeoutRef.current) clearTimeout(redirectTimeoutRef.current);
    };
  }, [targetSubtopicId, allNotes, loading, showPreparing, navigate, level]);

  const loadNotes = async () => {
    setLoading(true);
    try {
      const notes = await apiCall('get_notes_by_level', { level });
      setAllNotes(notes || []);
      setFilteredNotes(notes || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    const term = e.target.value.toLowerCase().trim();
    setSearchTerm(term);
    if (term === '') {
      setFilteredNotes(allNotes);
    } else {
      setFilteredNotes(allNotes.filter(note =>
        note.title?.toLowerCase().includes(term) ||
        note.topic?.toLowerCase().includes(term) ||
        note.preview?.toLowerCase().includes(term)
      ));
    }
  };

  const clearSearch = () => {
    setSearchTerm('');
    setFilteredNotes(allNotes);
    const input = document.getElementById('note-search');
    if (input) input.value = '';
  };

  const onNoteCardClick = (noteId, title) => {
    setPreparingTitle(title);
    setShowPreparing(true);
    if (redirectTimeoutRef.current) clearTimeout(redirectTimeoutRef.current);
    redirectTimeoutRef.current = setTimeout(() => {
      navigate(`/note/${noteId}?level=${level}&return_to=${level.toLowerCase().replace('-', '')}&return_subtopic=${noteId}&return_title=${encodeURIComponent(title)}`);
    }, 6000);
  };

  const hidePreparing = () => {
    setShowPreparing(false);
    if (redirectTimeoutRef.current) clearTimeout(redirectTimeoutRef.current);
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (redirectTimeoutRef.current) clearTimeout(redirectTimeoutRef.current);
    };
  }, []);

  if (showPreparing) {
    return <PreparingMessage title={preparingTitle} logoUrl={logoUrl} />;
  }

  if (!isAuthenticated) {
    return (
      <div className="auth-wall">
        <i className="fa-solid fa-lock"></i>
        <h2>Access {levelDisplay}</h2>
        <p>Sign in or create an account to access our complete library of study notes.</p>
        <div className="auth-buttons">
          <button className="signin-btn" onClick={() => window.showAuthForm('signin')}><i className="fa-solid fa-right-to-bracket"></i> Sign In</button>
          <button className="signup-btn" onClick={() => window.showAuthForm('signup')}><i className="fa-solid fa-user-plus"></i> Create Account</button>
        </div>
      </div>
    );
  }

  return (
    <>
      <section className="hero-section">
        <div className="level-badge"><i className={`fa-solid ${heroIcon}`}></i> {levelDisplay}</div>
        <h1 className="hero-title">Master <span className="accent">{heroTitle}</span></h1>
        <p className="hero-subtitle">{heroSubtitle}</p>
        <div className="search-section">
          <div className="search-container">
            <div className="search-icon"><i className="fa-solid fa-search"></i></div>
            <input type="text" className="search-input" id="note-search" placeholder={`Search ${levelDisplay} notes...`} value={searchTerm} onChange={handleSearch} />
            {searchTerm && <button className="search-clear visible" onClick={clearSearch}><i className="fa-solid fa-times-circle"></i></button>}
          </div>
          <div className="search-stats">
            {filteredNotes.length === allNotes.length
              ? `📚 Showing all ${allNotes.length} notes`
              : `🔍 Found ${filteredNotes.length} note${filteredNotes.length !== 1 ? 's' : ''} matching "${searchTerm}"`}
          </div>
        </div>
      </section>

      <section className="notes-section">
        <div className="section-header">
          <h2><i className="fa-solid fa-book-open"></i> {levelDisplay} Notes Library</h2>
          <p>Browse all available notes. Click on any card to view the complete content.</p>
        </div>
        <div id="notes-grid-container">
          {loading ? (
            <div className="skeleton-grid">
              {[1,2,3].map(i => (
                <div className="skeleton-card" key={i}>
                  <div className="skeleton-title"></div>
                  <div className="skeleton-text"></div>
                  <div className="skeleton-btn"></div>
                </div>
              ))}
            </div>
          ) : (
            <div className="notes-grid">
              {filteredNotes.length === 0 ? (
                <div className="no-results"><i className="fa-solid fa-search" style={{fontSize:'3rem'}}></i><p>No notes found.</p></div>
              ) : (
                filteredNotes.map(note => (
                  <div className="note-card" key={note.id} data-note-id={note.id}>
                    <div className="card-inner">
                      <span className="topic-badge"><i className="fa-solid fa-tag"></i> {note.topic || level}</span>
                      <h3 className="note-title">{note.title}</h3>
                      <p className="note-preview">{note.preview || (note.content ? note.content.substring(0,120)+'...' : 'No preview available')}</p>
                      <div className="note-meta">
                        <span><i className="fa-regular fa-clock"></i> {note.read_time || '5 min read'}</span>
                        <span><i className="fa-regular fa-file-lines"></i> {note.word_count ? Math.round(note.word_count/100)*100 : '~800'} words</span>
                      </div>
                      <button className="read-more-btn" onClick={() => onNoteCardClick(note.id, note.title)}>
                        <i className="fa-solid fa-book-open-reader"></i> Read Full Note
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
        <div className="back-buttons-container">
          <Link to="/" className="back-link" style={{background:'var(--gradient-cyan)', color:'#fff', borderColor:'var(--clr-cyan)'}}>
            <i className="fa-solid fa-home"></i> Back to Homepage
          </Link>
        </div>
      </section>
    </>
  );
}
