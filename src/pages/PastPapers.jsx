/* pages/PastPapers.jsx */
import { useState, useEffect, useRef } from 'react';
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
  getDownloadHistory,
  getPaperReviews,
  ratePaper,
  deletePaperReview,
  getPaperFilterPresets,
  savePaperFilterPreset,
  deletePaperFilterPreset
} from '../api/client';
import Icon from '../components/Icon/Icon';
import Skeleton from '../components/Skeleton/Skeleton';
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
  const [papersLoading, setPapersLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [bookmarkedIds, setBookmarkedIds] = useState(new Set());
  const [downloadedIds, setDownloadedIds] = useState(new Set());
  const [selectedPaper, setSelectedPaper] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('year_desc');
  const [presets, setPresets] = useState([]);
  const [presetName, setPresetName] = useState('');
  const [showPresets, setShowPresets] = useState(false);

  const papersRequestId = useRef(0);

  const effectiveLevel = showAll ? null : level;
  const effectiveClass = showAll ? null : class_name;

  function getEmptyStateImage(key) {
    const uiComponents = bootstrap?.ui_components || [];
    const component = uiComponents.find(
      (item) => item.component_key === `empty_state_${key}`
    );

    return component?.properties?.image_url || null;
  }

  useEffect(() => {
    let mounted = true;

    getPastPaperFilterOptions()
      .then((result) => {
        if (mounted) {
          setFilterOptions({
            subjects: result?.subjects || [],
            years: result?.years || [],
            exam_boards: result?.exam_boards || [],
            paper_types: result?.paper_types || []
          });
        }
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) {
          setInitializing(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    setPage(1);
  }, [effectiveLevel, effectiveClass, activeTab, searchQuery]);

  useEffect(() => {
    if (!user) {
      setBookmarkedIds(new Set());
      setDownloadedIds(new Set());
      setPresets([]);
      return;
    }

    loadUserInteractions();
    loadPresets();
  }, [user]);

  useEffect(() => {
    loadPapers();
  }, [
    page,
    effectiveLevel,
    effectiveClass,
    activeTab,
    searchQuery,
    sortBy,
    filters.subject,
    filters.year,
    filters.exam_board,
    filters.paper_type
  ]);

  const loadUserInteractions = async () => {
    try {
      const [bookmarked, downloaded] = await Promise.all([
        getBookmarkedPapers(1, 100),
        getDownloadHistory(1, 100)
      ]);

      setBookmarkedIds(
        new Set((bookmarked?.papers || []).map((paper) => paper.id))
      );

      setDownloadedIds(
        new Set((downloaded?.papers || []).map((paper) => paper.id))
      );
    } catch {}
  };

  const loadPresets = async () => {
    try {
      const result = await getPaperFilterPresets();

      setPresets(Array.isArray(result) ? result : []);
    } catch {
      setPresets([]);
    }
  };

  const loadPapers = async () => {
    const requestId = ++papersRequestId.current;

    setPapersLoading(true);

    try {
      let result;

      if (activeTab === 'bookmarked') {
        result = await getBookmarkedPapers(page, 12);
      } else if (activeTab === 'downloaded') {
        result = await getDownloadHistory(page, 12);
      } else {
        const params = {
          page,
          limit: 12
        };

        if (effectiveLevel) {
          params.level = effectiveLevel;
        }

        if (effectiveClass) {
          params.class_name = effectiveClass;
        }

        if (searchQuery.trim()) {
          params.search = searchQuery.trim();
        }

        if (sortBy) {
          params.sort = sortBy;
        }

        if (filters.subject) {
          params.subject = filters.subject;
        }

        if (filters.year) {
          params.year = filters.year;
        }

        if (filters.exam_board) {
          params.exam_board = filters.exam_board;
        }

        if (filters.paper_type) {
          params.paper_type = filters.paper_type;
        }

        result = await getPastPapers(params);
      }

      if (requestId !== papersRequestId.current) {
        return;
      }

      setPapers(result?.papers || []);
      setTotalPages(result?.total_pages || 1);
      setTotal(result?.total || 0);
    } catch (error) {
      if (requestId !== papersRequestId.current) {
        return;
      }

      console.error('[PAST_PAPERS_LOAD_ERROR]', error);
      addToast('Failed to load papers', 'error');

      setPapers([]);
      setTotalPages(1);
      setTotal(0);
    } finally {
      if (requestId === papersRequestId.current) {
        setPapersLoading(false);
      }
    }
  };

  const loadReviews = async (paperId) => {
    setReviewsLoading(true);

    try {
      const result = await getPaperReviews(paperId, 1, 20);

      setReviews(result?.reviews || []);
    } catch {
      setReviews([]);
    } finally {
      setReviewsLoading(false);
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

      if (!result?.url) {
        throw new Error('Download URL was not returned');
      }

      const anchor = document.createElement('a');

      anchor.href = result.url;
      anchor.download = `${paper.title}.pdf`;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';

      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);

      setDownloadedIds((prev) => {
        const next = new Set(prev);
        next.add(paper.id);
        return next;
      });

      addToast('Download started', 'success');
    } catch (error) {
      if (error?.status === 403) {
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

        if (result?.bookmarked) {
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
    setSelectedPaper(paper);

    setReviewRating(0);
    setReviewComment('');

    if (user) {
      try {
        await trackPaperView(paper.id);
      } catch {}
    }

    loadReviews(paper.id);
  };

  const handleCloseModal = () => {
    setSelectedPaper(null);
    setReviews([]);
    setReviewRating(0);
    setReviewComment('');
  };

  const handleSubmitReview = async () => {
    if (!selectedPaper) {
      return;
    }

    if (!user) {
      addToast('Please sign in to review this paper', 'warning');
      return;
    }

    if (!reviewRating) {
      addToast('Please select a rating', 'warning');
      return;
    }

    setSubmittingReview(true);

    try {
      await ratePaper(
        selectedPaper.id,
        reviewRating,
        reviewComment.trim() || null
      );

      addToast('Review submitted', 'success');

      setReviewRating(0);
      setReviewComment('');

      loadReviews(selectedPaper.id);
    } catch {
      addToast('Failed to submit review', 'error');
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleDeleteReview = async () => {
    if (!selectedPaper) {
      return;
    }

    try {
      await deletePaperReview(selectedPaper.id);

      addToast('Review deleted', 'success');
      loadReviews(selectedPaper.id);
    } catch {
      addToast('Failed to delete review', 'error');
    }
  };

  const handleSavePreset = async () => {
    if (!user) {
      addToast('Please sign in to save filter presets', 'warning');
      return;
    }

    if (!presetName.trim()) {
      return;
    }

    try {
      const preset = await savePaperFilterPreset(
        presetName.trim(),
        filters
      );

      setPresets((prev) => [
        preset,
        ...prev.filter((item) => item.name !== preset.name)
      ]);

      setPresetName('');

      addToast('Filter preset saved', 'success');
    } catch {
      addToast('Failed to save preset', 'error');
    }
  };

  const handleApplyPreset = (preset) => {
    setFilters({
      subject: preset?.filters?.subject || '',
      year: preset?.filters?.year || '',
      exam_board: preset?.filters?.exam_board || '',
      paper_type: preset?.filters?.paper_type || ''
    });

    setPage(1);
    setShowPresets(false);
  };

  const handleDeletePreset = async (presetId) => {
    try {
      await deletePaperFilterPreset(presetId);

      setPresets((prev) =>
        prev.filter((preset) => preset.id !== presetId)
      );
    } catch {
      addToast('Failed to delete preset', 'error');
    }
  };

  const clearFilters = () => {
    setFilters({
      subject: '',
      year: '',
      exam_board: '',
      paper_type: ''
    });

    setPage(1);
  };

  const activeFilterCount = [
    filters.subject,
    filters.year,
    filters.exam_board,
    filters.paper_type
  ].filter(Boolean).length;

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
              {levelName && (
                <span className="past-papers-title-dim">
                  {' '}
                  · {levelName}
                </span>
              )}
            </h1>

            {classLabel && (
              <p className="past-papers-subtitle">
                {classLabel}
              </p>
            )}

            <nav className="breadcrumb">
              <Link to="/">
                <Icon
                  name="home"
                  className="breadcrumb-icon"
                />
                Home
              </Link>

              <Icon
                name="chevron-right"
                className="breadcrumb-sep"
              />

              <span>Past Papers</span>
            </nav>

            <div className="past-papers-meta">
              <span className="past-papers-meta-item">
                <strong>{total}</strong> papers
              </span>

              <span className="past-papers-meta-divider" />

              <span className="past-papers-meta-item">
                <strong>
                  {filterOptions.years.length || '—'}
                </strong>{' '}
                years
              </span>

              <span className="past-papers-meta-divider" />

              <span className="past-papers-meta-item">
                <strong>
                  {filterOptions.subjects.length || '—'}
                </strong>{' '}
                subjects
              </span>
            </div>
          </div>
        </div>
      </div>

      <div
        className="section"
        style={{ paddingTop: 'var(--space-6)' }}
      >
        {!user && (
          <div
            className="alert alert-info"
            style={{ marginBottom: 'var(--space-6)' }}
          >
            <Icon name="lock" /> Sign in to download papers.
            You can browse freely.
          </div>
        )}

        <div className="past-papers-tabs">
          {TABS.map((tab) => (
            <Button
              key={tab.key}
              variant={
                activeTab === tab.key
                  ? 'primary'
                  : 'ghost'
              }
              size="sm"
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}

              {tab.key === 'bookmarked' &&
                bookmarkedIds.size > 0 && (
                  <span className="badge badge-primary">
                    {bookmarkedIds.size}
                  </span>
                )}

              {tab.key === 'downloaded' &&
                downloadedIds.size > 0 && (
                  <span className="badge badge-primary">
                    {downloadedIds.size}
                  </span>
                )}
            </Button>
          ))}
        </div>

        {activeTab === 'all' && (
          <div className="past-papers-toolbar">
            <div className="search-input-wrapper past-papers-search-wrapper">
              <input
                type="search"
                placeholder="Search papers..."
                value={searchQuery}
                onChange={(event) =>
                  setSearchQuery(event.target.value)
                }
                className="search-input"
                aria-label="Search papers"
              />

              <span className="search-input-icon">
                <Icon name="magnifying-glass" />
              </span>
            </div>

            <Select
              label="Sort"
              options={[
                {
                  value: 'year_desc',
                  label: 'Newest'
                },
                {
                  value: 'year_asc',
                  label: 'Oldest'
                },
                {
                  value: 'downloads',
                  label: 'Most Downloaded'
                },
                {
                  value: 'rating',
                  label: 'Highest Rated'
                }
              ]}
              value={sortBy}
              onChange={(event) =>
                setSortBy(event.target.value)
              }
            />

            <Button
              variant={
                showFilters ? 'primary' : 'secondary'
              }
              size="sm"
              onClick={() =>
                setShowFilters((value) => !value)
              }
            >
              <Icon name="filter" /> Filters

              {activeFilterCount > 0 && (
                <span className="badge badge-primary">
                  {activeFilterCount}
                </span>
              )}
            </Button>

            {user && presets.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setShowPresets((value) => !value)
                }
              >
                <Icon name="bookmark" /> Presets
              </Button>
            )}

            {activeFilterCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
              >
                <Icon name="xmark" /> Clear
              </Button>
            )}

            <p className="past-papers-count">
              {papersLoading ? (
                'Loading papers...'
              ) : (
                <>
                  {total} paper{total !== 1 ? 's' : ''} found
                </>
              )}
            </p>
          </div>
        )}

        {showPresets && activeTab === 'all' && user && (
          <div className="past-papers-presets">
            {presets.length === 0 ? (
              <p className="past-papers-presets-empty">
                No saved presets yet.
              </p>
            ) : (
              presets.map((preset) => (
                <div
                  key={preset.id}
                  className="past-papers-preset-item"
                >
                  <button
                    className="past-papers-preset-apply"
                    onClick={() =>
                      handleApplyPreset(preset)
                    }
                  >
                    <Icon name="bookmark" />
                    {preset.name}
                  </button>

                  <button
                    className="past-papers-preset-delete"
                    onClick={() =>
                      handleDeletePreset(preset.id)
                    }
                    aria-label={`Delete ${preset.name}`}
                  >
                    <Icon name="trash" />
                  </button>
                </div>
              ))
            )}

            <div className="past-papers-preset-form">
              <input
                type="text"
                placeholder="Preset name..."
                value={presetName}
                onChange={(event) =>
                  setPresetName(event.target.value)
                }
                className="past-papers-preset-input"
                maxLength={50}
              />

              <Button
                size="sm"
                variant="secondary"
                onClick={handleSavePreset}
                disabled={!presetName.trim()}
              >
                Save
              </Button>
            </div>
          </div>
        )}

        {showFilters && activeTab === 'all' && (
          <div className="past-papers-filters">
            <Select
              label="Subject"
              options={filterOptions.subjects.map(
                (subject) => ({
                  value: subject,
                  label: subject
                })
              )}
              value={filters.subject}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  subject: event.target.value
                }))
              }
            />

            <Select
              label="Year"
              options={filterOptions.years.map((year) => ({
                value: String(year),
                label: String(year)
              }))}
              value={filters.year}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  year: event.target.value
                }))
              }
            />

            <Select
              label="Exam Board"
              options={filterOptions.exam_boards.map(
                (board) => ({
                  value: board,
                  label: board
                })
              )}
              value={filters.exam_board}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  exam_board: event.target.value
                }))
              }
            />

            <Select
              label="Paper Type"
              options={filterOptions.paper_types.map(
                (type) => ({
                  value: type,
                  label: type
                })
              )}
              value={filters.paper_type}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  paper_type: event.target.value
                }))
              }
            />
          </div>
        )}

        {papersLoading ? (
          <div className="past-papers-skeleton-grid">
            {Array.from({ length: 6 }, (_, index) => (
              <div
                key={index}
                className="past-papers-skeleton-card"
                aria-hidden="true"
              >
                <div className="past-papers-skeleton-icon">
                  <Icon
                    name="file-pdf"
                    style={{
                      fontSize: '2.5rem',
                      color: 'var(--border-default)'
                    }}
                  />
                </div>

                <div className="past-papers-skeleton-body">
                  <Skeleton
                    width="80%"
                    height={20}
                    borderRadius="var(--radius-sm)"
                  />

                  <Skeleton
                    width="50%"
                    height={14}
                    borderRadius="var(--radius-sm)"
                  />

                  <Skeleton
                    width="100%"
                    height={14}
                    borderRadius="var(--radius-sm)"
                  />

                  <Skeleton
                    width="60%"
                    height={14}
                    borderRadius="var(--radius-sm)"
                  />
                </div>
              </div>
            ))}
          </div>
        ) : papers.length === 0 ? (
          <EmptyState
            image={getEmptyStateImage('past_papers')}
            title={
              activeTab === 'bookmarked'
                ? 'No Bookmarked Papers'
                : activeTab === 'downloaded'
                  ? 'No Downloads Yet'
                  : 'No Papers Found'
            }
            description={
              activeTab === 'bookmarked'
                ? 'Bookmark papers to find them here later.'
                : activeTab === 'downloaded'
                  ? 'Papers you download will appear here.'
                  : `No past papers match your filters for ${
                      classLabel ||
                      levelName ||
                      'your level'
                    }.`
            }
            action={
              activeTab === 'all' && (
                <Button
                  variant="secondary"
                  onClick={clearFilters}
                >
                  Clear Filters
                </Button>
              )
            }
          />
        ) : (
          <div className="past-papers-grid">
            {papers.map((paper) => (
              <div
                key={paper.id}
                className={`card paper-card${
                  paper.is_premium
                    ? ' paper-card-premium'
                    : ''
                }`}
                onClick={() => handlePaperOpen(paper)}
              >
                <div className="card-image-placeholder paper-card-icon">
                  <Icon
                    name="file-pdf"
                    style={{
                      fontSize: '2.5rem',
                      color: 'var(--error)'
                    }}
                  />

                  {paper.is_premium && (
                    <span className="paper-premium-badge">
                      <Icon name="crown" /> Premium
                    </span>
                  )}
                </div>

                <div className="card-body">
                  <div className="paper-card-title-row">
                    <h3 className="card-title">
                      {paper.title}
                    </h3>

                    <button
                      className={`paper-bookmark-btn${
                        bookmarkedIds.has(paper.id)
                          ? ' active'
                          : ''
                      }`}
                      onClick={(event) => {
                        event.stopPropagation();
                        handleBookmark(paper.id);
                      }}
                      aria-label={
                        bookmarkedIds.has(paper.id)
                          ? 'Remove bookmark'
                          : 'Bookmark paper'
                      }
                    >
                      <Icon
                        name={
                          bookmarkedIds.has(paper.id)
                            ? 'bookmark-solid'
                            : 'bookmark'
                        }
                      />
                    </button>
                  </div>

                  <p className="card-text">
                    {paper.subject}
                  </p>

                  {paper.avg_rating > 0 && (
                    <div className="paper-rating-stars">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <span
                          key={star}
                          className={
                            star <=
                            Math.round(paper.avg_rating)
                              ? 'paper-star-filled'
                              : 'paper-star-empty'
                          }
                        >
                          <Icon name="star" />
                        </span>
                      ))}

                      <span className="paper-rating-count-small">
                        ({paper.rating_count || 0})
                      </span>
                    </div>
                  )}

                  <div className="paper-card-chips">
                    {paper.level && (
                      <span className="chip">
                        {paper.level}
                      </span>
                    )}

                    {paper.year && (
                      <span className="chip chip-accent">
                        {paper.year}
                      </span>
                    )}

                    {paper.paper_type && (
                      <span className="chip chip-primary">
                        {paper.paper_type}
                      </span>
                    )}

                    {paper.class_name && (
                      <span className="chip">
                        {paper.class_name}
                      </span>
                    )}

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
                    loading={
                      downloadingId === paper.id
                    }
                    onClick={(event) => {
                      event.stopPropagation();
                      handleDownload(paper);
                    }}
                    variant={
                      paper.is_premium
                        ? 'warm'
                        : 'primary'
                    }
                  >
                    <Icon
                      name={
                        paper.is_premium
                          ? 'lock'
                          : 'download'
                      }
                    />

                    {paper.is_premium
                      ? 'Premium Download'
                      : user
                        ? 'Download'
                        : 'Sign in to Download'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {!papersLoading && totalPages > 1 && (
          <div className="past-papers-pagination">
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                setPage((current) =>
                  Math.max(1, current - 1)
                )
              }
              disabled={page === 1}
            >
              <Icon name="chevron-left" />
            </Button>

            {Array.from(
              { length: totalPages },
              (_, index) => index + 1
            )
              .filter(
                (item) =>
                  item === 1 ||
                  item === totalPages ||
                  Math.abs(item - page) <= 2
              )
              .map((item) => (
                <Button
                  key={item}
                  variant={
                    item === page
                      ? 'primary'
                      : 'ghost'
                  }
                  size="sm"
                  onClick={() => setPage(item)}
                >
                  {item}
                </Button>
              ))}

            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                setPage((current) =>
                  Math.min(totalPages, current + 1)
                )
              }
              disabled={page === totalPages}
            >
              <Icon name="chevron-right" />
            </Button>
          </div>
        )}
      </div>

      {selectedPaper && (
        <div
          className="paper-modal-overlay"
          onClick={handleCloseModal}
        >
          <div
            className="paper-modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="paper-modal-header">
              <div>
                <h2 className="paper-modal-title">
                  {selectedPaper.title}
                </h2>

                <p className="paper-modal-subject">
                  {selectedPaper.subject}
                </p>
              </div>

              <button
                className="paper-modal-close"
                onClick={handleCloseModal}
                aria-label="Close"
              >
                <Icon name="xmark" />
              </button>
            </div>

            <div className="paper-modal-body">
              <div className="paper-modal-meta">
                {selectedPaper.level && (
                  <span className="chip">
                    {selectedPaper.level}
                  </span>
                )}

                {selectedPaper.year && (
                  <span className="chip chip-accent">
                    {selectedPaper.year}
                  </span>
                )}

                {selectedPaper.paper_type && (
                  <span className="chip chip-primary">
                    {selectedPaper.paper_type}
                  </span>
                )}

                {selectedPaper.exam_board && (
                  <span className="chip">
                    {selectedPaper.exam_board}
                  </span>
                )}

                {selectedPaper.class_name && (
                  <span className="chip">
                    {selectedPaper.class_name}
                  </span>
                )}
              </div>

              <div className="paper-modal-actions">
                <Button
                  size="sm"
                  loading={
                    downloadingId === selectedPaper.id
                  }
                  onClick={() =>
                    handleDownload(selectedPaper)
                  }
                  variant={
                    selectedPaper.is_premium
                      ? 'warm'
                      : 'primary'
                  }
                >
                  <Icon
                    name={
                      selectedPaper.is_premium
                        ? 'lock'
                        : 'download'
                    }
                  />

                  {selectedPaper.is_premium
                    ? 'Premium Download'
                    : 'Download'}
                </Button>

                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    handleBookmark(selectedPaper.id)
                  }
                >
                  <Icon
                    name={
                      bookmarkedIds.has(
                        selectedPaper.id
                      )
                        ? 'bookmark-solid'
                        : 'bookmark'
                    }
                  />

                  {bookmarkedIds.has(
                    selectedPaper.id
                  )
                    ? 'Bookmarked'
                    : 'Bookmark'}
                </Button>
              </div>

              <div className="paper-review-form">
                <span className="paper-review-label">
                  Rate this paper
                </span>

                <div className="paper-rating-stars">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      className={`paper-star-btn${
                        star <= reviewRating
                          ? ' active'
                          : ''
                      }`}
                      onClick={() =>
                        setReviewRating(star)
                      }
                      aria-label={`Rate ${star} star${
                        star !== 1 ? 's' : ''
                      }`}
                    >
                      <Icon name="star" />
                    </button>
                  ))}
                </div>

                <textarea
                  className="paper-review-input"
                  placeholder="Share your experience with this paper..."
                  value={reviewComment}
                  onChange={(event) =>
                    setReviewComment(
                      event.target.value
                    )
                  }
                  rows={3}
                />

                <Button
                  size="sm"
                  variant="primary"
                  loading={submittingReview}
                  onClick={handleSubmitReview}
                >
                  <Icon name="paper-plane" />
                  Submit Review
                </Button>
              </div>

              {reviewsLoading ? (
                <div
                  style={{
                    textAlign: 'center',
                    padding: 'var(--space-4)'
                  }}
                >
                  <Spinner size="sm" />
                </div>
              ) : reviews.length === 0 ? (
                <p className="paper-reviews-empty">
                  No reviews yet. Be the first to review.
                </p>
              ) : (
                <div className="paper-reviews-list">
                  {reviews.map((review) => (
                    <div
                      key={review.id}
                      className="paper-review-item"
                    >
                      <div className="paper-review-header">
                        <div className="paper-review-author">
                          <div className="paper-review-avatar">
                            {review.display_name?.[0] ||
                              'U'}
                          </div>

                          <div>
                            <span className="paper-review-name">
                              {review.display_name ||
                                'Anonymous'}
                            </span>

                            <div className="paper-review-stars">
                              {[1, 2, 3, 4, 5].map(
                                (star) => (
                                  <span
                                    key={star}
                                    style={{
                                      color:
                                        star <=
                                        review.rating
                                          ? 'var(--warm)'
                                          : 'var(--border-default)'
                                    }}
                                  >
                                    <Icon name="star" />
                                  </span>
                                )
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="paper-review-meta">
                          <span className="paper-review-date">
                            {new Date(
                              review.created_at
                            ).toLocaleDateString()}
                          </span>

                          {review.user_id ===
                            user?.id && (
                            <button
                              className="paper-review-delete"
                              onClick={
                                handleDeleteReview
                              }
                            >
                              <Icon name="trash" />
                              Delete
                            </button>
                          )}
                        </div>
                      </div>

                      {review.comment && (
                        <p className="paper-review-comment">
                          {review.comment}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
