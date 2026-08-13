import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useContentAccess } from '../hooks/useContentAccess';
import { useLevelFilter } from '../hooks/useLevelFilter';
import { useLayout } from '../contexts/LayoutContext';
import { getNotesList, getNotesStructure } from '../api/client';
import Icon from '../components/Icon/Icon';
import Spinner from '../components/Spinner/Spinner';
import EmptyState from '../components/EmptyState/EmptyState';
import Button from '../components/Button/Button';
import Container from '../components/Container/Container';

export default function NotesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const access = useContentAccess();
  const { level, class_name, displayName } = useLevelFilter();
  const { bootstrap } = useLayout();

  const [notes, setNotes] = useState([]);
  const [structure, setStructure] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeUnitId, setActiveUnitId] = useState(null);

  useEffect(() => {
    if (!access.canAccess) {
      setLoading(false);
      return;
    }
    loadContent();
  }, [access.canAccess, level, class_name]);

  async function loadContent() {
    setLoading(true);
    try {
      const structureData = await getNotesStructure();
      const units = Array.isArray(structureData) ? structureData : [];
      setStructure(units);

      if (units.length) {
        const firstUnitId = units[0].unit_id;
        setActiveUnitId(firstUnitId);
        const notesData = await getNotesList(firstUnitId);
        setNotes(Array.isArray(notesData) ? notesData : []);
      } else {
        setNotes([]);
      }
    } catch {
      setNotes([]);
      setStructure([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleUnitSelect(unitId) {
    setActiveUnitId(unitId);
    try {
      const notesData = await getNotesList(unitId);
      setNotes(Array.isArray(notesData) ? notesData : []);
    } catch {
      setNotes([]);
    }
  }

  function getEmptyStateImage(key) {
    const uiComponents = bootstrap?.ui_components || [];
    const comp = uiComponents.find(c => c.component_key === `empty_state_${key}`);
    return comp?.properties?.image_url || null;
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
        <span className="sec-label">Study Notes</span>
        <h1 className="section-title" style={{ textAlign: 'left', margin: '0 0 var(--space-3)' }}>
          Notes{levelName ? ` – ${levelName}` : ''}
        </h1>
        {classLabel && (
          <p style={{ color: 'var(--text-dim)', marginBottom: 'var(--space-6)' }}>
            {classLabel}
          </p>
        )}

        <nav className="breadcrumb">
          <Link to="/"><Icon name="home" className="breadcrumb-icon" /> Home</Link>
          <Icon name="chevron-right" className="breadcrumb-sep" />
          <span>Notes</span>
        </nav>

        {structure.length > 0 && (
          <div className="notes-unit-tabs" style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-6)', flexWrap: 'wrap' }}>
            {structure.map((unit) => (
              <Button
                key={unit.unit_id}
                variant={activeUnitId === unit.unit_id ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => handleUnitSelect(unit.unit_id)}
              >
                {unit.unit_name}
              </Button>
            ))}
          </div>
        )}

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-16)' }}>
            <Spinner size="lg" />
          </div>
        ) : notes.length === 0 ? (
          <EmptyState
            image={getEmptyStateImage('notes')}
            title="No Notes Available"
            description={`No study notes found for ${classLabel || levelName || 'your level'}.`}
          />
        ) : (
          <div className="grid grid-cols-3">
            {notes.map((note) => (
              <button
                key={note.id}
                className="card card-clickable"
                onClick={() => navigate(`/notes/read?id=${note.id}`)}
              >
                <div className="card-image-placeholder">
                  <Icon name="book-open" style={{ fontSize: '2rem', color: 'var(--primary)' }} />
                </div>
                <div className="card-body">
                  <h3 className="card-title">{note.title}</h3>
                  {note.content_preview && (
                    <p className="card-text">{note.content_preview}</p>
                  )}
                  {note.read_time && (
                    <span className="chip" style={{ marginTop: 'var(--space-3)' }}>{note.read_time}</span>
                  )}
                </div>
                <div className="card-footer">
                  <span className="btn btn-primary btn-sm">Read Note</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </Container>
  );
}
