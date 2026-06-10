import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null, errorInfo: null }; }
  componentDidCatch(error, errorInfo) { this.setState({ error, errorInfo }); }
  render() {
    if (this.state.error) {
      return React.createElement('div', { style: { padding: 20, background: 'white', color: 'red', fontFamily: 'monospace', whiteSpace: 'pre-wrap' } },
        React.createElement('h2', null, 'React Error:'),
        React.createElement('pre', null, this.state.error.toString()),
        React.createElement('details', null,
          React.createElement('summary', null, 'Stack trace'),
          React.createElement('pre', null, this.state.errorInfo?.componentStack)
        )
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  React.createElement(React.StrictMode, null,
    React.createElement(ErrorBoundary, null,
      React.createElement(App, null)
    )
  )
);
