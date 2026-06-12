import React from 'react';
import { Link } from 'react-router-dom';

export default function Quiz() {
  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h1>Quiz Page (Test)</h1>
      <p>If you see this, routing works.</p>
      <Link to="/" className="btn-primary">Back to Home</Link>
    </div>
  );
}
