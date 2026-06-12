 import React, { useState, useEffect } from 'react';
import { signup, getAllSiteSections } from '../api/client';
import { Link, useNavigate } from 'react-router-dom';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [sections, setSections] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    getAllSiteSections().then(data => setSections(data)).catch(() => {});
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (password !== confirm) { setError('Passwords do not match'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    try {
      await signup(email, password);
      setSuccess(true);
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err.message || 'Registration failed');
    }
  }

  if (success) {
    return React.createElement('div', { className: 'auth-page' },
      React.createElement('div', { className: 'auth-wrapper' },
        React.createElement('div', { className: 'auth-container', style: { textAlign: 'center' } },
          React.createElement('div', { style: { fontSize: '3rem', marginBottom: '1rem' } }, '✅'),
          React.createElement('h2', null, 'Account Created!'),
          React.createElement('p', { style: { color: 'var(--clr-text-dim)' } }, 'Redirecting to login...')
        )
      )
    );
  }

  return React.createElement('div', { className: 'auth-page' },

    React.createElement('header', { className: 'site-header' },
      React.createElement('div', { className: 'header-container' },
        React.createElement('a', { href: '/', className: 'logo-link', 'aria-label': 'AliverBiopharm Home' },
          sections?.site_config?.logo_url
            ? React.createElement('img', { src: sections.site_config.logo_url, alt: 'AliverBiopharm', style: { height: '70px', width: 'auto' } })
            : 'AliverBiopharm'
        ),
        React.createElement('a', { href: '/', style: { color: 'var(--clr-cyan)', textDecoration: 'none', fontWeight: 600, fontSize: '0.9rem' } }, '← Back to Home')
      )
    ),

    React.createElement('div', { className: 'auth-wrapper' },
      React.createElement('div', { className: 'auth-container' },
        React.createElement('div', { className: 'auth-logo' }, '🧬'),
        React.createElement('h2', null, 'Create Account'),
        React.createElement('p', { className: 'auth-subtitle' }, 'Join AliverBiopharm today'),

        error && React.createElement('div', { className: 'error-message' }, error),

        React.createElement('form', { onSubmit: handleSubmit },
          React.createElement('div', { className: 'form-group' },
            React.createElement('label', { className: 'f-label' }, 'EMAIL ADDRESS'),
            React.createElement('input', {
              type: 'email',
              className: 'f-input',
              placeholder: 'Enter your email',
              value: email,
              onChange: e => setEmail(e.target.value),
              required: true
            })
          ),
          React.createElement('div', { className: 'form-group' },
            React.createElement('label', { className: 'f-label' }, 'PASSWORD'),
            React.createElement('input', {
              type: 'password',
              className: 'f-input',
              placeholder: 'Minimum 8 characters',
              value: password,
              onChange: e => setPassword(e.target.value),
              required: true
            })
          ),
          React.createElement('div', { className: 'form-group' },
            React.createElement('label', { className: 'f-label' }, 'CONFIRM PASSWORD'),
            React.createElement('input', {
              type: 'password',
              className: 'f-input',
              placeholder: 'Repeat your password',
              value: confirm,
              onChange: e => setConfirm(e.target.value),
              required: true
            })
          ),
          React.createElement('button', { type: 'submit', className: 'auth-btn' },
            React.createElement('i', { className: 'fa-solid fa-user-plus' }),
            ' Create Account'
          )
        ),

        React.createElement('p', { className: 'auth-switch' },
          'Already have an account? ',
          React.createElement(Link, { to: '/login', style: { color: 'var(--clr-cyan)', fontWeight: 600 } }, 'Sign In')
        )
      )
    ),

    React.createElement('footer', { className: 'auth-footer' },
      `© ${new Date().getFullYear()} AliverBiopharm. All rights reserved.`
    )
  );
}
