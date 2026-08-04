 /* components/EmptyState/EmptyState.jsx */
import Icon from '../Icon/Icon';

export default function EmptyState({ icon, image, title, description, action }) {
  return (
    <div className="empty-state">
      {image ? (
        <img src={image} alt={title || 'Empty state'} className="empty-state-image" loading="lazy" />
      ) : icon ? (
        <Icon name={icon} className="empty-state-icon" />
      ) : null}
      {title && <h3 className="empty-state-title">{title}</h3>}
      {description && <p className="empty-state-text">{description}</p>}
      {action}
    </div>
  );
}
