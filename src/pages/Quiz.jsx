 import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import {
  getAllSiteSections,
  getQuizTopics,
  getQuizBlock,
  checkDailyRetry,
  checkQuizAnswer,
  submitQuizBlock,
  recordDailyVisit
} from '../api/client';

export default function Quiz() {
  const { user } = useAuth();
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [allTopics, setAllTopics] = useState([]);
  const [currentLevel] = useState('O-Level');

  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        await getAllSiteSections();
        const topics = await getQuizTopics({ level: currentLevel });
        setAllTopics(topics || []);
        if (user) await recordDailyVisit();
        setLoading(false);
      } catch (err) {
        setError(err.message || 'Failed to load quiz');
        setLoading(false);
      }
    };
    init();
  }, []);

  if (error) {
    return (
      <div className="section" style={{ padding: '2rem', textAlign: 'center' }}>
        <h2 style={{ color: '#ef4444' }}>Quiz Error</h2>
        <pre style={{ background: 'rgba(0,0,0,0.1)', padding: '1rem', borderRadius: '8px', color: 'var(--clr-white)' }}>{error}</pre>
        <Link to="/" className="btn-primary">Back to Home</Link>
      </div>
    );
  }

  if (loading) {
    return <div className="section"><p style={{ textAlign: 'center', padding: '3rem' }}>Loading quiz...</p></div>;
  }

  return (
    <div className="section">
      <h1>Quiz page loaded</h1>
      <p>User: {user?.email || 'Not logged in'}</p>
      <p>Topics found: {allTopics.length}</p>
      <Link to="/" className="btn-primary">Back to Home</Link>
    </div>
  );
}
