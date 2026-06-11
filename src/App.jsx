import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider, ProtectedRoute } from './contexts/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';

function App() {
  return (
    React.createElement(BrowserRouter, null,
       
        React.createElement(Routes, null,
          React.createElement(Route, { path: "/login", element: React.createElement(Login, null) }),
          React.createElement(Route, { path: "/register", element: React.createElement(Register, null) }),
            React.createElement(Route, { path: "*", element: React.createElement(Home, null) })
      )
    )
  );
}

export default App;
