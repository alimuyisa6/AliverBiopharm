 /* components/Skeleton/Skeleton.jsx */
export default function Skeleton({ 
  width, 
  height = 16, 
  borderRadius, 
  className = '',
  variant = 'default',
  lines = 1,
  avatar = false
}) {
  if (variant === 'card') {
    return (
      <div className={`skeleton-card ${className}`.trim()} aria-hidden="true">
        {avatar && <div className="skeleton skeleton-avatar" />}
        {Array.from({ length: lines }).map((_, i) => (
          <div 
            key={i}
            className="skeleton skeleton-line" 
            style={{ width: i === lines - 1 ? '80%' : '100%' }}
          />
        ))}
      </div>
    );
  }

  if (variant === 'text') {
    return (
      <div className={`skeleton-text ${className}`.trim()} aria-hidden="true">
        {Array.from({ length: lines }).map((_, i) => (
          <div 
            key={i}
            className="skeleton skeleton-line" 
            style={{ width: i === lines - 1 ? '60%' : '100%' }}
          />
        ))}
      </div>
    );
  }

  if (variant === 'avatar') {
    return (
      <div 
        className={`skeleton skeleton-avatar ${className}`.trim()}
        style={{ width: width || 60, height: height || 60 }}
        aria-hidden="true"
      />
    );
  }

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
