  /* features/home/HowItWorksSection.jsx */
const STEPS = [
  { number: '1', title: 'Create your account', text: 'Sign up free and pick O-Level, A-Level, or Pharmacy.' },
  { number: '2', title: 'Study your way', text: 'Work through notes, flashcards, and quizzes built around your syllabus.' },
  { number: '3', title: 'Watch it add up', text: 'Your streak, weak spots, and progress update as you go.' }
];

export function HowItWorksSection() {
  return (
    <section className="section">
      <div className="section-head">
        <div className="section-head-left">
          <span className="eyebrow">Getting Started</span>
          <h2>Three steps, then you're studying</h2>
        </div>
      </div>
      <div className="how-it-works">
        {STEPS.map((step) => (
          <div key={step.number} className="how-step">
            <div className="num">{step.number}</div>
            <h3>{step.title}</h3>
            <p>{step.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
