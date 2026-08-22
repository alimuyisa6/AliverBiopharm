// components/ImageStep/ImageStep.jsx
import { Link } from 'react-router-dom';
import Icon from '../Icon/Icon';
import Button from '../Button/Button';
import './ImageStep.css';

export default function ImageStep({ 
  image,
  title,
  subtitle,
  link,
  buttonText = 'View',
  className = ''
}) {
  return (
    <Link to={link} className={`image-step ${className}`}>
      <div className="image-step-image">
        <img src={image} alt={title} loading="lazy" />
        <div className="image-step-overlay">
          <div className="image-step-content">
            {subtitle && <span className="image-step-subtitle">{subtitle}</span>}
            <h3 className="image-step-title">{title}</h3>
            <Button size="sm" variant="primary" className="image-step-btn">
              {buttonText} <Icon name="arrow-right" />
            </Button>
          </div>
        </div>
      </div>
    </Link>
  );
}
