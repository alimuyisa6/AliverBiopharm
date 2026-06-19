 import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { signin } from '../api/client';
import { useNavigate, Link } from 'react-router-dom';
import '../styles/Auth.css';

const TURNSTILE_SITE_KEY = '0x4AAAAAADknPpI_XcH1KfPe';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { refresh } = useAuth();
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

    const token =
      window.turnstile && widgetIdRef.current
        ? window.turnstile.getResponse(widgetIdRef.current)
        : '';

    if (!token) {
      setError('Verify to continue');
      return;
    }

    try {
      await signin(email, password, token);
      await refresh();
      navigate('/');
    } catch (err) {
      setError(err.message || 'Login failed');
      if (window.turnstile && widgetIdRef.current) {
        window.turnstile.reset(widgetIdRef.current);
      }
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-brand-panel">
        <div className="auth-brand-content">
          <div className="auth-label">ALIVER BIOPHARM</div>
          <div className="auth-brand-title">Welcome back</div>
          <div className="auth-brand-description">
            Sign in to continue.
          </div>
        </div>
      </div>

      <div className="auth-form-panel">
        <div className="auth-card">
          <div className="auth-title">Login</div>
          <div className="auth-subtitle">Access your account securely</div>

          {error && <div className="auth-error">{error}</div>}

          <form onSubmit={handleSubmit} className="auth-form">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="form-input"
              required
            />

            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="form-input"
              required
            />

            <div ref={turnstileRef} className="auth-captcha"></div>

            <button type="submit" className="btn-primary auth-submit">
              Sign in
            </button>
          </form>

          <div className="auth-footer-text">
            No account? <Link to="/register" className="auth-link">Register</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
