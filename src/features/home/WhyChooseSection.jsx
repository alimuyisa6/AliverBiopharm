 import { Link } from 'react-router-dom';

const REASONS = [
  { number: '1', title: 'Syllabus-Aligned Content', text: 'Every note and quiz matches your official curriculum, not generic material.', color: 'blue' },
  { number: '2', title: 'Built to Stick', text: 'Flashcards and spaced repetition designed for retention, not just re-reading.', color: 'amber' },
  { number: '3', title: 'Real Exam Practice', text: 'Past papers and block quizzes modeled on the actual exam structure.', color: 'teal' },
  { number: '4', title: 'Never Stuck Alone', text: 'Live classrooms and tutors are there when a note alone is not enough.', color: 'grey' }
];

export function WhyChooseSection() {
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

      <div className="numbered-stack">
        {REASONS.map((reason) => (
          <div key={reason.number} className={`numbered-item numbered-item-${reason.color}`}>
            <div className={`numbered-circle numbered-circle-${reason.color}`}>
              {reason.number}
            </div>
            <h3 className="numbered-title">{reason.title}</h3>
            <p className="numbered-text">{reason.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
