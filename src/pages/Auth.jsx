import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { signup, getCurriculumLevels } from '../api/client';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '../components/Toast/Toast';
import Input from '../components/Input/Input';
import Button from '../components/Button/Button';
import Icon from '../components/Icon/Icon';
import Spinner from '../components/Spinner/Spinner';

const TURNSTILE_SITE_KEY = '0x4AAAAAADknPpI_XcH1KfPe';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Mirrors the exact rule in auth.js's signup/change_password handlers:
// 10-128 chars, at least 3 of {upper, lower, digit, special}. Kept in sync
// on purpose so a password that passes here never gets rejected by the API.
function validatePasswordRules(password) {
  if (!password || password.length < 10) return 'Password must be at least 10 characters';
  if (password.length > 128) return 'Password must not exceed 128 characters';
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  const categories = [hasUpper, hasLower, hasDigit, hasSpecial].filter(Boolean).length;
  if (categories < 3) {
    return 'Password must contain at least 3 of: uppercase letter, lowercase letter, number, special character';
  }
  return null;
}

// Mirrors auth.js's signup handler: 2-100 chars, no angle brackets.
function validateFullNameRules(fullName) {
  const trimmed = fullName.trim();
  if (trimmed.length < 2 || trimmed.length > 100) return 'Full name must be between 2 and 100 characters';
  if (/[<>]/.test(trimmed)) return 'Full name contains invalid characters';
  return null;
}

export default function Auth() {
  const location = useLocation();
  const navigate = useNavigate();
  const mode = location.pathname === '/register' ? 'register' : 'login';
  const addToast = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [pendingConfirmation, setPendingConfirmation] = useState(false);
  const [confirmationMessage, setConfirmationMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Onboarding is exactly two steps now, matching what auth.js's signup
  // handler actually accepts: role, then level. There is no third
  // "pick your specific class" step — the backend auto-assigns the
  // default group for the chosen level server-side.
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [role, setRole] = useState(null);
  const [track, setTrack] = useState(null);

  // Levels come from curriculum_levels via the database, not a hardcoded
  // list — same endpoint classroom.js's getLevels() already serves.
  const [levels, setLevels] = useState([]);
  const [levelsLoading, setLevelsLoading] = useState(false);
  const [levelsError, setLevelsError] = useState('');

  const [mfaStep, setMfaStep] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaError, setMfaError] = useState('');

  const { login, refresh } = useAuth();
  const widgetIdRef = useRef(null);
  const widgetReadyRef = useRef(false);
  const [captchaSlot, setCaptchaSlot] = useState(null);

  const redirectTo = location.state?.from
    ? `${location.state.from.pathname}${location.state.from.search || ''}`
    : '/dashboard';

  // Fetch the real level list from the database the first time the level
  // step is reached, rather than shipping a static copy of it in the bundle.
  useEffect(() => {
    if (onboardingStep !== 2 || levels.length || levelsLoading) return;
    setLevelsLoading(true);
    setLevelsError('');
    getCurriculumLevels()
      .then(data => setLevels(data || []))
      .catch(() => setLevelsError('Could not load available levels. Please try again.'))
      .finally(() => setLevelsLoading(false));
  }, [onboardingStep, levels.length, levelsLoading]);

  const renderWidget = useCallback((container) => {
    if (!window.turnstile || !container || widgetIdRef.current) return;
    try {
      widgetIdRef.current = window.turnstile.render(container, {
        sitekey: TURNSTILE_SITE_KEY,
        callback: () => { widgetReadyRef.current = true; },
        'expired-callback': () => {
          widgetReadyRef.current = false;
          if (window.turnstile && widgetIdRef.current) {
            try { window.turnstile.reset(widgetIdRef.current); } catch {}
          }
        },
        'error-callback': () => {
          widgetReadyRef.current = false;
          if (window.turnstile && widgetIdRef.current) {
            try { window.turnstile.reset(widgetIdRef.current); } catch {}
          }
          return false;
        }
      });
      widgetReadyRef.current = true;
    } catch {
      widgetIdRef.current = null;
      widgetReadyRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!document.querySelector('script[src*="turnstile"]')) {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
      script.async = true;
      script.defer = true;
      script.crossOrigin = 'anonymous';
      document.head.appendChild(script);
    }

    if (!captchaSlot) return;

    let cancelled = false;
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      if (cancelled) return;
      if (window.turnstile && captchaSlot && !widgetIdRef.current) {
        renderWidget(captchaSlot);
        clearInterval(interval);
      }
      if (attempts > 50) clearInterval(interval);
    }, 100);

    return () => {
      cancelled = true;
      clearInterval(interval);
      if (window.turnstile && widgetIdRef.current) {
        try { window.turnstile.remove(widgetIdRef.current); } catch {}
      }
      widgetIdRef.current = null;
      widgetReadyRef.current = false;
    };
  }, [captchaSlot, renderWidget]);

  const getTurnstileToken = () => {
    if (!window.turnstile || !widgetIdRef.current || !widgetReadyRef.current) return '';
    try { return window.turnstile.getResponse(widgetIdRef.current) || ''; } catch { return ''; }
  };

  const resetTurnstile = () => {
    if (!window.turnstile || !widgetIdRef.current) return;
    try { window.turnstile.reset(widgetIdRef.current); } catch {
      widgetIdRef.current = null;
      widgetReadyRef.current = false;
      if (captchaSlot) renderWidget(captchaSlot);
    }
  };

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    const token = getTurnstileToken();
    if (!token) { setError('Please complete the verification'); return; }
    setSubmitting(true);
    try {
      const result = await login(email, password, token);
      if (result?.mfa_required || result?.passkey_required) {
        setSubmitting(false);
        setMfaStep(true);
        resetTurnstile();
        return;
      }
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err.message || 'Login failed.');
      resetTurnstile();
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
    if (!token) { setMfaError('Please complete the verification again'); return; }
    setSubmitting(true);
    try {
      const result = await login(email, password, token, mfaCode.trim());
      if (result?.mfa_required) {
        setMfaError('Incorrect code. Please try again.');
        resetTurnstile();
        return;
      }
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setMfaError(err.message || 'Verification failed.');
      resetTurnstile();
    } finally {
      setSubmitting(false);
    }
  }

  function handleMfaBack() {
    setMfaStep(false);
    setMfaCode('');
    setMfaError('');
    resetTurnstile();
  }

  async function handleRegister(e) {
    e.preventDefault();
    setError('');

    const nameError = validateFullNameRules(fullName);
    if (nameError) { setError(nameError); return; }
    if (!EMAIL_PATTERN.test(email.trim())) { setError('Please enter a valid email address'); return; }
    if (password !== confirm) { setError('Passwords do not match'); return; }
    const passwordError = validatePasswordRules(password);
    if (passwordError) { setError(passwordError); return; }

    if (mode === 'register') setOnboardingStep(1);
  }

  async function handleOnboardingFinish(selectedRole, selectedLevel) {
    setError('');
    if (!selectedRole || !selectedLevel) { setError('Please complete all onboarding steps'); return; }
    const token = getTurnstileToken();
    if (!token) { setError('Verification expired.'); return; }
    setSubmitting(true);
    try {
      const result = await signup(email, password, token, {
        full_name: fullName.trim(),
        role: selectedRole,
        level: selectedLevel,
      });
      if (result?.user) {
        await refresh();
        setSuccess(true);
        setTimeout(() => navigate(redirectTo, { replace: true }), 1500);
      } else {
        setConfirmationMessage(result?.message || 'If this email is valid, please check your inbox to confirm your account.');
        setPendingConfirmation(true);
      }
    } catch (err) {
      setError(err.message || 'Registration failed.');
      resetTurnstile();
    } finally {
      setSubmitting(false);
    }
  }

  const progressPct = () => {
    if (onboardingStep === 1) return 50;
    if (onboardingStep === 2) return 100;
    return 0;
  };

  const switchMode = (nextMode) => {
    navigate(nextMode === 'register' ? '/register' : '/login', { state: location.state, replace: true });
  };

  return (
    <div className="auth-page" style={{ display: 'flex', minHeight: 'calc(100vh - var(--header-height))' }}>
      <div className="auth-brand-panel" style={{
        flex: 1,
        background: 'linear-gradient(135deg, var(--primary-light), var(--accent-light))',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-10)',
        display: window.innerWidth < 768 ? 'none' : 'flex',
      }}>
        <div style={{ maxWidth: 400, textAlign: 'center' }}>
          <Icon name="graduation-cap" style={{ fontSize: '3rem', color: 'var(--primary)', marginBottom: 'var(--space-6)' }} />
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--text-4xl)', fontWeight: 'var(--weight-black)', marginBottom: 'var(--space-4)' }}>
            {mode === 'login' ? 'Welcome Back' : 'Start Your Journey'}
          </h1>
          <p style={{ color: 'var(--text-dim)', lineHeight: 'var(--leading-relaxed)' }}>
            {mode === 'login'
              ? 'Sign in to continue your learning journey across O-Level, A-Level, and Pharmacy.'
              : 'Create an account and access thousands of resources tailored to your level.'}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginTop: 'var(--space-10)', textAlign: 'left' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <Icon name="rocket" style={{ color: 'var(--primary)' }} />
              <span style={{ fontSize: 'var(--text-sm)' }}>Personalized learning</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <Icon name="book-open" style={{ color: 'var(--accent)' }} />
              <span style={{ fontSize: 'var(--text-sm)' }}>Expert resources</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <Icon name="shield-halved" style={{ color: 'var(--secondary)' }} />
              <span style={{ fontSize: 'var(--text-sm)' }}>Secure & private</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <Icon name="users" style={{ color: 'var(--warm)' }} />
              <span style={{ fontSize: 'var(--text-sm)' }}>Community learning</span>
            </div>
          </div>
        </div>
      </div>

      <div className="auth-form-panel" style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 'var(--space-10)', background: 'var(--bg-card)'
      }}>
        <div style={{ maxWidth: 420, width: '100%' }}>
          {pendingConfirmation ? (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} style={{ textAlign: 'center' }}>
              <Icon name="envelope-circle-check" style={{ fontSize: '4rem', color: 'var(--primary)', marginBottom: 'var(--space-6)' }} />
              <h2 style={{ marginBottom: 'var(--space-4)' }}>Check Your Inbox</h2>
              <p style={{ color: 'var(--text-dim)', marginBottom: 'var(--space-6)' }}>{confirmationMessage}</p>
              <button className="btn btn-ghost" onClick={() => switchMode('login')}>
                <Icon name="arrow-left" /> Back to sign in
              </button>
            </motion.div>
          ) : success ? (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} style={{ textAlign: 'center' }}>
              <Icon name="circle-check" style={{ fontSize: '4rem', color: 'var(--success)', marginBottom: 'var(--space-6)' }} />
              <h2 style={{ marginBottom: 'var(--space-4)' }}>Account Created!</h2>
              <p style={{ color: 'var(--text-dim)', marginBottom: 'var(--space-6)' }}>Welcome to AliverBiopharm. Redirecting you...</p>
              <div className="progress-track">
                <div className="progress-fill progress-gradient" style={{ width: '100%', animation: 'borderProgress 1.5s var(--ease-slow) forwards' }} />
              </div>
            </motion.div>
          ) : mfaStep ? (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <div style={{ marginBottom: 'var(--space-8)' }}>
                <h2 style={{ marginBottom: 'var(--space-3)' }}>Two-Factor Verification</h2>
                <p style={{ color: 'var(--text-dim)' }}>Enter the 6-digit code from your authenticator app</p>
              </div>
              {mfaError && (
                <div className="alert alert-error" style={{ marginBottom: 'var(--space-6)' }}>
                  <Icon name="exclamation-triangle" /> {mfaError}
                </div>
              )}
              <form onSubmit={handleMfaSubmit}>
                <Input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="000000"
                  value={mfaCode}
                  onChange={e => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  disabled={submitting}
                  autoFocus
                />
                <div ref={setCaptchaSlot} style={{ marginBottom: 'var(--space-6)' }} />
                <Button type="submit" loading={submitting} style={{ width: '100%' }}>
                  Verify and Sign In
                </Button>
              </form>
              <div style={{ marginTop: 'var(--space-6)', textAlign: 'center' }}>
                <button className="btn btn-ghost" onClick={handleMfaBack}>
                  <Icon name="arrow-left" /> Back to sign in
                </button>
              </div>
            </motion.div>
          ) : onboardingStep > 0 ? (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <div style={{ marginBottom: 'var(--space-8)' }}>
                <h2 style={{ marginBottom: 'var(--space-3)' }}>Complete Your Profile</h2>
                <p style={{ color: 'var(--text-dim)' }}>Help us personalise your learning experience</p>
              </div>
              <div className="progress-track" style={{ marginBottom: 'var(--space-6)' }}>
                <div className="progress-fill progress-gradient" style={{ width: `${progressPct()}%` }} />
              </div>
              {error && (
                <div className="alert alert-error" style={{ marginBottom: 'var(--space-6)' }}>
                  <Icon name="exclamation-triangle" /> {error}
                </div>
              )}
              {onboardingStep === 1 && (
                <div>
                  <span className="sec-label" style={{ textAlign: 'left' }}>Step 1 of 2</span>
                  <h3 style={{ marginBottom: 'var(--space-6)' }}>I am a...</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    <button className={`card card-clickable ${role === 'student' ? 'card-selected' : ''}`}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 'var(--space-4)', padding: 'var(--space-5)' }}
                      onClick={() => { setRole('student'); setOnboardingStep(2); }}>
                      <Icon name="user-graduate" style={{ fontSize: '1.5rem' }} /> Student
                    </button>
                    <button className={`card card-clickable ${role === 'teacher' ? 'card-selected' : ''}`}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 'var(--space-4)', padding: 'var(--space-5)' }}
                      onClick={() => { setRole('teacher'); setOnboardingStep(2); }}>
                      <Icon name="user-pen" style={{ fontSize: '1.5rem' }} /> Teacher
                    </button>
                  </div>
                </div>
              )}
              {onboardingStep === 2 && (
                <div>
                  <span className="sec-label" style={{ textAlign: 'left' }}>Step 2 of 2</span>
                  <h3 style={{ marginBottom: 'var(--space-6)' }}>Select your level</h3>
                  {levelsLoading && (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-6)' }}>
                      <Spinner />
                    </div>
                  )}
                  {levelsError && (
                    <div className="alert alert-error" style={{ marginBottom: 'var(--space-4)' }}>
                      <Icon name="exclamation-triangle" /> {levelsError}
                      <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'var(--space-3)' }}
                        onClick={() => { setLevels([]); setLevelsError(''); }}>
                        Retry
                      </button>
                    </div>
                  )}
                  {!levelsLoading && !levelsError && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                      {levels.map(lvl => {
                        const value = lvl.display_name;
                        const rowKey = lvl.key || lvl.id || value;
                        const classCount = Array.isArray(lvl.classes) ? lvl.classes.length : null;
                        return (
                          <button key={rowKey}
                            className={`card card-clickable ${track === value ? 'card-selected' : ''}`}
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 'var(--space-4)', padding: 'var(--space-5)' }}
                            disabled={submitting}
                            onClick={() => { setTrack(value); handleOnboardingFinish(role, value); }}>
                            <Icon name={lvl.icon || 'graduation-cap'} style={{ fontSize: '1.5rem' }} />
                            <div>
                              <div style={{ fontWeight: 700 }}>{lvl.display_name}</div>
                              {classCount !== null && (
                                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-dim)' }}>
                                  {classCount} {classCount === 1 ? 'class' : 'classes'} available
                                </div>
                              )}
                            </div>
                            {submitting && track === value && <Spinner size="sm" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <button className="btn btn-ghost" style={{ marginTop: 'var(--space-6)' }} disabled={submitting}
                    onClick={() => { setOnboardingStep(1); setTrack(null); }}>
                    <Icon name="arrow-left" /> Back
                  </button>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <div style={{ marginBottom: 'var(--space-8)' }}>
                <h2 style={{ marginBottom: 'var(--space-3)' }}>
                  {mode === 'login' ? 'Sign In' : 'Create Account'}
                </h2>
                <p style={{ color: 'var(--text-dim)' }}>
                  {mode === 'login' ? 'Access your account securely' : 'Join thousands of learners worldwide'}
                </p>
              </div>
              {error && (
                <div className="alert alert-error" style={{ marginBottom: 'var(--space-6)' }}>
                  <Icon name="exclamation-triangle" /> {error}
                </div>
              )}
              <form onSubmit={mode === 'login' ? handleLogin : handleRegister}>
                {mode === 'register' && (
                  <Input
                    label="Full Name"
                    placeholder="Enter your full name"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    required
                    disabled={submitting}
                    icon="user"
                  />
                )}
                <Input
                  label="Email Address"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  disabled={submitting}
                  icon="envelope"
                />
                <Input
                  label="Password"
                  type="password"
                  placeholder={mode === 'register' ? 'Create a password' : 'Enter your password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  disabled={submitting}
                  hint={mode === 'register' ? 'Minimum 10 characters, with at least 3 of: uppercase, lowercase, number, symbol' : undefined}
                />
                {mode === 'register' && (
                  <Input
                    label="Confirm Password"
                    type="password"
                    placeholder="Confirm your password"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    required
                    disabled={submitting}
                  />
                )}
                <div ref={setCaptchaSlot} style={{ marginBottom: 'var(--space-6)' }} />
                <Button type="submit" loading={submitting} style={{ width: '100%' }}>
                  {mode === 'login' ? <><Icon name="right-to-bracket" /> Sign In</> : <><Icon name="user-plus" /> Create Account</>}
                </Button>
              </form>
              <div style={{ marginTop: 'var(--space-6)', textAlign: 'center' }}>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-dim)' }}>
                  {mode === 'login' ? (
                    <>Don't have an account? <button className="btn btn-ghost btn-sm" onClick={() => switchMode('register')}>Sign Up <Icon name="arrow-right" /></button></>
                  ) : (
                    <>Already have an account? <button className="btn btn-ghost btn-sm" onClick={() => switchMode('login')}><Icon name="arrow-left" /> Sign In</button></>
                  )}
                </p>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
