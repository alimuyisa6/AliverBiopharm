 /* components/SearchOverlay/SearchOverlay.jsx */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Icon from '../Icon/Icon';
import { globalSearch } from '../../api/client';
import { useLayout } from '../../contexts/LayoutContext';

const CATEGORIES = [
  { key: 'note', label: 'Notes', icon: 'book-open', path: (item) => `/notes/read?id=${item.id}` },
  { key: 'glossary_term', label: 'Glossary', icon: 'book-open', path: (item) => `/glossary/${item.slug}` },
  { key: 'past_paper', label: 'Past Papers', icon: 'file-lines', path: () => '/past-papers' },
  { key: 'flashcard_deck', label: 'Flashcards', icon: 'layer-group', path: () => '/flashcards' },
  { key: 'curriculum_unit', label: 'Quizzes', icon: 'clipboard-check', path: () => '/quiz' },
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
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
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
      try {
        const data = await globalSearch(value.trim(), activeGroupId ? { group_id: activeGroupId } : {});
        setResults(data);
      } catch {
        setResults(null);
      } finally {
        setLoading(false);
      }
    }, 350);
  }, [activeGroupId]);

  const handleChange = (e) => {
    setQuery(e.target.value);
    runSearch(e.target.value);
  };

  const handleResultClick = (url) => {
    onClose();
    navigate(url);
  };

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
            <div className="search-results">
              <div style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
                <div className="spinner" />
              </div>
            </div>
          )}
          {!loading && hasResults && (
            <div className="search-results">
              {CATEGORIES.map((cat) => {
                const items = results.results.filter((r) => r.type === cat.key);
                if (!items.length) return null;
                return (
                  <div key={cat.key} className="search-result-group">
                    <div className="search-result-group-label">{cat.label}</div>
                    {items.map((item, idx) => (
                      <button
                        key={idx}
                        className="search-result-item"
                        onClick={() => handleResultClick(cat.path(item))}
                      >
                        <Icon name={cat.icon} className="search-result-icon" />
                        <div>
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
