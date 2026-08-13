 /* pages/FlashcardsPage.jsx */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useRequireOnboarding } from '../hooks/useRequireOnboarding';
import { useLevelFilter } from '../hooks/useLevelFilter';
import { useContentAccess } from '../hooks/useContentAccess';
import { useSecurityUiLock } from '../hooks/useSecurityUiLock';
import { PendingApprovalScreen } from '../components/access/PendingApprovalScreen';
import { AccessDenied } from '../components/access/AccessDenied';
import FlashcardDeckView from '../components/FlashcardDeckView';
import FlashcardProgress from '../components/Flashcardprogress';
import {
  completeFlashcardSession,
  getKnownFlashcards,
  getFlashcardDecks
} from '../api/cachedClient';
import Icon from '../components/Icon/Icon';
import Spinner from '../components/Spinner/Spinner';
import Skeleton from '../components/Skeleton/Skeleton';
import Button from '../components/Button/Button';
import Card from '../components/Card/Card';
import EmptyState from '../components/EmptyState/EmptyState';
import { useLayout } from '../contexts/LayoutContext';
import { useToast } from '../components/Toast/Toast';

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
  const { locked, reason } = useSecurityUiLock();
  const { level, class_name, displayName } = useLevelFilter();
  const { bootstrap } = useLayout();
  const addToast = useToast();

  const [stage, setStage] = useState(STAGE.LOADING);
  const [selectedDeck, setSelectedDeck] = useState(null);
  const [sessionResult, setSessionResult] = useState(null);
  const [knownIds, setKnownIds] = useState([]);
  const [decks, setDecks] = useState([]);
  const [error, setError] = useState(null);

  const levelName = displayName || level || '';
  const classLabel = class_name || '';

  useEffect(() => {
    if (!user || !isReady || !access.canAccess) return;

    init();
  }, [user, isReady, access.canAccess, level, class_name]);

  async function init() {
    setStage(STAGE.LOADING);

    try {
      const [knownData, decksData] = await Promise.all([
        getKnownFlashcards(),
        getFlashcardDecks({})
      ]);

      setKnownIds(knownData || []);
      setDecks(decksData || []);
      setStage(STAGE.SUBJECT);
    } catch {
      setError('Failed to load flashcards. Please refresh.');
    }
  }

  function handleDeckSelect(deck) {
    if (locked) {
      addToast(reason || 'Action temporarily disabled', 'error');
      return;
    }

    setSelectedDeck(deck);
    setStage(STAGE.STUDY);
  }

  async function handleStudyComplete({ sessionId, total }) {
    let result = {
      total,
      correct: 0,
      incorrect: 0,
      score: 0
    };

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

  function getEmptyStateImage(key) {
    const uiComponents = bootstrap?.ui_components || [];
    const component = uiComponents.find((item) => item.component_key === `empty_state_${key}`);

    return component?.properties?.image_url || null;
  }

  if (!isReady || access.isPending) return <PendingApprovalScreen />;
  if (!access.canAccess) return <AccessDenied />;

  if (stage === STAGE.LOADING) {
    return (
      <div className="fcd-loading-wrap">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="section flashcard-error">
        <EmptyState
          image={getEmptyStateImage('general')}
          title="Error"
          description={error}
          action={<Button onClick={init}>Try Again</Button>}
        />
      </div>
    );
  }

  if (stage === STAGE.SUBJECT) {
    return (
      <div className="flashcards-page">
        <div className="section flashcard-subject-section">
          <span className="sec-label">Study Tools</span>
          <h1 className="section-title flashcard-title">
            Flashcards<br />{levelName ? `– ${levelName}` : ''}
          </h1>

          {classLabel && <p className="flashcard-class">{classLabel}</p>}

          <p className="section-subtitle flashcard-subtitle">
            Select a deck to start studying.
          </p>

          {decks.length === 0 ? (
            <EmptyState
              image={getEmptyStateImage('flashcards')}
              title="No Decks Available"
              description={`No flashcard decks found for ${classLabel || levelName || 'your level'}.`}
            />
          ) : (
            <div className="flashcard-decks-grid">
              {decks.map((deck) => (
                <Card key={deck.id}>
                  <div className="card-image-placeholder">
                    <Icon name="layer-group" className="flashcard-deck-icon" />
                  </div>

                  <div className="card-body">
                    <h3 className="card-title">{deck.title}</h3>
                    <p className="card-text">{deck.description || 'No description'}</p>

                    {deck.card_types && (
                      <div className="flashcard-type-row">
                        {deck.card_types.map((type) => (
                          <span key={type} className="chip">{type.replace('_', ' ')}</span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="card-footer">
                    <Button size="sm" icon="play" onClick={() => handleDeckSelect(deck)} disabled={locked}>
                      Start
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
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
