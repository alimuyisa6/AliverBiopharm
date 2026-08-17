 /* components/Spinner/Spinner.jsx */
export default function Spinner({ 
  size, 
  variant = 'primary',
  context = 'default'
}) {
  const loaderMap = {
    default: `spinner spinner-${variant}`,
    brand: 'spinner-brand',
    conic: 'spinner-conic',
    media: 'spinner-equalizer',
    data: 'spinner-chart',
  };

  const sizeClass = size === 'sm' ? 'spinner-sm' : size === 'lg' ? 'spinner-lg' : '';
  
  if (context === 'media' || context === 'data') {
    const barCount = context === 'media' ? 5 : 7;
    return (
      <div
        className={`${loaderMap[context]} ${sizeClass}`}
        role="status"
        aria-label="Loading"
      >
        {Array.from({ length: barCount }).map((_, i) => (
          <span key={i}></span>
        ))}
      </div>
    );
  }

  return (
    <div
      className={`${loaderMap[context] || loaderMap.default} ${sizeClass}`}
      role="status"
      aria-label="Loading"
    />
  );
}
