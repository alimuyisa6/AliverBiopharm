 /* features/tutor-marketplace/TutorMarketplaceSection.jsx */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { listTutorsCached } from '../../api/cachedClient';
import { sendContactRequest } from '../../api/client';
import TutorCard from './TutorCard';
import Spinner from '../../components/Spinner/Spinner';
import EmptyState from '../../components/EmptyState/EmptyState';
import { useToast } from '../../components/Toast/Toast';

export default function TutorMarketplaceSection() {
  const { user } = useAuth();
  const addToast = useToast();
  const [tutors, setTutors] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listTutorsCached({ limit: 6 })
      .then(setTutors)
      .catch(() => {})
      .finally(() => setLoading(false));
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
    <section className="section reveal">
      <span className="sec-label">Tutor Marketplace</span>
      <h2 className="section-title">
        Find a<br />Tutor
      </h2>
      <p className="section-subtitle">
        Connect with qualified tutors for personalised learning
      </p>

      {tutors.length > 0 ? (
        <>
          <div className="grid grid-cols-3">
            {tutors.map((tutor) => (
              <TutorCard key={tutor.id} tutor={tutor} user={user} onContact={handleContact} />
            ))}
          </div>

          <div className="tutor-section-footer">
            <Link to="/tutors" className="btn btn-primary">Browse All Tutors</Link>
          </div>
        </>
      ) : (
        <EmptyState
          title="No tutors available yet"
          description="Be the first to join our marketplace and start teaching. Check back soon or apply to become a tutor."
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
