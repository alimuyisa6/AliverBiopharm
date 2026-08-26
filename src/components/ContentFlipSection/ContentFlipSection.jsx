// components/ContentFlipSection/ContentFlipSection.jsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../components/Icon/Icon';
import Button from '../../components/Button/Button';
import { useLayout } from '../../contexts/LayoutContext';

const CONTENT_TYPES = [
  { key: 'notes', label: 'Notes', description: 'Structured topic notes with diagrams and summaries', icon: 'book-open', route: '/notes', color: 'blue' },
  { key: 'flashcards', label: 'Flashcards', description: 'Active recall with flip, typed, and MCQ modes', icon: 'layer-group', route: '/flashcards', color: 'teal' },
  { key: 'pdfs', label: 'PDF Library', description: 'Downloadable guides and reference sheets', icon: 'file-pdf', route: '/pdfs', color: 'violet' },
  { key: 'quizzes', label: 'Quizzes', description: 'Block-by-block testing across every unit', icon: 'clipboard-check', route: '/quiz', color: 'amber' },
  { key: 'past_papers', label: 'Past Papers', description: 'Real exam papers by year and board', icon: 'file-lines', route: '/past-papers', color: 'emerald' },
  { key: 'recall', label: 'Recall', description: 'Spaced repetition for lasting memory', icon: 'brain', route: '/recall', color: 'blue' }
];

export default function ContentFlipSection({ sections, navigate, user }) {
  const { bootstrap } = useLayout();
  const uiComponents = bootstrap?.ui_components || [];
  const [flipped, setFlipped] = useState(false);

  function getCardImage(key) {
    const component = uiComponents.find((item) => item.component_key === `content_type_${key}`);
    return component?.properties?.image_url || null;
  }

  function getIntroImage() {
    const component = uiComponents.find((item) => item.component_key === 'flip_intro_image');
    return component?.properties?.image_url || null;
  }

  const introImage = getIntroImage();
  const title = sections?.flip?.title || 'Your Learning Hub';
  const description = sections?.flip?.description || 'Explore six powerful tools to master your subjects.';

  return (
    <section className="flip-section reveal">
      <div className="flip-container">
        <div className={`flip-inner ${flipped ? 'flipped' : ''}`}>
          <div className="flip-front">
            {introImage && (
              <img src={introImage} alt="Intro" className="flip-image" loading="lazy" />
            )}
            <h2 className="flip-title">{title}</h2>
            <p className="flip-description">{description}</p>
            <Button variant="primary" onClick={() => setFlipped(true)}>
              Start
            </Button>
          </div>

          <div className="flip-back">
            <button className="back-btn" onClick={() => setFlipped(false)}>
              ← Back
            </button>
            <div className="grid-frame">
              <div className="grid grid-cols-3">
                {CONTENT_TYPES.map((type) => {
                  const imageUrl = getCardImage(type.key);
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
                          className="btn-radius-sm"
                          onClick={() => navigate(user ? type.route : '/login')}
                        >
                          Browse {type.label}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
