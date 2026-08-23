 import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { listTutorsCached } from '../../api/cachedClient';
import { sendContactRequest } from '../../api/client';
import SplitCard from '../../components/SplitCard/SplitCard';
import Spinner from '../../components/Spinner/Spinner';
import { useToast } from '../../components/Toast/Toast';

export default function TutorMarketplaceSection() {
  const { user } = useAuth();
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
    <section
      className={`section reveal ${tutors.length > 0 ? 'section-with-bg' : ''}`}
      style={tutors.length > 0 ? {
        backgroundImage: `url(/images/tutors.jpg)`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
      } : undefined}
    >
      <div className={tutors.length > 0 ? 'section-overlay' : ''}>
        <span className="sec-label">Tutor Marketplace</span>
        <h2 className="section-title">
          Learn From Someone<br />Who Gets It
        </h2>
        <p className="section-subtitle">
          Browse verified specialists in biology and pharmacy, matched to how you learn best.
        </p>

        {tutors.length > 0 ? (
          <>
            <div className="classroom-level-grid">
              {tutors.map((tutor) => (
                <SplitCard
                  key={tutor.id}
                  image={tutor.avatar_url}
                  fallbackImage="/images/default-tutor.jpg"
                  title={tutor.display_name}
                  subtitle={tutor.headline || 'Qualified Tutor'}
                  badge={tutor.specialty || 'Tutor'}
                  badgeVariant="success"
                  link={`/tutor/${tutor.id}`}
                  buttonText="View"
                  onButtonClick={() => handleContact(tutor)}
                />
              ))}
            </div>
            <div className="tutor-section-footer">
              <Link to="/tutors" className="btn btn-primary">Browse All Tutors</Link>
            </div>
          </>
        ) : (
          <div className="section-empty-state">
            <img
              src="/images/empty-tutors.svg"
              alt=""
              className="section-empty-image"
            />
            <h3 className="section-empty-title">Be the first to teach here</h3>
            <p className="section-empty-text">
              Our marketplace is just getting started — apply as a tutor and claim your spot before anyone else.
            </p>
            <div className="section-empty-actions">
              <Link to="/tutors" className="btn btn-secondary">Browse anyway</Link>
              <Link to="/tutor/apply" className="btn btn-primary">Apply as a Tutor</Link>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
