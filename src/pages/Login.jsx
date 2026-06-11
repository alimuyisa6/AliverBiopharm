import React, { useState } from 'react';
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

  return React.createElement('div', { className: 'auth-page' },
    React.createElement('header', { className: 'site-header' },
      React.createElement('div', { className: 'header-container' },
        React.createElement('a', { href: '/', className: 'logo-link' }, 'AliverBiopharm'),
        React.createElement('nav', null,
          React.createElement('a', { href: '/', style: { color: 'var(--clr-cyan)', textDecoration: 'none', fontWeight: 600 } }, '← Back to Home')
        )
      )
    ),
    React.createElement('div', { className: 'auth-wrapper' },
      React.createElement('div', { className: 'auth-container' },
        React.createElement('div', { className: 'auth-logo' }, '🧬'),
        React.createElement('h2', null, 'Welcome Back'),
        React.createElement('p', { className: 'auth-subtitle' }, 'Sign in to your AliverBiopharm account'),
        error && React.createElement('div', { className: 'error-message' }, error),
        React.createElement('form', { onSubmit: handleSubmit },
          React.createElement('div', { className: 'form-group' },
            React.createElement('label', { className: 'f-label' }, 'EMAIL ADDRESS'),
            React.createElement('input', { type: 'email', className: 'f-input', placeholder: 'Enter your email', value: email, onChange: e => setEmail(e.target.value), required: true })
          ),
          React.createElement('div', { className: 'form-group' },
            React.createElement('label', { className: 'f-label' }, 'PASSWORD'),
            React.createElement('input', { type: 'password', className: 'f-input', placeholder: 'Enter your password', value: password, onChange: e => setPassword(e.target.value), required: true })
          ),
          React.createElement('button', { type: 'submit', className: 'auth-btn' },
            React.createElement('i', { className: 'fa-solid fa-right-to-bracket' }), ' Sign In'
          )
        ),
        React.createElement('p', { className: 'auth-switch' },
          "Don't have an account? ",
          React.createElement(Link, { to: '/register', style: { color: 'var(--clr-cyan)', fontWeight: 600 } }, 'Create Account')
        )
      )
    ),
    React.createElement('footer', { style: { textAlign: 'center', padding: '1.5rem', color: 'var(--clr-text-muted)', fontSize: '0.8rem', borderTop: '1px solid var(--clr-border-glow)' } },
      `© ${new Date().getFullYear()} AliverBiopharm. All rights reserved.`
    )
  );
}
