 // Login.jsx
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
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-lg shadow-md w-full max-w-md p-8">
        <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">Login</h2>
        {error && <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>}
        <form onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="Email"
            className="w-full p-3 border border-gray-300 rounded mb-4 focus:outline-none focus:ring-2 focus:ring-teal-500"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            className="w-full p-3 border border-gray-300 rounded mb-6 focus:outline-none focus:ring-2 focus:ring-teal-500"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
          <button type="submit" className="w-full bg-gradient-to-r from-amber-600 to-teal-600 text-white py-3 rounded font-semibold hover:opacity-90 transition">
            Sign In
          </button>
        </form>
        <p className="mt-4 text-center text-gray-600">
          Don't have an account? <Link to="/register" className="text-teal-600 hover:underline">Register</Link>
        </p>
      </div>
    </div>
  );
}
