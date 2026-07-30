/* components/Spinner/Spinner.jsx */
export default function Spinner({ size }) {
  return <div className={`spinner ${size === 'sm' ? 'spinner-sm' : size === 'lg' ? 'spinner-lg' : ''}`} />;
}
