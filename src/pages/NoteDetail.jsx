/* pages/NoteDetail.jsx */
import { useState, useEffect, useRef, useCallback } from 'react';
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
  getReadingProgress,
  getNoteInternalLinks
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
  const [internalLinks, setInternalLinks] = useState({ inline_links: [], related_links: [] });
  const [linkPreview, setLinkPreview] = useState(null);
  const [linkPreviewPosition, setLinkPreviewPosition] = useState({ x: 0, y: 0 });
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const contentRef = useRef(null);
  const progressTimer = useRef(null);
  const startTime = useRef(Date.now());
  const previewTimer = useRef(null);

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
      setLoading(true);
      setFetchError(null);
      setInternalLinks({ inline_links: [], related_links: [] });
      setComments([]);
      setReactions({ counts: {}, user: [] });
      setReadProgress(0);

      try {
        const data = await getNoteDetail(noteId);

        if (!mounted) return;

        setNote(data);
        setBreadcrumb(data.breadcrumb || []);

        const [reactionResult, commentResult, linksResult] = await Promise.allSettled([
          getReactions('note', data.id),
          getComments('note', data.id),
          getNoteInternalLinks(data.id)
        ]);

        if (!mounted) return;

        const reactionData = reactionResult.status === 'fulfilled' ? reactionResult.value : { counts: {}, user_reactions: [] };
        const commentData = commentResult.status === 'fulfilled' ? commentResult.value : { comments: [] };
        const linksData = linksResult.status === 'fulfilled' ? linksResult.value : { inline_links: [], related_links: [] };

        setReactions(normalizeReactions(reactionData));
        setComments(commentData?.comments || []);
        setInternalLinks({
          inline_links: linksData?.inline_links || [],
          related_links: linksData?.related_links || []
        });

        if (user) {
          const progress = await getReadingProgress(noteId);

          if (mounted && progress?.scroll_position) {
            setTimeout(() => {
              window.scrollTo({ top: progress.scroll_position, behavior: 'smooth' });
            }, 500);
          }
        }
      } catch (error) {
        console.error('[NOTE_DETAIL_LOAD_ERROR]', error);
        if (mounted) setFetchError('Failed to load the note. Please try again.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    init();

    return () => {
      mounted = false;

      if (progressTimer.current) clearTimeout(progressTimer.current);
      if (previewTimer.current) clearTimeout(previewTimer.current);
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

  const enhanceContentWithLinks = useCallback((html, inlineLinks) => {
    if (!html || !inlineLinks.length) return html;

    let enhancedHtml = html;

    for (const link of inlineLinks) {
      if (!link.link_text) continue;

      const escapedText = link.link_text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(${escapedText})`, 'gi');

      enhancedHtml = enhancedHtml.replace(regex, (match) => {
        return `<a href="/notes/read?id=${link.target_note_id}" class="note-inline-link" data-note-id="${link.target_note_id}" data-note-title="${link.target_title}" data-note-preview="${link.target_content_preview || ''}" data-note-read-time="${link.target_read_time || ''}">${match}</a>`;
      });
    }

    return enhancedHtml;
  }, []);

  const handleInlineLinkClick = useCallback((event) => {
    const link = event.target.closest('.note-inline-link');

    if (!link) return;

    event.preventDefault();
    event.stopPropagation();

    const targetNoteId = link.dataset.noteId;

    if (!targetNoteId) return;

    navigate(`/notes/read?id=${targetNoteId}`);
  }, [navigate]);

  const handleInlineLinkHover = useCallback((event) => {
    const link = event.target.closest('.note-inline-link');

    if (!link) {
      hideLinkPreview();
      return;
    }

    const rect = link.getBoundingClientRect();
    const targetTitle = link.dataset.noteTitle;
    const targetPreview = link.dataset.notePreview;
    const targetReadTime = link.dataset.noteReadTime;

    setLinkPreview({
      title: targetTitle,
      preview: targetPreview,
      read_time: targetReadTime
    });
    setLinkPreviewPosition({
      x: rect.left,
      y: rect.bottom + 8
    });
  }, []);

  const hideLinkPreview = useCallback(() => {
    setLinkPreview(null);
  }, []);

  useEffect(() => {
    const contentElement = contentRef.current;

    if (!contentElement) return;

    contentElement.addEventListener('click', handleInlineLinkClick);
    contentElement.addEventListener('mouseover', handleInlineLinkHover);
    contentElement.addEventListener('mouseout', hideLinkPreview);

    return () => {
      contentElement.removeEventListener('click', handleInlineLinkClick);
      contentElement.removeEventListener('mouseover', handleInlineLinkHover);
      contentElement.removeEventListener('mouseout', hideLinkPreview);
    };
  }, [handleInlineLinkClick, handleInlineLinkHover, hideLinkPreview, note, internalLinks]);

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

  const enhancedContent = enhanceContentWithLinks(note.content, internalLinks.inline_links);

  return (
    <>
      {/* Animated striped progress bar - fixed at top */}
      <div className="note-progress-wrapper">
        <div className="note-progress-track">
          <div 
            className="note-progress-fill" 
            style={{ width: `${readProgress}%` }}
            role="progressbar"
            aria-valuenow={readProgress}
            aria-valuemin="0"
            aria-valuemax="100"
          />
        </div>
        {user && (
          <div className="note-progress-indicator">
            <i className={`fa-solid fa-circle-check ${progressSaved ? 'progress-saved' : 'progress-unsaved'}`}></i>
            {readProgress}% read {progressSaved && '· saved'}
          </div>
        )}
      </div>

      {linkPreview && (
        <div
          className="note-link-preview"
          style={{
            left: `${linkPreviewPosition.x}px`,
            top: `${linkPreviewPosition.y}px`
          }}
          onMouseEnter={() => {
            if (previewTimer.current) clearTimeout(previewTimer.current);
          }}
          onMouseLeave={hideLinkPreview}
        >
          <strong className="note-link-preview-title">{linkPreview.title}</strong>
          {linkPreview.preview && (
            <p className="note-link-preview-text">{linkPreview.preview.slice(0, 120)}...</p>
          )}
          {linkPreview.read_time && (
            <span className="note-link-preview-readtime">{linkPreview.read_time}</span>
          )}
        </div>
      )}

      <div className="note-detail-container">
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
            dangerouslySetInnerHTML={{ __html: enhancedContent || '<p>Content not available.</p>' }}
          />
        </article>

        {internalLinks.related_links.length > 0 && (
          <div className="note-related-section">
            <h3 className="note-related-title">
              <i className="fa-solid fa-link"></i> Related Notes
            </h3>
            <div className="note-related-grid">
              {internalLinks.related_links.map((link) => (
                <button
                  key={link.link_id}
                  className="note-related-card"
                  onClick={() => navigate(`/notes/read?id=${link.target_note_id}`)}
                >
                  <span className="note-related-link-type">{link.link_type}</span>
                  <strong className="note-related-link-title">{link.target_title}</strong>
                  {link.target_read_time && (
                    <span className="note-related-link-readtime">{link.target_read_time}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

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

        <button className="note-back-btn note-back-bottom" onClick={handleBack}>
          <i className="fa-solid fa-arrow-left"></i> Back to Notes
        </button>
      </div>
    </>
  );
} 
