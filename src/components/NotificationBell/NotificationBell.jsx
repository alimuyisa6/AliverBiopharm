/* components/NotificationBell/NotificationBell.jsx */
import { useState, useEffect, useRef, useCallback } from 'react';
import Icon from '../Icon/Icon';
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  dismissNotification
} from '../../api/client';

export default function NotificationBell({ user }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);
  const pollRef = useRef(null);

  const fetchNotifications = useCallback(async () => {
    if (!user?.id) return;

    setLoading(true);

    try {
      const data = await getNotifications({ limit: 50 });
      const list = Array.isArray(data?.notifications) ? data.notifications : [];

      setNotifications(list);
      setUnreadCount(
        typeof data?.unread_count === 'number'
          ? data.unread_count
          : list.filter((item) => !item.is_read).length
      );
    } catch {
      setNotifications([]);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    fetchNotifications();

    pollRef.current = setInterval(fetchNotifications, 30000);

    return () => clearInterval(pollRef.current);
  }, [fetchNotifications, user?.id]);

  useEffect(() => {
    const handler = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handler);

    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleMarkRead = async (id, actionUrl) => {
    try {
      await markNotificationRead(id);
    } catch {}

    setNotifications((prev) => prev.map((item) => (item.id === id ? { ...item, is_read: true } : item)));
    setUnreadCount((prev) => Math.max(0, prev - 1));

    if (actionUrl) window.location.href = actionUrl;
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
    } catch {}

    setNotifications((prev) => prev.map((item) => ({ ...item, is_read: true })));
    setUnreadCount(0);
  };

  const handleDismiss = async (event, id) => {
    event.stopPropagation();

    try {
      await dismissNotification(id);
    } catch {}

    setNotifications((prev) => prev.filter((item) => item.id !== id));
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '';

    const date = new Date(dateStr);

    if (isNaN(date.getTime())) return '';

    const diff = Date.now() - date.getTime();

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;

    return date.toLocaleDateString();
  };

  if (!user?.id) return null;

  return (
    <div className="notification-bell" ref={dropdownRef}>
      <button
        className="btn btn-ghost btn-sm btn-icon"
        onClick={() => setOpen((prev) => !prev)}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <Icon name="bell" />
        {unreadCount > 0 && <span className="notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
      </button>

      {open && (
        <div className="dropdown-menu notification-dropdown">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-3) var(--space-4)' }}>
            <span style={{ fontWeight: 600 }}>Notifications</span>
            {unreadCount > 0 && (
              <button className="btn btn-ghost btn-sm" onClick={handleMarkAllRead}>Mark all read</button>
            )}
          </div>

          <div className="dropdown-divider" />

          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            {loading && notifications.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 'var(--space-6)' }}>
                <Icon name="bell" style={{ fontSize: '2rem', color: 'var(--text-muted)', marginBottom: 'var(--space-3)' }} />
                <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>Loading...</p>
              </div>
            ) : !loading && notifications.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 'var(--space-6)' }}>
                <Icon name="bell" style={{ fontSize: '2rem', color: 'var(--text-muted)', marginBottom: 'var(--space-3)' }} />
                <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>No notifications yet</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`dropdown-item ${notification.is_read ? '' : 'notification-unread'}`}
                  onClick={() => handleMarkRead(notification.id, notification.action_url)}
                  style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 'var(--space-1)' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', width: '100%' }}>
                    <Icon name={notification.icon === 'dna' ? 'microscope' : notification.icon || 'bell'} style={{ color: notification.color || 'var(--primary)' }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: notification.is_read ? 400 : 600, fontSize: 'var(--text-sm)' }}>{notification.title}</div>
                      {notification.body && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-dim)' }}>{notification.body}</div>}
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{formatTime(notification.created_at)}</div>
                    </div>
                    <button className="btn btn-ghost btn-sm btn-icon" onClick={(event) => handleDismiss(event, notification.id)}>
                      <Icon name="xmark" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
} 
