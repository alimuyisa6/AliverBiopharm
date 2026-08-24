import Icon from '../../components/Icon/Icon';
import { useLayout } from '../../contexts/LayoutContext';

const REASONS = [
  { key: 'syllabus', icon: 'graduation-cap', title: 'Syllabus-Aligned', text: 'Every note and quiz matches your official curriculum, not generic material.', color: 'blue' },
  { key: 'recall', icon: 'brain', title: 'Built to Stick', text: 'Flashcards and spaced repetition designed for retention, not just re-reading.', color: 'teal' },
  { key: 'exams', icon: 'file-lines', title: 'Real Exam Practice', text: 'Past papers and block quizzes modeled on the actual exam structure.', color: 'violet' },
  { key: 'support', icon: 'user-pen', title: 'Never Stuck Alone', text: 'Live classrooms and tutors are there when a note alone is not enough.', color: 'amber' }
];

export function WhyChooseSection() {
  const { bootstrap } = useLayout();
  const uiComponents = bootstrap?.ui_components || [];

  function getImage(key) {
    const component = uiComponents.find((item) => item.component_key === `why_choose_${key}`);

    return component?.properties?.image_url || null;
  }

  return (
    <section className="section reveal">
      <span className="sec-label">Why AliverBiopharm</span>
      <h2 className="section-title">
        Not Just Another<br />
        <span className="title-accent">Study Platform</span><br />
        Built With Purpose
      </h2>
      <p className="section-subtitle">
        A system designed around how students actually learn, not just another resource dump.
      </p>

      <div className="grid-frame">
        <div className="grid grid-cols-4">
          {REASONS.map((reason) => {
            const imageUrl = getImage(reason.key);

            return (
              <div key={reason.key} className={`card card-${reason.color}`}>
                {imageUrl ? (
                  <img src={imageUrl} alt={reason.title} className="card-image" loading="lazy" />
                ) : (
                  <div className="card-image-placeholder">
                    <Icon name={reason.icon} />
                  </div>
                )}

                <div className="card-body">
                  <h3 className="card-title">{reason.title}</h3>
                  <p className="card-text">{reason.text}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
