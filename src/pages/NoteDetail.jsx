 import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useLevelFilter } from '../hooks/useLevelFilter';
import {
  getNoteContent,
  getNoteReactions,
  toggleNoteReaction,
  getResourceInteractions,
  commentResource,
  saveReadingProgress,
  getReadingProgress
} from '../api/client';

export default function NoteDetail() {
  const { user } = useAuth();
  const { level, class_name } = useLevelFilter();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const subtopicId = searchParams.get('id');
  const [note, setNote] = useState(null);
  const [reactions, setReactions] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentInput, setCommentInput] = useState('');
  const [readProgress, setReadProgress] = useState(0);
  const [progressSaved, setProgressSaved] = useState(false);
  const contentRef = useRef(null);
  const progressTimer = useRef(null);
  const startTime = useRef(Date.now());

  useEffect(() => {
    if (!subtopicId) {
      navigate('/notes');
      return;
    }
    const init = async () => {
      try {
        const [content, reactionData, interactions] = await Promise.all([
          getNoteContent(subtopicId),
          getNoteReactions(subtopicId),
          getResourceInteractions(subtopicId)
        ]);
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
      }
    };
    init();
    return () => {
      if (progressTimer.current) clearTimeout(progressTimer.current);
    };
  }, [subtopicId, navigate, user]);

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
        } catch (err) {
          console.error(err);
        }
      }, 1500);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [user, note, subtopicId]);

  async function handleReaction(reactionType) {
    if (!user) {
      navigate('/login');
      return;
    }
    try {
      await toggleNoteReaction(subtopicId, reactionType);
      const updated = await getNoteReactions(subtopicId);
      setReactions(updated);
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
      await commentResource(subtopicId, commentInput);
      setCommentInput('');
      const interactions = await getResourceInteractions(subtopicId);
      setComments(interactions?.comments || []);
    } catch (err) {
      console.error(err);
    }
  }

  function handleBack() {
    navigate(`/notes?highlight=${subtopicId}`);
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
              <i className="fa-solid fa-circle-check" style={{ color: progressSaved ? 'var(--clr-success)' : 'var(--clr-border-glow)' }}></i>
              {readProgress}% read {progressSaved && '· saved'}
            </div>
          )}
        </div>

        <div className="breadcrumb note-breadcrumb">
          <Link to="/">Home</Link>
          <span>›</span>
          <Link to="/notes" className="breadcrumb-link">Notes</Link>
          <span>›</span>
          {note?.level && (
            <>
              <span>{note.level}</span>
              <span>›</span>
            </>
          )}
          {note?.topic && (
            <>
              <span>{note.topic}</span>
              <span>›</span>
            </>
          )}
          <span className="breadcrumb-current">{note?.title || note?.subtopic_name || 'Note'}</span>
          {class_name && (
            <span className="note-class-badge">{class_name}</span>
          )}
        </div>

        <article ref={contentRef} className="note-article">
          <div className="note-meta-tags">
            {note?.level && (
              <span className="note-tag note-tag-level">{note.level}</span>
            )}
            {note?.topic && (
              <span className="note-tag note-tag-topic">{note.topic}</span>
            )}
            {class_name && (
              <span className="note-tag note-tag-class">{class_name}</span>
            )}
          </div>

          <h1 className="note-title">{note?.title || note?.subtopic_name}</h1>

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
                className="note-reaction-btn"
                onClick={() => handleReaction(type)}
              >
                <i className={`fa-regular ${icon}`}></i> {label}
                <span className="note-reaction-count">{reactions?.counts?.[type] || 0}</span>
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
              comments.filter(Boolean).map((c, idx) => (
                <div key={idx} className="note-comment-item">
                  <div className="note-comment-header">
                    <strong className="note-comment-author">{c.user_name}</strong>
                    <span className="note-comment-date">{new Date(c.created_at).toLocaleDateString()}</span>
                  </div>
                  <p className="note-comment-text">{c.comment}</p>
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
