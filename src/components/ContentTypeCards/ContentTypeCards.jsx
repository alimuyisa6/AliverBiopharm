 /* features/home/ContentTypeCards.jsx */
import { useNavigate } from 'react-router-dom';
import Icon from '../../components/Icon/Icon';
import Button from '../../components/Button/Button';
import { useAuth } from '../../contexts/AuthContext';
import { useLayout } from '../../contexts/LayoutContext';

const CONTENT_TYPES = [
  { key: 'notes', label: 'Notes', description: 'Structured topic notes with diagrams and summaries', icon: 'book-open', route: '/notes', color: 'blue' },
  { key: 'flashcards', label: 'Flashcards', description: 'Active recall with flip, typed, and MCQ modes', icon: 'layer-group', route: '/flashcards', color: 'teal' },
  { key: 'pdfs', label: 'PDF Library', description: 'Downloadable guides and reference sheets', icon: 'file-pdf', route: '/pdfs', color: 'grey' },
  { key: 'quizzes', label: 'Quizzes', description: 'Block-by-block testing across every unit', icon: 'clipboard-check', route: '/quiz', color: 'amber' },
  { key: 'past_papers', label: 'Past Papers', description: 'Real exam papers by year and board', icon: 'file-lines', route: '/past-papers', color: 'emerald' },
  { key: 'recall', label: 'Recall', description: 'Spaced repetition for lasting memory', icon: 'brain', route: '/recall', color: 'blue' }
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
    <section className="section">
      <div className="section-head">
        <div className="section-head-left">
          <span className="eyebrow">Inside</span>
          <h2>Everything you need to succeed</h2>
        </div>
      </div>
      <div className="row-list">
        {CONTENT_TYPES.map((type) => {
          const imageUrl = getImage(type.key);
          return (
            <div key={type.key} className="content-type-row">
              <div className="content-type-thumb">
                {imageUrl ? (
                  <img src={imageUrl} alt={type.label} loading="lazy" />
                ) : (
                  <Icon name={type.icon === 'dna' ? 'microscope' : type.icon} />
                )}
              </div>
              <div className="content-type-info">
                <div className="content-type-title">{type.label}</div>
                <div className="content-type-desc">{type.description}</div>
              </div>
              <div className="row-actions">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => navigate(isAuthenticated ? type.route : '/login')}
                >
                  Browse
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
