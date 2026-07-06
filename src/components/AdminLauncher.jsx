 import React, { useContext, useState, useEffect } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import { requestHandoff } from '../api/client';

export default function AdminLauncher() {
  useEffect(() => {
    alert('AdminLauncher mounted - version CHECK123');
  }, []);

  const { user, loading } = useContext(AuthContext);
  const [status, setStatus] = useState(null);

  if (loading) return null;

  return (
    <div style={{ position: 'fixed', bottom: 20, right: 20, background: '#fff', padding: 8, zIndex: 9999, fontSize: 11, maxWidth: 260, border: '2px solid red' }}>
      <div>user: {user ? JSON.stringify(user) : 'null'}</div>
      {user?.is_admin && (
        <button onClick={async () => {
          try {
            setStatus('requesting...');
            const { token } = await requestHandoff();
            setStatus('got token, redirecting...');
            window.location.href = `https://aliver-biopharma-admindashboard.vercel.app/sso?token=${token}`;
          } catch (e) {
            setStatus('FAILED: ' + e.message);
          }
        }}>
          Admin
        </button>
      )}
      {status && <div>{status}</div>}
    </div>
  );
}
