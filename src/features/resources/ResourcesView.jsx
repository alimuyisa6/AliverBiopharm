/* features/resources/ResourcesView.jsx */
import Icon from '../../components/Icon/Icon';
import Button from '../../components/Button/Button';
import { useLayout } from '../../contexts/LayoutContext';
import './resources.css';

const CONTENT_TYPES = [
  { key: 'notes', label: 'Notes', description: 'Structured topic notes with diagrams and summaries', icon: 'book-open', route: '/notes', color: 'blue' },
  { key: 'flashcards', label: 'Flashcards', description: 'Active recall with flip, typed, and MCQ modes', icon: 'layer-group', route: '/flashcards', color: 'teal' },
  { key: 'pdfs', label: 'PDF Library', description: 'Downloadable guides and reference sheets', icon: 'file-pdf', route: '/pdfs', color: 'grey' },
  { key: 'quizzes', label: 'Quizzes', description: 'Block-by-block testing across every unit', icon: 'clipboard-check', route: '/quiz', color: 'amber' },
  { key: 'past_papers', label: 'Past Papers', description: 'Real exam papers by year and board', icon: 'file-lines', route: '/past-papers', color: 'emerald' },
  { key: 'recall', label: 'Recall', description: 'Spaced repetition for lasting memory', icon: 'brain', route: '/recall', color: 'blue' }
];

export default function ResourcesView({ navigate, user, sections }) {
  const { bootstrap } = useLayout();
  const uiComponents = bootstrap?.ui_components || [];

  function getImage(key) {
    const component = uiComponents.find((item) => item.component_key === `content_type_${key}`);
    return component?.properties?.image_url || null;
  }

  return (
    <div className="resources-page">
      <section className="section resources-hero">
        <span className="eyebrow">Resources</span>
        <h1>{sections?.section_headings?.content_types_title || 'Everything You Need to Succeed'}</h1>
        <p className="section-subtitle">{sections?.section_headings?.content_types_subtitle || 'Notes, flashcards, quizzes, past papers and recall — everything you need, all in one place.'}</p>
      </section>

      <section className="section">
        <div className="row-list row-list-tight">
          {CONTENT_TYPES.map((type) => {
            const imageUrl = getImage(type.key);
            return (
              <div key={type.key} className={`content-type-row content-type-row-${type.color}`}>
                <div className={`content-type-thumb content-type-thumb-${type.color}`}>
                  {imageUrl ? <img src={imageUrl} alt={type.label} loading="lazy" /> : <Icon name={type.icon} />}
                </div>
                <div className="content-type-info">
                  <div className="content-type-title">{type.label}</div>
                  <div className="content-type-desc">{type.description}</div>
                </div>
                <div className="row-actions">
                  <Button size="sm" variant="secondary" onClick={() => navigate(user ? type.route : '/login')}>Browse</Button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
