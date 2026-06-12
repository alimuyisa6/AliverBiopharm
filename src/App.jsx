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
           <Routes>
  <Route path="/login" element={<Login />} />
  <Route path="/register" element={<Register />} />
  <Route path="/quiz" element={<div>Test route works!</div>} />   // add this line
  <Route path="*" element={<Home />} />
</Routes>
        )
      )
    )
  );
}

export default App;
