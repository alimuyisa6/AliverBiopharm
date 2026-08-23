 import { forwardRef } from 'react';
import Icon from '../Icon/Icon';

const Card = forwardRef(function Card(
  {
    image,
    icon,
    title,
    description,
    footer,
    className = '',
    scoop = null,
    variant = '',
    imageVariant = null,
    children,
    onClick,
    ...props
  },
  ref
) {
  const isClickable = !!onClick;
  const Wrapper = isClickable ? 'button' : 'div';

  const safeIcon = icon === 'dna' ? 'microscope' : icon;

  let imageClassName = 'card-image';
  if (scoop) imageClassName += ` card-image-scoop-${scoop}`;
  if (imageVariant === 'original') imageClassName += ' card-image-original';

  let cardClass = 'card';
  if (variant) cardClass += ` card-${variant}`;
  if (isClickable) cardClass += ' card-clickable';
  if (className) cardClass += ` ${className}`;

  return (
    <Wrapper
      ref={ref}
      className={cardClass}
      onClick={onClick}
      {...props}
    >
      {image ? (
        <img src={image} alt={title || ''} className={imageClassName} loading="lazy" />
      ) : (
        <div className="card-image-placeholder">
          {safeIcon && <Icon name={safeIcon} />}
        </div>
      )}

      <div className="card-body">
        {title && <h3 className="card-title">{title}</h3>}
        {description && <p className="card-text">{description}</p>}
        {children}
      </div>

      {footer && <div className="card-footer">{footer}</div>}
    </Wrapper>
  );
});

export default Card;
