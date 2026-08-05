import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLevelFilter } from '../hooks/useLevelFilter';
import { listTutorsCached } from '../api/cachedClient';
import { sendContactRequest } from '../api/client';
import Icon from '../components/Icon/Icon';
import Spinner from '../components/Spinner/Spinner';
import Button from '../components/Button/Button';
import EmptyState from '../components/EmptyState/EmptyState';
import { useToast } from '../components/Toast/Toast';
import { useLayout } from '../contexts/LayoutContext';

export default function TutorMarketplace() {
  const { user } = useAuth();
  const navigate = useNavigate();
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
    }
    setLoading(false);
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
      <div className="section" style={{ paddingTop: 'var(--space-6)' }}>
        <span className="sec-label">Tutor Marketplace</span>
        <h1 className="section-title" style={{ textAlign: 'left', margin: '0 0 var(--space-2)' }}>
          Find a Tutor {levelName ? `– ${levelName}` : ''}
        </h1>
        {classLabel && (
          <p style={{ color: 'var(--text-dim)', marginBottom: 'var(--space-4)' }}>
            {classLabel}
          </p>
        )}

        <nav className="breadcrumb">
          <Link to="/"><Icon name="home" className="breadcrumb-icon" /> Home</Link>
          <Icon name="chevron-right" className="breadcrumb-sep" />
          <span>Tutors</span>
          {levelName && <><Icon name="chevron-right" className="breadcrumb-sep" /><span>{levelName}</span></>}
        </nav>

        <div style={{ marginBottom: 'var(--space-6)', display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: 1, maxWidth: '320px', position: 'relative' }}>
            <input
              type="text"
              placeholder="Search by name, subject..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input"
            />
            <Icon name="search" style={{ position: 'absolute', right: 'var(--space-3)', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
          </div>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-dim)' }}>
            {loading ? 'Loading...' : `${total} tutor${total !== 1 ? 's' : ''} found`}
          </p>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-10)' }}>
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
            {tutors.map(tutor => (
              <div key={tutor.id} className="card">
                <div className="card-image-placeholder" style={{ background: 'var(--primary-light)' }}>
                  <Icon name="user-graduate" style={{ fontSize: '2rem' }} />
                </div>
                <div className="card-body">
                  <h3 className="card-title">{tutor.display_name}</h3>
                  {tutor.headline && <p className="card-text">{tutor.headline}</p>}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginTop: 'var(--space-3)' }}>
                    {tutor.teaching_mode && <span className="chip">{tutor.teaching_mode === 'online' ? 'Online' : tutor.teaching_mode === 'physical' ? 'In-Person' : 'Both'}</span>}
                    {tutor.hourly_rate > 0 && <span className="chip">{tutor.hourly_rate} UGX/h</span>}
                  </div>
                </div>
                <div className="card-footer" style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  <Button size="sm" variant="secondary" onClick={() => navigate(`/tutor/${tutor.id}`)}>View Profile</Button>
                  {user && <Button size="sm" onClick={() => handleContact(tutor)}>Contact</Button>}
                </div>
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-2)', marginTop: 'var(--space-8)' }}>
            <Button variant="secondary" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
              <Icon name="chevron-left" />
            </Button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
              .reduce((acc, p, idx, arr) => {
                if (idx > 0 && p - arr[idx - 1] > 1) acc.push('...');
                acc.push(p);
                return acc;
              }, [])
              .map((p, idx) =>
                p === '...' ? (
                  <span key={`ellipsis-${idx}`} style={{ padding: 'var(--space-2)' }}>...</span>
                ) : (
                  <Button
                    key={p}
                    variant={p === page ? 'primary' : 'ghost'}
                    size="sm"
                    onClick={() => setPage(p)}
                  >
                    {p}
                  </Button>
                )
              )}
            <Button variant="secondary" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
              <Icon name="chevron-right" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
