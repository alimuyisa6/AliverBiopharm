 import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider, ProtectedRoute } from './contexts/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';
import Quiz from './pages/Quiz';

function App() {
  return (
    React.createElement(BrowserRouter, null,
      React.createElement(AuthProvider, null,
        React.createElement(Routes, null,
          React.createElement(Route, { path: "/login", element: React.createElement(Login, null) }),
          React.createElement(Route, { path: "/register", element: React.createElement(Register, null) }),
          React.createElement(Route, { path: "/quiz", element: React.createElement(ProtectedRoute, null, React.createElement(Quiz, null)) }),
          React.createElement(Route, { path: "*", element: React.createElement(ProtectedRoute, null, React.createElement(Home, null)) })
        )
      )
    )
  );
}

export default App;
