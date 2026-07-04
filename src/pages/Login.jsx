 import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { signin } from '../api/client';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import '../styles/Auth.css';
import useLoading from '../loading/useLoading';
import InlineSpinner from '../loading/components/InlineSpinner';
import { FaSignInAlt } from "react-icons/fa";
import { FaEnvelope, FaLock, FaArrowRight } from "react-icons/fa6";

const TURNSTILE_SITE_KEY = '0x4AAAAAADknPpI_XcH1KfPe';

const pageVariants = {
  initial: {
    opacity: 0,
    x: 60,
  },
  in: {
    opacity: 1,
    x: 0,
  },
  out: {
    opacity: 0,
    x: -60,
  }
};

const pageTransition = {
  type: 'tween',
  ease: 'easeInOut',
  duration: 0.3
};

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const turnstileRef = useRef(null);
  const widgetIdRef = useRef(null);
  const { show, hide } = useLoading();

  useEffect(() => {
    let cancelled = false;

    if (!document.querySelector('script[src*="turnstile"]')) {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
      script.async = true;
      script.defer = true;
      script.crossOrigin = 'anonymous';
      document.head.appendChild(script);
    }

    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      if (cancelled) return;
      if (window.turnstile && turnstileRef.current && !widgetIdRef.current) {
        widgetIdRef.current = window.turnstile.render(turnstileRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          'expired-callback': () => {
            if (window.turnstile && widgetIdRef.current) {
              window.turnstile.reset(widgetIdRef.current);
            }
          },
          'error-callback': () => {
            if (window.turnstile && widgetIdRef.current) {
              window.turnstile.reset(widgetIdRef.current);
            }
            return false;
          }
        });
        clearInterval(interval);
      }
      if (attempts > 50) clearInterval(interval);
    }, 100);

    return () => {
      cancelled = true;
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

    setSubmitting(true);
    show("auth", "Signing you in...");

    try {
      await signin(email, password, token);
      await refresh();
      hide();
      navigate('/');
    } catch (err) {
      setError(err.message || 'Login failed');
      hide();
      if (window.turnstile && widgetIdRef.current) {
        window.turnstile.reset(widgetIdRef.current);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <motion.div
      className="auth-page"
      initial="initial"
      animate="in"
      exit="out"
      variants={pageVariants}
      transition={pageTransition}
    >
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
            <div className="input-wrapper">
              <FaEnvelope style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="form-input"
                style={{ paddingLeft: '44px' }}
                required
                disabled={submitting}
              />
            </div>

            <div className="input-wrapper">
              <FaLock style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="form-input"
                style={{ paddingLeft: '44px' }}
                required
                disabled={submitting}
              />
            </div>

            <div ref={turnstileRef} className="auth-captcha"></div>

            <button type="submit" className={`btn-primary auth-submit${submitting ? ' alv-btn-loading' : ''}`} disabled={submitting}>
              {submitting ? <><InlineSpinner /> Signing in...</> : <><FaSignInAlt style={{ marginRight: '8px' }} /> Sign in</>}
            </button>
          </form>

          <div className="auth-footer-text">
            No account? <Link to="/register" className="auth-link"><FaArrowRight style={{ marginRight: '4px', fontSize: '0.8rem' }} /> Register</Link>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
