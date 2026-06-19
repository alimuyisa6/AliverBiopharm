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

      if (attempts > 50) {
        clearInterval(interval);
      }
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

    const turnstileToken =
      window.turnstile && widgetIdRef.current
        ? window.turnstile.getResponse(widgetIdRef.current)
        : '';

    if (!turnstileToken) {
      setError('Please complete the captcha');
      return;
    }

    try {
      await signup(email, password, turnstileToken);

      setSuccess(true);

      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err) {
      setError(err.message || 'Registration failed');

      if (window.turnstile && widgetIdRef.current) {
        window.turnstile.reset(widgetIdRef.current);
      }
    }
  }

  if (success) {
    return (
      <div className="auth-success-screen">
        <div className="auth-success-card">
          Registration successful. Redirecting to login...
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-brand-panel">
        <div className="auth-brand-content">
          <span className="auth-label">ALIVER BIOPHARM</span>

          <h1 className="auth-brand-title">
            Your Scientific
            <br />
            Journey Starts
            <br />
            Here.
          </h1>

          <p className="auth-brand-description">
            Create an account to access interactive learning resources,
            monitor your progress, and build a stronger foundation in
            biology and pharmaceutical sciences.
          </p>

          <div className="auth-features">
            <div className="auth-feature">✓ Personalized Learning</div>
            <div className="auth-feature">✓ Track Achievements</div>
            <div className="auth-feature">✓ Community Learning</div>
            <div className="auth-feature">✓ Modern Study Tools</div>
          </div>
        </div>
      </div>

      <div className="auth-form-panel">
        <div className="auth-card">
          <h2 className="auth-title">Create Account</h2>

          <p className="auth-subtitle">
            Join Aliver BIOPHARM and start learning today.
          </p>

          {error && (
            <div className="auth-error">
              {error}
            </div>
          )}

          <form className="auth-form" onSubmit={handleSubmit}>
            <input
              type="email"
              placeholder="Email Address"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <input
              type="password"
              placeholder="Password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <input
              type="password"
              placeholder="Confirm Password"
              className="form-input"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />

            <div ref={turnstileRef} className="auth-captcha" />

            <button
              type="submit"
              className="btn-primary auth-submit"
            >
              Create Account
            </button>
          </form>

          <p className="auth-footer-text">
            Already have an account?{' '}
            <Link to="/login" className="auth-link">
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
