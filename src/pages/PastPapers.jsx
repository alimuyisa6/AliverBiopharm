 /* pages/PastPapers.jsx */
import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLevelFilter } from '../hooks/useLevelFilter';
import {
  getPastPapers,
  getPastPaperFilterOptions,
  getPastPaperDownloadUrl,
  togglePaperBookmark,
  getBookmarkedPapers,
  trackPaperView,
  getDownloadHistory
} from '../api/client';
import Icon from '../components/Icon/Icon';
import Spinner from '../components/Spinner/Spinner';
import Button from '../components/Button/Button';
import Select from '../components/Select/Select';
import EmptyState from '../components/EmptyState/EmptyState';
import { useToast } from '../components/Toast/Toast';
import { useLayout } from '../contexts/LayoutContext';

const TABS = [
  { key: 'all', label: 'All Papers' },
  { key: 'bookmarked', label: 'Bookmarked' },
  { key: 'downloaded', label: 'Downloaded' }
];

export default function PastPapers() {
  const { user } = useAuth();
  const { level, class_name, showAll, displayName } = useLevelFilter();
  const { bootstrap } = useLayout();
  const addToast = useToast();

  const [initializing, setInitializing] = useState(true);
  const [papers, setPapers] = useState([]);
  const [filterOptions, setFilterOptions] = useState({
    subjects: [],
    years: [],
    exam_boards: [],
    paper_types: []
  });
  const [filters, setFilters] = useState({
    subject: '',
    year: '',
    exam_board: '',
    paper_type: ''
  });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [papersLoading, setPapersLoading] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [bookmarkedIds, setBookmarkedIds] = useState(new Set());
  const [downloadedIds, setDownloadedIds] = useState(new Set());

  const effectiveLevel = showAll ? null : level;
  const effectiveClass = showAll ? null : class_name;

  function getEmptyStateImage(key) {
    const uiComponents = bootstrap?.ui_components || [];
    const component = uiComponents.find((item) => item.component_key === `empty_state_${key}`);

    return component?.properties?.image_url || null;
  }

  useEffect(() => {
    getPastPaperFilterOptions()
      .then(setFilterOptions)
      .catch(() => {})
      .finally(() => setInitializing(false));
  }, []);

  useEffect(() => {
    setPage(1);
  }, [effectiveLevel, effectiveClass, activeTab]);

  useEffect(() => {
    if (user) {
      loadUserInteractions();
    }
  }, [user]);

  useEffect(() => {
    loadPapers();
  }, [filters, page, effectiveLevel, effectiveClass, activeTab]);

  const loadUserInteractions = async () => {
    try {
      const [bookmarked, downloaded] = await Promise.all([
        getBookmarkedPapers(1, 100),
        getDownloadHistory(1, 100)
      ]);

      setBookmarkedIds(new Set((bookmarked.papers || []).map((paper) => paper.id)));
      setDownloadedIds(new Set((downloaded.papers || []).map((paper) => paper.id)));
    } catch {}
  };

  const loadPapers = async () => {
    setPapersLoading(true);

    try {
      let result;

      if (activeTab === 'bookmarked') {
        result = await getBookmarkedPapers(page, 12);
      } else if (activeTab === 'downloaded') {
        result = await getDownloadHistory(page, 12);
      } else {
        const params = { page, limit: 12 };

        if (effectiveLevel) params.level = effectiveLevel;
        if (effectiveClass) params.class_name = effectiveClass;
        if (filters.subject) params.subject = filters.subject;
        if (filters.year) params.year = filters.year;
        if (filters.exam_board) params.exam_board = filters.exam_board;
        if (filters.paper_type) params.paper_type = filters.paper_type;

        result = await getPastPapers(params);
      }

      setPapers(result.papers || []);
      setTotalPages(result.total_pages || 1);
      setTotal(result.total || 0);
    } catch {
      addToast('Failed to load papers', 'error');
    } finally {
      setPapersLoading(false);
    }
  };

  const handleDownload = async (paper) => {
    if (!user) {
      addToast('Please sign in to download', 'warning');
      return;
    }

    if (paper.locked || paper.is_premium) {
      addToast('This paper requires premium access', 'warning');
      return;
    }

    setDownloadingId(paper.id);

    try {
      const result = await getPastPaperDownloadUrl(paper.id);
      const anchor = document.createElement('a');

      anchor.href = result.url;
      anchor.download = `${paper.title}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);

      setDownloadedIds((prev) => new Set([...prev, paper.id]));
      addToast('Download started', 'success');
    } catch (error) {
      if (error.status === 403) {
        addToast('Premium access required for this paper', 'warning');
      } else {
        addToast('Download failed', 'error');
      }
    } finally {
      setDownloadingId(null);
    }
  };

  const handleBookmark = async (paperId) => {
    if (!user) {
      addToast('Please sign in to bookmark', 'warning');
      return;
    }

    try {
      const result = await togglePaperBookmark(paperId);

      setBookmarkedIds((prev) => {
        const next = new Set(prev);

        if (result.bookmarked) {
          next.add(paperId);
        } else {
          next.delete(paperId);
        }

        return next;
      });

      if (activeTab === 'bookmarked') {
        loadPapers();
      }
    } catch {
      addToast('Failed to update bookmark', 'error');
    }
  };

  const handlePaperOpen = async (paper) => {
    if (user) {
      try {
        await trackPaperView(paper.id);
      } catch {}
    }
  };

  const clearFilters = () => {
    setFilters({ subject: '', year: '', exam_board: '', paper_type: '' });
    setPage(1);
  };

  const activeFilterCount = [
    filters.subject,
    filters.year,
    filters.exam_board,
    filters.paper_type
  ].filter(Boolean).length;

  if (initializing) {
    return (
      <div className="section" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <Spinner size="lg" />
      </div>
    );
  }

  const levelName = displayName || level || '';
  const classLabel = class_name || '';

  return (
    <div className="past-papers-page">
      <div className="past-papers-hero">
        <div className="past-papers-hero-inner">
          <div className="past-papers-hero-content">
            <span className="past-papers-eyebrow">
              <span className="past-papers-eyebrow-line" />
              Exam Preparation
            </span>
            <h1 className="past-papers-title">
              Past Papers
              {levelName && <span className="past-papers-title-dim"> · {levelName}</span>}
            </h1>
            {classLabel && <p className="past-papers-subtitle">{classLabel}</p>}

            <nav className="breadcrumb">
              <Link to="/"><Icon name="home" className="breadcrumb-icon" /> Home</Link>
              <Icon name="chevron-right" className="breadcrumb-sep" />
              <span>Past Papers</span>
            </nav>

            <div className="past-papers-meta">
              <span className="past-papers-meta-item">
                <strong>{total}</strong> papers
              </span>
              <span className="past-papers-meta-divider" />
              <span className="past-papers-meta-item">
                <strong>{filterOptions.years.length || '—'}</strong> years
              </span>
              <span className="past-papers-meta-divider" />
              <span className="past-papers-meta-item">
                <strong>{filterOptions.subjects.length || '—'}</strong> subjects
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="section" style={{ paddingTop: 'var(--space-6)' }}>
        {!user && (
          <div className="alert alert-info" style={{ marginBottom: 'var(--space-6)' }}>
            <Icon name="lock" /> Sign in to download papers. You can browse freely.
          </div>
        )}

        <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-6)', flexWrap: 'wrap' }}>
          {TABS.map((tab) => (
            <Button
              key={tab.key}
              variant={activeTab === tab.key ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
              {tab.key === 'bookmarked' && bookmarkedIds.size > 0 && (
                <span className="badge badge-primary">{bookmarkedIds.size}</span>
              )}
              {tab.key === 'downloaded' && downloadedIds.size > 0 && (
                <span className="badge badge-primary">{downloadedIds.size}</span>
              )}
            </Button>
          ))}
        </div>

        {activeTab === 'all' && (
          <div className="past-papers-toolbar">
            <Button variant={showFilters ? 'primary' : 'secondary'} size="sm" onClick={() => setShowFilters((value) => !value)}>
              <Icon name="filter" /> Filters
              {activeFilterCount > 0 && <span className="badge badge-primary">{activeFilterCount}</span>}
            </Button>

            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <Icon name="xmark" /> Clear filters
              </Button>
            )}

            <p className="past-papers-count">
              {papersLoading ? 'Loading...' : `${total} paper${total !== 1 ? 's' : ''} found`}
            </p>
          </div>
        )}

        {showFilters && activeTab === 'all' && (
          <div className="past-papers-filters">
            <Select
              label="Subject"
              options={filterOptions.subjects.map((subject) => ({ value: subject, label: subject }))}
              value={filters.subject}
              onChange={(event) => setFilters((prev) => ({ ...prev, subject: event.target.value }))}
            />
            <Select
              label="Year"
              options={filterOptions.years.map((year) => ({ value: String(year), label: String(year) }))}
              value={filters.year}
              onChange={(event) => setFilters((prev) => ({ ...prev, year: event.target.value }))}
            />
            <Select
              label="Exam Board"
              options={filterOptions.exam_boards.map((board) => ({ value: board, label: board }))}
              value={filters.exam_board}
              onChange={(event) => setFilters((prev) => ({ ...prev, exam_board: event.target.value }))}
            />
            <Select
              label="Paper Type"
              options={filterOptions.paper_types.map((type) => ({ value: type, label: type }))}
              value={filters.paper_type}
              onChange={(event) => setFilters((prev) => ({ ...prev, paper_type: event.target.value }))}
            />
          </div>
        )}

        {papersLoading ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-10)' }}>
            <Spinner size="lg" />
          </div>
        ) : papers.length === 0 ? (
          <EmptyState
            image={getEmptyStateImage('past_papers')}
            title={activeTab === 'bookmarked' ? 'No Bookmarked Papers' : activeTab === 'downloaded' ? 'No Downloads Yet' : 'No Papers Found'}
            description={
              activeTab === 'bookmarked'
                ? 'Bookmark papers to find them here later.'
                : activeTab === 'downloaded'
                  ? 'Papers you download will appear here.'
                  : `No past papers match your filters for ${classLabel || levelName || 'your level'}.`
            }
            action={
              activeTab === 'all' && (
                <Button variant="secondary" onClick={clearFilters}>Clear Filters</Button>
              )
            }
          />
        ) : (
          <div className="past-papers-grid">
            {papers.map((paper) => (
              <div key={paper.id} className={`card paper-card${paper.is_premium ? ' paper-card-premium' : ''}`}>
                <div className="card-image-placeholder paper-card-icon">
                  <Icon name="file-pdf" style={{ fontSize: '2.5rem', color: 'var(--error)' }} />
                  {paper.is_premium && (
                    <span className="paper-premium-badge">
                      <Icon name="crown" /> Premium
                    </span>
                  )}
                </div>

                <div className="card-body">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-2)' }}>
                    <h3 className="card-title">{paper.title}</h3>
                    <button
                      className={`paper-bookmark-btn${bookmarkedIds.has(paper.id) ? ' active' : ''}`}
                      onClick={() => handleBookmark(paper.id)}
                      aria-label={bookmarkedIds.has(paper.id) ? 'Remove bookmark' : 'Bookmark paper'}
                    >
                      <Icon name={bookmarkedIds.has(paper.id) ? 'bookmark-solid' : 'bookmark'} />
                    </button>
                  </div>
                  <p className="card-text">{paper.subject}</p>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginTop: 'var(--space-3)' }}>
                    {paper.level && <span className="chip">{paper.level}</span>}
                    {paper.year && <span className="chip chip-accent">{paper.year}</span>}
                    {paper.paper_type && <span className="chip chip-primary">{paper.paper_type}</span>}
                    {paper.class_name && <span className="chip">{paper.class_name}</span>}
                    {downloadedIds.has(paper.id) && (
                      <span className="chip chip-success">
                        <Icon name="check" /> Downloaded
                      </span>
                    )}
                  </div>
                </div>

                <div className="card-footer">
                  <Button
                    size="sm"
                    loading={downloadingId === paper.id}
                    onClick={() => handleDownload(paper)}
                    variant={paper.is_premium ? 'warm' : 'primary'}
                  >
                    <Icon name={paper.is_premium ? 'lock' : 'download'} />
                    {paper.is_premium ? 'Premium Download' : user ? 'Download' : 'Sign in to Download'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="past-papers-pagination">
            <Button variant="secondary" size="sm" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1}>
              <Icon name="chevron-left" />
            </Button>

            {Array.from({ length: totalPages }, (_, index) => index + 1)
              .filter((item) => item === 1 || item === totalPages || Math.abs(item - page) <= 2)
              .map((item) => (
                <Button
                  key={item}
                  variant={item === page ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setPage(item)}
                >
                  {item}
                </Button>
              ))}

            <Button variant="secondary" size="sm" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page === totalPages}>
              <Icon name="chevron-right" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
