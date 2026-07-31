 /* components/AdminLauncher.jsx */
import { useContext, useState } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import { requestHandoff } from '../api/client';
import Icon from './Icon/Icon';

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
      className="btn btn-primary btn-sm"
      style={{ position: 'fixed', bottom: 'var(--space-6)', right: 'var(--space-6)', zIndex: 50 }}
    >
      <Icon name="shield-halved" />
      {loading ? 'Opening…' : 'Admin'}
    </button>
  );
}
