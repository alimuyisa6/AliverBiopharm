/* components/Container/Container.jsx */
export default function Container({ children, className = '' }) {
  return <div className={`section ${className}`}>{children}</div>;
}
