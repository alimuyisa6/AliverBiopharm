 import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/global.css';
import './styles/component-bundle.css';
import './styles/quiz.css';
import './loading/Loading.css';
import LoadingProvider from './loading/LoadingProvider';

function displayError(errorInfo) {
  const root = document.getElementById('root');
  if (root) {
    root.innerHTML = '';
    const errorDiv = document.createElement('div');
    errorDiv.innerHTML = errorInfo;
    root.appendChild(errorDiv);
  } else {
    document.body.innerHTML = errorInfo;
  }
}

window.onerror = function(message, source, lineno, colno, error) {
  displayError(`
    <div style="background: #fff; padding: 24px; font-family: monospace; margin: 20px; border: 3px solid red; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
      <h1 style="color: red; margin-top: 0; font-size: 24px;">Runtime Error</h1>
      <div style="margin-bottom: 16px; padding: 12px; background: #ffe6e6; border-radius: 6px;">
        <div style="margin-bottom: 8px; font-size: 14px;"><strong>Message:</strong> ${message}</div>
        <div style="margin-bottom: 8px; font-size: 14px;"><strong>Source:</strong> ${source}</div>
        <div style="margin-bottom: 8px; font-size: 14px;"><strong>Location:</strong> Line ${lineno}, Column ${colno}</div>
      </div>
      <div style="margin-bottom: 16px;">
        <h3 style="color: #333; margin: 0 0 8px 0;">Stack Trace:</h3>
        <pre style="background: #1e1e1e; color: #d4d4d4; padding: 16px; border-radius: 6px; overflow-x: auto; white-space: pre-wrap; word-break: break-word; font-size: 13px; line-height: 1.5;">${error ? error.stack : 'No stack available'}</pre>
      </div>
      <div style="margin-bottom: 16px;">
        <h3 style="color: #333; margin: 0 0 8px 0;">Error Object:</h3>
        <pre style="background: #f5f5f5; padding: 16px; border-radius: 6px; overflow-x: auto; white-space: pre-wrap; word-break: break-word; font-size: 13px;">${error ? JSON.stringify({
          name: error.name,
          message: error.message,
          fileName: error.fileName,
          lineNumber: error.lineNumber,
          columnNumber: error.columnNumber,
          cause: error.cause
        }, null, 2) : 'No error object'}</pre>
      </div>
    </div>
  `);
  return false;
};

window.addEventListener('unhandledrejection', function(event) {
  displayError(`
    <div style="background: #fff; padding: 24px; font-family: monospace; margin: 20px; border: 3px solid #ff9800; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
      <h1 style="color: #ff9800; margin-top: 0; font-size: 24px;">Unhandled Promise Rejection</h1>
      <div style="margin-bottom: 16px; padding: 12px; background: #fff3e0; border-radius: 6px;">
        <div style="font-size: 14px;"><strong>Reason:</strong> ${event.reason}</div>
      </div>
      <div style="margin-bottom: 16px;">
        <h3 style="color: #333; margin: 0 0 8px 0;">Details:</h3>
        <pre style="background: #f5f5f5; padding: 16px; border-radius: 6px; overflow-x: auto; white-space: pre-wrap; word-break: break-word; font-size: 13px;">${event.reason?.stack || event.reason?.message || JSON.stringify(event.reason, null, 2) || 'No details available'}</pre>
      </div>
    </div>
  `);
});

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.log('ErrorBoundary caught:', error);
    console.log('Component stack:', errorInfo.componentStack);
  }

  render() {
    if (this.state.hasError) {
      const error = this.state.error;
      return (
        <div style={{
          padding: 24,
          fontFamily: 'monospace',
          background: '#ffffff',
          margin: 20,
          border: '3px solid red',
          borderRadius: 12,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
        }}>
          <h1 style={{ color: 'red', marginTop: 0, fontSize: 24 }}>Component Error</h1>
          
          <div style={{ marginBottom: 16, padding: 16, background: '#ffe6e6', borderRadius: 8 }}>
            <div style={{ fontSize: 14, lineHeight: 1.8 }}>
              <div><strong>Name:</strong> {error?.name || 'Error'}</div>
              <div><strong>Message:</strong> {error?.message || String(error)}</div>
              <div><strong>Type:</strong> {error?.constructor?.name || 'Unknown'}</div>
              {error?.fileName && <div><strong>File:</strong> {error.fileName}</div>}
              {error?.lineNumber && <div><strong>Line:</strong> {error.lineNumber}</div>}
              {error?.columnNumber && <div><strong>Column:</strong> {error.columnNumber}</div>}
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <h3 style={{ color: '#333', margin: '0 0 8px 0', fontSize: 16 }}>Stack Trace</h3>
            <pre style={{
              background: '#1e1e1e',
              color: '#d4d4d4',
              padding: 16,
              borderRadius: 8,
              overflowX: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontSize: 13,
              lineHeight: 1.5,
              maxHeight: 400,
              overflowY: 'auto'
            }}>
              {error?.stack || 'No stack trace available'}
            </pre>
          </div>

          {this.state.errorInfo?.componentStack && (
            <div style={{ marginBottom: 16 }}>
              <h3 style={{ color: '#333', margin: '0 0 8px 0', fontSize: 16 }}>Component Stack</h3>
              <pre style={{
                background: '#f5f5f5',
                padding: 16,
                borderRadius: 8,
                overflowX: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                fontSize: 12,
                lineHeight: 1.6,
                color: '#555',
                maxHeight: 300,
                overflowY: 'auto'
              }}>
                {this.state.errorInfo.componentStack}
              </pre>
            </div>
          )}

          <div style={{ marginBottom: 16, padding: 12, background: '#fff9c4', borderRadius: 6, fontSize: 13 }}>
            <strong>Timestamp:</strong> {new Date().toISOString()}
          </div>

          <button
            onClick={() => {
              this.setState({ hasError: false, error: null, errorInfo: null });
              window.location.reload();
            }}
            style={{
              padding: '12px 24px',
              background: '#d32f2f',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              fontSize: 16,
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

try {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error('Root element with id "root" not found in DOM');
  }

  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ErrorBoundary>
        <LoadingProvider>
          <App />
        </LoadingProvider>
      </ErrorBoundary>
    </React.StrictMode>
  );
} catch (error) {
  displayError(`
    <div style="background: #fff; padding: 24px; font-family: monospace; margin: 20px; border: 3px solid red; border-radius: 12px;">
      <h1 style="color: red; margin-top: 0;">Initialization Error</h1>
      <div style="margin-bottom: 16px; padding: 12px; background: #ffe6e6; border-radius: 6px;">
        <div style="font-size: 14px;"><strong>Message:</strong> ${error.message}</div>
      </div>
      <pre style="background: #1e1e1e; color: #d4d4d4; padding: 16px; border-radius: 6px; overflow-x: auto; white-space: pre-wrap; word-break: break-word; font-size: 13px;">${error.stack}</pre>
    </div>
  `);
}
