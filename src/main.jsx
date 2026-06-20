 import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/global.css';
import './styles/component-bundle.css';
import './styles/quiz.css';
import './loading/Loading.css';
import LoadingProvider from './loading/LoadingProvider';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ error, errorInfo });
    // eslint-disable-next-line no-console
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ error: null, errorInfo: null });
  };

  render() {
    const { error, errorInfo } = this.state;
    if (error) {
      return (
        <div style={{ padding: 24, fontFamily: 'monospace', background: '#fff', color: '#111' }}>
          <h2 style={{ color: 'red', fontFamily: 'sans-serif' }}>App Error</h2>

          <div style={{ marginBottom: 12 }}>
            <strong>Message:</strong>
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13, color: '#c0392b' }}>
              {error.message || error.toString()}
            </pre>
          </div>

          <details open style={{ marginBottom: 12 }}>
            <summary style={{ cursor: 'pointer', fontFamily: 'sans-serif', fontWeight: 'bold' }}>
              Stack trace
            </summary>
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, overflowX: 'auto', background: '#f7f7f7', padding: 8, borderRadius: 6 }}>
              {error.stack}
            </pre>
          </details>

          {errorInfo?.componentStack && (
            <details style={{ marginBottom: 12 }}>
              <summary style={{ cursor: 'pointer', fontFamily: 'sans-serif', fontWeight: 'bold' }}>
                Component stack (which component crashed)
              </summary>
              <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, overflowX: 'auto', background: '#f7f7f7', padding: 8, borderRadius: 6 }}>
                {errorInfo.componentStack}
              </pre>
            </details>
          )}

          <button
            onClick={this.handleReset}
            style={{
              marginTop: 12,
              padding: '8px 16px',
              background: '#e74c3c',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              fontFamily: 'sans-serif',
              fontWeight: 600,
            }}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Catch errors that React's render-time boundary CANNOT catch:
// errors thrown inside async functions, promise rejections, and
// event handlers that aren't already wrapped in try/catch.
// Without this, an unhandled rejection in e.g. a useEffect data
// fetch just silently fails (or logs only to devtools console)
// and never reaches the ErrorBoundary above.
function GlobalErrorListener({ children }) {
  const [globalError, setGlobalError] = React.useState(null);

  React.useEffect(() => {
    const handleError = (event) => {
      setGlobalError(event.error || new Error(event.message));
    };
    const handleRejection = (event) => {
      const reason = event.reason;
      setGlobalError(reason instanceof Error ? reason : new Error(String(reason)));
    };
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  if (globalError) {
    return (
      <div style={{ padding: 24, fontFamily: 'monospace', background: '#fff', color: '#111' }}>
        <h2 style={{ color: 'red', fontFamily: 'sans-serif' }}>Unhandled Error</h2>
        <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13, color: '#c0392b' }}>
          {globalError.message || globalError.toString()}
        </pre>
        <details open>
          <summary style={{ cursor: 'pointer', fontFamily: 'sans-serif', fontWeight: 'bold' }}>
            Stack trace
          </summary>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, overflowX: 'auto', background: '#f7f7f7', padding: 8, borderRadius: 6 }}>
            {globalError.stack}
          </pre>
        </details>
        <button
          onClick={() => setGlobalError(null)}
          style={{ marginTop: 12, padding: '8px 16px', background: '#e74c3c', color: '#fff', border: 'none', borderRadius: 6, fontFamily: 'sans-serif', fontWeight: 600 }}
        >
          Dismiss
        </button>
      </div>
    );
  }

  return children;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <GlobalErrorListener>
        <LoadingProvider>
          <App />
        </LoadingProvider>
      </GlobalErrorListener>
    </ErrorBoundary>
  </React.StrictMode>
);
