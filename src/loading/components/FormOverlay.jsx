export default function FormOverlay({ message }) {
  return (
    <div className="alv-form-overlay">
      <div className="alv-form-inner">
        <div className="alv-form-spinner" />
        <p className="alv-form-msg">{message || "Processing…"}</p>
      </div>
    </div>
  );
}
