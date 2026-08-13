import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useContentAccess } from '../hooks/useContentAccess';
import { useLevelFilter } from '../hooks/useLevelFilter';
import { useLayout } from '../contexts/LayoutContext';
import { getPdfsByLevel } from '../api/client';
import Icon from '../components/Icon/Icon';
import Spinner from '../components/Spinner/Spinner';
import EmptyState from '../components/EmptyState/EmptyState';
import Button from '../components/Button/Button';
import Container from '../components/Container/Container';

export default function PdfLibraryPage() {
  const { user } = useAuth();
  const access = useContentAccess();
  const { level, class_name, displayName } = useLevelFilter();
  const { bootstrap } = useLayout();

  const [pdfs, setPdfs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!access.canAccess) {
      setLoading(false);
      return;
    }
    loadPdfs();
  }, [access.canAccess, level, class_name]);

  async function loadPdfs() {
    setLoading(true);
    try {
      const data = await getPdfsByLevel();
      setPdfs(Array.isArray(data) ? data : []);
    } catch {
      setPdfs([]);
    } finally {
      setLoading(false);
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
          image={getEmptyStateImage('pdfs')}
          title="Access Restricted"
          description="Your account does not have access to the PDF library."
        />
      </Container>
    );
  }

  const levelName = displayName || level || '';
  const classLabel = class_name || '';

  return (
    <Container>
      <div className="pdf-library-page">
        <span className="sec-label">PDF Library</span>
        <h1 className="section-title" style={{ textAlign: 'left', margin: '0 0 var(--space-3)' }}>
          PDF Resources{levelName ? ` – ${levelName}` : ''}
        </h1>
        {classLabel && (
          <p style={{ color: 'var(--text-dim)', marginBottom: 'var(--space-6)' }}>
            {classLabel}
          </p>
        )}

        <nav className="breadcrumb">
          <Link to="/"><Icon name="home" className="breadcrumb-icon" /> Home</Link>
          <Icon name="chevron-right" className="breadcrumb-sep" />
          <span>PDF Library</span>
        </nav>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-16)' }}>
            <Spinner size="lg" />
          </div>
        ) : pdfs.length === 0 ? (
          <EmptyState
            image={getEmptyStateImage('pdfs')}
            title="No PDFs Available"
            description={`No PDF resources found for ${classLabel || levelName || 'your level'}.`}
          />
        ) : (
          <div className="grid grid-cols-3">
            {pdfs.map((pdf) => (
              <div key={pdf.id} className="card">
                <div className="card-image-placeholder" style={{ background: 'var(--warm-light)' }}>
                  <Icon name="file-pdf" style={{ fontSize: '2rem', color: 'var(--error)' }} />
                </div>
                <div className="card-body">
                  <h3 className="card-title">{pdf.title}</h3>
                  {pdf.author && <p className="card-text">{pdf.author}</p>}
                  {pdf.file_size && (
                    <span className="chip" style={{ marginTop: 'var(--space-3)' }}>{pdf.file_size}</span>
                  )}
                </div>
                <div className="card-footer">
                  <a
                    href={pdf.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-primary btn-sm"
                  >
                    <Icon name="download" /> Download
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Container>
  );
}
