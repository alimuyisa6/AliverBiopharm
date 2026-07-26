 import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLevelFilter } from '../hooks/useLevelFilter';
import {
  getPastPapers,
  getPastPaperFilterOptions,
  getPastPaperDownloadUrl
} from '../api/client';
import {
  FaLock,
  FaFilter,
  FaChevronDown,
  FaFilePdf,
  FaDownload,
  FaSpinner,
  FaChevronLeft,
  FaChevronRight,
  FaXmark,
  FaHouse
} from 'react-icons/fa6';

const LEVEL_ACCENTS = {
  'O-Level': 'var(--clr-cyan)',
  'A-Level': 'var(--clr-magenta)',
  'Pharmacy': 'var(--clr-green)'
};

function getLevelAccent(level) {
  return LEVEL_ACCENTS[level] || 'var(--clr-cyan)';
}

export default function PastPapers() {
  const { user } = useAuth();
  const { level, class_name, showAll, classLabel } = useLevelFilter();

  const [initializing, setInitializing] = useState(true);
  const [papers, setPapers] = useState([]);
  const [filterOptions, setFilterOptions] = useState({ levels: [], subjects: [], years: [], exam_boards: [], paper_types: [], topics: [] });
  const [filters, setFilters] = useState({ subject: '', year: '', exam_board: '', paper_type: '', topic: '' });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [papersLoading, setPapersLoading] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);
  const [filterAccordions, setFilterAccordions] = useState({ subject: false, year: false, exam_board: false, paper_type: false });
  const [authPrompt, setAuthPrompt] = useState(false);

  const effectiveLevel = showAll ? null : level;
  const effectiveClass = showAll ? null : class_name;

  useEffect(() => {
    const init = async () => {
      try {
        const opts = await getPastPaperFilterOptions();
        setFilterOptions(opts);
      } catch (err) {
        console.error(err);
      }
      setInitializing(false);
    };
    init();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [effectiveLevel, effectiveClass]);

  useEffect(() => {
    loadPapers();
  }, [filters, page, effectiveLevel, effectiveClass]);

  async function loadPapers() {
    setPapersLoading(true);
    try {
      const params = { page, limit: 12 };
      if (effectiveLevel) params.level = effectiveLevel;
      if (effectiveClass) params.class_name = effectiveClass;
      if (filters.subject) params.subject = filters.subject;
      if (filters.year) params.year = filters.year;
      if (filters.exam_board) params.exam_board = filters.exam_board;
      if (filters.paper_type) params.paper_type = filters.paper_type;
      if (filters.topic) params.topic = filters.topic;
      const result = await getPastPapers(params);
      setPapers(result.papers || []);
      setTotalPages(result.total_pages || 1);
      setTotal(result.total || 0);
    } catch (err) {
      console.error(err);
    }
    setPapersLoading(false);
  }

  function setFilter(key, value) {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1);
  }

  function clearFilters() {
    setFilters({ subject: '', year: '', exam_board: '', paper_type: '', topic: '' });
    setPage(1);
  }

  async function handleDownload(paper) {
    if (!user) { setAuthPrompt(true); return; }
    setDownloadingId(paper.id);
    try {
      const result = await getPastPaperDownloadUrl(paper.id);
      const a = document.createElement('a');
      a.href = result.url;
      a.download = paper.title + '.pdf';
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      alert('Download failed: ' + err.message);
    }
    setDownloadingId(null);
  }

  const activeFilterCount = [filters.subject, filters.year, filters.exam_board, filters.paper_type, filters.topic].filter(Boolean).length;

  if (initializing) {
    return (
      <div className="past-papers-page">
        <div className="pp-loading">
          <div className="pdf-loading-spinner">
            <div className="spinner-dot dot-magenta"></div>
            <div className="spinner-dot dot-cyan"></div>
            <div className="spinner-dot dot-orange"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="past-papers-page">
      <span className="sec-label">EXAM PREPARATION</span>
      <h1 className="section-title">Past Papers</h1>
      <p className="section-subtitle">Download past examination papers for O-Level, A-Level and Pharmacy. Practice with real exam questions.</p>

      <div className="breadcrumb">
        <Link to="/"><FaHouse className="breadcrumb-icon" /> Home</Link><span>›</span><span>Past Papers</span>
        {effectiveLevel && (<><span>›</span><span>{effectiveLevel}</span></>)}
        {effectiveClass && (<><span>›</span><span>{classLabel || 'Class'}: {effectiveClass}</span></>)}
      </div>

      {!user && (
        <div className="pp-auth-banner">
          <FaLock className="pp-auth-banner-icon" />
          <div className="pp-auth-banner-text">
            <p className="pp-auth-banner-title">Sign in to download papers</p>
            <p className="pp-auth-banner-sub">You can browse all papers freely. Create a free account to download.</p>
          </div>
          <div className="pp-auth-banner-actions">
            <Link to="/login" className="btn-secondary">Sign In</Link>
            <Link to="/register" className="btn-primary">Register Free</Link>
          </div>
        </div>
      )}

      <div className="pp-controls">
        <div className="pp-filter-wrap">
          <button
            className={`pp-filter-toggle${filterDropdownOpen ? ' open' : ''}`}
            onClick={() => setFilterDropdownOpen(!filterDropdownOpen)}
          >
            <FaFilter className="pp-icon-filter" />
            Filters
            {activeFilterCount > 0 && <span className="pp-filter-badge">{activeFilterCount}</span>}
            <FaChevronDown className="pp-chevron" />
          </button>

          {filterDropdownOpen && (
            <div className="pp-filter-panel">
              {[
                { key: 'subject', label: 'Subject', options: filterOptions.subjects },
                { key: 'year', label: 'Year', options: filterOptions.years.map(String) },
                { key: 'exam_board', label: 'Exam Board', options: filterOptions.exam_boards },
                { key: 'paper_type', label: 'Paper Type', options: filterOptions.paper_types }
              ].map(({ key, label, options }) => (
                <div key={key} className="filter-accordion">
                  <button
                    className={`filter-accordion-btn${filterAccordions[key] ? ' open' : ''}`}
                    onClick={() => setFilterAccordions(prev => ({ ...prev, [key]: !prev[key] }))}
                  >
                    <span>{label}</span>
                    <span className="filter-selected">{filters[key] || 'All'}</span>
                    <FaChevronDown className="pp-chevron" />
                  </button>
                  {filterAccordions[key] && (
                    <div className="filter-options open">
                      <label className="filter-option">
                        <input type="radio" name={key} checked={!filters[key]} onChange={() => setFilter(key, '')} /> All
                      </label>
                      {options.map(opt => (
                        <label key={opt} className="filter-option">
                          <input type="radio" name={key} checked={filters[key] === opt} onChange={() => setFilter(key, opt)} /> {opt}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {activeFilterCount > 0 && (
                <button className="pp-filter-clear" onClick={() => { clearFilters(); setFilterDropdownOpen(false); }}>
                  <FaXmark /> Clear all filters
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="pp-results-bar">
        <p className="pp-results-count">
          {papersLoading ? 'Loading...' : `${total} paper${total !== 1 ? 's' : ''} found`}
        </p>
        {activeFilterCount > 0 && (
          <button className="pp-clear-btn" onClick={clearFilters}>
            <FaXmark /> Clear filters
          </button>
        )}
      </div>

      {papersLoading ? (
        <div className="pp-loading">
          <div className="pdf-loading-spinner">
            <div className="spinner-dot dot-magenta"></div>
            <div className="spinner-dot dot-cyan"></div>
            <div className="spinner-dot dot-orange"></div>
          </div>
        </div>
      ) : papers.length === 0 ? (
        <div className="pp-empty">
          <FaFilePdf className="pp-empty-icon" />
          <p className="pp-empty-title">No papers found</p>
          <p className="pp-empty-sub">Try adjusting your filters.</p>
          <button onClick={clearFilters} className="btn-secondary">Clear filters</button>
        </div>
      ) : (
        <div className="pp-grid">
          {papers.map(paper => (
            <div key={paper.id} className="pp-card" style={{ '--level-accent': getLevelAccent(paper.level) }}>
              <div className="pp-card-header">
                <div className="pp-card-icon">
                  <FaFilePdf />
                </div>
                <div className="pp-card-header-text">
                  <h3 className="pp-card-title">{paper.title}</h3>
                  <p className="pp-card-subject">{paper.subject}</p>
                </div>
              </div>

              <div className="pp-tags">
                <span className="pp-tag pp-tag-level">{paper.level}</span>
                {paper.year && <span className="pp-tag pp-tag-year">{paper.year}</span>}
                {paper.paper_type && <span className="pp-tag pp-tag-type">{paper.paper_type}</span>}
                {paper.exam_board && <span className="pp-tag pp-tag-board">{paper.exam_board}</span>}
                {paper.topic && <span className="pp-tag pp-tag-topic">{paper.topic}</span>}
                {paper.class_name && <span className="pp-tag pp-tag-class">{paper.class_name}</span>}
              </div>

              {paper.download_count > 0 && (
                <p className="pp-downloads">
                  <FaDownload /> {paper.download_count} downloads
                </p>
              )}

              <div className="pp-card-footer">
                <button
                  onClick={() => handleDownload(paper)}
                  disabled={downloadingId === paper.id}
                  className={`pp-download-btn${user ? ' authed' : ''}`}
                >
                  {downloadingId === paper.id ? (
                    <><FaSpinner className="icon-spin" /> Downloading...</>
                  ) : user ? (
                    <><FaDownload /> Download</>
                  ) : (
                    <><FaLock /> Sign in to Download</>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="pp-pagination">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="btn-secondary pp-page-nav"
          >
            <FaChevronLeft />
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
            .reduce((acc, p, idx, arr) => {
              if (idx > 0 && p - arr[idx - 1] > 1) acc.push('...');
              acc.push(p);
              return acc;
            }, [])
            .map((p, idx) => p === '...' ? (
              <span key={`ellipsis-${idx}`} className="pp-page-ellipsis">...</span>
            ) : (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`pp-page-btn${p === page ? ' active' : ''}`}
              >
                {p}
              </button>
            ))}
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="btn-secondary pp-page-nav"
          >
            <FaChevronRight />
          </button>
        </div>
      )}

      {authPrompt && (
        <div className="pp-auth-modal-overlay" onClick={() => setAuthPrompt(false)}>
          <div className="pp-auth-modal" onClick={e => e.stopPropagation()}>
            <FaLock className="pp-auth-modal-icon" />
            <h3 className="pp-auth-modal-title">Sign in to Download</h3>
            <p className="pp-auth-modal-text">Create a free account to download past papers and track your progress.</p>
            <div className="pp-auth-modal-actions">
              <Link to="/login" className="btn-secondary">Sign In</Link>
              <Link to="/register" className="btn-primary">Register Free</Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
