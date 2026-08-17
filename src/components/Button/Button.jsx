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
    loading, 
    loadingContext = 'default',
    className = '', 
    ...props 
  },
  ref
) {
  const cls = [
    'btn',
    `btn-${variant}`,
    size === 'sm' ? 'btn-sm' : size === 'lg' ? 'btn-lg' : '',
    loading ? 'btn-loading' : '',
    !children && icon ? 'btn-icon' : '',
    className
  ].filter(Boolean).join(' ');

  const safeIcon = icon === 'dna' ? 'microscope' : icon;
  const safeIconRight = iconRight === 'dna' ? 'microscope' : iconRight;

  return (
    <button ref={ref} className={cls} disabled={loading || props.disabled} {...props}>
      {loading ? (
        <Spinner size="sm" context={loadingContext} />
      ) : (
        <>
          {safeIcon && <Icon name={safeIcon} />}
          {children && <span>{children}</span>}
          {safeIconRight && <Icon name={safeIconRight} />}
        </>
      )}
    </button>
  );
});

export default Button;
