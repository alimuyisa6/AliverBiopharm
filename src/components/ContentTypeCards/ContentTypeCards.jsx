/* components/ContentTypeCards/ContentTypeCards.jsx */
import { useNavigate } from 'react-router-dom';
import Icon from '../Icon/Icon';
import { useAuth } from '../../contexts/AuthContext';

const TYPES = [
  { key: 'notes', label: 'Notes', description: 'Structured topic notes with diagrams and summaries', icon: 'book-open', route: '/notes' },
  { key: 'flashcards', label: 'Flashcards', description: 'Active recall with flip, typed, and MCQ modes', icon: 'layer-group', route: '/flashcards' },
  { key: 'pdfs', label: 'PDF Library', description: 'Downloadable guides and reference sheets', icon: 'file-pdf', route: '/pdfs' },
  { key: 'quizzes', label: 'Quizzes', description: 'Block-by-block testing across every unit', icon: 'clipboard-check', route: '/quiz' },
  { key: 'past_papers', label: 'Past Papers', description: 'Real exam papers by year and board', icon: 'file-lines', route: '/past-papers' },
  { key: 'recall', label: 'Recall', description: 'Spaced-repetition for long-term memory', icon: 'brain', route: '/recall' },
];

export default function ContentTypeCards() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  return (
    <section className="section reveal">
      <span className="sec-label">Explore</span>
      <h2 className="section-title">Everything You Need to Succeed</h2>
      <p className="section-subtitle">Pick where you want to start — every resource is tailored to your level.</p>
      <div className="grid grid-cols-3">
        {TYPES.map((type) => (
          <button
            key={type.key}
            className="card card-clickable"
            onClick={() => navigate(isAuthenticated ? type.route : '/login')}
          >
            <div className="card-image-placeholder">
              <Icon name={type.icon} />
            </div>
            <div className="card-body">
              <h3 className="card-title">{type.label}</h3>
              <p className="card-text">{type.description}</p>
            </div>
            <div className="card-footer">
              <span className="btn btn-secondary btn-sm">Browse {type.label}</span>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
