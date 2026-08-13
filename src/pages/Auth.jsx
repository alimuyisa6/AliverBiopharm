 /* pages/Auth.jsx */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { signup, getCurriculumLevels } from '../api/client';
import Input from '../components/Input/Input';
import Button from '../components/Button/Button';
import Icon from '../components/Icon/Icon';
import Spinner from '../components/Spinner/Spinner';
import { useToast } from '../components/Toast/Toast';

const TURNSTILE_SITE_KEY = '0x4AAAAAADknPpI_XcH1KfPe';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

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
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [role, setRole] = useState(null);
  const [track, setTrack] = useState(null);
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

  useEffect(() => {
    if (onboardingStep !== 2 || levels.length || levelsLoading) return;

    setLevelsLoading(true);
    setLevelsError('');

    getCurriculumLevels()
      .then((data) => setLevels(data || []))
      .catch(() => setLevelsError('Could not load available levels. Please try again.'))
      .finally(() => setLevelsLoading(false));
  }, [onboardingStep, levels.length, levelsLoading]);

  const renderWidget = useCallback((container) => {
    if (!window.turnstile || !container || widgetIdRef.current) return;

    try {
      widgetIdRef.current = window.turnstile.render(container, {
        sitekey: TURNSTILE_SITE_KEY,
        callback: () => {
          widgetReadyRef.current = true;
        },
        'expired-callback': () => {
          widgetReadyRef.current = false;
          if (window.turnstile && widgetIdRef.current) {
            try { window.turnstile.reset(widgetIdRef.current); } catch {}
          }
        },
        'error-callback': () => {
          widgetReadyRef.current = false;
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
      attempts += 1;

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

    try {
      return window.turnstile.getResponse(widgetIdRef.current) || '';
    } catch {
      return '';
    }
  };

  const resetTurnstile = () => {
    if (!window.turnstile || !widgetIdRef.current) return;

    try {
      window.turnstile.reset(widgetIdRef.current);
    } catch {
      widgetIdRef.current = null;
      widgetReadyRef.current = false;
      if (captchaSlot) renderWidget(captchaSlot);
    }
  };

  async function handleLogin(event) {
    event.preventDefault();
    setError('');

    const token = getTurnstileToken();

    if (!token) {
      setError('Please complete the verification');
      return;
    }

    setSubmitting(true);

    try {
      const result = await login(email, password, token);

      if (result?.mfa_required || result?.passkey_required) {
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

  async function handleMfaSubmit(event) {
    event.preventDefault();
    setMfaError('');

    if (!/^\d{6}$/.test(mfaCode.trim())) {
      setMfaError('Enter the 6-digit code from your authenticator app');
      return;
    }

    const token = getTurnstileToken();

    if (!token) {
      setMfaError('Please complete the verification again');
      return;
    }

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

  async function handleRegister(event) {
    event.preventDefault();
    setError('');

    const nameError = validateFullNameRules(fullName);

    if (nameError) {
      setError(nameError);
      return;
    }

    if (!EMAIL_PATTERN.test(email.trim())) {
      setError('Please enter a valid email address');
      return;
    }

    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }

    const passwordError = validatePasswordRules(password);

    if (passwordError) {
      setError(passwordError);
      return;
    }

    setOnboardingStep(1);
  }

  async function handleOnboardingFinish(selectedRole, selectedLevel) {
    setError('');

    if (!selectedRole || !selectedLevel) {
      setError('Please complete all onboarding steps');
      return;
    }

    const token = getTurnstileToken();

    if (!token) {
      setError('Verification expired.');
      return;
    }

    setSubmitting(true);

    try {
      const result = await signup(email, password, token, {
        full_name: fullName.trim(),
        role: selectedRole,
        level: selectedLevel
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
    navigate(nextMode === 'register' ? '/register' : '/login', {
      state: location.state,
      replace: true
    });
  };

  return (
    <div className="auth-page">
      <div className="auth-form-panel">
        <div style={{ maxWidth: 420, width: '100%' }}>
          {pendingConfirmation ? (
            <div style={{ textAlign: 'center' }}>
              <Icon name="envelope-circle-check" style={{ fontSize: '4rem', color: 'var(--primary)', marginBottom: 'var(--space-6)' }} />
              <h2>Check Your Inbox</h2>
              <p style={{ color: 'var(--text-dim)', marginBottom: 'var(--space-6)' }}>{confirmationMessage}</p>
              <Button variant="ghost" onClick={() => switchMode('login')}>
                <Icon name="arrow-left" /> Back to sign in
              </Button>
            </div>
          ) : success ? (
            <div style={{ textAlign: 'center' }}>
              <Icon name="circle-check" style={{ fontSize: '4rem', color: 'var(--success)', marginBottom: 'var(--space-6)' }} />
              <h2>Account Created</h2>
              <p style={{ color: 'var(--text-dim)', marginBottom: 'var(--space-6)' }}>Welcome to AliverBiopharm. Redirecting...</p>
              <Spinner />
            </div>
          ) : mfaStep ? (
            <div>
              <h2>Two-Factor Verification</h2>
              <p style={{ color: 'var(--text-dim)' }}>Enter the 6-digit code from your authenticator app</p>

              {mfaError && (
                <div className="alert alert-error">
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
                  onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  disabled={submitting}
                />
                <div ref={setCaptchaSlot} />
                <Button type="submit" loading={submitting} style={{ width: '100%' }}>
                  Verify and Sign In
                </Button>
              </form>
            </div>
          ) : onboardingStep > 0 ? (
            <div>
              <h2>Complete Your Profile</h2>
              <p style={{ color: 'var(--text-dim)' }}>Help us personalise your learning experience</p>

              <div className="progress-track">
                <div className="progress-fill progress-gradient" style={{ width: `${progressPct()}%` }} />
              </div>

              {error && (
                <div className="alert alert-error">
                  <Icon name="exclamation-triangle" /> {error}
                </div>
              )}

              {onboardingStep === 1 && (
                <div>
                  <h3>I am a...</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    <Button variant={role === 'student' ? 'primary' : 'secondary'} onClick={() => { setRole('student'); setOnboardingStep(2); }}>
                      <Icon name="user-graduate" /> Student
                    </Button>
                    <Button variant={role === 'teacher' ? 'primary' : 'secondary'} onClick={() => { setRole('teacher'); setOnboardingStep(2); }}>
                      <Icon name="user-pen" /> Teacher
                    </Button>
                  </div>
                </div>
              )}

              {onboardingStep === 2 && (
                <div>
                  <h3>Select your level</h3>

                  {levelsLoading && <Spinner />}
                  {levelsError && <p style={{ color: 'var(--error)' }}>{levelsError}</p>}

                  {!levelsLoading && !levelsError && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                      {levels.map((lvl) => {
                        const value = lvl.display_name;
                        const rowKey = lvl.key || lvl.id || value;

                        return (
                          <Button
                            key={rowKey}
                            variant={track === value ? 'primary' : 'secondary'}
                            onClick={() => { setTrack(value); handleOnboardingFinish(role, value); }}
                            loading={submitting && track === value}
                            disabled={submitting}
                          >
                            <Icon name={lvl.icon === 'dna' ? 'microscope' : lvl.icon || 'graduation-cap'} /> {lvl.display_name}
                          </Button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div>
              <h2>{mode === 'login' ? 'Sign In' : 'Create Account'}</h2>

              {error && (
                <div className="alert alert-error">
                  <Icon name="exclamation-triangle" /> {error}
                </div>
              )}

              <form onSubmit={mode === 'login' ? handleLogin : handleRegister}>
                {mode === 'register' && (
                  <Input
                    label="Full Name"
                    placeholder="Enter your full name"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
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
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  disabled={submitting}
                  icon="envelope"
                />

                <Input
                  label="Password"
                  type="password"
                  placeholder={mode === 'register' ? 'Create a password' : 'Enter your password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
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
                    onChange={(event) => setConfirm(event.target.value)}
                    required
                    disabled={submitting}
                  />
                )}

                <div ref={setCaptchaSlot} />

                <Button type="submit" loading={submitting} style={{ width: '100%' }}>
                  {mode === 'login' ? <><Icon name="right-to-bracket" /> Sign In</> : <><Icon name="user-plus" /> Create Account</>}
                </Button>
              </form>

              <div style={{ marginTop: 'var(--space-6)', textAlign: 'center' }}>
                {mode === 'login' ? (
                  <Button variant="ghost" size="sm" onClick={() => switchMode('register')}>Sign Up</Button>
                ) : (
                  <Button variant="ghost" size="sm" onClick={() => switchMode('login')}>Sign In</Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
