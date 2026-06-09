 import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import DOMPurify from 'dompurify';
import useAuth from '../../hooks/useAuth';
import { apiCall } from '../../services/apiService';
import './NotePage.css';

function getCachedNote(id, level) {
  const key = `note_${id}_${level}`;
  const cached = sessionStorage.getItem(key);
  if (!cached) return null;
  try {
    const { data, expiresAt } = JSON.parse(cached);
    if (Date.now() > expiresAt) {
      sessionStorage.removeItem(key);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function setCachedNote(id, level, data, ttlMs = 3600000) {
  const key = `note_${id}_${level}`;
  sessionStorage.setItem(key, JSON.stringify({ data, expiresAt: Date.now() + ttlMs }));
}

export default function NotePage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const level = searchParams.get('level');
  const returnTo = searchParams.get('return_to');
  const returnSubtopic = searchParams.get('return_subtopic');
  const returnTitle = searchParams.get('return_title');
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();

  const [note, setNote] = useState(() => getCachedNote(id, level));
  const [loading, setLoading] = useState(!note);
  const [error, setError] = useState(null);
  const [reactions, setReactions] = useState({ counts: { like: 0, love: 0, helpful: 0 }, userReaction: null });
  const [comments, setComments] = useState([]);
  const [maxScrollPercent, setMaxScrollPercent] = useState(0);
  const [textSize, setTextSize] = useState(() => {
    try { return localStorage.getItem('note_text_size') || 'medium'; } catch { return 'medium'; }
  });
  const [completionShown, setCompletionShown] = useState(false);
  const [resumePercent, setResumePercent] = useState(0);

  const scrollTimerRef = useRef(null);
  const utteranceRef = useRef(null);
  const saveTimerRef = useRef(null);

  const ALLOWED_LEVELS = ['O-Level', 'A-Level', 'Pharmacy'];
  const ALLOWED_RETURN = ['olevel', 'alevel', 'pharmacy'];

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/');
      return;
    }
    if (!id || !ALLOWED_LEVELS.includes(level)) {
      navigate('/');
      return;
    }
    if (!note) {
      fetchNote();
    } else {
      loadReactions();
      loadComments();
      loadProgressFromLocal();
    }
    return () => {
      if (utteranceRef.current) window.speechSynthesis.cancel();
      window.removeEventListener('scroll', handleScroll);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [id, level, isAuthenticated]);

  const fetchNote = async () => {
    setLoading(true);
    try {
      const data = await apiCall('get_note_content', { subtopic_id: id, level });
      if (!data) throw new Error('Note not found');
      setNote(data);
      setCachedNote(id, level, data);
      document.title = `${data.title || 'Study Note'} | AliverBiopharm ${level} Notes`;
      await loadReactions();
      await loadComments();
      loadProgressFromLocal();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadReactions = async () => {
    try {
      const res = await apiCall('get_note_reactions', { note_id: id });
      if (res) setReactions({ counts: res.counts, userReaction: res.user_reaction });
    } catch (e) {}
  };

  const loadComments = async () => {
    try {
      const res = await apiCall('get_resource_interactions', { resource_id: id });
      setComments(res?.comments || []);
    } catch (e) {}
  };

  const toggleReaction = async (type) => {
    if (!user) return;
    try {
      await apiCall('toggle_note_reaction', { note_id: id, reaction_type: type });
      await loadReactions();
    } catch (e) {}
  };

  const submitComment = async () => {
    const input = document.getElementById('comment-input');
    let comment = input?.value.trim() || '';
    if (comment.length < 2 || comment.length > 500) {
      alert('Comment must be 2-500 characters.');
      return;
    }
    const sanitized = comment.replace(/[<>]/g, '');
    try {
      await apiCall('comment_resource', { resource_id: id, comment: sanitized });
      if (input) input.value = '';
      await loadComments();
    } catch (e) {}
  };

  const handleScroll = useCallback(() => {
    const winScroll = window.scrollY;
    const height = document.documentElement.scrollHeight - window.innerHeight;
    let percent = height <= 0 ? 0 : (winScroll / height) * 100;
    percent = Math.min(100, Math.max(0, percent));
    if (percent > maxScrollPercent) {
      setMaxScrollPercent(percent);
      updateProgressBar(percent);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => saveProgressToLocal(percent), 1000);
    }
  }, [maxScrollPercent]);

  const updateProgressBar = (percent) => {
    const fill = document.getElementById('progress-bar-fill');
    const text = document.getElementById('progress-percentage');
    if (fill) fill.style.width = `${percent}%`;
    if (text) text.innerText = `${Math.floor(percent)}% read`;
    if (!completionShown && percent >= 95) {
      setCompletionShown(true);
      const badgeContainer = document.getElementById('completion-badge-container');
      if (badgeContainer) {
        badgeContainer.innerHTML = '<div class="badge-completed"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg> Completed! You mastered this note.</div>';
      }
    }
  };

  const saveProgressToLocal = (percent) => {
    try {
      if (percent >= 10 && id) {
        localStorage.setItem(`progress_${id}`, percent);
        localStorage.setItem(`progress_${id}_time`, Date.now());
      }
    } catch (e) {}
  };

  const loadProgressFromLocal = () => {
    try {
      const saved = localStorage.getItem(`progress_${id}`);
      if (saved) {
        let percent = parseFloat(saved);
        percent = Math.min(100, Math.max(0, percent));
        if (percent > 10 && percent < 95) {
          setMaxScrollPercent(percent);
          updateProgressBar(percent);
          setResumePercent(percent);
        } else if (percent >= 95) {
          setMaxScrollPercent(percent);
          updateProgressBar(percent);
        }
      }
    } catch (e) {}
  };

  const resumeScroll = () => {
    if (resumePercent <= 0) return;
    const height = document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo({ top: (resumePercent / 100) * height, behavior: 'smooth' });
    setResumePercent(0);
    const prompt = document.querySelector('.resume-prompt');
    if (prompt) prompt.remove();
  };

  const toggleTextSize = (size) => {
    setTextSize(size);
    try { localStorage.setItem('note_text_size', size); } catch (e) {}
  };

  const speakNote = () => {
    if (utteranceRef.current) window.speechSynthesis.cancel();
    const textElem = document.querySelector('.note-content-wrapper');
    if (!textElem) return;
    const rawText = textElem.innerText;
    if (!rawText) return;
    utteranceRef.current = new SpeechSynthesisUtterance(rawText);
    utteranceRef.current.rate = 0.9;
    utteranceRef.current.onend = () => { utteranceRef.current = null; };
    window.speechSynthesis.speak(utteranceRef.current);
  };

  const stopSpeech = () => {
    if (utteranceRef.current) {
      window.speechSynthesis.cancel();
      utteranceRef.current = null;
    }
  };

  const printNote = () => {
    const content = document.querySelector('.note-content-wrapper');
    if (!content) return;
    const title = document.querySelector('.note-title')?.innerText || 'Study Note';
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`<html><head><title>${escapeHtml(title)}</title><style>body{font-family:'Inter',sans-serif;padding:40px;max-width:900px;margin:0 auto;line-height:1.6;}h1{color:#0a7e7e;}h2{color:#b8873a;}</style></head><body><h1>${escapeHtml(title)}</h1>${content.innerHTML}</body></html>`);
    printWindow.document.close();
    printWindow.print();
  };

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    alert('Link copied!');
  };

  const shareNote = () => {
    if (navigator.share) {
      navigator.share({ title: document.title, url: window.location.href });
    } else {
      copyLink();
    }
  };

  const buildBackLink = () => {
    if (returnTo && ALLOWED_RETURN.includes(returnTo) && returnSubtopic) {
      const safeSubtopic = encodeURIComponent(returnSubtopic);
      const safeTitle = returnTitle ? encodeURIComponent(returnTitle) : '';
      if (returnTo === 'olevel') return `/olevel.html?subtopic=${safeSubtopic}&title=${safeTitle}`;
      if (returnTo === 'alevel') return `/alevel.html?subtopic=${safeSubtopic}&title=${safeTitle}`;
      if (returnTo === 'pharmacy') return `/pharmacy.html?subtopic=${safeSubtopic}&title=${safeTitle}`;
    }
    return '/';
  };

  const escapeHtml = (str) => {
    if (!str) return '';
    return String(str).replace(/[&<>]/g, function (m) {
      if (m === '&') return '&amp;';
      if (m === '<') return '&lt;';
      if (m === '>') return '&gt;';
      return m;
    });
  };

  const getReadTime = (content) => {
    const words = (content || '').replace(/<[^>]*>/g, '').trim().split(/\s+/).length;
    return `${Math.max(2, Math.ceil(words / 200))} min read`;
  };

  const generateTOC = (htmlContent) => {
    const matches = htmlContent.match(/<h2[^>]*>.*?<\/h2>/gi);
    if (!matches || matches.length < 2) return '';
    let tocHtml = '<div class="table-of-contents"><h3><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--clr-magenta)" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg> Contents</h3><ul>';
    matches.forEach((heading, idx) => {
      const title = heading.replace(/<[^>]*>/g, '');
      tocHtml += `<li><a href="#section-${idx}">${escapeHtml(title)}</a></li>`;
    });
    tocHtml += '</ul></div>';
    return tocHtml;
  };

  const generateKeyPoints = (htmlContent) => {
    const strongMatches = htmlContent.match(/<strong>([^<]+)<\/strong>/g);
    if (strongMatches && strongMatches.length >= 3) {
      let points = '';
      for (let i = 0; i < Math.min(6, strongMatches.length); i++) {
        const term = strongMatches[i].replace(/<[^>]*>/g, '');
        if (term.length > 3 && term.length < 60) points += `<li>${escapeHtml(term)}</li>`;
      }
      if (points) {
        return `<div class="key-points"><h3><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--clr-magenta)" strokeWidth="2"><path d="M9.5 2.5L12 5l2.5-2.5a4.5 4.5 0 0 1 5.5 5.5L12 19 4 8a4.5 4.5 0 0 1 5.5-5.5z"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="8" y1="22" x2="16" y2="22"/></svg> Key Terms to Remember</h3><ul>${points}</ul></div>`;
      }
    }
    return '';
  };

  useEffect(() => {
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  useEffect(() => {
    if (resumePercent > 10 && resumePercent < 95) {
      const promptDiv = document.createElement('div');
      promptDiv.className = 'resume-prompt';
      promptDiv.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> Resume from ${Math.floor(resumePercent)}%`;
      promptDiv.onclick = resumeScroll;
      document.body.appendChild(promptDiv);
      setTimeout(() => promptDiv.remove(), 8000);
      return () => promptDiv.remove();
    }
  }, [resumePercent]);

  if (loading) {
    return (
      <div className="loading-spinner-container">
        <div className="loading-spinner">
          <svg className="spinner-svg" viewBox="0 0 24 24" fill="none" stroke="var(--clr-cyan)" strokeWidth="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
          <p>Loading note...</p>
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="note-container">
        <div style={{ textAlign: 'center', padding: '80px' }}>
          <p>Failed to load note. Please try again.</p>
          <Link to={buildBackLink()} className="back-link">Back</Link>
        </div>
      </div>
    );
  }
  if (!note) return null;

  const rawContent = note.content || '<p>No content available.</p>';
  const sanitizedFull = DOMPurify.sanitize(rawContent);
  let contentWithIds = sanitizedFull.replace(/<h2>/gi, (match, offset) => {
    const idx = (sanitizedFull.slice(0, offset).match(/<h2>/gi) || []).length;
    return `<h2 id="section-${idx}">`;
  });

  const levelDisplay = { 'O-Level': 'O-LEVEL BIOLOGY', 'A-Level': 'A-LEVEL BIOLOGY', 'Pharmacy': 'PHARMACY' };
  const levelIcon = {
    'O-Level': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>',
    'A-Level': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2"><path d="M20 12L12 20M12 4L4 12M12 4v16M4 12h16"/><circle cx="12" cy="12" r="3"/></svg>',
    'Pharmacy': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><line x1="12" y1="6" x2="12" y2="14"/><line x1="8" y1="10" x2="16" y2="10"/></svg>'
  };

  const readTime = getReadTime(note.content);
  const lastUpdated = note.updated_at ? new Date(note.updated_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : new Date().toLocaleDateString();
  const levelPath = level === 'Pharmacy' ? 'pharmacy.html' : (level === 'A-Level' ? 'alevel.html' : 'olevel.html');
  const tocHtml = generateTOC(sanitizedFull);
  const keyPointsHtml = generateKeyPoints(sanitizedFull);

  return (
    <>
      <div className="progress-fixed-container">
        <div className="progress-wrapper">
          <div className="progress-container">
            <div className="progress-bar-fill" id="progress-bar-fill"></div>
          </div>
          <div className="progress-percentage" id="progress-percentage">0% read</div>
        </div>
      </div>

      <div className="note-container">
        <div className="note-header">
          <div className="level-badge" dangerouslySetInnerHTML={{ __html: `${levelIcon[level]} ${levelDisplay[level]}` }} />
          <h1 className="note-title">{escapeHtml(note.title)}</h1>
          <div className="note-meta-bar">
            <span className="note-meta-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> {readTime}
            </span>
            <span className="note-meta-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> Updated {lastUpdated}
            </span>
          </div>
          <div className="breadcrumbs">
            <Link to="/">Home</Link>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
            <Link to={`/${levelPath}`}>{level}</Link>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
            <span>{escapeHtml(note.title)}</span>
          </div>
          <div id="completion-badge-container"></div>
        </div>

        <div className="toolbar">
          <div className="text-controls">
            <button className="text-size-btn" onClick={() => toggleTextSize('small')}>A-</button>
            <button className="text-size-btn" onClick={() => toggleTextSize('medium')}>A</button>
            <button className="text-size-btn" onClick={() => toggleTextSize('large')}>A+</button>
          </div>
          <button className="tool-btn" onClick={speakNote}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg> Listen
          </button>
          <button className="tool-btn" onClick={stopSpeech}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="6" y="6" width="12" height="12"/></svg> Stop
          </button>
          <button className="tool-btn" onClick={printNote}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9V3h12v6"/><rect x="4" y="12" width="16" height="10"/><path d="M18 12h2a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2h2"/><path d="M8 12h8"/></svg> Print/PDF
          </button>
          <button className="tool-btn" onClick={copyLink}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy Link
          </button>
          <button className="tool-btn" onClick={shareNote}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg> Share
          </button>
        </div>

        <div className={`note-content-wrapper ${textSize}`}>
          <div className="note-content">
            {tocHtml && <div dangerouslySetInnerHTML={{ __html: tocHtml }} />}
            <div dangerouslySetInnerHTML={{ __html: contentWithIds }} />
            {keyPointsHtml && <div dangerouslySetInnerHTML={{ __html: keyPointsHtml }} />}

            <div className="reaction-bar" data-note-id={id}>
              <button className={`reaction-btn ${reactions.userReaction === 'like' ? 'active' : ''}`} onClick={() => toggleReaction('like')}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--clr-cyan)" strokeWidth="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
                <span className="reaction-count like-count">{reactions.counts.like || 0}</span>
              </button>
              <button className={`reaction-btn ${reactions.userReaction === 'love' ? 'active' : ''}`} onClick={() => toggleReaction('love')}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--clr-cyan)" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                <span className="reaction-count love-count">{reactions.counts.love || 0}</span>
              </button>
              <button className={`reaction-btn ${reactions.userReaction === 'helpful' ? 'active' : ''}`} onClick={() => toggleReaction('helpful')}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--clr-cyan)" strokeWidth="2"><path d="M9.5 2.5L12 5l2.5-2.5a4.5 4.5 0 0 1 5.5 5.5L12 19 4 8a4.5 4.5 0 0 1 5.5-5.5z"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="8" y1="22" x2="16" y2="22"/></svg>
                <span className="reaction-count helpful-count">{reactions.counts.helpful || 0}</span>
              </button>
            </div>

            <div className="comment-section">
              <div className="comment-input-group">
                <input type="text" id="comment-input" placeholder="Add a comment or question..." maxLength="500" />
                <button className="comment-submit" onClick={submitComment}>Post</button>
              </div>
              <div className="comments-list" id="comments-list">
                {comments.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px' }}>No comments yet.</div>
                ) : (
                  comments.map(c => (
                    <div key={c.created_at} className="comment-item">
                      <strong>{escapeHtml(c.user_name)}</strong> <small>{new Date(c.created_at).toLocaleDateString()}</small><br />
                      {escapeHtml(c.comment)}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div style={{ marginTop: '30px' }}>
              <Link to={buildBackLink()} className="back-link" onClick={() => sessionStorage.setItem('fromNote', 'true')}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--clr-cyan)" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg> Back to {level} Notes
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
