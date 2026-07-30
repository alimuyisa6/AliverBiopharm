/* components/EmptyState/EmptyState.jsx */
import Icon from '../Icon/Icon';

export default function EmptyState({ icon, title, description, action }) {
  return (
    <div className="empty-state">
      {icon && <Icon name={icon} className="empty-state-icon" />}
      {title && <h3 className="empty-state-title">{title}</h3>}
      {description && <p className="empty-state-text">{description}</p>}
      {action}
    </div>
  );
}
