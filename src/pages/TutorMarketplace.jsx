 /* pages/TutorMarketplace.jsx */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLevelFilter } from '../hooks/useLevelFilter';
import { listTutorsCached } from '../api/cachedClient';
import { sendContactRequest } from '../api/client';
import TutorCard from '../features/tutor-marketplace/TutorCard';
import Icon from '../components/Icon/Icon';
import Spinner from '../components/Spinner/Spinner';
import Button from '../components/Button/Button';
import EmptyState from '../components/EmptyState/EmptyState';
import { useToast } from '../components/Toast/Toast';
import { useLayout } from '../contexts/LayoutContext';

export default function TutorMarketplace() {
  const { user } = useAuth();
  const { bootstrap } = useLayout();
  const addToast = useToast();
  const { level, showAll, class_name } = useLevelFilter();

  const [tutors, setTutors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    setPage(1);
  }, [level, showAll, class_name, search]);

  useEffect(() => {
    loadTutors();
  }, [page, level, showAll, class_name, search]);

  async function loadTutors() {
    setLoading(true);

    try {
      const params = { limit: 12, offset: (page - 1) * 12 };

      if (search) params.search = search;

      const data = await listTutorsCached(params);

      setTutors(data);
      setTotal(data.length);
      setTotalPages(Math.ceil(data.length / 12) || 1);
    } catch {
      addToast('Failed to load tutors', 'error');
    } finally {
      setLoading(false);
    }
  }

  const handleContact = async (tutor) => {
    if (!user) {
      addToast('Please sign in to contact a tutor', 'warning');
      return;
    }

    try {
      await sendContactRequest(tutor.user_id, '');
      addToast('Request sent!', 'success');
    } catch {
      addToast('Could not send request', 'error');
    }
  };

  const levelName = showAll ? null : level;
  const classLabel = class_name || '';

  return (
    <div className="tutor-marketplace-page">
      <div className="section tutor-page-section">
        <span className="sec-label">Tutor Marketplace</span>
        <h1 className="section-title tutor-page-title">
          Find a Tutor<br />{levelName ? `– ${levelName}` : ''}
        </h1>

        {classLabel && <p className="tutor-class-label">{classLabel}</p>}

        <nav className="breadcrumb">
          <Link to="/"><Icon name="home" className="breadcrumb-icon" /> Home</Link>
          <Icon name="chevron-right" className="breadcrumb-sep" />
          <span>Tutors</span>
        </nav>

        <div className="tutor-controls-row">
          <div className="tutor-search-wrap">
            <input
              type="text"
              placeholder="Search by name, subject..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="input"
            />
            <Icon name="magnifying-glass" className="tutor-search-icon" />
          </div>

          <p className="tutor-results-count">
            {loading ? 'Loading...' : `${total} tutor${total !== 1 ? 's' : ''} found`}
          </p>
        </div>

        {loading ? (
          <div className="tutor-loading-wrap">
            <Spinner size="lg" />
          </div>
        ) : tutors.length === 0 ? (
          <EmptyState
            title="No Tutors Found"
            description="No tutors match your search criteria."
            action={<Button variant="secondary" onClick={() => setSearch('')}>Clear Search</Button>}
          />
        ) : (
          <div className="grid grid-cols-3">
            {tutors.map((tutor) => (
              <TutorCard key={tutor.id} tutor={tutor} user={user} onContact={handleContact} />
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="tutor-pagination">
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
