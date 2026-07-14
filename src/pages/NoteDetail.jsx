 import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
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
    if (!subtopicId) { navigate('/notes'); return; }
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

  return (
    <>
      <div style={{ position: 'fixed', top: 0, left: 0, height: '3px', width: `${readProgress}%`, background: 'var(--gradient-cyan)', zIndex: 200, transition: 'width 0.3s ease' }}></div>

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
          <Link to="/">Home</Link><span>›</span>
          <Link to="/notes" style={{ color: 'var(--clr-cyan)', textDecoration: 'none' }}>Notes</Link><span>›</span>
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
              <Link to="/login" className="btn-primary" style={{ padding: '8px 20px', fontSize: 'var(--text-sm)' }}>Sign In</Link>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {comments.length === 0 ? (
              <p style={{ color: 'var(--clr-text-muted)', fontSize: 'var(--text-sm)', textAlign: 'center', padding: '1.5rem' }}>No comments yet. Be the first to share your thoughts.</p>
            ) : comments.filter(Boolean).map((c, idx) => (
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
    </>
  );
}
