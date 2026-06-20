 import React, { useState, useEffect, useRef } from 'react';
import { signup } from '../api/client';
import { useNavigate, Link } from 'react-router-dom';
import AuthLayout from '../layouts/AuthLayout';
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

    const interval = setInterval(() => {
      if (window.turnstile && turnstileRef.current && !widgetIdRef.current) {
        widgetIdRef.current = window.turnstile.render(turnstileRef.current, {
          sitekey: TURNSTILE_SITE_KEY
        });
        clearInterval(interval);
      }
    }, 100);

    return () => {
      clearInterval(interval);
      if (window.turnstile && widgetIdRef.current) {
        window.turnstile.remove(widgetIdRef.current);
      }
    };
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (password !== confirm) return setError('Passwords do not match');
    if (password.length < 8) return setError('Password too short');

    const token =
      window.turnstile && widgetIdRef.current
        ? window.turnstile.getResponse(widgetIdRef.current)
        : '';

    if (!token) return setError('Verify first');

    try {
      await signup(email, password, token);
      setSuccess(true);
      setTimeout(() => navigate('/login'), 1500);
    } catch (err) {
      setError(err.message || 'Signup failed');
    }
  }

  if (success) {
    return (
      <div className="auth-success-screen">
        <div className="auth-success-card">
          Account created. Redirecting...
        </div>
      </div>
    );
  }

  return (
    <AuthLayout
      title="Create account"
      subtitle="Join Aliver Biopharm secure platform"
    >
      <div className="auth-title">Register</div>
      <div className="auth-subtitle">Fill details to continue</div>

      {error && <div className="auth-error">{error}</div>}

      <form onSubmit={handleSubmit} className="auth-form">
        <input
          className="form-input"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />

        <input
          className="form-input"
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
        />

        <input
          className="form-input"
          type="password"
          placeholder="Confirm Password"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
        />

        <div ref={turnstileRef} className="auth-captcha"></div>

        <button className="btn-primary auth-submit">
          Create account
        </button>
      </form>

      <div className="auth-footer-text">
        Already have account?{" "}
        <Link className="auth-link" to="/login">
          Login
        </Link>
      </div>
    </AuthLayout>
  );
}
