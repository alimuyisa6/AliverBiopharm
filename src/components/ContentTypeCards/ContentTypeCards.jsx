 /* features/home/ContentTypeCards.jsx */
import { useNavigate } from 'react-router-dom';
import Icon from '../../components/Icon/Icon';
import Button from '../../components/Button/Button';
import { useAuth } from '../../contexts/AuthContext';
import { useLayout } from '../../contexts/LayoutContext';

const CONTENT_TYPES = [
  { key: 'notes', label: 'Notes', description: 'Structured topic notes with diagrams and summaries', icon: 'book-open', route: '/notes', color: 'blue' },
  { key: 'flashcards', label: 'Flashcards', description: 'Active recall with flip, typed, and MCQ modes', icon: 'layer-group', route: '/flashcards', color: 'teal' },
  { key: 'pdfs', label: 'PDF Library', description: 'Downloadable guides and reference sheets', icon: 'file-pdf', route: '/pdfs', color: 'violet' },
  { key: 'quizzes', label: 'Quizzes', description: 'Block-by-block testing across every unit', icon: 'clipboard-check', route: '/quiz', color: 'amber' },
  { key: 'past_papers', label: 'Past Papers', description: 'Real exam papers by year and board', icon: 'file-lines', route: '/past-papers', color: 'emerald' },
  { key: 'recall', label: 'Recall', description: 'Spaced-repetition for long-term memory', icon: 'brain', route: '/recall', color: 'blue' }
];

export default function ContentTypeCards() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { bootstrap } = useLayout();

  const uiComponents = bootstrap?.ui_components || [];

  function getImage(key) {
    const component = uiComponents.find((item) => item.component_key === `content_type_${key}`);

    return component?.properties?.image_url || null;
  }

  return (
    <section className="section reveal">
      <span className="sec-label">Explore</span>
      <h2 className="section-title">
        Everything You Need<br />to Succeed
      </h2>
      <p className="section-subtitle">
        Pick where you want to start — every resource is tailored to your level.
      </p>

      <div className="grid grid-cols-3">
        {CONTENT_TYPES.map((type) => {
          const imageUrl = getImage(type.key);

          return (
            <div key={type.key} className={`card card-${type.color}`}>
              {imageUrl ? (
                <img src={imageUrl} alt={type.label} className="card-image" loading="lazy" />
              ) : (
                <div className="card-image-placeholder">
                  <Icon name={type.icon === 'dna' ? 'microscope' : type.icon} />
                </div>
              )}

              <div className="card-body">
                <h3 className="card-title">{type.label}</h3>
                <p className="card-text">{type.description}</p>
              </div>

              <div className="card-footer">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => navigate(isAuthenticated ? type.route : '/login')}
                >
                  Browse {type.label}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
