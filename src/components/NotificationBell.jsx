import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FaBell, FaCheck, FaTimes, FaTrophy, FaFire, FaStar, FaBookOpenReader, FaRotate, FaBullhorn, FaTriangleExclamation, FaHeart, FaComment, FaUserPlus, FaLayerGroup, FaFilePdf, FaBookOpen, FaClipboardCheck, FaCrown, FaMedal, FaHandHoldingHeart, FaCreditCard, FaLock, FaUnlock, FaChartLine, FaFlask, FaHeadset, FaMessage, FaRocket, FaCircleCheck, FaClock, FaDownload, FaEnvelopeCircleCheck, FaRightToBracket, FaShieldHalved, FaUserPen, FaFileLines, FaSpellCheck, FaPen, FaPenToSquare, FaRoute, FaCircleXmark, FaFileContract, FaScrewdriverWrench, FaUsers, FaFaceSmile } from 'react-icons/fa6';
import { getNotifications, markNotificationRead, markAllNotificationsRead, dismissNotification } from '../api/client';

const iconMap = {
  'fa-trophy': FaTrophy,
  'fa-fire': FaFire,
  'fa-star': FaStar,
  'fa-book-open-reader': FaBookOpenReader,
  'fa-rotate': FaRotate,
  'fa-bullhorn': FaBullhorn,
  'fa-triangle-exclamation': FaTriangleExclamation,
  'fa-heart': FaHeart,
  'fa-comment': FaComment,
  'fa-user-plus': FaUserPlus,
  'fa-layer-group': FaLayerGroup,
  'fa-file-pdf': FaFilePdf,
  'fa-book-open': FaBookOpen,
  'fa-clipboard-check': FaClipboardCheck,
  'fa-crown': FaCrown,
  'fa-medal': FaMedal,
  'fa-hand-holding-heart': FaHandHoldingHeart,
  'fa-credit-card': FaCreditCard,
  'fa-lock': FaLock,
  'fa-unlock': FaUnlock,
  'fa-chart-line': FaChartLine,
  'fa-flask': FaFlask,
  'fa-headset': FaHeadset,
  'fa-message': FaMessage,
  'fa-rocket': FaRocket,
  'fa-circle-check': FaCircleCheck,
  'fa-clock': FaClock,
  'fa-download': FaDownload,
  'fa-envelope-circle-check': FaEnvelopeCircleCheck,
  'fa-right-to-bracket': FaRightToBracket,
  'fa-shield-halved': FaShieldHalved,
  'fa-user-pen': FaUserPen,
  'fa-file-lines': FaFileLines,
  'fa-spell-check': FaSpellCheck,
  'fa-pen': FaPen,
  'fa-pen-to-square': FaPenToSquare,
  'fa-route': FaRoute,
  'fa-circle-xmark': FaCircleXmark,
  'fa-file-contract': FaFileContract,
  'fa-screwdriver-wrench': FaScrewdriverWrench,
  'fa-users': FaUsers,
  'fa-face-smile': FaFaceSmile,
  'fa-arrow-trend-up': FaChartLine,
  'fa-check-double': FaCircleCheck,
  'fa-rotate-right': FaRotate,
  'fa-clipboard-list': FaClipboardCheck,
  'fa-bell': FaBell
};

function getIconComponent(iconName) {
  const IconComponent = iconMap[iconName] || FaBell;
  return IconComponent;
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);
  const pollRef = useRef(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const data = await getNotifications({ limit: 30 });
      setNotifications(data.notifications || []);
      setUnreadCount(data.unread_count || 0);
    } catch (e) {
      console.error('Failed to fetch notifications', e);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    pollRef.current = setInterval(fetchNotifications, 30000);
    return () => clearInterval(pollRef.current);
  }, [fetchNotifications]);

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
    await markNotificationRead(id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
    if (actionUrl) {
      window.location.href = actionUrl;
    }
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead();
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  const handleDismiss = async (e, id) => {
    e.stopPropagation();
    await dismissNotification(id);
    setNotifications(prev => prev.filter(n => n.id !== id));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const formatTime = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
    return date.toLocaleDateString();
  };

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

          <div className="notification-list">
            {notifications.length === 0 && (
              <div className="notification-empty">
                <FaBell size="2rem" color="var(--clr-text-muted)" />
                <p>No notifications yet</p>
              </div>
            )}

            {notifications.map(notification => {
              const IconComponent = getIconComponent(notification.icon);
              return (
                <div
                  key={notification.id}
                  className={`notification-item ${notification.is_read ? 'read' : 'unread'} priority-${notification.priority}`}
                  onClick={() => handleMarkRead(notification.id, notification.action_url)}
                >
                  <div className="notification-icon" style={{ color: notification.color }}>
                    <IconComponent />
                  </div>
                  <div className="notification-content">
                    <div className="notification-title">{notification.title}</div>
                    <div className="notification-body">{notification.body}</div>
                    {notification.action_text && (
                      <span className="notification-action-text">{notification.action_text}</span>
                    )}
                    <div className="notification-time">{formatTime(notification.created_at)}</div>
                  </div>
                  <button
                    className="notification-dismiss-btn"
                    onClick={(e) => handleDismiss(e, notification.id)}
                    aria-label="Dismiss notification"
                  >
                    <FaTimes />
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
