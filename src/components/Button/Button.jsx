 /* components/Button/Button.jsx */
import { forwardRef } from 'react';
import Icon from '../Icon/Icon';

const Button = forwardRef(function Button(
  { children, variant = 'primary', size, icon, iconRight, loading, className = '', ...props },
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
      {loading ? null : safeIcon ? <Icon name={safeIcon} /> : null}
      {children && <span>{children}</span>}
      {!loading && safeIconRight ? <Icon name={safeIconRight} /> : null}
    </button>
  );
});

export default Button;
