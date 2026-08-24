const STEPS = [
  { number: '1', title: 'Create your account', text: 'Sign up free and choose O-Level, A-Level, or Pharmacy.' },
  { number: '2', title: 'Study your way', text: 'Work through notes, flashcards, and quizzes built for your syllabus.' },
  { number: '3', title: 'Track your progress', text: 'Follow your streak, weak areas, and improvement as you go.' }
];

export function HowItWorksSection() {
  return (
    <section className="section section-tint reveal">
      <span className="sec-label">Getting Started</span>
      <h2 className="section-title">
        Three Steps to<br />Better Grades
      </h2>
      <p className="section-subtitle">
        No setup complexity — you can be studying in under a minute.
      </p>

      <div className="how-it-works-row">
        {STEPS.map((step, index) => (
          <div key={step.number} className="how-it-works-step">
            <div className="how-it-works-number">{step.number}</div>
            <h3 className="how-it-works-title">{step.title}</h3>
            <p className="how-it-works-text">{step.text}</p>
            {index < STEPS.length - 1 && <div className="how-it-works-connector" />}
          </div>
        ))}
      </div>
    </section>
  );
}
