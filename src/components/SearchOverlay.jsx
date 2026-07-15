import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaMagnifyingGlass, FaXmark, FaSpinner, FaBookOpen, FaBook,
  FaFileLines, FaLayerGroup, FaClipboardQuestion, FaArrowRight
} from 'react-icons/fa6';
import { globalSearch } from '../api/client';
import '../styles/Search.css';

const panelVariants = {
  hidden: { height: 0, opacity: 0 },
  visible: { height: 'auto', opacity: 1 },
  exit: { height: 0, opacity: 0 },
};

const CATEGORY_CONFIG = [
  {
    key: 'notes',
    label: 'Notes',
    icon: FaBookOpen,
    path: (item) => `/notes/read?id=${item.subtopic_id}`,
    title: (item) => item.subtopic_name,
    meta: (item) => `${item.topic} · ${item.level}`,
  },
  {
    key: 'glossary',
    label: 'Glossary',
    icon: FaBook,
    path: (item) => `/glossary/${item.slug}?level=${(item.levels && item.levels[0]) || ''}`,
    title: (item) => item.term,
    meta: (item) => item.plain_definition,
  },
  {
    key: 'past_papers',
    label: 'Past Papers',
    icon: FaFileLines,
    path: () => '/past-papers',
    title: (item) => item.title,
    meta: (item) => `${item.subject} · ${item.year}`,
  },
  {
    key: 'flashcards',
    label: 'Flashcards',
    icon: FaLayerGroup,
    path: () => '/flashcards',
    title: (item) => item.title,
    meta: (item) => item.category,
  },
  {
    key: 'quizzes',
    label: 'Quizzes',
    icon: FaClipboardQuestion,
    path: () => '/quiz',
    title: (item) => item.topic_name,
    meta: (item) => item.level,
  },
];

export default function SearchOverlay({ isOpen, onClose }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);
  const debounceRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen) {
      const timeoutId = setTimeout(() => inputRef.current?.focus(), 150);
      return () => clearTimeout(timeoutId);
    }
    setQuery('');
    setResults(null);
    setError('');
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    return () => clearTimeout(debounceRef.current);
  }, []);

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
        const data = await globalSearch(value.trim());
        setResults(data);
        setError('');
      } catch (err) {
        setError(err.message || 'Search failed');
        setResults(null);
      } finally {
        setLoading(false);
      }
    }, 350);
  }, []);

  function handleChange(e) {
    const value = e.target.value;
    setQuery(value);
    runSearch(value);
  }

  function handleResultClick(url) {
    onClose();
    navigate(url);
  }

  const hasResults = results && CATEGORY_CONFIG.some((cat) => (results[cat.key] || []).length > 0);
  const showEmpty = results && !hasResults && query.trim().length >= 2 && !loading;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="search-overlay-panel"
          variants={panelVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          transition={{ duration: 0.25, ease: 'easeInOut' }}
        >
          <div className="search-overlay-inner">
            <div className="search-input-row">
              <FaMagnifyingGlass className="search-input-icon" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={handleChange}
                placeholder="Search notes, glossary, past papers, flashcards, quizzes..."
                className="search-input"
                aria-label="Search"
              />
              {loading && <FaSpinner className="icon-spin search-loading-icon" />}
              <button className="search-close-btn" onClick={onClose} aria-label="Close search" type="button">
                <FaXmark />
              </button>
            </div>

            {error && <div className="search-error">{error}</div>}
            {showEmpty && <div className="search-empty">No results for "{query.trim()}"</div>}

            {hasResults && (
              <div className="search-results">
                {CATEGORY_CONFIG.map((cat) => {
                  const items = results[cat.key] || [];
                  if (items.length === 0) return null;
                  const Icon = cat.icon;
                  return (
                    <div key={cat.key} className="search-result-group">
                      <div className="search-result-group-label">{cat.label}</div>
                      {items.map((item, idx) => (
                        <button
                          key={idx}
                          className="search-result-item"
                          onClick={() => handleResultClick(cat.path(item))}
                          type="button"
                        >
                          <Icon className="search-result-item-icon" />
                          <div className="search-result-item-text">
                            <div className="search-result-item-title">{cat.title(item)}</div>
                            {cat.meta(item) && <div className="search-result-item-meta">{cat.meta(item)}</div>}
                          </div>
                          <FaArrowRight className="search-result-item-arrow" />
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
