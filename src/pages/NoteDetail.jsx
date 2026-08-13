 /* pages/NoteDetail.jsx */
import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLayout } from '../contexts/LayoutContext';
import {
  getNoteDetail,
  getReactions,
  toggleReaction,
  addComment,
  getComments,
  saveReadingProgress,
  getReadingProgress
} from '../api/client';
import EmptyState from '../components/EmptyState/EmptyState';
import Spinner from '../components/Spinner/Spinner';
import Button from '../components/Button/Button';

function normalizeReactions(data) {
  return {
    counts: data?.counts || {},
    user: Array.isArray(data?.user_reactions) ? data.user_reactions : []
  };
}

export default function NoteDetail() {
  const { user } = useAuth();
  const { bootstrap } = useLayout();
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
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const contentRef = useRef(null);
  const progressTimer = useRef(null);
  const startTime = useRef(Date.now());

  function getEmptyStateImage(key) {
    const uiComponents = bootstrap?.ui_components || [];
    const component = uiComponents.find((item) => item.component_key === `empty_state_${key}`);

    return component?.properties?.image_url || null;
  }

  useEffect(() => {
    if (!noteId) {
      navigate('/notes');
      return;
    }

    let mounted = true;

    const init = async () => {
      try {
        const data = await getNoteDetail(noteId);

        if (!mounted) return;

        setNote(data);
        setBreadcrumb(data.breadcrumb || []);

        const [reactionData, commentData] = await Promise.all([
          getReactions('note', data.id),
          getComments('note', data.id)
        ]);

        if (!mounted) return;

        setReactions(normalizeReactions(reactionData));
        setComments(commentData?.comments || []);

        if (user) {
          const progress = await getReadingProgress(noteId);

          if (mounted && progress?.scroll_position) {
            setTimeout(() => {
              window.scrollTo({ top: progress.scroll_position, behavior: 'smooth' });
            }, 500);
          }
        }
      } catch {
        if (mounted) setFetchError('Failed to load the note. Please try again.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    init();

    return () => {
      mounted = false;

      if (progressTimer.current) clearTimeout(progressTimer.current);
    };
  }, [noteId, navigate, user]);

  useEffect(() => {
    if (!user || !note) return;

    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const percentage = docHeight > 0 ? Math.round((scrollTop / docHeight) * 100) : 0;

      setReadProgress(percentage);

      if (progressTimer.current) clearTimeout(progressTimer.current);

      progressTimer.current = setTimeout(async () => {
        const timeSpent = Math.round((Date.now() - startTime.current) / 1000);

        try {
          await saveReadingProgress(noteId, percentage, scrollTop, timeSpent, percentage >= 90);
          setProgressSaved(true);
          setTimeout(() => setProgressSaved(false), 2000);
        } catch {}
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
    } catch {}
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
    } catch {}
  }

  function handleBack() {
    navigate(`/notes?highlight=${noteId}`);
  }

  if (loading) {
    return (
      <div className="fcd-loading-wrap">
        <Spinner size="lg" />
      </div>
    );
  }

  if (fetchError || !note) {
    return (
      <div className="section" style={{ paddingTop: 'var(--space-16)' }}>
        <EmptyState
          image={getEmptyStateImage('notes')}
          title="Note Unavailable"
          description={fetchError || 'The requested note could not be found.'}
          action={
            <Button onClick={() => navigate('/notes')}>
              Browse Notes
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <>
      <div className="note-progress-bar" style={{ width: `${readProgress}%` }} />

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
          {breadcrumb.map((crumb, index) => (
            <span key={index}>
              {crumb.href ? (
                <Link to={crumb.href} className="breadcrumb-link">{crumb.label}</Link>
              ) : (
                <span className="breadcrumb-current">{crumb.label}</span>
              )}

              {index < breadcrumb.length - 1 && <span className="breadcrumb-sep">›</span>}
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

            <h1 className="note-title">{note.title}</h1>
          </div>

          <div
            className="notes-content-container"
            dangerouslySetInnerHTML={{ __html: note.content || '<p>Content not available.</p>' }}
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
                className={`note-reaction-btn ${reactions.user.includes(type) ? 'active' : ''}`}
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
                onChange={(event) => setCommentInput(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && handleComment()}
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
              <p className="note-comments-empty">No comments yet.</p>
            ) : (
              comments.filter(Boolean).map((comment) => (
                <div key={comment.id || comment.created_at} className="note-comment-item">
                  <div className="note-comment-header">
                    <strong className="note-comment-author">{comment.user_name}</strong>
                    <span className="note-comment-date">
                      {new Date(comment.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="note-comment-text">{comment.body || comment.comment}</p>
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
