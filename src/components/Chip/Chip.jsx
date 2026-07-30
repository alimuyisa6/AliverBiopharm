/* components/Chip/Chip.jsx */
import Icon from '../Icon/Icon';

export default function Chip({ children, icon, onRemove, className = '' }) {
  return (
    <span className={`chip ${className}`}>
      {icon && <Icon name={icon} />}
      {children}
      {onRemove && (
        <button className="chip-remove" onClick={onRemove} aria-label="Remove">
          <Icon name="xmark" />
        </button>
      )}
    </span>
  );
}
