 /* pages/PastPapers.jsx */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLevelFilter } from '../hooks/useLevelFilter';
import {
  getPastPapers,
  getPastPaperFilterOptions,
  getPastPaperDownloadUrl
} from '../api/client';
import Icon from '../components/Icon/Icon';
import Spinner from '../components/Spinner/Spinner';
import Button from '../components/Button/Button';
import Select from '../components/Select/Select';
import EmptyState from '../components/EmptyState/EmptyState';
import { useToast } from '../components/Toast/Toast';
import { useLayout } from '../contexts/LayoutContext';

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
  }, [effectiveLevel, effectiveClass]);

  useEffect(() => {
    loadPapers();
  }, [filters, page, effectiveLevel, effectiveClass]);

  const loadPapers = async () => {
    setPapersLoading(true);

    try {
      const params = { page, limit: 12 };

      if (effectiveLevel) params.level = effectiveLevel;
      if (effectiveClass) params.class_name = effectiveClass;
      if (filters.subject) params.subject = filters.subject;
      if (filters.year) params.year = filters.year;
      if (filters.exam_board) params.exam_board = filters.exam_board;
      if (filters.paper_type) params.paper_type = filters.paper_type;

      const result = await getPastPapers(params);

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

    setDownloadingId(paper.id);

    try {
      const result = await getPastPaperDownloadUrl(paper.id);
      const anchor = document.createElement('a');

      anchor.href = result.url;
      anchor.download = `${paper.title}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
    } catch {
      addToast('Download failed', 'error');
    } finally {
      setDownloadingId(null);
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
      <div className="hero hero-editorial">
        <div className="hero-content">
          <span className="hero-eyebrow">
            <span className="hero-eyebrow-line" />
            Exam Preparation
          </span>
          <h1 className="hero-title">
            Past Papers
            {levelName && <span className="hero-title-dim"> · {levelName}</span>}
          </h1>
          {classLabel && <p className="hero-subtitle">{classLabel}</p>}

          <nav className="breadcrumb">
            <Link to="/"><Icon name="home" className="breadcrumb-icon" /> Home</Link>
            <Icon name="chevron-right" className="breadcrumb-sep" />
            <span>Past Papers</span>
          </nav>
        </div>

        <div className="hero-meta">
          <span className="hero-meta-item">
            <strong>{total}</strong> papers
          </span>
          <span className="hero-meta-divider" />
          <span className="hero-meta-item">
            <strong>{filterOptions.years.length || '—'}</strong> years
          </span>
          <span className="hero-meta-divider" />
          <span className="hero-meta-item">
            <strong>{filterOptions.subjects.length || '—'}</strong> subjects
          </span>
        </div>
      </div>

      <div className="section" style={{ paddingTop: 'var(--space-6)' }}>
        {!user && (
          <div className="alert alert-info" style={{ marginBottom: 'var(--space-6)' }}>
            <Icon name="lock" /> Sign in to download papers. You can browse freely.
          </div>
        )}

        <div style={{ display: 'flex', gap: 'var(--space-4)', marginBottom: 'var(--space-6)', flexWrap: 'wrap', alignItems: 'center' }}>
          <Button variant={showFilters ? 'primary' : 'secondary'} size="sm" onClick={() => setShowFilters((value) => !value)}>
            <Icon name="filter" /> Filters
            {activeFilterCount > 0 && <span className="badge badge-primary">{activeFilterCount}</span>}
          </Button>

          {activeFilterCount > 0 && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <Icon name="xmark" /> Clear filters
            </Button>
          )}

          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-dim)' }}>
            {papersLoading ? 'Loading...' : `${total} paper${total !== 1 ? 's' : ''} found`}
          </p>
        </div>

        {showFilters && (
          <div className="card" style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-6)', display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
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
            title="No Papers Found"
            description={`No past papers match your filters for ${classLabel || levelName || 'your level'}.`}
            action={<Button variant="secondary" onClick={clearFilters}>Clear Filters</Button>}
          />
        ) : (
          <div className="grid grid-cols-3">
            {papers.map((paper) => (
              <div key={paper.id} className="card paper-card">
                <div className="card-image-placeholder paper-card-icon">
                  <Icon name="file-pdf" style={{ fontSize: '2.5rem', color: 'var(--error)' }} />
                </div>

                <div className="card-body">
                  <h3 className="card-title">{paper.title}</h3>
                  <p className="card-text">{paper.subject}</p>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginTop: 'var(--space-3)' }}>
                    {paper.level && <span className="chip">{paper.level}</span>}
                    {paper.year && <span className="chip chip-accent">{paper.year}</span>}
                    {paper.paper_type && <span className="chip chip-primary">{paper.paper_type}</span>}
                    {paper.class_name && <span className="chip">{paper.class_name}</span>}
                  </div>
                </div>

                <div className="card-footer">
                  <Button size="sm" loading={downloadingId === paper.id} onClick={() => handleDownload(paper)}>
                    <Icon name="download" />
                    {user ? 'Download' : 'Sign in to Download'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-2)', marginTop: 'var(--space-8)' }}>
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
