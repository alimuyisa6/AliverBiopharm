/* components/ProgressBar/ProgressBar.jsx */
export default function ProgressBar({ value = 0, max = 100, variant = 'primary', showLabel, size }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className={`progress-track ${size === 'sm' ? 'progress-sm' : ''}`}>
      <div
        className={`progress-fill ${variant.startsWith('progress-') ? variant : `progress-${variant}`}`}
        style={{ width: `${pct}%` }}
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
      />
      {showLabel && <span className="progress-label">{Math.round(pct)}%</span>}
    </div>
  );
}
