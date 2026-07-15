 import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { signup } from '../api/client';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import '../styles/Auth.css';
import useLoading from '../loading/useLoading';
import InlineSpinner from '../loading/components/InlineSpinner';
import { FaSignInAlt, FaCheckCircle } from 'react-icons/fa';
import { FaEnvelope, FaLock, FaUser, FaArrowRight, FaArrowLeft, FaUserPlus } from 'react-icons/fa6';

const TURNSTILE_SITE_KEY = '0x4AAAAAADknPpI_XcH1KfPe';

const pageVariants = {
  initial: { opacity: 0, x: 60 },
  in: { opacity: 1, x: 0 },
  out: { opacity: 0, x: -60 },
};

const pageTransition = { type: 'tween', ease: 'easeInOut', duration: 0.3 };

export default function Auth() {
  const location = useLocation();
  const navigate = useNavigate();
  const mode = location.pathname === '/register' ? 'register' : 'login';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { login } = useAuth();
  const turnstileRef = useRef(null);
  const widgetIdRef = useRef(null);
  const { show, hide } = useLoading();

  const redirectTo = location.state?.from
    ? `${location.state.from.pathname}${location.state.from.search || ''}`
    : '/dashboard';

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
          },
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

  const switchMode = useCallback((nextMode) => {
    navigate(nextMode === 'register' ? '/register' : '/login', {
      state: location.state,
      replace: true,
    });
  }, [navigate, location.state]);

  async function handleLogin(e) {
    e.preventDefault();
    setError('');

    const token = window.turnstile && widgetIdRef.current
      ? window.turnstile.getResponse(widgetIdRef.current)
      : '';

    if (!token) {
      setError('Verify to continue');
      return;
    }

    setSubmitting(true);
    show('auth', 'Signing you in...');

    try {
      await login(email, password, token);
      hide();
      navigate(redirectTo, { replace: true });
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

  async function handleRegister(e) {
    e.preventDefault();
    setError('');

    if (!fullName.trim()) {
      setError('Full name is required');
      return;
    }

    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    const token = window.turnstile && widgetIdRef.current
      ? window.turnstile.getResponse(widgetIdRef.current)
      : '';

    if (!token) {
      setError('Verify to continue');
      return;
    }

    setSubmitting(true);
    show('form', 'Creating your account...');

    try {
      await signup(email, password, token, { full_name: fullName.trim() });
      setSuccess(true);
      hide();

      setTimeout(() => {
        navigate('/login', { state: location.state, replace: true });
      }, 1500);
    } catch (err) {
      setError(err.message || 'Registration failed');
      hide();
      if (window.turnstile && widgetIdRef.current) {
        window.turnstile.reset(widgetIdRef.current);
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <motion.div
        className="auth-page"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="auth-form-panel">
          <div className="auth-card">
            <FaCheckCircle style={{ color: '#10b981', fontSize: '3rem', marginBottom: '1rem' }} />
            <div className="auth-title">Success</div>
            <div className="auth-subtitle">Account created. Redirecting...</div>
          </div>
        </div>
      </motion.div>
    );
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
          <div className="auth-brand-title">
            {mode === 'login' ? 'Welcome back' : 'Create account'}
          </div>
          <div className="auth-brand-description">
            {mode === 'login' ? 'Sign in to continue.' : 'Join the platform.'}
          </div>
        </div>
      </div>

      <div className="auth-form-panel">
        <div className="auth-card">
          <div className="auth-title">{mode === 'login' ? 'Login' : 'Register'}</div>
          <div className="auth-subtitle">
            {mode === 'login' ? 'Access your account securely' : 'Create your account securely'}
          </div>

          {error && <div className="auth-error">{error}</div>}

          <form onSubmit={mode === 'login' ? handleLogin : handleRegister} className="auth-form">
            {mode === 'register' && (
              <div className="input-wrapper">
                <FaUser style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="text"
                  placeholder="Full name"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  className="form-input"
                  style={{ paddingLeft: '44px' }}
                  required
                  disabled={submitting}
                />
              </div>
            )}

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

            {mode === 'register' && (
              <div className="input-wrapper">
                <FaLock style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="password"
                  placeholder="Confirm password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  className="form-input"
                  style={{ paddingLeft: '44px' }}
                  required
                  disabled={submitting}
                />
              </div>
            )}

            <div ref={turnstileRef} className="auth-captcha"></div>

            <button type="submit" className={`btn-primary auth-submit${submitting ? ' alv-btn-loading' : ''}`} disabled={submitting}>
              {mode === 'login'
                ? (submitting ? <><InlineSpinner /> Signing in...</> : <><FaSignInAlt style={{ marginRight: '8px' }} /> Sign in</>)
                : (submitting ? <><InlineSpinner /> Creating account...</> : <><FaUserPlus style={{ marginRight: '8px' }} /> Create Account</>)}
            </button>
          </form>

          <div className="auth-footer-text">
            {mode === 'login' ? (
              <>
                No account?{' '}
                <button type="button" className="auth-link" onClick={() => switchMode('register')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, font: 'inherit' }}>
                  <FaArrowRight style={{ marginRight: '4px', fontSize: '0.8rem' }} /> Register
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button type="button" className="auth-link" onClick={() => switchMode('login')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, font: 'inherit' }}>
                  <FaArrowLeft style={{ marginRight: '4px', fontSize: '0.8rem' }} /> Login
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
