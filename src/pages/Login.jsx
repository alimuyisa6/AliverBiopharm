import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { signin } from '../api/client';
import { useNavigate, Link } from 'react-router-dom';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { refresh } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      await signin(email, password);
      await refresh();
      navigate('/');
    } catch (err) {
      setError(err.message || 'Login failed');
    }
  }

  return (
    <div className="login-wrapper" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--clr-deep-space)' }}>
      <div style={{ background: 'var(--clr-navy-card)', padding: '2rem', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: '400px' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '1.5rem', color: 'var(--clr-white)' }}>Login</h2>
        {error && <div style={{ background: '#fee', color: '#c00', padding: '0.5rem', borderRadius: '8px', marginBottom: '1rem' }}>{error}</div>}
        <form onSubmit={handleSubmit}>
          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="form-input" style={{ width: '100%', marginBottom: '1rem' }} required />
          <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} className="form-input" style={{ width: '100%', marginBottom: '1rem' }} required />
          <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>Sign In</button>
        </form>
        <p style={{ textAlign: 'center', marginTop: '1rem', color: 'var(--clr-text-dim)' }}>
          Don't have an account? <Link to="/register" style={{ color: 'var(--clr-magenta)' }}>Register</Link>
        </p>
      </div>
    </div>
  );
}
