 import { useState } from 'react';
import Icon from '../../components/Icon/Icon';
import Button from '../../components/Button/Button';
import { useLayout } from '../../contexts/LayoutContext';

const CONTENT_TYPES = [
  {
    key: 'notes',
    label: 'Notes',
    description: 'Structured topic notes with diagrams and summaries',
    icon: 'book-open',
    route: '/notes',
    color: 'blue'
  },
  {
    key: 'flashcards',
    label: 'Flashcards',
    description: 'Active recall with flip, typed, and MCQ modes',
    icon: 'layer-group',
    route: '/flashcards',
    color: 'teal'
  },
  {
    key: 'pdfs',
    label: 'PDF Library',
    description: 'Downloadable guides and reference sheets',
    icon: 'file-pdf',
    route: '/pdfs',
    color: 'violet'
  },
  {
    key: 'quizzes',
    label: 'Quizzes',
    description: 'Block-by-block testing across every unit',
    icon: 'clipboard-check',
    route: '/quiz',
    color: 'amber'
  },
  {
    key: 'past_papers',
    label: 'Past Papers',
    description: 'Real exam papers by year and board',
    icon: 'file-lines',
    route: '/past-papers',
    color: 'emerald'
  },
  {
    key: 'recall',
    label: 'Recall',
    description: 'Spaced repetition for lasting memory',
    icon: 'brain',
    route: '/recall',
    color: 'blue'
  }
];

export default function ContentFlipSection({ sections, navigate, user }) {
  const { bootstrap } = useLayout();
  const uiComponents = bootstrap?.ui_components || [];

  const [flipped, setFlipped] = useState(false);

  function getComponentProperties(component) {
    if (!component?.properties) {
      return {};
    }

    if (typeof component.properties === 'string') {
      try {
        return JSON.parse(component.properties);
      } catch (error) {
        console.error(
          `Invalid properties for component: ${component.component_key}`,
          error
        );
        return {};
      }
    }

    return component.properties;
  }

  function getCardImage(key) {
    const component = uiComponents.find(
      (item) => item.component_key === `content_type_${key}`
    );

    const properties = getComponentProperties(component);

    return properties.image_url || null;
  }

  function getIntroImage() {
    const component = uiComponents.find(
      (item) => item.component_key === 'flip_intro_image'
    );

    const properties = getComponentProperties(component);

    return properties.image_url || null;
  }

  const introImage = getIntroImage();

  const title =
    sections?.flip?.title || 'Master Your Subjects';

  const description =
    sections?.flip?.description ||
    'Click Start to explore six powerful learning tools designed to help you excel.';

  return (
    <section className="flip-section">
      <div className="flip-container">
        <div className={`flip-inner ${flipped ? 'flipped' : ''}`}>

          {/* FRONT */}
          <div className="flip-front">
            {introImage && (
              <img
                src={introImage}
                alt="Introduction to learning tools"
                className="flip-image"
                loading="eager"
                decoding="async"
              />
            )}

            <h2 className="flip-title">
              {title}
            </h2>

            <p className="flip-description">
              {description}
            </p>

            <Button
              variant="primary"
              size="lg"
              onClick={() => setFlipped(true)}
            >
              Start
            </Button>
          </div>

          {/* BACK */}
          <div className="flip-back">
            <button
              type="button"
              className="back-btn"
              onClick={() => setFlipped(false)}
            >
              <span aria-hidden="true">←</span>
              <span>Back</span>
            </button>

            <div className="grid-frame">
              <div className="grid grid-cols-3">
                {CONTENT_TYPES.map((type) => {
                  const imageUrl = getCardImage(type.key);

                  return (
                    <div
                      key={type.key}
                      className={`card card-${type.color}`}
                    >
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={type.label}
                          className="card-image"
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <div className="card-image-placeholder">
                          <Icon
                            name={
                              type.icon === 'dna'
                                ? 'microscope'
                                : type.icon
                            }
                          />
                        </div>
                      )}

                      <div className="card-body">
                        <h3 className="card-title">
                          {type.label}
                        </h3>

                        <p className="card-text">
                          {type.description}
                        </p>
                      </div>

                      <div className="card-footer">
                        <Button
                          size="sm"
                          variant="secondary"
                          className="btn-radius-sm"
                          onClick={() =>
                            navigate(
                              user ? type.route : '/login'
                            )
                          }
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
