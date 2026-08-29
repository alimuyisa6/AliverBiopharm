 /* components/tutor-marketplace/TutorMarketplaceSection.jsx */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useLayout } from '../../contexts/LayoutContext';
import { listTutorsCached } from '../../api/cachedClient';
import { sendContactRequest } from '../../api/client';
import EmptyState from '../../components/EmptyState/EmptyState';
import Spinner from '../../components/Spinner/Spinner';
import { useToast } from '../../components/Toast/Toast';

export default function TutorMarketplaceSection() {
  const { user } = useAuth();
  const { bootstrap } = useLayout();
  const addToast = useToast();
  const [tutors, setTutors] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    listTutorsCached({ limit: 6 })
      .then((data) => { if (!cancelled) setTutors(data); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  function getUiImage(key) {
    const uiComponents = bootstrap?.ui_components || [];
    const component = uiComponents.find((item) => item.component_key === key);
    return component?.properties?.image_url || null;
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

  if (loading) {
    return (
      <section className="section">
        <div className="tutor-section-loading">
          <Spinner size="lg" />
        </div>
      </section>
    );
  }

  return (
    <section className="section">
      <div className="section-head">
        <div className="section-head-left">
          <span className="eyebrow">Tutor Marketplace</span>
          <h2>Learn from someone who gets it</h2>
        </div>
      </div>
      {tutors.length > 0 ? (
        <>
          <div className="tutor-grid-flat">
            {tutors.map((tutor) => (
              <div key={tutor.id} className="tutor-card-flat">
                <div className="tutor-avatar">
                  {tutor.avatar_url ? <img src={tutor.avatar_url} alt={tutor.display_name} /> : <span>{tutor.display_name?.[0]}</span>}
                </div>
                <div style={{ flex: 1 }}>
                  <div className="tutor-name">{tutor.display_name}</div>
                  <div className="tutor-headline">{tutor.headline || 'Qualified Tutor'}</div>
                </div>
                <Link to={`/tutor/${tutor.id}`} className="btn btn-secondary btn-sm">View</Link>
              </div>
            ))}
          </div>
          <div className="tutor-section-footer">
            <Link to="/tutors" className="btn btn-primary">Browse All Tutors</Link>
          </div>
        </>
      ) : (
        <EmptyState
          image={getUiImage('empty_state_tutors')}
          title="Be the first to teach here"
          description="Our marketplace is just getting started — apply as a tutor and claim your spot before anyone else."
          action={
            <div className="tutor-empty-actions">
              <Link to="/tutors" className="btn btn-secondary">Browse anyway</Link>
              <Link to="/tutor/apply" className="btn btn-primary">Apply as a Tutor</Link>
            </div>
          }
        />
      )}
    </section>
  );
}
