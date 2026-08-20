 import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
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
import SearchOverlay from '../components/SearchOverlay/SearchOverlay'; // <-- NEW import

// Load mermaid from CDN only when needed
let mermaidPromise = null;
function loadMermaid() {
  if (!mermaidPromise) {
    mermaidPromise = new Promise((resolve, reject) => {
      if (window.mermaid) {
        resolve(window.mermaid);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js';
      script.onload = () => resolve(window.mermaid);
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }
  return mermaidPromise;
}

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
  const [isBarFloating, setIsBarFloating] = useState(false);
  const [toc, setToc] = useState([]);
  const [metadata, setMetadata] = useState({});
  const [tocOpen, setTocOpen] = useState(false);
  const [lightboxImage, setLightboxImage] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false); // <-- NEW state for search overlay

  const contentRef = useRef(null);
  const progressTimer = useRef(null);
  const startTime = useRef(Date.now());
  const previewTimer = useRef(null);
  const progressBarObserver = useRef(null);

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
      setToc([]);
      setMetadata({});

      try {
        const data = await getNoteDetail(noteId);

        if (!mounted) return;

        setNote(data);
        setBreadcrumb(data.breadcrumb || []);
        setToc(data.toc || []);
        setMetadata(data.metadata || {});

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

  const progressBarRef = useCallback((node) => {
    if (progressBarObserver.current) {
      progressBarObserver.current.disconnect();
      progressBarObserver.current = null;
    }

    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsBarFloating(false);
          return;
        }
        setIsBarFloating(entry.boundingClientRect.top < 0);
      },
      { threshold: 0 }
    );

    observer.observe(node);
    progressBarObserver.current = observer;
  }, []);

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

  const buildContentWithMetadata = useCallback((enhancedHtml, metadata) => {
    let html = enhancedHtml || '';

    const images = metadata.images || [];
    const diagrams = metadata.diagrams || [];

    const imageHtml = (img) => {
      const caption = img.caption ? `<figcaption class="note-image-caption">${img.caption}</figcaption>` : '';
      return `<figure class="note-image-wrapper" data-image-src="${img.src}">
        <img src="${img.src}" alt="${img.caption || 'Note image'}" loading="lazy" />
        ${caption}
      </figure>`;
    };

    const diagramHtml = (diagram) => {
      if (diagram.type === 'mermaid') {
        const caption = diagram.caption ? `<figcaption class="note-image-caption">${diagram.caption}</figcaption>` : '';
        return `<figure class="note-mermaid-wrapper">
          <div class="mermaid">${diagram.code}</div>
          ${caption}
        </figure>`;
      }
      return '';
    };

    // Position: top
    const topItems = [...images.filter(i => i.position === 'top'), ...diagrams.filter(d => d.position === 'top')];
    if (topItems.length) {
      html = topItems.map(item => item.type ? diagramHtml(item) : imageHtml(item)).join('') + html;
    }

    // Position: bottom
    const bottomItems = [...images.filter(i => i.position === 'bottom'), ...diagrams.filter(d => d.position === 'bottom')];
    if (bottomItems.length) {
      html += bottomItems.map(item => item.type ? diagramHtml(item) : imageHtml(item)).join('');
    }

    // Position: inline
    const inlineItems = [...images.filter(i => i.position === 'inline'), ...diagrams.filter(d => d.position === 'inline')];
    for (const item of inlineItems) {
      if (!item.anchor) continue;
      const anchorId = item.anchor;
      const headingRegex = new RegExp(`<h[23][^>]*id="${anchorId}"[^>]*>.*?</h[23]>`, 'i');
      const insertHtml = item.type ? diagramHtml(item) : imageHtml(item);
      html = html.replace(headingRegex, (match) => `${match}${insertHtml}`);
    }

    return html;
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

  const handleContentClick = useCallback((event) => {
    if (event.target.tagName === 'IMG') {
      setLightboxImage(event.target.src);
    }
  }, []);

  useEffect(() => {
    const contentElement = contentRef.current;
    if (!contentElement) return;

    contentElement.addEventListener('click', handleInlineLinkClick);
    contentElement.addEventListener('click', handleContentClick);
    contentElement.addEventListener('mouseover', handleInlineLinkHover);
    contentElement.addEventListener('mouseout', hideLinkPreview);

    return () => {
      contentElement.removeEventListener('click', handleInlineLinkClick);
      contentElement.removeEventListener('click', handleContentClick);
      contentElement.removeEventListener('mouseover', handleInlineLinkHover);
      contentElement.removeEventListener('mouseout', hideLinkPreview);
    };
  }, [handleInlineLinkClick, handleInlineLinkHover, hideLinkPreview, handleContentClick, note, internalLinks]);

  // Initialize Mermaid after content is rendered
  useEffect(() => {
    if (!contentRef.current) return;
    const mermaidElements = contentRef.current.querySelectorAll('.mermaid');
    if (mermaidElements.length === 0) return;

    let cancelled = false;

    loadMermaid()
      .then((mermaid) => {
        if (cancelled) return;
        mermaid.initialize({ startOnLoad: false, theme: 'default' });
        mermaid.run({ nodes: mermaidElements });
      })
      .catch((err) => console.error('Mermaid loading failed', err));

    return () => {
      cancelled = true;
    };
  }, [note, metadata]);

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

  function handleTocLinkClick(e, anchor) {
    e.preventDefault();
    const element = document.getElementById(anchor);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setTocOpen(false);
    }
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
  const finalContent = buildContentWithMetadata(enhancedContent, metadata);

  return (
    <>
      {/* Global Search Overlay */}
      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />

      {isBarFloating && createPortal(
        <div
          className="note-progress-bar note-progress-bar--floating"
          style={{ '--progress-width': `${readProgress}%` }}
          role="progressbar"
          aria-valuenow={readProgress}
          aria-valuemin="0"
          aria-valuemax="100"
        />,
        document.body
      )}

      {user && (
        <div className="note-progress-indicator">
          <i className={`fa-solid fa-circle-check ${progressSaved ? 'progress-saved' : 'progress-unsaved'}`}></i>
          {readProgress}% read {progressSaved && '· saved'}
        </div>
      )}

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

      {lightboxImage && createPortal(
        <div
          className="note-lightbox-overlay"
          onClick={() => setLightboxImage(null)}
        >
          <img src={lightboxImage} className="note-lightbox-image" alt="Lightbox" />
        </div>,
        document.body
      )}

      {toc.length > 0 && (
        <>
          <aside className="note-toc-sidebar">
            <h4 className="note-toc-title">
              <i className="fa-solid fa-list"></i> Contents
            </h4>
            <ul className="note-toc-list">
              {toc.map((item, index) => (
                <li key={index} className="note-toc-item" style={{ paddingLeft: `${(item.level - 2) * 12}px` }}>
                  <a
                    href={`#${item.anchor}`}
                    className="note-toc-link"
                    onClick={(e) => handleTocLinkClick(e, item.anchor)}
                  >
                    {item.text}
                  </a>
                </li>
              ))}
            </ul>
          </aside>

          <button
            className="note-toc-mobile-toggle"
            onClick={() => setTocOpen(!tocOpen)}
            aria-label="Toggle table of contents"
          >
            <i className={`fa-solid ${tocOpen ? 'fa-xmark' : 'fa-list'}`}></i>
          </button>

          {tocOpen && (
            <div className="note-toc-mobile-overlay" onClick={() => setTocOpen(false)}>
              <div className="note-toc-mobile-panel" onClick={(e) => e.stopPropagation()}>
                <h4 className="note-toc-title">Contents</h4>
                <ul className="note-toc-list">
                  {toc.map((item, index) => (
                    <li key={index} className="note-toc-item" style={{ paddingLeft: `${(item.level - 2) * 12}px` }}>
                      <a
                        href={`#${item.anchor}`}
                        className="note-toc-link"
                        onClick={(e) => handleTocLinkClick(e, item.anchor)}
                      >
                        {item.text}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </>
      )}

      <div className="note-detail-container">
        {/* Search button */}
        <button
          className="note-search-btn"
          onClick={() => setSearchOpen(true)}
          aria-label="Search notes"
        >
          <i className="fa-solid fa-magnifying-glass"></i> Search
        </button>

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
            <div
              ref={progressBarRef}
              className="note-progress-bar"
              style={{ '--progress-width': `${readProgress}%` }}
              role="progressbar"
              aria-valuenow={readProgress}
              aria-valuemin="0"
              aria-valuemax="100"
            />

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
            dangerouslySetInnerHTML={{ __html: finalContent || '<p>Content not available.</p>' }}
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
