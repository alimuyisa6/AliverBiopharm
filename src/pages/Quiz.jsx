 import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';

export default function Quiz() {
  const { user } = useAuth();
  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h1>Quiz Page</h1>
      <p>User: {user ? user.email : 'Not logged in'}</p>
      <Link to="/" className="btn-primary">Back to Home</Link>
    </div>
  );
}
