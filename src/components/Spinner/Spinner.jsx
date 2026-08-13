 /* components/Spinner/Spinner.jsx */
export default function Spinner({ size, variant = 'primary' }) {
  return (
    <div
      className={`spinner spinner-${variant} ${
        size === 'sm' ? 'spinner-sm' : size === 'lg' ? 'spinner-lg' : ''
      }`}
      role="status"
      aria-label="Loading"
    />
  );
}
