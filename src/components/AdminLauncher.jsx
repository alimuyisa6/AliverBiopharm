 import React, { useContext, useState } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import { requestHandoff } from '../api/client';

export default function AdminLauncher() {
  const { user } = useContext(AuthContext);
  const [loading, setLoading] = useState(false);

  if (!user?.is_admin) return null;

  async function openAdminDashboard() {
    try {
      setLoading(true);
      const { token } = await requestHandoff();
      window.location.href = `https://aliver-biopharma-admindashboard.vercel.app/sso?token=${token}`;
    } catch (e) {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={openAdminDashboard}
      disabled={loading}
      className="btn btn-cyan admin-launcher-btn"
    >
      <i className="fa-solid fa-user-shield" />
      {loading ? 'Opening…' : 'Admin'}
    </button>
  );
}
