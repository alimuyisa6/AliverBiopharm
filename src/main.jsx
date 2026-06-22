import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/global.css';

import './styles/quiz.css';
import './styles/glossary.css';
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

function parseStackTrace(stack) {
  if (!stack) return [];
  const lines = stack.split('\n');
  const parsed = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const match = line.match(/at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)/) || 
                  line.match(/at\s+(.+?):(\d+):(\d+)/) ||
                  line.match(/at\s+(.+)/);
    if (match) {
      parsed.push({
        functionName: match[1] || 'anonymous',
        file: match[2] || 'unknown',
        line: match[3] || '?',
        column: match[4] || '?',
        raw: line
      });
    }
  }
  return parsed;
}

function extractMeaningfulError(stack) {
  const parsed = parseStackTrace(stack);
  const appFiles = parsed.filter(p => 
    p.file && !p.file.includes('node_modules') && 
    (p.file.includes('.jsx') || p.file.includes('.tsx') || p.file.includes('.js') || p.file.includes('.ts'))
  );
  return appFiles.length > 0 ? appFiles : parsed;
}

window.onerror = function(message, source, lineno, colno, error) {
  const stackTrace = error?.stack || '';
  const parsedStack = parseStackTrace(stackTrace);
  const meaningfulStack = extractMeaningfulError(stackTrace);
  
  displayError(`
    <div style="background: #fff; padding: 24px; font-family: monospace; margin: 20px; border: 3px solid red; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
      <h1 style="color: red; margin-top: 0; font-size: 24px;">Runtime Error</h1>
      
      <div style="margin-bottom: 16px; padding: 16px; background: #ffe6e6; border-radius: 8px;">
        <div style="margin-bottom: 12px; font-size: 14px;"><strong style="color: #d32f2f;">Message:</strong> ${message}</div>
        <div style="margin-bottom: 8px; font-size: 14px;"><strong>Source:</strong> ${source || 'runtime'}</div>
        <div style="margin-bottom: 8px; font-size: 14px;"><strong>Location:</strong> Line ${lineno || '?'}, Column ${colno || '?'}</div>
        <div style="margin-bottom: 8px; font-size: 14px;"><strong>Error Type:</strong> ${error?.name || 'Error'}</div>
      </div>

      ${error?.code ? `
        <div style="margin-bottom: 16px; padding: 12px; background: #e3f2fd; border-radius: 6px; font-size: 14px;">
          <strong>Error Code:</strong> ${error.code}
        </div>
      ` : ''}

      <div style="margin-bottom: 16px;">
        <h3 style="color: #333; margin: 0 0 8px 0;">Complete Stack Trace:</h3>
        <pre style="background: #1e1e1e; color: #d4d4d4; padding: 16px; border-radius: 8px; overflow-x: auto; white-space: pre-wrap; word-break: break-word; font-size: 13px; line-height: 1.5; max-height: 300px; overflow-y: auto;">${stackTrace || 'No stack available'}</pre>
      </div>

      <div style="margin-bottom: 16px;">
        <h3 style="color: #333; margin: 0 0 8px 0;">Parsed Stack Frames:</h3>
        <div style="background: #f5f5f5; padding: 16px; border-radius: 8px; font-size: 13px;">
          ${meaningfulStack.map((frame, index) => `
            <div style="margin-bottom: ${index < meaningfulStack.length - 1 ? '12px' : '0'}; padding: 8px; background: white; border-radius: 4px; border-left: 3px solid ${index === 0 ? '#d32f2f' : '#2196f3'};">
              <div><strong>${index === 0 ? '❌ ERROR AT' : '📍'}</strong> ${frame.functionName}</div>
              <div style="color: #666; margin-top: 4px;">📁 ${frame.file}:${frame.line}:${frame.column}</div>
            </div>
          `).join('')}
        </div>
      </div>

      <div style="margin-bottom: 16px; padding: 12px; background: #fff9c4; border-radius: 6px; font-size: 13px;">
        <strong>💡 Debug Tip:</strong> Check if you're accessing a property (like .name) on an undefined variable. Look for objects that might be null/undefined when the component renders. Check your API responses or props.
      </div>

      <div style="margin-bottom: 16px; padding: 12px; background: #e8eaf6; border-radius: 6px; font-size: 13px;">
        <strong>🔍 Source Maps:</strong> To see original source files, ensure source maps are enabled in your build. Add <code>devtool: 'source-map'</code> to your webpack/vite config.
      </div>

      ${parsedStack.length > 0 ? `
        <div style="margin-bottom: 16px;">
          <h3 style="color: #333; margin: 0 0 8px 0;">All Stack Frames:</h3>
          <div style="background: #f5f5f5; padding: 12px; border-radius: 8px; max-height: 200px; overflow-y: auto; font-size: 12px;">
            ${parsedStack.map(frame => `
              <div style="margin-bottom: 4px; font-family: monospace;">
                ${frame.functionName} @ ${frame.file}:${frame.line}
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
    </div>
  `);
  return false;
};

window.addEventListener('unhandledrejection', function(event) {
  const reason = event.reason;
  const stackTrace = reason?.stack || '';
  
  displayError(`
    <div style="background: #fff; padding: 24px; font-family: monospace; margin: 20px; border: 3px solid #ff9800; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
      <h1 style="color: #ff9800; margin-top: 0; font-size: 24px;">Unhandled Promise Rejection</h1>
      <div style="margin-bottom: 16px; padding: 12px; background: #fff3e0; border-radius: 8px;">
        <div style="font-size: 14px;"><strong>Reason:</strong> ${reason?.message || reason}</div>
      </div>
      <pre style="background: #1e1e1e; color: #d4d4d4; padding: 16px; border-radius: 8px; overflow-x: auto; white-space: pre-wrap; word-break: break-word; font-size: 13px;">${stackTrace || JSON.stringify(reason, null, 2)}</pre>
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
  }

  render() {
    if (this.state.hasError) {
      const error = this.state.error;
      const parsedStack = parseStackTrace(error?.stack || '');
      const meaningfulStack = extractMeaningfulError(error?.stack || '');
      
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
              {error?.code && <div><strong>Code:</strong> {error.code}</div>}
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
              maxHeight: 300,
              overflowY: 'auto'
            }}>
              {error?.stack || 'No stack trace available'}
            </pre>
          </div>

          {meaningfulStack.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <h3 style={{ color: '#333', margin: '0 0 8px 0', fontSize: 16 }}>Error Locations</h3>
              <div style={{ background: '#f5f5f5', padding: 16, borderRadius: 8, fontSize: 13 }}>
                {meaningfulStack.map((frame, index) => (
                  <div key={index} style={{ 
                    marginBottom: index < meaningfulStack.length - 1 ? '12px' : '0',
                    padding: 8,
                    background: 'white',
                    borderRadius: 4,
                    borderLeft: `3px solid ${index === 0 ? '#d32f2f' : '#2196f3'}`
                  }}>
                    <div style={{ fontWeight: 'bold', marginBottom: 4 }}>
                      {index === 0 ? '❌ ' : '📍 '}{frame.functionName}
                    </div>
                    <div style={{ color: '#666' }}>
                      📁 {frame.file}:{frame.line}:{frame.column}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

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
                maxHeight: 200,
                overflowY: 'auto'
              }}>
                {this.state.errorInfo.componentStack}
              </pre>
            </div>
          )}

          <div style={{ marginBottom: 16, padding: 12, background: '#fff9c4', borderRadius: 6, fontSize: 13 }}>
            <strong>💡 Common Cause:</strong> Trying to access <code>.name</code> property on an undefined object. Check:
            <ul style={{ margin: '8px 0 0 0', paddingLeft: 20 }}>
              <li>API data that hasn't loaded yet</li>
              <li>Component props that might be undefined</li>
              <li>Array/object destructuring of undefined values</li>
              <li>State that's null during initial render</li>
            </ul>
          </div>

          <div style={{ marginBottom: 16, padding: 12, background: '#f5f5f5', borderRadius: 6, fontSize: 13 }}>
            <strong>🕒 Timestamp:</strong> {new Date().toISOString()}
          </div>

          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '12px 24px',
              background: '#d32f2f',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              fontSize: 16,
              cursor: 'pointer',
              fontWeight: 'bold',
              marginRight: 10
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

function initRevealObserver() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in');
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

  const observeElements = () => {
    document.querySelectorAll('.reveal:not(.in)').forEach(el => observer.observe(el));
  };

  observeElements();

  const mutationObserver = new MutationObserver(() => {
    observeElements();
  });

  mutationObserver.observe(document.body, {
    childList: true,
    subtree: true
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initRevealObserver);
} else {
  initRevealObserver();
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
      <pre style="background: #1e1e1e; color: #d4d4d4; padding: 16px; border-radius: 8px; overflow-x: auto; white-space: pre-wrap; font-size: 13px;">${error.stack}</pre>
    </div>
  `);
} 
