/* components/Breadcrumb/Breadcrumb.jsx */
import { Link } from 'react-router-dom';
import Icon from '../Icon/Icon';

export default function Breadcrumb({ items = [] }) {
  if (!items.length) return null;
  return (
    <nav className="breadcrumb" aria-label="Breadcrumb">
      {items.map((item, idx) => (
        <span key={idx}>
          {idx > 0 && <Icon name="chevron-right" className="breadcrumb-sep" />}
          {item.href ? (
            <Link to={item.href} className="breadcrumb-link">{item.label}</Link>
          ) : (
            <span className="breadcrumb-current">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
