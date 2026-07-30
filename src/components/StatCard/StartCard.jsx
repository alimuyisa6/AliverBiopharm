/* components/StatCard/StatCard.jsx */
import Icon from '../Icon/Icon';

export default function StatCard({ icon, value, label, color }) {
  return (
    <div className="stat-card">
      {icon && <Icon name={icon} className="stat-icon" style={color ? { color: `var(--${color})` } : undefined} />}
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
