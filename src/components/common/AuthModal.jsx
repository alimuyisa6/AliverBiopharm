import { useState, useEffect } from 'react';
import useAuth from '../../hooks/useAuth';

function AuthModal() {
  const [show, setShow] = useState(false);
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login, register, refresh } = useAuth();

  useEffect(() => {
    const handler = (e) => { setMode(e.detail); setShow(true); };
    window.addEventListener('open-auth', handler);
    return () => window.removeEventListener('open-auth', handler);
  }, []);

  const close = () => { setShow(false); setError(''); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (mode === 'signin') await login(email, password);
      else await register(email, password);
      close();
      refresh();
    } catch (err) {
      setError(err.message);
    }
  };

  const switchMode = () => {
    setMode(prev => prev === 'signin' ? 'signup' : 'signin');
    setError('');
  };

  if (!show) return null;

  return (
    <div id="auth-modal" style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.8)' }} role="dialog" aria-modal="true" aria-label={mode === 'signin' ? 'Sign In' : 'Create Account'}>
      <div style={{ background: 'var(--clr-navy-card)', border: '2px solid var(--clr-cyan)', borderRadius: 'var(--radius-lg)', padding: '2rem', maxWidth: '380px', width: '90%', position: 'relative', backdropFilter: 'blur(20px)' }}>
        <button onClick={close} style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', background: 'none', border: 'none', color: 'var(--clr-text-dim)', cursor: 'pointer', fontSize: '1.2rem' }} aria-label="Close">✕</button>
        <h3 style={{ color: 'var(--clr-cyan)', marginBottom: '1.2rem', textAlign: 'center' }}>{mode === 'signin' ? 'Sign In' : 'Create Account'}</h3>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <input type="email" className="form-input" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
          <input type="password" className="form-input" placeholder="Password (min 6 chars)" value={password} onChange={e => setPassword(e.target.value)} minLength="6" required autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} />
          <button type="submit" className="btn-primary" style={{ justifyContent: 'center' }}>{mode === 'signin' ? 'Sign In' : 'Create Account'}</button>
        </form>
        {error && <p style={{ color: '#ff4444', textAlign: 'center', marginTop: '0.5rem' }}>{error}</p>}
        <p style={{ textAlign: 'center', marginTop: '1rem', color: 'var(--clr-text-dim)', fontSize: '0.9rem' }}>
          {mode === 'signin' ? "No account? " : "Have an account? "}
          <button onClick={switchMode} style={{ background: 'none', border: 'none', color: 'var(--clr-magenta)', cursor: 'pointer', fontWeight: 600, padding: 0 }}>{mode === 'signin' ? 'Sign up' : 'Sign in'}</button>
        </p>
      </div>
    </div>
  );
}

export default AuthModal;
