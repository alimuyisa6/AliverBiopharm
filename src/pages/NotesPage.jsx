 import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useContentAccess } from '../hooks/useContentAccess';
import { useLevelFilter } from '../hooks/useLevelFilter';
import { useLayout } from '../contexts/LayoutContext';
import { getNotesList } from '../api/client';
import Card from '../components/Card/Card';
import Icon from '../components/Icon/Icon';
import Skeleton from '../components/Skeleton/Skeleton';
import EmptyState from '../components/EmptyState/EmptyState';
import Button from '../components/Button/Button';
import Container from '../components/Container/Container';

export default function NotesPage() {
  const navigate = useNavigate();
  const access = useContentAccess();
  const { level, class_name, displayName } = useLevelFilter();
  const { bootstrap } = useLayout();

  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!access.canAccess) {
      setLoading(false);
      return;
    }

    let mounted = true;

    loadContent(mounted);

    return () => {
      mounted = false;
    };
  }, [access.canAccess, level, class_name]);

  async function loadContent(mounted = true) {
    setLoading(true);

    try {
      const data = await getNotesList();

      if (mounted) setNotes(Array.isArray(data) ? data : []);
    } catch {
      if (mounted) setError('Failed to load notes.');
    } finally {
      if (mounted) setLoading(false);
    }
  }

  function getEmptyStateImage(key) {
    const uiComponents = bootstrap?.ui_components || [];
    const component = uiComponents.find((item) => item.component_key === `empty_state_${key}`);

    return component?.properties?.image_url || null;
  }

  if (!access.canAccess) {
    return (
      <Container>
        <EmptyState
          image={getEmptyStateImage('notes')}
          title="Access Restricted"
          description="Your account does not have access to study notes."
        />
      </Container>
    );
  }

  const levelName = displayName || level || '';
  const classLabel = class_name || '';

  return (
    <Container>
      <div className="notes-page">
        <span className="sec-label font-mono">Study Notes</span>
        <h1 className="section-title notes-page-title font-fraunces">
          Notes<br />{levelName ? `– ${levelName}` : ''}
        </h1>

        {classLabel && <p className="notes-page-class font-maven-pro">{classLabel}</p>}

        <nav className="breadcrumb font-mono">
          <Link to="/"><Icon name="home" className="breadcrumb-icon" /> Home</Link>
          <Icon name="chevron-right" className="breadcrumb-sep" />
          <span className="font-maven-pro">Notes</span>
        </nav>

        {loading ? (
          <div className="notes-skeleton-grid">
            <Skeleton height={160} />
            <Skeleton height={160} />
            <Skeleton height={160} />
          </div>
        ) : error ? (
          <EmptyState
            image={getEmptyStateImage('error')}
            title="Error"
            description={error}
            action={<Button onClick={() => loadContent()}>Try Again</Button>}
          />
        ) : notes.length === 0 ? (
          <EmptyState
            image={getEmptyStateImage('notes')}
            title="No Notes Available"
            description={`No study notes found for ${classLabel || levelName || 'your level'}.`}
          />
        ) : (
          <div className="notes-grid">
            {notes.map((note) => (
              <Card
                key={note.id}
                variant="blue-strong"
                className="card-round notes-card"
                image={note.topic_image_url || undefined}
                icon={note.topic_image_url ? undefined : 'book-open'}
                title={note.title}
                description={note.content_preview}
                footer={
                  <Button size="sm" onClick={() => navigate(`/notes/read?id=${note.id}`)}>
                    Read Note
                  </Button>
                }
                onClick={() => navigate(`/notes/read?id=${note.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </Container>
  );
}
