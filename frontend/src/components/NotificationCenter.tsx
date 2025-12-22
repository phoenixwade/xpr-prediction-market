import React, { useState, useEffect, useCallback } from 'react';

interface Notification {
  id: number;
  type: 'trade' | 'resolution' | 'comment' | 'mention';
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  marketId?: number;
  link?: string;
}

interface NotificationCenterProps {
  account: string;
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({ account }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const fetchNotifications = useCallback(async () => {
    try {
      const response = await fetch(
        `${process.env.REACT_APP_API_URL || ''}/api/notifications.php?account=${account}`
      );
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.notifications?.filter((n: Notification) => !n.read).length || 0);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  }, [account]);

  useEffect(() => {
    if (account) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [account, fetchNotifications]);

  const markAsRead = async (notificationId: number) => {
    try {
      await fetch(`${process.env.REACT_APP_API_URL || ''}/api/notifications.php`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notification_id: notificationId,
          read: true
        })
      });
      fetchNotifications();
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await fetch(`${process.env.REACT_APP_API_URL || ''}/api/notifications.php`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account,
          mark_all_read: true
        })
      });
      fetchNotifications();
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const filteredNotifications = filter === 'unread' 
    ? notifications.filter(n => !n.read)
    : notifications;

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'trade': return '📊';
      case 'resolution': return '✅';
      case 'comment': return '💬';
      case 'mention': return '@';
      default: return '🔔';
    }
  };

  return (
    <div className="notification-center">
      <button 
        className="notification-bell"
        onClick={() => setIsOpen(!isOpen)}
      >
        🔔
        {unreadCount > 0 && (
          <span className="notification-badge">{unreadCount}</span>
        )}
      </button>

      {isOpen && (
        <div className="notification-dropdown">
          <div className="notification-header">
            <h3>Notifications</h3>
            <div className="notification-actions">
              <button
                className={filter === 'all' ? 'active' : ''}
                onClick={() => setFilter('all')}
              >
                All
              </button>
              <button
                className={filter === 'unread' ? 'active' : ''}
                onClick={() => setFilter('unread')}
              >
                Unread ({unreadCount})
              </button>
              {unreadCount > 0 && (
                <button onClick={markAllAsRead} className="mark-all-read">
                  Mark all read
                </button>
              )}
            </div>
          </div>

          <div className="notifications-list">
            {filteredNotifications.length === 0 ? (
              <div className="no-notifications">
                {filter === 'unread' ? 'No unread notifications' : 'No notifications'}
              </div>
            ) : (
              filteredNotifications.map(notification => (
                <div
                  key={notification.id}
                  className={`notification-item ${notification.read ? 'read' : 'unread'}`}
                  onClick={() => {
                    if (!notification.read) {
                      markAsRead(notification.id);
                    }
                    // Navigate to the notification target
                    if (notification.link) {
                      window.location.href = notification.link;
                    } else if (notification.marketId) {
                      // Fallback: use marketId to navigate to market page
                      window.location.href = `/market/${notification.marketId}`;
                    }
                  }}
                >
                  <div className="notification-icon">
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="notification-content">
                    <div className="notification-title">{notification.title}</div>
                    <div className="notification-message">{notification.message}</div>
                    <div className="notification-time">
                      {new Date(notification.timestamp * 1000).toLocaleString()}
                    </div>
                  </div>
                  {!notification.read && <div className="unread-dot" />}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;
