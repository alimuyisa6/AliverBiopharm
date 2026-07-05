 import React, { useContext, useState } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import { requestHandoff } from '../api/client';

export default function AdminLauncher() {
  const { user, loading } = useContext(AuthContext);
  const [status, setStatus] = useState(null);

  if (loading) {
    return <div style={{ position: 'fixed', bottom: 20, right: 20, background: '#fff', padding: 8, zIndex: 1000 }}>Auth loading...</div>;
  }

  return (
    <div style={{ position: 'fixed', bottom: 20, right: 20, background: '#fff', padding: 8, zIndex: 1000, fontSize: 11, maxWidth: 260, border: '1px solid #000' }}>
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
