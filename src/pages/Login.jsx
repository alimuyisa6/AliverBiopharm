import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { signin } from '../api/client';
import { useNavigate, Link } from 'react-router-dom';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { refresh } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      await signin(email, password);
      await refresh();
      navigate('/');
    } catch (err) {
      setError(err.message || 'Login failed');
    }
  }

  return React.createElement('div', { className: 'login-wrapper' },
    React.createElement('div', { className: 'login-container' },
      React.createElement('h2', null, 'Login'),
      error && React.createElement('div', { className: 'error-message' }, error),
      React.createElement('form', { onSubmit: handleSubmit },
        React.createElement('input', { type: 'email', placeholder: 'Email', value: email, onChange: e => setEmail(e.target.value), required: true }),
        React.createElement('input', { type: 'password', placeholder: 'Password', value: password, onChange: e => setPassword(e.target.value), required: true }),
        React.createElement('button', { type: 'submit' }, 'Sign In')
      ),
      React.createElement('p', null, "Don't have an account? ", React.createElement(Link, { to: '/register' }, 'Register'))
    )
  );
}
