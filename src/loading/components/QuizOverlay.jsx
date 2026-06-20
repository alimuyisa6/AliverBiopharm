export default function QuizOverlay({ message }) {
  return (
    <div className="alv-quiz-overlay">
      <div className="alv-quiz-dots"><span /><span /><span /></div>
      <p className="alv-quiz-msg">{message || "Loading quiz…"}</p>
    </div>
  );
}
