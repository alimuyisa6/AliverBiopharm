 import React, { useState } from 'react';
import { signup } from '../api/client';
import { Link, useNavigate } from 'react-router-dom';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    try {
      await signup(email, password);
      setSuccess(true);
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err.message || 'Registration failed');
    }
  }

  if (success) {
    return React.createElement('div', { className: 'success-wrapper' },
      React.createElement('div', null, '✅ Registration successful! Redirecting to login...')
    );
  }

  return React.createElement('div', { className: 'register-wrapper' },
    React.createElement('div', { className: 'register-container' },
      React.createElement('h2', null, 'Register'),
      error && React.createElement('div', { className: 'error-message' }, error),
      React.createElement('form', { onSubmit: handleSubmit },
        React.createElement('input', { type: 'email', placeholder: 'Email', value: email, onChange: e => setEmail(e.target.value), required: true }),
        React.createElement('input', { type: 'password', placeholder: 'Password (min 8 chars)', value: password, onChange: e => setPassword(e.target.value), required: true }),
        React.createElement('input', { type: 'password', placeholder: 'Confirm Password', value: confirm, onChange: e => setConfirm(e.target.value), required: true }),
        React.createElement('button', { type: 'submit' }, 'Create Account')
      ),
      React.createElement('p', null, 'Already have an account? ', React.createElement(Link, { to: '/login' }, 'Login'))
    )
  );
}
