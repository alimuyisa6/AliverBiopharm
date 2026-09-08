 import { useLayout } from '../../contexts/LayoutContext';

const STEPS = [
  {
    number: '01',
    componentKey: 'how_it_works_account_icon',
    title: 'Create your account',
    text: 'Sign up for free and choose the learning pathway that matches your studies — O-Level, A-Level, or Pharmacy.'
  },
  {
    number: '02',
    componentKey: 'how_it_works_study_icon',
    title: 'Study with purpose',
    text: 'Explore syllabus-aligned notes, flashcards, quizzes, recall activities, and other resources designed to support the way you learn.'
  },
  {
    number: '03',
    componentKey: 'how_it_works_progress_icon',
    title: 'Build your progress',
    text: 'Keep learning consistently, strengthen weaker areas, and watch your knowledge, activity, and progress develop over time.'
  }
];

export function HowItWorksSection() {
  const { bootstrap } = useLayout();

  const uiComponents = bootstrap?.ui_components || [];

  return (
    <section className="section how-it-works-section">
      <div className="section-head">
        <div className="section-head-left">
          <span className="eyebrow">Getting Started</span>

          <h2>Start learning in three simple steps</h2>

          <p className="section-description">
            AliverBiopharm keeps the beginning simple: choose your pathway,
            find the right learning resources, and build your understanding
            step by step.
          </p>
        </div>
      </div>

      <div className="how-it-works-grid">
        {STEPS.map((step) => {
          const component = uiComponents.find(
            (item) => item.component_key === step.componentKey
          );

          const imageUrl = component?.properties?.image_url;

          return (
            <article key={step.number} className="how-step">
              <div className="how-step-top">
                <span className="how-step-number">
                  {step.number}
                </span>

                {imageUrl && (
                  <div className="how-step-icon">
                    <img
                      src={imageUrl}
                      alt=""
                      className="how-step-icon-image"
                    />
                  </div>
                )}
              </div>

              <div className="how-step-content">
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
