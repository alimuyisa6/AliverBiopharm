/* components/Grid/Grid.jsx */
export default function Grid({ children, cols = 3, gap, className = '' }) {
  return (
    <div
      className={`grid grid-cols-${cols} ${className}`}
      style={gap ? { gap: `var(--space-${gap})` } : undefined}
    >
      {children}
    </div>
  );
}
