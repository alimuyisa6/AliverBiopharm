 import { Link } from 'react-router-dom';
import Button from '../Button/Button';
import Icon from '../Icon/Icon';

export default function SplitCard({
  image,
  fallbackImage,
  title,
  subtitle,
  badge,
  badgeVariant = 'primary',
  link,
  buttonText = 'View',
  onButtonClick,
  className = ''
}) {
  return (
    <div className={`split-card ${className}`}>
      <Link to={link} className="split-card-media">
        <img src={image || fallbackImage} alt={title} loading="lazy" />
        {badge && (
          <span className={`split-card-badge split-card-badge-${badgeVariant}`}>
            {badge}
          </span>
        )}
      </Link>
      <div className="split-card-body">
        <div className="split-card-text">
          <h3 className="split-card-title">{title}</h3>
          {subtitle && <p className="split-card-subtitle">{subtitle}</p>}
        </div>
        {onButtonClick ? (
          <Button size="sm" variant="primary" onClick={onButtonClick} className="split-card-btn">
            {buttonText} <Icon name="arrow-right" />
          </Button>
        ) : (
          <Link to={link} className="btn btn-primary btn-sm split-card-btn">
            {buttonText} <Icon name="arrow-right" />
          </Link>
        )}
      </div>
    </div>
  );
}
