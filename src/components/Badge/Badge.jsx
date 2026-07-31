/* components/Badge/Badge.jsx */
import Icon from '../Icon/Icon';

export default function Badge({ children, variant = 'primary', icon, className = '' }) {
  return (
    <span className={`badge badge-${variant} ${className}`}>
      {icon && <Icon name={icon} />}
      {children}
    </span>
  );
}
