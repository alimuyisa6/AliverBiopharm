 /* components/Button/Button.jsx */

import { forwardRef } from 'react';
import Icon from '../Icon/Icon';
import Spinner from '../Spinner/Spinner';

const Button = forwardRef(function Button(
  {
    children,
    variant = 'primary',
    size,
    icon,
    iconRight,
    loading = false,
    loadingContext = 'default',
    radius,
    flat = false,
    className = '',
    type = 'button',
    disabled = false,
    ...props
  },
  ref
) {
  const classes = [
    'btn',
    `btn-${variant}`,

    size === 'sm' && 'btn-sm',
    size === 'lg' && 'btn-lg',

    radius === 'square' && 'btn-radius-square',
    radius === 'sm' && 'btn-radius-sm',
    radius === 'pill' && 'btn-radius-pill',
    radius === 'wavy' && 'btn-radius-wavy',

    flat && 'btn-flat',

    loading && 'btn-loading',

    !children && icon && 'btn-icon',

    className
  ]
    .filter(Boolean)
    .join(' ');

  const safeIcon = icon === 'dna' ? 'microscope' : icon;
  const safeIconRight = iconRight === 'dna' ? 'microscope' : iconRight;

  return (
    <button
      ref={ref}
      type={type}
      className={classes}
      disabled={loading || disabled}
      {...props}
    >
      {loading ? (
        <Spinner
          size="sm"
          context={loadingContext}
        />
      ) : (
        <>
          {safeIcon && (
            <Icon name={safeIcon} />
          )}

          {children && (
            <span>{children}</span>
          )}

          {safeIconRight && (
            <Icon name={safeIconRight} />
          )}
        </>
      )}
    </button>
  );
});

export default Button;
