 /* features/home/WhyChooseSection.jsx */
const REASONS = [
  { number: '1', title: 'Syllabus-Aligned Content', text: 'Every note and quiz matches your official curriculum, not generic material.', color: 'blue' },
  { number: '2', title: 'Built to Stick', text: 'Flashcards and spaced repetition designed for retention, not just re-reading.', color: 'amber' },
  { number: '3', title: 'Real Exam Practice', text: 'Past papers and block quizzes modeled on the actual exam structure.', color: 'teal' },
  { number: '4', title: 'Never Stuck Alone', text: 'Live classrooms and tutors are there when a note alone is not enough.', color: 'grey' }
];

export function WhyChooseSection() {
  return (
    <section className="section">
      <div className="section-head">
        <div className="section-head-left">
          <span className="eyebrow">Why Aliver</span>
          <h2>Built with purpose</h2>
        </div>
      </div>
      <div className="why-choose-row">
        {REASONS.map((reason) => (
          <div key={reason.number} className="why-choose-item">
            <div className={`num num-${reason.color}`}>{reason.number}</div>
            <h3>{reason.title}</h3>
            <p>{reason.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
