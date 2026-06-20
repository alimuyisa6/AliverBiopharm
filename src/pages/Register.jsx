 import React, { useState, useEffect, useRef } from 'react';
import { signup } from '../api/client';
import { Link, useNavigate } from 'react-router-dom';
import '../styles/Auth.css';

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

    const token =
      window.turnstile && widgetIdRef.current
        ? window.turnstile.getResponse(widgetIdRef.current)
        : '';

    if (!token) {
      setError('Verify to continue');
      return;
    }

    try {
      await signup(email, password, token);
      setSuccess(true);

      setTimeout(() => {
        navigate('/login');
      }, 1500);
    } catch (err) {
      setError(err.message || 'Registration failed');

      if (window.turnstile && widgetIdRef.current) {
        window.turnstile.reset(widgetIdRef.current);
      }
    }
  }

  if (success) {
    return (
      <div className="auth-page">
        <div className="auth-form-panel">
          <div className="auth-card">
            <div className="auth-title">Success</div>
            <div className="auth-subtitle">
              Account created. Redirecting...
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-brand-panel">
        <div className="auth-brand-content">
          <div className="auth-label">ALIVER BIOPHARM</div>
          <div className="auth-brand-title">Create account</div>
          <div className="auth-brand-description">
            Join the platform.
          </div>
        </div>
      </div>

      <div className="auth-form-panel">
        <div className="auth-card">
          <div className="auth-title">Register</div>
          <div className="auth-subtitle">
            Create your account securely
          </div>

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

            <input
              type="password"
              placeholder="Confirm Password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              className="form-input"
              required
            />

            <div ref={turnstileRef} className="auth-captcha"></div>

            <button
              type="submit"
              className="btn-primary auth-submit"
            >
              Create Account
            </button>
          </form>

          <div className="auth-footer-text">
            Already have an account?{' '}
            <Link
              to="/login"
              className="auth-link"
            >
              Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
