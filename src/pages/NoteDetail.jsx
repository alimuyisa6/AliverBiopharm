 import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useLayout } from '../contexts/LayoutContext';
import {
  getNoteDetail,
  getContentDetail,
  getReactions,
  toggleReaction,
  addComment,
  getComments,
  saveReadingProgress,
  getReadingProgress
} from '../api/client';

function normalizeReactions(data) {
  return {
    counts: data?.counts || {},
    user: Array.isArray(data?.user_reactions) ? data.user_reactions : []
  };
}

export default function NoteDetail() {
  const { user } = useAuth();
  const { groups } = useLayout();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const noteId = searchParams.get('id');

  const [note, setNote] = useState(null);
  const [breadcrumb, setBreadcrumb] = useState([]);
  const [reactions, setReactions] = useState({ counts: {}, user: [] });
  const [comments, setComments] = useState([]);
  const [commentInput, setCommentInput] = useState('');
  const [readProgress, setReadProgress] = useState(0);
  const [progressSaved, setProgressSaved] = useState(false);
  const contentRef = useRef(null);
  const progressTimer = useRef(null);
  const startTime = useRef(Date.now());

  useEffect(() => {
    if (!noteId) {
      navigate('/notes');
      return;
    }
    const init = async () => {
      try {
        const data = await getNoteDetail(noteId);
        setNote(data);
        if (data.breadcrumb) setBreadcrumb(data.breadcrumb);
        else if (data.unit_title) {
          setBreadcrumb([
            { label: 'Home', href: '/' },
            ...(data.unit_title.group_name ? [{ label: data.unit_title.group_name, href: `/group/${data.unit_id}` }] : []),
            { label: data.unit_title.unit_name, href: null }
          ]);
        }

        const [reactionData, commentData] = await Promise.all([
          getReactions('note', data.id),
          getComments('note', data.id)
        ]);
        setReactions(normalizeReactions(reactionData));
        setComments(commentData?.comments || []);

        if (user) {
          const progress = await getReadingProgress(noteId);
          if (progress?.scroll_position) {
            setTimeout(() => window.scrollTo({ top: progress.scroll_position, behavior: 'smooth' }), 500);
          }
        }
      } catch (err) {
        console.error(err);
      }
    };
    init();
    return () => {
      if (progressTimer.current) clearTimeout(progressTimer.current);
    };
  }, [noteId, navigate, user]);

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
          await saveReadingProgress(noteId, pct, scrollTop, timeSpent, pct >= 90);
          setProgressSaved(true);
          setTimeout(() => setProgressSaved(false), 2000);
        } catch (err) {
          console.error(err);
        }
      }, 1500);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [user, note, noteId]);

  async function handleReaction(reactionType) {
    if (!user) {
      navigate('/login');
      return;
    }
    try {
      await toggleReaction('note', noteId, reactionType);
      const updated = await getReactions('note', noteId);
      setReactions(normalizeReactions(updated));
    } catch (err) {
      console.error(err);
    }
  }

  async function handleComment() {
    if (!user) {
      navigate('/login');
      return;
    }
    if (!commentInput.trim()) return;
    try {
      await addComment('note', noteId, commentInput.trim());
      setCommentInput('');
      const updated = await getComments('note', noteId);
      setComments(updated?.comments || []);
    } catch (err) {
      console.error(err);
    }
  }

  function handleBack() {
    navigate(`/notes?highlight=${noteId}`);
  }

  return (
    <>
      <div className="note-progress-bar" style={{ width: `${readProgress}%` }}></div>

      <div className="note-detail-container">
        <div className="note-detail-header">
          <button className="note-back-btn" onClick={handleBack}>
            <i className="fa-solid fa-arrow-left"></i> Back to Notes
          </button>
          {user && (
            <div className="note-progress-indicator">
              <i className={`fa-solid fa-circle-check ${progressSaved ? 'progress-saved' : 'progress-unsaved'}`}></i>
              {readProgress}% read {progressSaved && '· saved'}
            </div>
          )}
        </div>

        <div className="breadcrumb note-breadcrumb">
          {breadcrumb.map((crumb, i) => (
            <span key={i}>
              {crumb.href ? <Link to={crumb.href} className="breadcrumb-link">{crumb.label}</Link> : <span className="breadcrumb-current">{crumb.label}</span>}
              {i < breadcrumb.length - 1 && <span className="breadcrumb-sep">›</span>}
            </span>
          ))}
          {note?.unit_title?.group_name && (
            <span className="note-class-badge">{note.unit_title.group_name}</span>
          )}
        </div>

        <article ref={contentRef} className="note-article">
          <div className="note-hero">
            <div className="note-meta-tags">
              {note?.unit_title?.group_name && (
                <span className="note-tag note-tag-group">{note.unit_title.group_name}</span>
              )}
              {note?.unit_title?.unit_name && (
                <span className="note-tag note-tag-unit">{note.unit_title.unit_name}</span>
              )}
            </div>

            <h1 className="note-title">{note?.title || note?.unit_title?.unit_name || 'Note'}</h1>
          </div>

          <div
            className="notes-content-container"
            dangerouslySetInnerHTML={{ __html: note?.content || '<p>Content not available.</p>' }}
          />
        </article>

        <div className="note-reactions-section">
          <p className="note-reactions-label">Was this helpful?</p>
          <div className="note-reactions-buttons">
            {[
              { type: 'like', icon: 'fa-thumbs-up', label: 'Helpful' },
              { type: 'love', icon: 'fa-heart', label: 'Love it' },
              { type: 'helpful', icon: 'fa-lightbulb', label: 'Insightful' }
            ].map(({ type, icon, label }) => (
              <button
                key={type}
                className={`note-reaction-btn ${(reactions.user || []).includes(type) ? 'active' : ''}`}
                onClick={() => handleReaction(type)}
              >
                <i className={`fa-regular ${icon}`}></i> {label}
                <span className="note-reaction-count">{reactions.counts?.[type] || 0}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="note-comments-section">
          <h3 className="note-comments-title">
            <i className="fa-regular fa-comments"></i>
            Discussion {comments.length > 0 && `(${comments.length})`}
          </h3>

          {user ? (
            <div className="note-comment-input-wrapper">
              <input
                type="text"
                className="note-comment-input"
                placeholder="Share a thought or ask a question..."
                value={commentInput}
                onChange={e => setCommentInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleComment()}
              />
              <button className="note-comment-submit" onClick={handleComment}>
                Post
              </button>
            </div>
          ) : (
            <div className="note-comment-signin">
              <p>Sign in to join the discussion</p>
              <Link to="/login" className="btn-primary note-signin-btn">Sign In</Link>
            </div>
          )}

          <div className="note-comments-list">
            {comments.length === 0 ? (
              <p className="note-comments-empty">No comments yet. Be the first to share your thoughts.</p>
            ) : (
              comments.filter(Boolean).map((c) => (
                <div key={c.id || c.created_at} className="note-comment-item">
                  <div className="note-comment-header">
                    <strong className="note-comment-author">{c.user_name}</strong>
                    <span className="note-comment-date">{new Date(c.created_at).toLocaleDateString()}</span>
                  </div>
                  <p className="note-comment-text">{c.body || c.comment}</p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="note-detail-footer">
          <button className="note-back-btn note-back-bottom" onClick={handleBack}>
            <i className="fa-solid fa-arrow-left"></i> Back to Notes
          </button>
        </div>
      </div>
    </>
  );
}
