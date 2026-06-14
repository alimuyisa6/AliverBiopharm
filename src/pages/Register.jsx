 import React, { useState, useEffect, useRef } from 'react';
import { signup } from '../api/client';
import { Link, useNavigate } from 'react-router-dom';

const TURNSTILE_SITE_KEY = '0x4AAAAAADknPpI_XcH1KfPe';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();
  const turnstileRef = useRef(null);
  const widgetIdRef = useRef(null);

  useEffect(() => {
    if (!document.querySelector('script[src*="turnstile"]')) {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      if (window.turnstile && turnstileRef.current && !widgetIdRef.current) {
        widgetIdRef.current = window.turnstile.render(turnstileRef.current, {
          sitekey: TURNSTILE_SITE_KEY
        });
        clearInterval(interval);
      }
      if (attempts > 50) clearInterval(interval);
    }, 100);

    return () => {
      clearInterval(interval);
      if (window.turnstile && widgetIdRef.current) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, []);

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

    const turnstileToken = window.turnstile && widgetIdRef.current
      ? window.turnstile.getResponse(widgetIdRef.current)
      : '';

    if (!turnstileToken) {
      setError('Please complete the captcha');
      return;
    }

    try {
      await signup(email, password, turnstileToken);
      setSuccess(true);
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err.message || 'Registration failed');
      if (window.turnstile && widgetIdRef.current) {
        window.turnstile.reset(widgetIdRef.current);
      }
    }
  }

  if (success) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--clr-deep-space)' }}>
        <div style={{ background: '#d4edda', padding: '1rem', borderRadius: '8px', color: '#155724' }}>✅ Registration successful! Redirecting to login...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--clr-deep-space)' }}>
      <div style={{ background: 'var(--clr-navy-card)', padding: '2rem', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: '400px' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '1.5rem', color: 'var(--clr-white)' }}>Register</h2>
        {error && <div style={{ background: '#fee', color: '#c00', padding: '0.5rem', borderRadius: '8px', marginBottom: '1rem' }}>{error}</div>}
        <form onSubmit={handleSubmit}>
          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="form-input" style={{ width: '100%', marginBottom: '1rem' }} required />
          <input type="password" placeholder="Password (min 8 chars)" value={password} onChange={e => setPassword(e.target.value)} className="form-input" style={{ width: '100%', marginBottom: '1rem' }} required />
          <input type="password" placeholder="Confirm Password" value={confirm} onChange={e => setConfirm(e.target.value)} className="form-input" style={{ width: '100%', marginBottom: '1rem' }} required />
          <div ref={turnstileRef} style={{ marginBottom: '1rem' }}></div>
          <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>Create Account</button>
        </form>
        <p style={{ textAlign: 'center', marginTop: '1rem', color: 'var(--clr-text-dim)' }}>
          Already have an account? <Link to="/login" style={{ color: 'var(--clr-magenta)' }}>Login</Link>
        </p>
      </div>
    </div>
  );
}
