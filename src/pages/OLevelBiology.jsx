import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import { apiCall } from '../services/apiService';

const CURRENT_LEVEL = 'O-Level';

function OLevelBiology() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [preparingNote, setPreparingNote] = useState(null);
  const [targetId, setTargetId] = useState(null);
  const [targetTitle, setTargetTitle] = useState('');
  const [logoUrl, setLogoUrl] = useState('');

  const fetchLogo = useCallback(async () => {
    try {
      const sections = await apiCall('get_all_site_sections');
      if (sections?.site_config?.logo_url) {
        setLogoUrl(sections.site_config.logo_url);
      }
    } catch (e) {}
  }, []);

  const fetchNotes = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiCall('get_notes_by_level', { level: CURRENT_LEVEL });
      setNotes(data || []);
    } catch (e) {
      setNotes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogo();
    fetchNotes();

    const params = new URLSearchParams(window.location.search);
    const subtopic = params.get('subtopic');
    const title = params.get('title') || '';
    if (subtopic) {
      setTargetId(subtopic);
      setTargetTitle(title);
    }
  }, [fetchLogo, fetchNotes]);

  const filteredNotes = searchTerm.trim()
    ? notes.filter(
        (n) =>
          n.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          n.topic?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          n.preview?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : notes;

  const handleNoteClick = (noteId, title) => {
    setPreparingNote({ id: noteId, title });
    setTimeout(() => {
      goToNoteViewer(noteId, title);
    }, 6000);
  };

  const goToNoteViewer = (noteId, title) => {
    const returnPath = window.location.pathname;
    const url = `/note.html?id=${noteId}&level=${CURRENT_LEVEL}&title=${encodeURIComponent(title)}&return_to=${encodeURIComponent(returnPath)}&return_subtopic=${noteId}&return_title=${encodeURIComponent(title)}`;
    window.location.href = url;
  };

  const handleBackToHome = (e) => {
    e.preventDefault();
    if (targetId && targetTitle) {
      navigate(`/?return_to_note=true&subtopic_id=${targetId}&subtopic_name=${encodeURIComponent(targetTitle)}&level=${encodeURIComponent(CURRENT_LEVEL)}`);
    } else {
      navigate('/');
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="o-level-page">
        <div className="auth-wall">
          <i className="fa-solid fa-lock"></i>
          <h2>Access O-Level Biology Notes</h2>
          <p>Sign in or create an account to access our complete library of study notes, interactive flashcards, and learning resources.</p>
          <div className="auth-buttons">
            <button className="signin-btn" onClick={() => window.dispatchEvent(new CustomEvent('open-auth', { detail: 'signin' }))}>
              <i className="fa-solid fa-right-to-bracket"></i> Sign In
            </button>
            <button className="signup-btn" onClick={() => window.dispatchEvent(new CustomEvent('open-auth', { detail: 'signup' }))}>
              <i className="fa-solid fa-user-plus"></i> Create Account
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="o-level-page">
      {preparingNote && (
        <div className="preparing-message">
          <div className="content">
            <div className="preparing-spinner">
              <img src={logoUrl || '/favicon-32x32.png'} alt="AliverBiopharm" className="spinner-logo" />
            </div>
            <h3>Preparing Your Lesson</h3>
            <p>Loading "<span className="preparing-title">{preparingNote.title}</span>"</p>
            <div className="preparing-progress">
              <div className="progress-bar" style={{ width: '100%', transition: 'width 6s linear' }}></div>
            </div>
            <p className="preparing-tip"><i className="fa-regular fa-lightbulb"></i> Active recall improves retention by 50%</p>
          </div>
        </div>
      )}

      <section className="hero-section">
        <div className="level-badge"><i className="fa-solid fa-leaf"></i> O-LEVEL BIOLOGY</div>
        <h1 className="hero-title">Master <span className="accent">O-Level Biology</span></h1>
        <p className="hero-subtitle">Comprehensive study notes covering cell biology, genetics, ecology, human physiology, and plant science</p>
        <div className="search-section">
          <div className="search-container">
            <div className="search-icon"><i className="fa-solid fa-search"></i></div>
            <input
              type="text"
              className="search-input"
              placeholder="Search O-Level Biology notes by topic, keyword, or subtopic..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <button className={`search-clear ${searchTerm ? 'visible' : ''}`} onClick={() => setSearchTerm('')}>
              <i className="fa-solid fa-times-circle"></i>
            </button>
          </div>
          <div className="search-stats">
            {searchTerm.trim()
              ? `🔍 Found ${filteredNotes.length} note${filteredNotes.length !== 1 ? 's' : ''} matching "${searchTerm}"`
              : `📚 Showing all ${notes.length} notes`}
          </div>
        </div>
      </section>

      <section className="notes-section">
        <div className="section-header">
          <h2><i className="fa-solid fa-book-open"></i> O-Level Biology Notes Library</h2>
          <p>Browse all available notes. Click on any card to view the complete content.</p>
        </div>

        <div className="notes-grid-container">
          {loading ? (
            <div className="skeleton-grid">
              {[1, 2, 3].map((i) => (
                <div className="skeleton-card" key={i}>
                  <div className="skeleton-title"></div>
                  <div className="skeleton-text"></div>
                  <div className="skeleton-btn"></div>
                </div>
              ))}
            </div>
          ) : filteredNotes.length === 0 ? (
            <div className="no-results">
              <i className="fa-solid fa-search" style={{ fontSize: '3rem' }}></i>
              <p>No notes found matching "{searchTerm}".</p>
            </div>
          ) : (
            <div className="notes-grid">
              {filteredNotes.map((note) => (
                <div
                  key={note.id}
                  className={`note-card ${targetId && String(targetId) === String(note.id) ? 'highlight' : ''}`}
                  id={`subtopic-${note.id}`}
                  onClick={() => handleNoteClick(note.id, note.title)}
                >
                  <div className="card-inner">
                    <span className="topic-badge"><i className="fa-solid fa-tag"></i> {note.topic || 'Pharmacy'}</span>
                    <h3 className="note-title">{note.title}</h3>
                    <p className="note-preview">{note.preview || (note.content ? note.content.substring(0, 120) + '...' : 'No preview available')}</p>
                    <div className="note-meta">
                      <span><i className="fa-regular fa-clock"></i> {note.read_time || '5 min read'}</span>
                      <span><i className="fa-regular fa-file-lines"></i> {note.word_count ? Math.round(note.word_count / 100) * 100 : '~800'} words</span>
                    </div>
                    <button className="read-more-btn" onClick={(e) => { e.stopPropagation(); handleNoteClick(note.id, note.title); }}>
                      <i className="fa-solid fa-book-open-reader"></i> Read Full Note
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="back-buttons-container">
          <a href="/" className="back-link" style={{ background: 'var(--gradient-cyan)', color: '#fff', borderColor: 'var(--clr-cyan)' }} onClick={handleBackToHome}>
            <i className="fa-solid fa-home"></i> Back to Homepage
          </a>
        </div>
      </section>
    </div>
  );
}

export default OLevelBiology;
