 /* features/home/HowItWorksSection.jsx */
const STEPS = [
  { number: '1', title: 'Create your account', text: 'Sign up free and choose O-Level, A-Level, or Pharmacy.' },
  { number: '2', title: 'Study your way', text: 'Work through notes, flashcards, and quizzes built for your syllabus.' },
  { number: '3', title: 'Track your progress', text: 'Follow your streak, weak areas, and improvement as you go.' }
];

export function HowItWorksSection() {
  return (
    <section className="section">
      <div className="section-head">
        <div className="section-head-left">
          <span className="eyebrow">Getting Started</span>
          <h2>Three steps to better grades</h2>
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
