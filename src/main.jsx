 import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import App from './App'

window.onerror = function(msg, src, line) {
  document.body.innerHTML = '<div style="color:red;padding:20px;font-size:18px">' + msg + ' (line ' + line + ')</div>';
}

ReactDOM.createRoot(document.getElementById('root')).render(
  React.createElement(App)
)
