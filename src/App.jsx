 import { BrowserRouter, Routes, Route } from 'react-router-dom';

function App() {
  return (
    React.createElement(BrowserRouter, null,
      React.createElement(Routes, null,
        React.createElement(Route, { path: "*", element: React.createElement('h1', { style: { color: 'red' } }, 'APP WORKS') })
      )
    )
  );
}

export default App;
