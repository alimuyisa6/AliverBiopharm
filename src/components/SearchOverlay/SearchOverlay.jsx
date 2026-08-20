 import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Icon from '../Icon/Icon';
import { globalSearch, searchNotes } from '../../api/client';
import { useLayout } from '../../contexts/LayoutContext';

const CATEGORIES = [
  { key: 'note', label: 'Notes', icon: 'book-open', path: (item) => `/notes/read?id=${item.id}` },
  { key: 'glossary_term', label: 'Glossary', icon: 'book-open', path: (item) => `/glossary/${item.slug}` },
  { key: 'past_paper', label: 'Past Papers', icon: 'file-lines', path: () => '/past-papers' },
  { key: 'flashcard_deck', label: 'Flashcards', icon: 'layer-group', path: () => '/flashcards' },
  { key: 'curriculum_unit', label: 'Quizzes', icon: 'clipboard-check', path: () => '/quiz' }
];

export default function SearchOverlay({ open, onClose }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);
  const navigate = useNavigate();
  const { level, activeGroupId } = useLayout();

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 150);
    } else {
      setQuery('');
      setResults(null);
    }
  }, [open]);

  useEffect(() => {
    const handler = (event) => {
      if (event.key === 'Escape') onClose();
    };

    if (open) document.addEventListener('keydown', handler);

    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const runSearch = useCallback((value) => {
    clearTimeout(debounceRef.current);

    if (value.trim().length < 2) {
      setResults(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    debounceRef.current = setTimeout(async () => {
      const trimmedQuery = value.trim();

      try {
        // Run both searches in parallel
        const [globalResults, noteResults] = await Promise.allSettled([
          globalSearch(trimmedQuery, activeGroupId ? { group_id: activeGroupId } : {}),
          searchNotes(trimmedQuery, 20)
        ]);

        // Extract global results (other categories + possibly notes)
        const globalData = globalResults.status === 'fulfilled' ? globalResults.value : { results: [] };
        const otherResults = (globalData.results || []).filter(
          (item) => item.type !== 'note'
        );

        // Map full‑text note results to expected shape
        const fullTextNotes = noteResults.status === 'fulfilled'
          ? noteResults.value.map((note) => ({
              type: 'note',
              id: note.id,
              title: note.title,
              preview: note.snippet || note.content_preview || '',
              slug: note.slug,
              read_time: note.read_time,
              word_count: note.word_count
            }))
          : [];

        // Merge: other categories + full‑text notes
        const mergedResults = [...otherResults, ...fullTextNotes];

        setResults({ results: mergedResults });
      } catch {
        setResults(null);
      } finally {
        setLoading(false);
      }
    }, 350);
  }, [activeGroupId]);

  function handleChange(event) {
    setQuery(event.target.value);
    runSearch(event.target.value);
  }

  function handleResultClick(url) {
    onClose();
    navigate(url);
  }

  const hasResults = results?.results?.length > 0;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="search-overlay"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.2 }}
        >
          <div className="search-input-wrapper">
            <Icon name="magnifying-glass" className="search-input-icon" />
            <input
              ref={inputRef}
              type="text"
              className="search-input"
              placeholder={`Search ${level?.display_name || ''} resources...`}
              value={query}
              onChange={handleChange}
            />
            <button className="search-close" onClick={onClose}>
              <Icon name="xmark" />
            </button>
          </div>

          {loading && (
            <div className="search-results search-loading">
              <div className="spinner" />
            </div>
          )}

          {!loading && hasResults && (
            <div className="search-results">
              {CATEGORIES.map((category) => {
                const items = results.results.filter((item) => item.type === category.key);

                if (!items.length) return null;

                return (
                  <div key={category.key} className="search-result-group">
                    <div className="search-result-group-label">{category.label}</div>

                    {items.map((item, idx) => (
                      <button
                        key={idx}
                        className="search-result-item"
                        onClick={() => handleResultClick(category.path(item))}
                      >
                        <Icon name={category.icon === 'dna' ? 'microscope' : category.icon} className="search-result-icon" />
                        <div className="search-result-content">
                          <div className="search-result-title">{item.title}</div>
                          {item.preview && <div className="search-result-meta">{item.preview}</div>}
                        </div>
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          )}

          {!loading && query.length >= 2 && !hasResults && (
            <div className="search-results">
              <div className="search-empty">No results for "{query}"</div>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
