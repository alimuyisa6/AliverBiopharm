 /* components/Skeleton/Skeleton.jsx */
export default function Skeleton({ width, height = 16, borderRadius, className = '' }) {
  return (
    <div
      className={`skeleton ${className}`.trim()}
      style={{
        width,
        height,
        borderRadius
      }}
      aria-hidden="true"
    />
  );
}
