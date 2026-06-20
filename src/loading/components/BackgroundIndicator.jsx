export default function BackgroundIndicator({ active }) {
  if (!active) return null;
  return (
    <div className="alv-bg-indicator">
      <div className="alv-bg-dots"><span /><span /><span /></div>
      <span className="alv-bg-label">Syncing</span>
    </div>
  );
}
