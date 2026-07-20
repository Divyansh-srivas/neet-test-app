import React, { useState, useEffect } from 'react'
import { Bell, Check, Trash2, X } from 'lucide-react'
import { getNotifications, markAsRead, markAllAsRead, deleteNotification } from '../api/notifications'
import { useAuth } from '../utils/useAuth'

export default function NotificationCenter({ align = 'left', direction = 'down' }) {
  const { profile } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(false)

  const unreadCount = notifications.filter(n => !n.is_read).length

  useEffect(() => {
    if (profile?.id) {
      loadNotifications()
      
      // We could use Supabase realtime subscriptions here, but for simplicity we'll poll or just load on mount/open
      const interval = setInterval(() => {
        loadNotifications()
      }, 30000)
      return () => clearInterval(interval)
    }
  }, [profile?.id])

  const loadNotifications = async () => {
    if (!profile?.id) return
    const data = await getNotifications(profile.id)
    setNotifications(data)
  }

  const handleToggle = () => {
    setIsOpen(!isOpen)
    if (!isOpen) loadNotifications()
  }

  const handleMarkAsRead = async (id, e) => {
    e.stopPropagation()
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
    try {
      await markAsRead(id)
    } catch (err) {
      console.error(err)
      loadNotifications() // revert
    }
  }

  const handleMarkAllRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    try {
      await markAllAsRead(profile.id)
    } catch (err) {
      console.error(err)
      loadNotifications()
    }
  }

  const handleDelete = async (id, e) => {
    e.stopPropagation()
    setNotifications(prev => prev.filter(n => n.id !== id))
    try {
      await deleteNotification(id)
    } catch (err) {
      console.error(err)
      loadNotifications()
    }
  }

  const formatTime = (ts) => {
    const d = new Date(ts);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  return (
    <div style={{ position: 'relative' }}>
      <button 
        onClick={handleToggle}
        style={{
          background: 'transparent', border: 'none', cursor: 'pointer',
          padding: 8, position: 'relative', color: 'var(--text)'
        }}
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <div style={{
            position: 'absolute', top: 4, right: 4, background: 'var(--red)',
            color: 'white', fontSize: 10, fontWeight: 700,
            width: 16, height: 16, borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </div>
        )}
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute', 
          ...(direction === 'down' ? { top: '100%', marginTop: 8 } : { bottom: '100%', marginBottom: 8 }),
          ...(align === 'left' ? { left: 0 } : align === 'right' ? { right: 0 } : { left: '50%', transform: 'translateX(-50%)' }),
          width: 320, maxHeight: 400, background: 'var(--surface)',
          border: '1px solid var(--border)', borderRadius: 12,
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
          display: 'flex', flexDirection: 'column', zIndex: 1000,
          overflow: 'hidden'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>Notifications</h3>
            {unreadCount > 0 && (
              <button onClick={handleMarkAllRead} style={{ background: 'transparent', border: 'none', color: 'var(--accent)', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                Mark all read
              </button>
            )}
          </div>
          
          <div style={{ overflowY: 'auto', flex: 1, padding: 8 }}>
            {notifications.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
                No notifications yet
              </div>
            ) : (
              notifications.map(n => (
                <div 
                  key={n.id} 
                  style={{
                    padding: 12, borderRadius: 8, marginBottom: 4,
                    background: n.is_read ? 'transparent' : 'color-mix(in srgb, var(--accent) 8%, transparent)',
                    borderLeft: `2px solid ${n.is_read ? 'transparent' : 'var(--accent)'}`,
                    display: 'flex', gap: 12, cursor: n.action_url ? 'pointer' : 'default',
                    transition: 'background 0.2s'
                  }}
                  onClick={() => {
                    if (n.action_url) window.location.href = n.action_url;
                    if (!n.is_read) handleMarkAsRead(n.id, { stopPropagation: () => {} });
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <div style={{ fontSize: 13, fontWeight: n.is_read ? 500 : 600, color: 'var(--text)' }}>{n.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{formatTime(n.created_at)}</div>
                    </div>
                    <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.4 }}>{n.message}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
                    {!n.is_read && (
                      <button onClick={(e) => handleMarkAsRead(n.id, e)} title="Mark as read" style={{ background: 'transparent', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: 4 }}>
                        <Check size={14} />
                      </button>
                    )}
                    <button onClick={(e) => handleDelete(n.id, e)} title="Delete" style={{ background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: 4 }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
