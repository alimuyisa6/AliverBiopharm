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

  /**
   * ui_components.properties may arrive from Supabase
   * either as an object or as a JSON string.
   */
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

  /**
   * Resolve an image from:
   * content_type_notes
   * content_type_flashcards
   * content_type_pdfs
   * content_type_quizzes
   * content_type_past_papers
   * content_type_recall
   */
  function getCardImage(key) {
    const componentKey = `content_type_${key}`;

    const component = uiComponents.find(
      (item) => item.component_key === componentKey
    );

    if (!component) {
      return null;
    }

    const properties = getComponentProperties(component);

    return (
      typeof properties.image_url === 'string' &&
      properties.image_url.trim()
    )
      ? properties.image_url.trim()
      : null;
  }

  /**
   * Resolve the introduction image.
   */
  function getIntroImage() {
    const component = uiComponents.find(
      (item) => item.component_key === 'flip_intro_image'
    );

    if (!component) {
      return null;
    }

    const properties = getComponentProperties(component);

    return (
      typeof properties.image_url === 'string' &&
      properties.image_url.trim()
    )
      ? properties.image_url.trim()
      : null;
  }

  const introImage = getIntroImage();

  const title =
    sections?.flip?.title || 'Learn. Practise. Remember.';

  const description =
    sections?.flip?.description ||
    'Learning becomes more effective when you have the right tools at the right time. Explore clear, structured notes to build your understanding, use flashcards and Recall to strengthen long-term memory, test yourself with quizzes, practise with past papers, and keep useful guides and reference materials within reach. Whether you are learning something for the first time, revising a familiar concept, preparing for an assessment, or working towards an examination, these tools give you different ways to engage with what you are learning. Understand the material, put your knowledge into practice, identify what needs more attention, and return to it until you can recall it with confidence.';

  return (
    <section className="flip-section">
      <div className="flip-container">
        <div className={`flip-inner ${flipped ? 'flipped' : ''}`}>

          {/* =====================================================
              FRONT
          ====================================================== */}

          <div className="flip-front">
            <div className="flip-front-content">

              <h2 className="flip-title">
                {title}
              </h2>

              {introImage && (
                <img
                  src={introImage}
                  alt="Learning tools"
                  className="flip-image"
                  loading="eager"
                  decoding="async"
                />
              )}

              <p className="flip-description">
                {description}
              </p>

              <Button
                variant="primary"
                size="lg"
                className="flip-start-button"
                onClick={() => setFlipped(true)}
              >
                Start Your Learning Journey
              </Button>

            </div>
          </div>

          {/* =====================================================
              BACK
          ====================================================== */}

          <div className="flip-back">

            <div className="flip-back-header">
              <button
                type="button"
                className="back-btn"
                onClick={() => setFlipped(false)}
                aria-label="Return to introduction"
              >
                <span aria-hidden="true">←</span>
                <span>Back</span>
              </button>
            </div>

            <div className="flip-back-content">

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
      </div>
    </section>
  );
}
