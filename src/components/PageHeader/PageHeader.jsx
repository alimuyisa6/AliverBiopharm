 /* components/PageHeader/PageHeader.jsx */
import Icon from '../Icon/Icon';
import Badge from '../Badge/Badge';

export default function PageHeader({ title, subtitle, label, icon, badges = [] }) {
  return (
    <div className="page-header">
      {label && <span className="sec-label">{label}</span>}

      <h1 className="section-title page-header-title">
        {icon && <Icon name={icon === 'dna' ? 'microscope' : icon} />}
        <span>{title}</span>
      </h1>

      {subtitle && <p className="section-subtitle page-header-subtitle">{subtitle}</p>}

      {badges.length > 0 && (
        <div className="page-header-badges">
          {badges.map((badge) => (
            <Badge
              key={badge.label}
              variant={badge.variant}
              icon={badge.icon === 'dna' ? 'microscope' : badge.icon}
            >
              {badge.label}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
