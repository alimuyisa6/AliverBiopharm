 import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useRequireOnboarding } from '../hooks/useRequireOnboarding';
import { useLevelFilter } from '../hooks/useLevelFilter';
import { useContentAccess } from '../hooks/useContentAccess';
 
import FlashcardDeckView from '../components/FlashcardDeckView';
import FlashcardProgress from '../components/Flashcardprogress';
import { PendingApprovalScreen } from '../components/access/PendingApprovalScreen';
import { completeFlashcardSession, getKnownFlashcards } from '../api/cachedClient';
import { FaSpinner, FaTriangleExclamation } from 'react-icons/fa6';

const STAGE = {
  LOADING: 'loading',
  SUBJECT: 'subject',
  STUDY: 'study',
  COMPLETE: 'complete'
};

export default function FlashcardsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { isReady } = useRequireOnboarding();
  const access = useContentAccess();
  const { level, class_name, showAll } = useLevelFilter();

  const [stage, setStage] = useState(STAGE.LOADING);
  const [selectedDeck, setSelectedDeck] = useState(null);
  const [sessionResult, setSessionResult] = useState(null);
  const [knownIds, setKnownIds] = useState([]);
  const [error, setError] = useState(null);
  const [studyMeta, setStudyMeta] = useState({ confidence_level: null, last_topic: null });

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    init();
  }, [user, isReady, access.canAccess, level]);

  async function init() {
    try {
      const knownData = await getKnownFlashcards();
      setKnownIds(knownData || []);
      setStage(STAGE.SUBJECT);
    } catch (err) {
      setError('Failed to load. Please refresh.');
      console.error(err);
    }
  }

  function handleSubjectStart({ confidence, topic, deck }) {
    setStudyMeta({ confidence_level: confidence, last_topic: topic || null });
    setSelectedDeck(deck);
    setStage(STAGE.STUDY);
  }

  async function handleStudyComplete({ sessionId, total }) {
    let result = { total, correct: 0, incorrect: 0, score: 0 };
    if (sessionId) {
      try {
        const data = await completeFlashcardSession(sessionId);
        result = {
          total: data.card_count ?? total,
          correct: data.correct ?? 0,
          incorrect: data.incorrect ?? 0,
          score: data.score ?? 0
        };
      } catch {}
    }
    setSessionResult(result);
    setStage(STAGE.COMPLETE);
  }

  function handleRestart() {
    setSelectedDeck(null);
    setSessionResult(null);
    setStage(STAGE.SUBJECT);
  }

  if (!isReady || access.isPending) {
    return <PendingApprovalScreen />;
  }

  if (!access.canAccess) {
    return <div className="fc-access-denied">Access restricted. Please contact support.</div>;
  }

  if (error) {
    return (
      <div className="fc-page">
        <div className="fc-page-inner">
          <div className="fc-empty">
            <FaTriangleExclamation className="fc-empty-icon" />
            <p className="fc-empty-text">{error}</p>
            <button className="fc-btn-primary" onClick={init}>Try Again</button>
          </div>
        </div>
      </div>
    );
  }

  if (stage === STAGE.LOADING) {
    return (
      <div className="fc-page">
        <div className="fc-page-inner">
          <div className="fc-loading">
            <FaSpinner className="icon-spin" />
            <p className="fc-loading-text">Loading your flashcards…</p>
          </div>
        </div>
      </div>
    );
  }

  if (stage === STAGE.SUBJECT) {
    return (
      <FlashcardSubjectSelect
        state={{
          selected_level: level || null,
          selected_discipline: level === 'Pharmacy' ? 'Pharmacy' : 'Biology',
          selected_class: class_name || '',
          show_all: showAll
        }}
        onStart={handleSubjectStart}
        onBack={() => navigate('/')}
      />
    );
  }

  if (stage === STAGE.STUDY && selectedDeck) {
    return (
      <FlashcardDeckView
        deck={selectedDeck}
        knownIds={knownIds}
        mode="flip"
        onComplete={handleStudyComplete}
      />
    );
  }

  if (stage === STAGE.COMPLETE) {
    return (
      <FlashcardProgress
        result={sessionResult}
        onRestart={handleRestart}
        onHome={() => navigate('/')}
      />
    );
  }

  return null;
}
