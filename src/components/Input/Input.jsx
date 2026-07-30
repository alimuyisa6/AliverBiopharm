/* components/Input/Input.jsx */
import { forwardRef, useState } from 'react';
import Icon from '../Icon/Icon';

const Input = forwardRef(function Input(
  { label, hint, error, icon, type = 'text', className = '', id, ...props },
  ref
) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword && showPassword ? 'text' : type;
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className={`form-group ${className}`}>
      {label && (
        <label className="form-label" htmlFor={inputId}>
          {label}
        </label>
      )}
      <div className="input-wrapper">
        {icon && <Icon name={icon} className="input-icon" />}
        <input
          ref={ref}
          id={inputId}
          type={inputType}
          className={`form-input ${error ? 'form-input-error' : ''}`}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            className="password-toggle"
            onClick={() => setShowPassword((p) => !p)}
            tabIndex={-1}
          >
            <Icon name={showPassword ? 'eye-slash' : 'eye'} />
          </button>
        )}
      </div>
      {hint && !error && <span className="form-hint">{hint}</span>}
      {error && <span className="form-error">{error}</span>}
    </div>
  );
});

export default Input;
