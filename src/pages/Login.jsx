import { useState } from 'react';
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
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--clr-deep-space)' }}>
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md" style={{ background: 'var(--clr-navy-card)' }}>
        <h2 className="text-2xl font-bold mb-6 text-center" style={{ color: 'var(--clr-white)' }}>Login</h2>
        {error && <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>}
        <form onSubmit={handleSubmit}>
          <input type="email" placeholder="Email" className="w-full p-3 border rounded mb-4 form-input" value={email} onChange={e => setEmail(e.target.value)} required />
          <input type="password" placeholder="Password" className="w-full p-3 border rounded mb-6 form-input" value={password} onChange={e => setPassword(e.target.value)} required />
          <button type="submit" className="btn-primary w-full justify-center">Sign In</button>
        </form>
        <p className="mt-4 text-center" style={{ color: 'var(--clr-text-dim)' }}>
          Don't have an account? <Link to="/register" style={{ color: 'var(--clr-magenta)' }}>Register</Link>
        </p>
      </div>
    </div>
  );
}
