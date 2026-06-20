 import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/global.css';
import './styles/component-bundle.css';
import './styles/quiz.css';
import './loading/Loading.css';
import LoadingProvider from './loading/LoadingProvider';

window.addEventListener('error', (event) => {
  const errorDisplay = document.getElementById('global-error-display');
  if (errorDisplay) {
    errorDisplay.style.display = 'block';
    errorDisplay.innerHTML = `
      <div style="background: #fff; padding: 24px; font-family: monospace; margin: 20px; border: 2px solid red; border-radius: 8px;">
        <h2 style="color: red; margin-top: 0;">Global Error Caught</h2>
        <div style="margin-bottom: 12px;">
          <strong>Message:</strong> ${event.message || 'Unknown error'}
        </div>
        <div style="margin-bottom: 12px;">
          <strong>Source:</strong> ${event.filename || 'Unknown source'}
        </div>
        <div style="margin-bottom: 12px;">
          <strong>Line:</strong> ${event.lineno || 'N/A'}:${event.colno || 'N/A'}
        </div>
        <div style="background: #f5f5f5; padding: 12px; border-radius: 4px; overflow-x: auto;">
          <pre style="margin: 0; white-space: pre-wrap; word-break: break-word; font-size: 13px;">${event.error ? event.error.stack : 'No stack trace available'}</pre>
        </div>
      </div>
    `;
  }
});

window.addEventListener('unhandledrejection', (event) => {
  const errorDisplay = document.getElementById('global-error-display');
  if (errorDisplay) {
    errorDisplay.style.display = 'block';
    errorDisplay.innerHTML = `
      <div style="background: #fff; padding: 24px; font-family: monospace; margin: 20px; border: 2px solid orange; border-radius: 8px;">
        <h2 style="color: orange; margin-top: 0;">Unhandled Promise Rejection</h2>
        <div style="margin-bottom: 12px;">
          <strong>Reason:</strong> ${event.reason || 'Unknown reason'}
        </div>
        <div style="background: #f5f5f5; padding: 12px; border-radius: 4px; overflow-x: auto;">
          <pre style="margin: 0; white-space: pre-wrap; word-break: break-word; font-size: 13px;">${event.reason?.stack || event.reason?.toString() || 'No stack trace available'}</pre>
        </div>
      </div>
    `;
  }
});

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      error: null, 
      errorInfo: null,
      errorType: null,
      componentStack: null
    };
  }

  static getDerivedStateFromError(error) {
    return { 
      error,
      errorType: error.constructor?.name || 'Error'
    };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ 
      errorInfo,
      componentStack: errorInfo.componentStack
    });
    
    console.error('ErrorBoundary caught an error:', error);
    console.error('Component Stack:', errorInfo.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ 
          padding: 24, 
          fontFamily: 'monospace', 
          background: '#fff', 
          margin: 20,
          border: '3px solid red',
          borderRadius: 12,
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
        }}>
          <h1 style={{ color: 'red', marginTop: 0, fontSize: 24 }}>React Error Boundary</h1>
          
          <div style={{ marginBottom: 16, padding: 12, background: '#fff3f3', borderRadius: 6 }}>
            <h2 style={{ color: '#d32f2f', margin: '0 0 8px 0', fontSize: 18 }}>Error Details</h2>
            <div style={{ fontSize: 14, lineHeight: 1.6 }}>
              <div style={{ marginBottom: 8 }}>
                <strong>Name:</strong> {this.state.error.name || 'Error'}
              </div>
              <div style={{ marginBottom: 8 }}>
                <strong>Type:</strong> {this.state.errorType}
              </div>
              <div style={{ marginBottom: 8 }}>
                <strong>Message:</strong> {this.state.error.message || this.state.error.toString()}
              </div>
              {this.state.error.fileName && (
                <div style={{ marginBottom: 8 }}>
                  <strong>File:</strong> {this.state.error.fileName}
                </div>
              )}
              {(this.state.error.lineNumber || this.state.error.line) && (
                <div style={{ marginBottom: 8 }}>
                  <strong>Line:</strong> {this.state.error.lineNumber || this.state.error.line}
                  {(this.state.error.columnNumber || this.state.error.column) && 
                    `:${this.state.error.columnNumber || this.state.error.column}`}
                </div>
              )}
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <h3 style={{ color: '#333', margin: '0 0 8px 0', fontSize: 16 }}>Stack Trace</h3>
            <div style={{ 
              background: '#1e1e1e', 
              color: '#d4d4d4', 
              padding: 16, 
              borderRadius: 6,
              overflowX: 'auto',
              maxHeight: 400,
              overflowY: 'auto'
            }}>
              <pre style={{ 
                margin: 0, 
                whiteSpace: 'pre-wrap', 
                wordBreak: 'break-word',
                fontSize: 13,
                lineHeight: 1.5,
                fontFamily: "'Fira Code', 'Consolas', monospace"
              }}>
                {this.state.error.stack || 'No stack trace available'}
              </pre>
            </div>
          </div>

          {this.state.componentStack && (
            <div style={{ marginBottom: 16 }}>
              <h3 style={{ color: '#333', margin: '0 0 8px 0', fontSize: 16 }}>Component Stack</h3>
              <div style={{ 
                background: '#f5f5f5', 
                padding: 12, 
                borderRadius: 6,
                maxHeight: 300,
                overflowY: 'auto'
              }}>
                <pre style={{ 
                  margin: 0, 
                  whiteSpace: 'pre-wrap', 
                  wordBreak: 'break-word',
                  fontSize: 12,
                  lineHeight: 1.4,
                  color: '#555'
                }}>
                  {this.state.componentStack}
                </pre>
              </div>
            </div>
          )}

          {this.state.errorInfo && (
            <div style={{ marginBottom: 16 }}>
              <h3 style={{ color: '#333', margin: '0 0 8px 0', fontSize: 16 }}>Additional Info</h3>
              <div style={{ 
                background: '#fff9c4', 
                padding: 12, 
                borderRadius: 6,
                fontSize: 13
              }}>
                {this.state.error.cause && (
                  <div style={{ marginBottom: 8 }}>
                    <strong>Cause:</strong> {JSON.stringify(this.state.error.cause, null, 2)}
                  </div>
                )}
                {this.state.error.code && (
                  <div style={{ marginBottom: 8 }}>
                    <strong>Code:</strong> {this.state.error.code}
                  </div>
                )}
                <div>
                  <strong>Time:</strong> {new Date().toISOString()}
                </div>
              </div>
            </div>
          )}

          <button 
            onClick={() => window.location.reload()} 
            style={{
              padding: '12px 24px',
              background: '#d32f2f',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              fontSize: 16,
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            Reload Application
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

const originalConsoleError = console.error;
console.error = (...args) => {
  originalConsoleError.apply(console, args);
  
  const errorDisplay = document.getElementById('console-error-display');
  if (errorDisplay) {
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
      background: #fff3cd;
      color: #856404;
      padding: 8px 12px;
      margin: 4px 0;
      border: 1px solid #ffc107;
      border-radius: 4px;
      font-family: monospace;
      font-size: 12px;
      word-break: break-word;
    `;
    errorDiv.textContent = args.map(arg => {
      if (arg instanceof Error) {
        return `${arg.name}: ${arg.message}\n${arg.stack}`;
      }
      return typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg);
    }).join(' ');
    errorDisplay.appendChild(errorDiv);
    
    if (errorDisplay.children.length > 50) {
      errorDisplay.removeChild(errorDisplay.firstChild);
    }
  }
};

const rootElement = document.getElementById('root');
if (!rootElement) {
  document.body.innerHTML = `
    <div style="background: #fff; padding: 24px; font-family: monospace; margin: 20px; border: 3px solid red; border-radius: 12px;">
      <h1 style="color: red;">Fatal Error</h1>
      <p>Root element with id "root" not found in the DOM.</p>
      <p>Please ensure your HTML file contains: <code>&lt;div id="root"&gt;&lt;/div&gt;</code></p>
    </div>
  `;
  throw new Error('Root element not found');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <div id="global-error-display" style="display: none;"></div>
    <div id="console-error-display" style="position: fixed; bottom: 0; right: 0; max-width: 400px; max-height: 300px; overflow-y: auto; z-index: 9999; padding: 8px;"></div>
    <ErrorBoundary>
      <LoadingProvider>
        <App />
      </LoadingProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
