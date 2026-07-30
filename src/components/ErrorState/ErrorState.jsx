/* components/ErrorState/ErrorState.jsx */
import Icon from '../Icon/Icon';

export default function ErrorState({ message = 'Something went wrong', onRetry }) {
  return (
    <div className="error-state">
      <Icon name="exclamation-triangle" className="error-state-icon" />
      <h3 className="error-state-title">Error</h3>
      <p className="error-state-text">{message}</p>
      {onRetry && (
        <button className="btn btn-primary" onClick={onRetry}>
          Try Again
        </button>
      )}
    </div>
  );
}
