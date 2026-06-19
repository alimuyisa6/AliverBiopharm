 import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { signin } from '../api/client';
import { useNavigate, Link } from 'react-router-dom';
import './Auth.css';

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

    const turnstileToken =
      window.turnstile && widgetIdRef.current
        ? window.turnstile.getResponse(widgetIdRef.current)
        : '';

    if (!turnstileToken) {
      setError('Please complete the captcha');
      return;
    }

    try {
      await signin(email, password, turnstileToken);
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
          <span className="auth-label">ALIVER BIOPHARM</span>

          <h1 className="auth-brand-title">
            Learn Biology.
            <br />
            Master Pharmacy.
            <br />
            Advance Healthcare.
          </h1>

          <p className="auth-brand-description">
            Empowering students and professionals through evidence-based
            biological and pharmaceutical education designed for academic
            excellence and lifelong learning.
          </p>

          <div className="auth-features">
            <div className="auth-feature">✓ Interactive Quizzes</div>
            <div className="auth-feature">✓ Study Resources</div>
            <div className="auth-feature">✓ Expert Learning Content</div>
            <div className="auth-feature">✓ Progress Tracking</div>
          </div>
        </div>
      </div>

      <div className="auth-form-panel">
        <div className="auth-card">
          <h2 className="auth-title">Welcome Back</h2>

          <p className="auth-subtitle">
            Sign in to continue your learning journey.
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

            <div ref={turnstileRef} className="auth-captcha" />

            <button
              type="submit"
              className="btn-primary auth-submit"
            >
              Sign In
            </button>
          </form>

          <p className="auth-footer-text">
            Don't have an account?{' '}
            <Link to="/register" className="auth-link">
              Create Account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
