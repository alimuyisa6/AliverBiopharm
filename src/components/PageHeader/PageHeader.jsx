/* components/PageHeader/PageHeader.jsx */
import Icon from '../Icon/Icon';
import Badge from '../Badge/Badge';

export default function PageHeader({ title, subtitle, label, icon, badges = [] }) {
  return (
    <div className="page-header">
      {label && <span className="sec-label">{label}</span>}
      <h1 className="section-title" style={{ textAlign: 'left', margin: '0 0 var(--space-3)' }}>
        {icon && <Icon name={icon} style={{ marginRight: 'var(--space-3)' }} />}
        {title}
      </h1>
      {subtitle && <p className="section-subtitle" style={{ textAlign: 'left', margin: '0 0 var(--space-6)' }}>{subtitle}</p>}
      {badges.length > 0 && (
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginBottom: 'var(--space-6)' }}>
          {badges.map((b) => <Badge key={b.label} variant={b.variant} icon={b.icon}>{b.label}</Badge>)}
        </div>
      )}
    </div>
  );
}
