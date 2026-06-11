import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getNoteContent, saveReadingProgress, getReadingProgress } from '../api/client';
import { useAuth } from '../contexts/AuthContext';

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

  if (loading) return <div className="text-center py-20">Loading note...</div>;
  if (!note) return <div className="text-center py-20">Note not found.</div>;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Link to="/" className="text-teal-600 mb-4 inline-block">← Back to Home</Link>
      <article ref={contentRef}>
        <h1 className="text-3xl font-bold mb-4">{note.title}</h1>
        <div dangerouslySetInnerHTML={{ __html: note.content || '<p>Content not available.</p>' }} />
      </article>
      {user && savedProgress > 0 && (
        <div className="mt-8 text-sm text-gray-500 border-t pt-4">
          You've read {savedProgress}% of this note.
        </div>
      )}
    </div>
  );
}
