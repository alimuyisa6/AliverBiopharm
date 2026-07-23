 import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { signup, getClassSequence, getPharmacyPrograms } from '../api/client';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import '../styles/Auth.css';
import useLoading from '../loading/useLoading';
import InlineSpinner from '../loading/components/InlineSpinner';
import { 
  FaEnvelope, 
  FaLock, 
  FaUser, 
  FaArrowRight, 
  FaArrowLeft, 
  FaUserPlus, 
  FaRightToBracket, 
  FaCircleCheck, 
  FaGraduationCap, 
  FaShield, 
  FaRocket, 
  FaBook, 
  FaChartLine, 
  FaUsers, 
  FaEye, 
  FaEyeSlash, 
  FaUserGraduate, 
  FaChalkboardUser, 
  FaSeedling, 
  FaFlask, 
  FaCapsules, 
  FaCheck 
} from 'react-icons/fa6';

const TURNSTILE_SITE_KEY = '0x4AAAAAADknPpI_XcH1KfPe';

const TRACKS = [
  { value: 'O-Level', icon: FaSeedling, label: 'O-Level', description: 'Senior 1 – 4' },
  { value: 'A-Level', icon: FaFlask, label: 'A-Level', description: 'Senior 5 – 6' },
  { value: 'Pharmacy', icon: FaCapsules, label: 'Pharmacy', description: 'Certificate, Diploma, Degree' },
];

const pageVariants = { 
  initial: { opacity: 0, x: 80 }, 
  in: { opacity: 1, x: 0 }, 
  out: { opacity: 0, x: -80 } 
};

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
  const [focused, setFocused] = useState(null);
  const [showPassword, setShowPassword] = useState({ password: false, confirm: false });

  const [onboardingStep, setOnboardingStep] = useState(0);
  const [role, setRole] = useState(null);
  const [track, setTrack] = useState(null);
  const [className, setClassName] = useState(null);
  const [classes, setClasses] = useState([]);

  const [mfaStep, setMfaStep] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaError, setMfaError] = useState('');

  const { login } = useAuth();
  const turnstileRef = useRef(null);
  const widgetIdRef = useRef(null);
  const { show, hide } = useLoading();

  const redirectTo = location.state?.from ? `${location.state.from.pathname}${location.state.from.search || ''}` : '/dashboard';

  useEffect(() => {
    if (track) {
      if (track === 'Pharmacy') {
        getPharmacyPrograms()
          .then(data => setClasses((data || []).map(p => ({ value: p.program_name, label: p.program_name, description: p.description }))))
          .catch(() => setClasses([]));
      } else {
        getClassSequence(track)
          .then(data => setClasses((data || []).map(c => ({ value: c.class_name, label: c.class_name }))))
          .catch(() => setClasses([]));
      }
    }
  }, [track]);

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
            if (window.turnstile && widgetIdRef.current) 
              window.turnstile.reset(widgetIdRef.current); 
          }, 
          'error-callback': () => { 
            if (window.turnstile && widgetIdRef.current) 
              window.turnstile.reset(widgetIdRef.current); 
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

  const switchMode = useCallback((nextMode) => { 
    navigate(nextMode === 'register' ? '/register' : '/login', { state: location.state, replace: true }); 
  }, [navigate, location.state]);

  const getTurnstileToken = () => window.turnstile && widgetIdRef.current ? window.turnstile.getResponse(widgetIdRef.current) : '';

  async function handleLogin(e) {
    e.preventDefault(); 
    setError(''); 
    const token = getTurnstileToken(); 
    if (!token) { 
      setError('Please complete the verification'); 
      return; 
    }
    setSubmitting(true); 
    show('auth', 'Signing you in...');
    try {
      const result = await login(email, password, token);
      if (result?.mfa_required) {
        hide();
        setSubmitting(false);
        setMfaStep(true);
        if (window.turnstile && widgetIdRef.current) 
          window.turnstile.reset(widgetIdRef.current);
        return;
      }
      hide();
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err.message || 'Login failed.'); 
      hide();
      if (window.turnstile && widgetIdRef.current) 
        window.turnstile.reset(widgetIdRef.current);
    } finally { 
      setSubmitting(false); 
    }
  }

  async function handleMfaSubmit(e) {
    e.preventDefault(); 
    setMfaError('');
    if (!mfaCode.trim() || mfaCode.trim().length !== 6) { 
      setMfaError('Enter the 6-digit code from your authenticator app'); 
      return; 
    }
    const token = getTurnstileToken();
    if (!token) { 
      setMfaError('Please complete the verification again'); 
      return; 
    }
    setSubmitting(true); 
    show('auth', 'Verifying...');
    try {
      const result = await login(email, password, token, mfaCode.trim());
      if (result?.mfa_required) {
        setMfaError('Incorrect code. Please try again.');
        hide();
        if (window.turnstile && widgetIdRef.current) 
          window.turnstile.reset(widgetIdRef.current);
        return;
      }
      hide();
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setMfaError(err.message || 'Verification failed.'); 
      hide();
      if (window.turnstile && widgetIdRef.current) 
        window.turnstile.reset(widgetIdRef.current);
    } finally { 
      setSubmitting(false); 
    }
  }

  function handleMfaBack() {
    setMfaStep(false); 
    setMfaCode(''); 
    setMfaError('');
    if (window.turnstile && widgetIdRef.current) 
      window.turnstile.reset(widgetIdRef.current);
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
    if (mode === 'register') { 
      setOnboardingStep(1); 
    }
  }

  async function handleOnboardingFinish() {
    setError('');
    if (!role || !track || !className) { 
      setError('Please complete all onboarding steps'); 
      return; 
    }
    const token = getTurnstileToken(); 
    if (!token) { 
      setError('Verification expired.'); 
      return; 
    }
    setSubmitting(true); 
    show('form', 'Creating your account...');
    try {
      await signup(email, password, token, { 
        full_name: fullName.trim(), 
        role, 
        track, 
        class_name: className 
      });
      setSuccess(true); 
      hide();
      setTimeout(() => { 
        navigate(redirectTo, { replace: true }); 
      }, 1500);
    } catch (err) { 
      setError(err.message || 'Registration failed.'); 
      hide(); 
      if (window.turnstile && widgetIdRef.current) 
        window.turnstile.reset(widgetIdRef.current); 
    } finally { 
      setSubmitting(false); 
    }
  }

  const progressPct = () => { 
    if (onboardingStep === 1) return 35; 
    if (onboardingStep === 2) return 70; 
    if (onboardingStep === 3) return 100; 
    return 0; 
  };

  if (success) {
    return (
      <motion.div 
        className="auth-page" 
        initial={{ opacity: 0, scale: 0.95 }} 
        animate={{ opacity: 1, scale: 1 }} 
        exit={{ opacity: 0 }} 
        transition={{ duration: 0.4 }}
      >
        <div className="auth-form-panel">
          <div className="auth-card success-card">
            <motion.div 
              initial={{ scale: 0 }} 
              animate={{ scale: 1 }} 
              transition={{ type: 'spring', damping: 15, stiffness: 200 }}
            >
              <FaCircleCheck className="success-icon" />
            </motion.div>
            <h2 className="success-title">Account Created!</h2>
            <p className="success-subtitle">Welcome to Aliver Biopharm. Redirecting you...</p>
            <div className="success-loader">
              <div className="loader-bar"></div>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  if (mfaStep) {
    return (
      <motion.div 
        className="auth-page" 
        initial="initial" 
        animate="in" 
        exit="out" 
        variants={pageVariants} 
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      >
        <div className="auth-form-panel">
          <motion.div 
            className="auth-card" 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ delay: 0.1 }}
          >
            <div className="auth-header">
              <h2 className="auth-title">Two-Factor Verification</h2>
              <p className="auth-subtitle">Enter the 6-digit code from your authenticator app</p>
            </div>
            <AnimatePresence>
              {mfaError && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  exit={{ opacity: 0, y: -10 }} 
                  className="auth-error"
                >
                  <span className="error-icon">⚠</span>{mfaError}
                </motion.div>
              )}
            </AnimatePresence>
            <form onSubmit={handleMfaSubmit} className="auth-form">
              <div className="form-group">
                <label className="form-label">Authentication Code</label>
                <div className="input-wrapper">
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    placeholder="000000"
                    value={mfaCode}
                    onChange={e => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    onFocus={() => setFocused('mfa')}
                    onBlur={() => setFocused(null)}
                    className={`form-input ${focused === 'mfa' ? 'input-focused' : ''}`}
                    style={{ letterSpacing: '0.4em', textAlign: 'center' }}
                    required
                    disabled={submitting}
                    autoFocus
                  />
                  <div className="input-highlight"></div>
                </div>
              </div>
              <div ref={turnstileRef} className="auth-captcha"></div>
              <motion.button 
                type="submit" 
                className={`btn-primary auth-submit ${submitting ? 'loading' : ''}`} 
                disabled={submitting} 
                whileHover={{ scale: 1.02 }} 
                whileTap={{ scale: 0.98 }}
              >
                {submitting ? <><InlineSpinner /> Verifying...</> : 'Verify and Sign In'}
              </motion.button>
            </form>
            <div className="auth-footer">
              <p className="auth-footer-text">
                <button type="button" className="auth-link" onClick={handleMfaBack}>
                  <FaArrowLeft /> Back to sign in
                </button>
              </p>
            </div>
          </motion.div>
        </div>
      </motion.div>
    );
  }

  if (onboardingStep > 0) {
    return (
      <motion.div 
        className="auth-page" 
        initial="initial" 
        animate="in" 
        exit="out" 
        variants={pageVariants} 
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      >
        <div className="auth-form-panel">
          <div className="auth-card">
            <div className="auth-header">
              <h2 className="auth-title">Complete Your Profile</h2>
              <p className="auth-subtitle">Help us personalise your learning experience</p>
            </div>
            <div className="fc-progress-track" style={{ marginBottom: '2rem' }}>
              <div className="fc-progress-fill" style={{ width: `${progressPct()}%` }} />
            </div>
            <AnimatePresence>
              {error && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  exit={{ opacity: 0, y: -10 }} 
                  className="auth-error"
                >
                  <span className="error-icon">⚠</span>{error}
                </motion.div>
              )}
            </AnimatePresence>
            {onboardingStep === 1 && (
              <div className="fc-step">
                <span className="fc-step-label">Step 1 of 3</span>
                <h3 className="fc-step-title">I am a...</h3>
                <div className="fc-option-grid fc-cols-1">
                  <button 
                    className={`fc-option-btn ${role === 'student' ? 'fc-selected' : ''}`} 
                    onClick={() => { setRole('student'); setOnboardingStep(2); }}
                  >
                    <FaUserGraduate className="fc-option-icon" />
                    <span className="fc-option-label">Student</span>
                    <span className="fc-option-sub">I'm here to learn</span>
                  </button>
                  <button 
                    className={`fc-option-btn ${role === 'teacher' ? 'fc-selected' : ''}`} 
                    onClick={() => { setRole('teacher'); setOnboardingStep(2); }}
                  >
                    <FaChalkboardUser className="fc-option-icon" />
                    <span className="fc-option-label">Teacher</span>
                    <span className="fc-option-sub">I'm here to teach or contribute content</span>
                  </button>
                </div>
              </div>
            )}
            {onboardingStep === 2 && (
              <div className="fc-step">
                <span className="fc-step-label">Step 2 of 3</span>
                <h3 className="fc-step-title">Select your track</h3>
                <div className="fc-option-grid fc-cols-1">
                  {TRACKS.map(t => { 
                    const Icon = t.icon; 
                    return (
                      <button 
                        key={t.value} 
                        className={`fc-option-btn ${track === t.value ? 'fc-selected' : ''}`} 
                        onClick={() => { setTrack(t.value); setClassName(null); setOnboardingStep(3); }}
                      >
                        <Icon className="fc-option-icon" />
                        <span className="fc-option-label">{t.label}</span>
                        <span className="fc-option-sub">{t.description}</span>
                      </button>
                    ); 
                  })}
                </div>
                <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'center' }}>
                  <button className="fc-btn fc-btn-ghost" onClick={() => { setOnboardingStep(1); setTrack(null); }}>
                    <FaArrowLeft /> Back
                  </button>
                </div>
              </div>
            )}
            {onboardingStep === 3 && (
              <div className="fc-step">
                <span className="fc-step-label">Step 3 of 3</span>
                <h3 className="fc-step-title">{track === 'Pharmacy' ? 'Select your programme' : 'Select your class'}</h3>
                <div className="fc-option-grid fc-cols-1">
                  {classes.map(c => (
                    <button 
                      key={c.value} 
                      className={`fc-option-btn ${className === c.value ? 'fc-selected' : ''}`} 
                      onClick={() => setClassName(c.value)}
                    >
                      <span className="fc-option-label">{c.label}</span>
                      {c.description && <span className="fc-option-sub">{c.description}</span>}
                    </button>
                  ))}
                </div>
                <div style={{ marginTop: '1.5rem', display: 'flex', gap: '10px', justifyContent: 'center' }}>
                  <button className="fc-btn fc-btn-ghost" onClick={() => setOnboardingStep(2)}>
                    <FaArrowLeft /> Back
                  </button>
                  <button 
                    className="btn-primary auth-submit" 
                    onClick={handleOnboardingFinish} 
                    disabled={!className || submitting}
                  >
                    {submitting ? <><InlineSpinner /> Creating account...</> : <><FaCheck /> Complete Registration</>}
                  </button>
                </div>
              </div>
            )}
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
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
    >
      <div className="auth-brand-panel">
        <div className="auth-brand-content">
          <motion.div 
            initial={{ opacity: 0, y: -20 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ delay: 0.2 }} 
            className="auth-brand-badge"
          >
            <FaGraduationCap />
          </motion.div>
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            transition={{ delay: 0.3 }} 
            className="auth-label"
          >
            ALIVER BIOPHARM
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ delay: 0.4 }} 
            className="auth-brand-title"
          >
            {mode === 'login' ? 'Welcome Back' : 'Start Your Journey'}
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            transition={{ delay: 0.5 }} 
            className="auth-brand-description"
          >
            {mode === 'login' ? 'Sign in to continue your learning journey' : 'Create an account and start learning today'}
          </motion.p>
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            transition={{ delay: 0.6 }} 
            className="auth-features"
          >
            <div className="auth-feature">
              <FaRocket className="feature-icon" style={{ color: 'var(--clr-cyan)' }} />
              <span>Personalized learning</span>
            </div>
            <div className="auth-feature">
              <FaBook className="feature-icon" style={{ color: 'var(--clr-magenta)' }} />
              <span>Expert resources</span>
            </div>
            <div className="auth-feature">
              <FaShield className="feature-icon" style={{ color: 'var(--clr-blue)' }} />
              <span>Secure & private</span>
            </div>
            <div className="auth-feature">
              <FaUsers className="feature-icon" style={{ color: 'var(--clr-orange)' }} />
              <span>Community learning</span>
            </div>
          </motion.div>
        </div>
      </div>
      <div className="auth-form-panel">
        <motion.div 
          className="auth-card" 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ delay: 0.2 }}
        >
          <div className="auth-header">
            <h2 className="auth-title">{mode === 'login' ? 'Sign In' : 'Create Account'}</h2>
            <p className="auth-subtitle">{mode === 'login' ? 'Access your account securely' : 'Join thousands of learners worldwide'}</p>
          </div>
          <AnimatePresence>
            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }} 
                animate={{ opacity: 1, y: 0 }} 
                exit={{ opacity: 0, y: -10 }} 
                className="auth-error"
              >
                <span className="error-icon">⚠</span>{error}
              </motion.div>
            )}
          </AnimatePresence>
          <form onSubmit={mode === 'login' ? handleLogin : handleRegister} className="auth-form">
            {mode === 'register' && (
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <div className="input-wrapper">
                  <input 
                    type="text" 
                    placeholder="Enter your full name" 
                    value={fullName} 
                    onChange={e => setFullName(e.target.value)} 
                    onFocus={() => setFocused('name')} 
                    onBlur={() => setFocused(null)} 
                    className={`form-input ${focused === 'name' ? 'input-focused' : ''}`} 
                    required 
                    disabled={submitting} 
                  />
                  <div className="input-highlight"></div>
                </div>
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <div className="input-wrapper">
                <input 
                  type="email" 
                  placeholder="Enter your email" 
                  value={email} 
                  onChange={e => setEmail(e.target.value)} 
                  onFocus={() => setFocused('email')} 
                  onBlur={() => setFocused(null)} 
                  className={`form-input ${focused === 'email' ? 'input-focused' : ''}`} 
                  required 
                  disabled={submitting} 
                />
                <div className="input-highlight"></div>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <div className="input-wrapper password-wrapper">
                <input 
                  type={showPassword.password ? 'text' : 'password'} 
                  placeholder={mode === 'register' ? 'Create a password' : 'Enter your password'} 
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                  onFocus={() => setFocused('password')} 
                  onBlur={() => setFocused(null)} 
                  className={`form-input ${focused === 'password' ? 'input-focused' : ''}`} 
                  required 
                  disabled={submitting} 
                />
                <button 
                  type="button" 
                  className="password-toggle" 
                  onClick={() => setShowPassword(prev => ({ ...prev, password: !prev.password }))} 
                  disabled={submitting}
                >
                  {showPassword.password ? <FaEyeSlash /> : <FaEye />}
                </button>
                <div className="input-highlight"></div>
              </div>
              {mode === 'register' && <span className="input-hint">Minimum 8 characters</span>}
            </div>
            {mode === 'register' && (
              <div className="form-group">
                <label className="form-label">Confirm Password</label>
                <div className="input-wrapper password-wrapper">
                  <input 
                    type={showPassword.confirm ? 'text' : 'password'} 
                    placeholder="Confirm your password" 
                    value={confirm} 
                    onChange={e => setConfirm(e.target.value)} 
                    onFocus={() => setFocused('confirm')} 
                    onBlur={() => setFocused(null)} 
                    className={`form-input ${focused === 'confirm' ? 'input-focused' : ''}`} 
                    required 
                    disabled={submitting} 
                  />
                  <button 
                    type="button" 
                    className="password-toggle" 
                    onClick={() => setShowPassword(prev => ({ ...prev, confirm: !prev.confirm }))} 
                    disabled={submitting}
                  >
                    {showPassword.confirm ? <FaEyeSlash /> : <FaEye />}
                  </button>
                  <div className="input-highlight"></div>
                </div>
              </div>
            )}
            <div ref={turnstileRef} className="auth-captcha"></div>
            <motion.button 
              type="submit" 
              className={`btn-primary auth-submit ${submitting ? 'loading' : ''}`} 
              disabled={submitting} 
              whileHover={{ scale: 1.02 }} 
              whileTap={{ scale: 0.98 }}
            >
              {submitting ? (
                <><InlineSpinner />{mode === 'login' ? 'Signing in...' : 'Creating account...'}</>
              ) : (
                <>{mode === 'login' ? <><FaRightToBracket /> Sign In</> : <><FaUserPlus /> Create Account</>}</>
              )}
            </motion.button>
          </form>
          <div className="auth-footer">
            <p className="auth-footer-text">
              {mode === 'login' ? (
                <>Don't have an account? <button type="button" className="auth-link" onClick={() => switchMode('register')}>Sign Up <FaArrowRight /></button></>
              ) : (
                <>Already have an account? <button type="button" className="auth-link" onClick={() => switchMode('login')}><FaArrowLeft /> Sign In</button></>
              )}
            </p>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
