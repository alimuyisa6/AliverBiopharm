import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FaBell, FaCheck, FaXmark, FaTrophy, FaFire, FaStar, FaBookOpenReader, FaRotate, FaBullhorn, FaTriangleExclamation, FaHeart, FaComment, FaUserPlus, FaLayerGroup, FaFilePdf, FaBookOpen, FaClipboardCheck, FaCrown, FaMedal, FaHandHoldingHeart, FaCreditCard, FaLock, FaUnlock, FaChartLine, FaFlask, FaHeadset, FaMessage, FaRocket, FaCircleCheck, FaClock, FaDownload, FaEnvelopeCircleCheck, FaRightToBracket, FaShieldHalved, FaUserPen, FaFileLines, FaSpellCheck, FaPen, FaPenToSquare, FaRoute, FaCircleXmark, FaFileContract, FaScrewdriverWrench, FaUsers, FaFaceSmile } from 'react-icons/fa6';
import { getNotifications, markNotificationRead, markAllNotificationsRead, dismissNotification } from '../api/client';

const iconMap = {
  'fa-trophy': FaTrophy, 'fa-fire': FaFire, 'fa-star': FaStar, 'fa-book-open-reader': FaBookOpenReader,
  'fa-rotate': FaRotate, 'fa-bullhorn': FaBullhorn, 'fa-triangle-exclamation': FaTriangleExclamation,
  'fa-heart': FaHeart, 'fa-comment': FaComment, 'fa-user-plus': FaUserPlus, 'fa-layer-group': FaLayerGroup,
  'fa-file-pdf': FaFilePdf, 'fa-book-open': FaBookOpen, 'fa-clipboard-check': FaClipboardCheck,
  'fa-crown': FaCrown, 'fa-medal': FaMedal, 'fa-hand-holding-heart': FaHandHoldingHeart,
  'fa-credit-card': FaCreditCard, 'fa-lock': FaLock, 'fa-unlock': FaUnlock, 'fa-chart-line': FaChartLine,
  'fa-flask': FaFlask, 'fa-headset': FaHeadset, 'fa-message': FaMessage, 'fa-rocket': FaRocket,
  'fa-circle-check': FaCircleCheck, 'fa-clock': FaClock, 'fa-download': FaDownload,
  'fa-envelope-circle-check': FaEnvelopeCircleCheck, 'fa-right-to-bracket': FaRightToBracket,
  'fa-shield-halved': FaShieldHalved, 'fa-user-pen': FaUserPen, 'fa-file-lines': FaFileLines,
  'fa-spell-check': FaSpellCheck, 'fa-pen': FaPen, 'fa-pen-to-square': FaPenToSquare,
  'fa-route': FaRoute, 'fa-circle-xmark': FaCircleXmark, 'fa-file-contract': FaFileContract,
  'fa-screwdriver-wrench': FaScrewdriverWrench, 'fa-users': FaUsers, 'fa-face-smile': FaFaceSmile,
  'fa-arrow-trend-up': FaChartLine, 'fa-check-double': FaCircleCheck, 'fa-rotate-right': FaRotate,
  'fa-clipboard-list': FaClipboardCheck, 'fa-bell': FaBell
};

function getIconComponent(iconName) {
  const IconComp = iconMap[iconName];
  if (!IconComp) {
    console.warn(`[NotificationBell] Missing icon mapping: "${iconName}", falling back to FaBell`);
    return FaBell;
  }
  return IconComp;
}

export default function NotificationBell({ user }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [debugInfo, setDebugInfo] = useState(null);
  const dropdownRef = useRef(null);
  const pollRef = useRef(null);

  const fetchNotifications = useCallback(async () => {
    if (!user?.id) {
      console.log('[NotificationBell] No user ID, skipping fetch');
      return;
    }
    try {
      console.log('[NotificationBell] Fetching notifications for user:', user.id);
      const data = await getNotifications({ limit: 30 });
      
      // Extensive debug logging
      console.log('[NotificationBell] Raw API response:', JSON.stringify(data, null, 2));
      console.log('[NotificationBell] notifications array:', data?.notifications);
      console.log('[NotificationBell] notifications length:', data?.notifications?.length);
      console.log('[NotificationBell] unread_count:', data?.unread_count);
      console.log('[NotificationBell] total:', data?.total);
      
      // Check each notification for potential rendering issues
      if (data?.notifications?.length > 0) {
        data.notifications.forEach((n, i) => {
          console.log(`[NotificationBell] Notification ${i}:`, {
            id: n.id,
            module: n.module,
            title: n.title,
            icon: n.icon,
            color: n.color,
            priority: n.priority,
            is_read: n.is_read,
            is_dismissed: n.is_dismissed,
            hasIconComponent: !!iconMap[n.icon],
            created_at: n.created_at
          });
        });
      }
      
      setDebugInfo({
        total: data?.total || 0,
        unread: data?.unread_count || 0,
        fetched: data?.notifications?.length || 0,
        timestamp: new Date().toISOString()
      });
      
      setNotifications(data?.notifications || []);
      setUnreadCount(data?.unread_count || 0);
      setFetchError(null);
    } catch (e) {
      console.error('[NotificationBell] Fetch failed:', e.message, e.stack);
      setFetchError(e.message);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    console.log('[NotificationBell] Component mounted, fetching immediately');
    fetchNotifications();
    pollRef.current = setInterval(fetchNotifications, 15000);
    return () => clearInterval(pollRef.current);
  }, [fetchNotifications, user?.id]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkRead = async (id, actionUrl) => {
    console.log('[NotificationBell] Marking read:', id);
    await markNotificationRead(id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
    if (actionUrl) window.location.href = actionUrl;
  };

  const handleMarkAllRead = async () => {
    console.log('[NotificationBell] Marking all read');
    await markAllNotificationsRead();
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  const handleDismiss = async (e, id) => {
    e.stopPropagation();
    console.log('[NotificationBell] Dismissing:', id);
    await dismissNotification(id);
    setNotifications(prev => prev.filter(n => n.id !== id));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const diff = new Date() - date;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
    return date.toLocaleDateString();
  };

  if (!user?.id) {
    console.log('[NotificationBell] No user, not rendering');
    return null;
  }

  console.log('[NotificationBell] Render state:', {
    open,
    unreadCount,
    notificationsLength: notifications.length,
    fetchError,
    debugInfo
  });

  return (
    <div className="notification-bell-container" ref={dropdownRef}>
      <button
        className="notification-bell-btn"
        onClick={() => setOpen(!open)}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <FaBell />
        {unreadCount > 0 && (
          <span className="notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
        )}
      </button>

      {open && (
        <div className="notification-dropdown">
          <div className="notification-dropdown-header">
            <h3>Notifications</h3>
            <div className="notification-header-actions">
              {unreadCount > 0 && (
                <button onClick={handleMarkAllRead} className="notification-action-btn">
                  <FaCheck /> Mark all read
                </button>
              )}
            </div>
          </div>

          {/* Debug banner - remove in production */}
          {debugInfo && (
            <div style={{
              background: '#1a1a2e',
              borderBottom: '1px solid #333',
              padding: '8px 16px',
              fontSize: '0.7rem',
              color: '#888',
              fontFamily: 'monospace'
            }}>
              Debug: {debugInfo.fetched} fetched / {debugInfo.total} total / {debugInfo.unread} unread
              {fetchError && <span style={{ color: '#e74c3c' }}> | Error: {fetchError}</span>}
            </div>
          )}

          <div className="notification-list">
            {notifications.length === 0 && (
              <div className="notification-empty">
                <FaBell size="2rem" color="var(--clr-text-muted)" />
                <p>No notifications yet</p>
                {fetchError && (
                  <p style={{ color: '#e74c3c', fontSize: '0.8rem', marginTop: '8px' }}>
                    Fetch error: {fetchError}
                  </p>
                )}
              </div>
            )}

            {notifications.map((notification, index) => {
              const IconComponent = getIconComponent(notification.icon);
              const isRead = notification.is_read;
              const priority = notification.priority || 'normal';
              const color = notification.color || '#0ab5b5';
              const title = notification.title || 'No title';
              const body = notification.body || '';
              const actionText = notification.action_text || '';
              const createdAt = notification.created_at;

              // Debug log for each item render
              if (index === 0) {
                console.log('[NotificationBell] Rendering first notification:', {
                  id: notification.id,
                  title,
                  icon: notification.icon,
                  IconComponent: IconComponent?.name || 'Unknown',
                  color,
                  priority,
                  isRead
                });
              }

              return (
                <div
                  key={notification.id || index}
                  className={`notification-item ${isRead ? 'read' : 'unread'} priority-${priority}`}
                  onClick={() => handleMarkRead(notification.id, notification.action_url)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="notification-icon" style={{ color: color }}>
                    <IconComponent />
                  </div>
                  <div className="notification-content">
                    <div className="notification-title">{title}</div>
                    {body && <div className="notification-body">{body}</div>}
                    {actionText && (
                      <span className="notification-action-text">{actionText}</span>
                    )}
                    <div className="notification-time">{formatTime(createdAt)}</div>
                  </div>
                  <button
                    className="notification-dismiss-btn"
                    onClick={(e) => handleDismiss(e, notification.id)}
                    aria-label="Dismiss notification"
                  >
                    <FaXmark />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
} 
