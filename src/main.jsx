 import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

window.addEventListener('error', function(event) {
  const errorDiv = document.createElement('div');
  errorDiv.style.cssText = 'position:fixed; top:0; left:0; right:0; background:#c00; color:white; padding:16px; z-index:10000; font-family:monospace; white-space:pre-wrap; word-break:break-word;';
  errorDiv.innerHTML = '<strong>JS Error:</strong><br>' + (event.error?.stack || event.message);
  document.body.prepend(errorDiv);
});

window.addEventListener('unhandledrejection', function(event) {
  const errorDiv = document.createElement('div');
  errorDiv.style.cssText = 'position:fixed; top:0; left:0; right:0; background:#c00; color:white; padding:16px; z-index:10000; font-family:monospace; white-space:pre-wrap; word-break:break-word;';
  errorDiv.innerHTML = '<strong>Unhandled Promise Rejection:</strong><br>' + (event.reason?.stack || event.reason);
  document.body.prepend(errorDiv);
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
