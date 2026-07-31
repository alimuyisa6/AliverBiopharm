/* components/Card/Card.jsx */
import { forwardRef } from 'react';
import Icon from '../Icon/Icon';

const Card = forwardRef(function Card(
  { image, icon, title, description, footer, className = '', children, onClick, ...props },
  ref
) {
  const isClickable = !!onClick;
  const Wrapper = isClickable ? 'button' : 'div';

  return (
    <Wrapper
      ref={ref}
      className={`card ${isClickable ? 'card-clickable' : ''} ${className}`}
      onClick={onClick}
      {...props}
    >
      {image ? (
        <img src={image} alt={title || ''} className="card-image" loading="lazy" />
      ) : (
        <div className="card-image-placeholder">
          {icon && <Icon name={icon} />}
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
