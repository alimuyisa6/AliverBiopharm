/* components/Textarea/Textarea.jsx */
import { forwardRef } from 'react';

const Textarea = forwardRef(function Textarea(
  { label, hint, error, className = '', id, ...props },
  ref
) {
  const textareaId = id || label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className={`form-group ${className}`}>
      {label && (
        <label className="form-label" htmlFor={textareaId}>
          {label}
        </label>
      )}
      <textarea ref={ref} id={textareaId} className="form-textarea" {...props} />
      {hint && !error && <span className="form-hint">{hint}</span>}
      {error && <span className="form-error">{error}</span>}
    </div>
  );
});

export default Textarea;
