 /* main.jsx */
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles/global.css';
import './styles/components.css';
import './styles/class.css';
import './styles/pastpapers.css';
  

function showFatalError(title, message, stack) {
  const root = document.getElementById('root') || document.body;
  root.innerHTML = `
    <div style="padding:20px;font-family:monospace;color:#111;background:#fff;">
      <h2 style="color:#c0392b;margin:0 0 8px;">${title}</h2>
      <div style="margin-bottom:10px;">${message || 'Unknown error'}</div>
      ${stack ? `<pre style="white-space:pre-wrap;background:#f5f5f5;padding:10px;border-radius:6px;font-size:12px;max-height:240px;overflow:auto;">${stack}</pre>` : ''}
      <button onclick="window.location.reload()" style="margin-top:12px;padding:8px 16px;background:#c0392b;color:#fff;border:none;border-radius:6px;cursor:pointer;">Reload</button>
    </div>
  `;
}

function isCrossOriginScriptError(message, source, error) {
  if (message !== 'Script error.') return false;
  if (error && error.stack) return false;
  try {
    if (!source) return true;
    const srcUrl = new URL(source, location.href);
    return srcUrl.origin !== location.origin;
  } catch {
    return true;
  }
}

window.onerror = function (message, source, lineno, colno, error) {
  if (isCrossOriginScriptError(message, source, error)) {
    console.warn('Cross-origin script error', source || 'unknown');
    return true;
  }
  showFatalError('Runtime Error', message, error?.stack);
  return false;
};

window.addEventListener('unhandledrejection', function (event) {
  const reason = event.reason;
  const message = (reason && reason.message) || String(reason);
  if (isCrossOriginScriptError(message, null, reason)) {
    console.warn('Cross-origin promise rejection', reason);
    return;
  }
  showFatalError('Unhandled Promise Rejection', message, reason?.stack);
});

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Component error:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 20, fontFamily: 'monospace', background: '#fff' }}>
          <h2 style={{ color: '#c0392b', margin: '0 0 8px' }}>Something went wrong</h2>
          <div style={{ marginBottom: 10 }}>{this.state.error?.message || 'Unknown error'}</div>
          {this.state.error?.stack && (
            <pre style={{
              whiteSpace: 'pre-wrap', background: '#f5f5f5', padding: 10,
              borderRadius: 6, fontSize: 12, maxHeight: 240, overflow: 'auto'
            }}>
              {this.state.error.stack}
            </pre>
          )}
          <button
            onClick={() => window.location.reload()}
            style={{ marginTop: 12, padding: '8px 16px', background: '#c0392b', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function initRevealObserver() {
  try {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
        }
      });
    }, { threshold: 0.25, rootMargin: '0px 0px -50px 0px' });

    const observeElements = () => {
      document.querySelectorAll('.reveal:not(.in)').forEach(el => {
        observer.observe(el);
      });
    };

    // Initial observation after a short delay (so React has rendered)
    setTimeout(observeElements, 100);

    // Re‑observe on DOM changes
    const mutationObserver = new MutationObserver(() => {
      observeElements();
    });
    mutationObserver.observe(document.body, { childList: true, subtree: true });

    // Fallback: after 2 seconds, force‑reveal any still‑hidden elements
    setTimeout(() => {
      document.querySelectorAll('.reveal:not(.in)').forEach(el => {
        el.classList.add('in');
      });
    }, 2000);

    return () => {
      observer.disconnect();
      mutationObserver.disconnect();
    };
  } catch (e) {
    console.warn('Reveal observer init failed', e);
    return () => {};
  }
}

let cleanupReveal;
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    cleanupReveal = initRevealObserver();
  }, { once: true });
} else {
  cleanupReveal = initRevealObserver();
}

try {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error('Root element with id "root" not found in DOM');
  }

  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ErrorBoundary>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ErrorBoundary>
    </React.StrictMode>
  );
} catch (error) {
  showFatalError('Initialization Error', error.message, error.stack);
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    if (cleanupReveal) cleanupReveal();
  });
}
