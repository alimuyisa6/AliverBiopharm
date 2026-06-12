import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getNoteContent, saveReadingProgress, getReadingProgress } from '../api/client';

export default function NotePage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [note, setNote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savedProgress, setSavedProgress] = useState(0);
  const contentRef = useRef(null);
  const startTime = useRef(Date.now());
  const scrollTimeout = useRef(null);

  useEffect(() => {
    loadNote();
    return () => {
      if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
      if (note && user) {
        const scrollPercent = getScrollPercentage();
        const timeSpent = Math.floor((Date.now() - startTime.current) / 1000);
        saveReadingProgress(id, scrollPercent, window.scrollY, timeSpent);
      }
    };
  }, [id, user]);

  useEffect(() => {
    if (!note || !contentRef.current || !user) return;
    if (savedProgress > 0) {
      const totalHeight = contentRef.current.scrollHeight - window.innerHeight;
      window.scrollTo(0, totalHeight * (savedProgress / 100));
    }
  }, [note, savedProgress, user]);

  async function loadNote() {
    setLoading(true);
    try {
      const data = await getNoteContent(id);
      setNote(data);
      if (user) {
        try {
          const prog = await getReadingProgress(id);
          if (prog) setSavedProgress(prog.scroll_percentage || 0);
        } catch {}
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function getScrollPercentage() {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    if (docHeight <= 0) return 0;
    return Math.floor((scrollTop / docHeight) * 100);
  }

  function handleScroll() {
    if (!note || !user) return;
    if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
    scrollTimeout.current = setTimeout(async () => {
      const percent = getScrollPercentage();
      const timeSpent = Math.floor((Date.now() - startTime.current) / 1000);
      await saveReadingProgress(id, percent, window.scrollY, timeSpent, percent >= 100);
    }, 1000);
  }

  useEffect(() => {
    if (user) {
      window.addEventListener('scroll', handleScroll);
      return () => window.removeEventListener('scroll', handleScroll);
    }
  }, [note, user]);

  if (loading) return <div className="section" style={{ textAlign: 'center', padding: '2rem' }}>Loading note...</div>;
  if (!note) return <div className="section" style={{ textAlign: 'center', padding: '2rem' }}>Note not found.</div>;

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem' }}>
      <Link to="/" className="btn-secondary" style={{ display: 'inline-block', marginBottom: '1rem' }}>← Back to Home</Link>
      <article ref={contentRef}>
        <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>{note.title}</h1>
        <div dangerouslySetInnerHTML={{ __html: note.content || '<p>No content available.</p>' }} />
      </article>
      {user && savedProgress > 0 && (
        <div style={{ marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid var(--clr-border-glow)', color: 'var(--clr-text-muted)' }}>
          📖 You've read {savedProgress}% of this note.
        </div>
      )}
    </div>
  );
}
