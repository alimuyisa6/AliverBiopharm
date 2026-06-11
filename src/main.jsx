 import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }
  componentDidCatch(error) {
    this.setState({ error: error.message })
  }
  render() {
    if (this.state.error) {
      return React.createElement('div', { style: { color: 'red', padding: '20px', fontSize: '16px' } }, this.state.error)
    }
    return this.props.children
  }
}

import App from './App'

ReactDOM.createRoot(document.getElementById('root')).render(
  React.createElement(ErrorBoundary, null,
    React.createElement(App)
  )
)
