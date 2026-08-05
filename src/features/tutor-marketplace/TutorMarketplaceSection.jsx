import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { listTutorsCached } from '../../api/cachedClient';
import { sendContactRequest } from '../../api/client';
import TutorCard from './TutorCard';
import Spinner from '../../components/Spinner/Spinner';
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
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <Spinner size="lg" />
        </div>
      </section>
    );
  }

  if (!tutors.length) return null;

  return (
    <section className="section reveal">
      <span className="sec-label">Tutor Marketplace</span>
      <h2 className="section-title">Find a Tutor</h2>
      <p className="section-subtitle">Connect with qualified tutors for personalised learning</p>

      <div className="grid grid-cols-3">
        {tutors.map(tutor => (
          <TutorCard key={tutor.id} tutor={tutor} user={user} onContact={handleContact} />
        ))}
      </div>

      <div style={{ textAlign: 'center', marginTop: 'var(--space-6)' }}>
        <Link to="/tutors" className="btn btn-primary">Browse All Tutors</Link>
      </div>
    </section>
  );
}
