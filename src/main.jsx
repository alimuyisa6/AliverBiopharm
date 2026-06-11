 import React from 'react'
import ReactDOM from 'react-dom/client'

function App() {
  return React.createElement('h1', { style: { color: 'red' } }, 'APP WORKS');
}

ReactDOM.createRoot(document.getElementById('root')).render(
  React.createElement(App)
)
