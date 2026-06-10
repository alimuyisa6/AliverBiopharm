import { useState } from 'react';
import { signup } from '../api/client';
import { Link, useNavigate } from 'react-router-dom';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

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
    try {
      await signup(email, password);
      setSuccess(true);
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err.message || 'Registration failed');
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--clr-deep-space)' }}>
        <div className="bg-green-100 p-6 rounded-lg text-green-800">✅ Registration successful! Redirecting to login...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--clr-deep-space)' }}>
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md" style={{ background: 'var(--clr-navy-card)' }}>
        <h2 className="text-2xl font-bold mb-6 text-center" style={{ color: 'var(--clr-white)' }}>Register</h2>
        {error && <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>}
        <form onSubmit={handleSubmit}>
          <input type="email" placeholder="Email" className="w-full p-3 border rounded mb-4 form-input" value={email} onChange={e => setEmail(e.target.value)} required />
          <input type="password" placeholder="Password (min 8 chars)" className="w-full p-3 border rounded mb-4 form-input" value={password} onChange={e => setPassword(e.target.value)} required />
          <input type="password" placeholder="Confirm Password" className="w-full p-3 border rounded mb-6 form-input" value={confirm} onChange={e => setConfirm(e.target.value)} required />
          <button type="submit" className="btn-primary w-full justify-center">Create Account</button>
        </form>
        <p className="mt-4 text-center" style={{ color: 'var(--clr-text-dim)' }}>
          Already have an account? <Link to="/login" style={{ color: 'var(--clr-magenta)' }}>Login</Link>
        </p>
      </div>
    </div>
  );
}
