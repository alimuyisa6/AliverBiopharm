 /* src/features/home/HowItWorksSection.jsx */

import Icon from '../../components/Icon/Icon';

const STEPS = [
  {
    number: '01',
    icon: 'user-plus',
    title: 'Create your account',
    text: 'Sign up for free and choose the learning pathway that matches your studies — O-Level, A-Level, or Pharmacy.'
  },
  {
    number: '02',
    icon: 'book-open',
    title: 'Study with purpose',
    text: 'Explore syllabus-aligned notes, flashcards, quizzes, recall activities, and other resources designed to support the way you learn.'
  },
  {
    number: '03',
    icon: 'trending-up',
    title: 'Build your progress',
    text: 'Keep learning consistently, strengthen weaker areas, and watch your knowledge, activity, and progress develop over time.'
  }
];

export function HowItWorksSection() {
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
        {STEPS.map((step) => (
          <article
            key={step.number}
            className="how-step"
          >
            <div className="how-step-top">
              <span className="how-step-number">
                {step.number}
              </span>

              <div className="how-step-icon" aria-hidden="true">
                <Icon name={step.icon} />
              </div>
            </div>

            <div className="how-step-content">
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
