import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, User, LogOut, Settings, Moon, Sun, Menu } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../hooks/useTheme'
import { useLanguage } from '../contexts/LanguageContext'
import { api, auth } from '../lib/api'
import { message } from 'antd'
import LoadingSpinner from './LoadingSpinner'

interface Notification {
  id: string
  title: string
  content: string
  type: 'info' | 'warning' | 'success' | 'error'
  read: boolean
  created_at: string
}

interface HeaderProps {
  onMobileMenuToggle?: () => void
}

export default function Header({ onMobileMenuToggle }: HeaderProps) {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const { t } = useLanguage()
  
  const [showNotifications, setShowNotifications] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [notificationsLoading, setNotificationsLoading] = useState(false)
  const notificationRef = React.useRef<HTMLDivElement>(null)
  
  useEffect(() => {
    if (showNotifications) {
      loadNotifications()
    }
  }, [showNotifications])
  
  useEffect(() => {
    if (user) {
      loadUnreadCount()
      // 每分钟更新一次未读数量
      const timer = setInterval(loadUnreadCount, 60000)
      return () => clearInterval(timer)
    }
  }, [user])
  
  // 添加点击外部关闭通知栏的功能
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false)
      }
    }
    
    if (showNotifications) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showNotifications])
  
  const loadNotifications = async () => {
    try {
      setNotificationsLoading(true)
      // 直接使用 api.get 替代 api.notifications.list
      const response = await api.get('/notifications')
      if (response.success) {
        setNotifications(response.data?.notifications || [])
        setUnreadCount(response.data?.unreadCount || 0)
      } else {
        console.error('加载通知失败:', response.error)
        message.error(t('error.load_notifications'))
      }
    } catch (error: any) {
      console.error('加载通知错误:', error)
      message.error(error.message || t('error.load_notifications'))
    } finally {
      setNotificationsLoading(false)
    }
  }
  
  const loadUnreadCount = async () => {
    try {
      // 直接使用 api.get 替代 api.notifications.unreadCount
      const response = await api.get('/notifications/unread-count')
      // 直接设置未读数量，提供默认值
      setUnreadCount(response?.data?.unreadCount ?? 0)
    } catch (error: any) {
      console.error('加载未读通知数量错误:', error)
      message.error(error.message || t('error.load_unread_count'))
      setUnreadCount(0)
    }
  }
  
  const markAsRead = async (notificationId: string) => {
    try {
      // 直接使用 api.put 替代 api.notifications.markAsRead
      await api.put(`/notifications/${notificationId}/read`)
      
      // 更新本地状态
      setNotifications(prev => 
        prev.map(notif => 
          notif.id === notificationId ? { ...notif, read: true } : notif
        )
      )
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (error: any) {
      console.error('标记通知为已读错误:', error)
    }
  }
  
  const handleLogout = async () => {
    try {
      await signOut()
      navigate('/login')
    } catch (error: any) {
      console.error('退出登录错误:', error)
      message.error(t('error.logout'))
    }
  }
  
  return (
    <header style={{
      position: 'sticky',
      top: 0,
      zIndex: 50,
      width: '100%',
      borderBottom: '1px solid #e5e7eb',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      backdropFilter: 'blur(8px)'
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        display: 'flex',
        height: '56px',
        alignItems: 'center',
        padding: '0 16px'
      }}>
        <div style={{
          marginRight: '16px',
          display: 'flex'
        }}>
          <a style={{
            marginRight: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            textDecoration: 'none',
            color: 'inherit'
          }} href="/">
            <span style={{ fontWeight: 'bold' }}>{t('app.title')}</span>
          </a>
        </div>

        <div style={{
          display: 'flex',
          flex: 1,
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px'
        }}>
          <div style={{
            width: '100%',
            flex: 1
          }}>
            {/* 移动端菜单按钮 */}
            {onMobileMenuToggle && (
              <button
                onClick={onMobileMenuToggle}
                style={{
                  display: window.innerWidth < 768 ? 'block' : 'none',
                  padding: '8px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f3f4f6'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent'
                }}
              >
                <Menu style={{ height: '20px', width: '20px' }} />
                <span style={{ position: 'absolute', left: '-9999px' }}>打开菜单</span>
              </button>
            )}
          </div>
          <nav style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <button
              onClick={toggleTheme}
              style={{
                padding: '8px',
                border: 'none',
                backgroundColor: 'transparent',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f3f4f6'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
            >
              {theme === 'dark' ? (
                <Sun style={{ height: '20px', width: '20px' }} />
              ) : (
                <Moon style={{ height: '20px', width: '20px' }} />
              )}
              <span style={{ position: 'absolute', left: '-9999px' }}>
                {theme === 'dark' ? t('theme.toggle_light') : t('theme.toggle_dark')}
              </span>
            </button>

            <div style={{ position: 'relative' }} ref={notificationRef}>
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                style={{
                  position: 'relative',
                  padding: '8px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f3f4f6'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent'
                }}
              >
                <Bell style={{ height: '20px', width: '20px' }} />
                {unreadCount > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: '4px',
                    right: '4px',
                    display: 'flex',
                    height: '16px',
                    width: '16px',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '50%',
                    backgroundColor: '#ef4444',
                    fontSize: '10px',
                    color: 'white'
                  }}>
                    {unreadCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div style={{
                  position: 'absolute',
                  right: 0,
                  marginTop: '8px',
                  width: '320px',
                  borderRadius: '6px',
                  backgroundColor: '#ffffff',
                  color: '#374151',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                  border: '1px solid rgba(0, 0, 0, 0.05)'
                }}>
                  <div style={{ padding: '16px' }}>
                    <h3 style={{
                      fontSize: '14px',
                      fontWeight: '500',
                      margin: 0
                    }}>{t('notifications.title')}</h3>
                    <div style={{
                      marginTop: '8px'
                    }}>
                      {notificationsLoading ? (
                        <div style={{
                          padding: '16px 0',
                          textAlign: 'center'
                        }}>
                          <LoadingSpinner />
                        </div>
                      ) : notifications.length > 0 ? (
                        notifications.map((notification) => (
                          <div
                            key={notification.id}
                            style={{
                              padding: '16px 0',
                              borderTop: '1px solid #e5e7eb',
                              backgroundColor: !notification.read ? 'rgba(243, 244, 246, 0.5)' : 'transparent',
                              cursor: 'pointer'
                            }}
                            onClick={() => markAsRead(notification.id)}
                          >
                            <div style={{
                              display: 'flex',
                              alignItems: 'flex-start'
                            }}>
                              <div style={{
                                marginLeft: '12px',
                                flex: 1
                              }}>
                                <p style={{
                                  fontSize: '14px',
                                  fontWeight: '500',
                                  color: '#111827',
                                  margin: 0
                                }}>
                                  {notification.title}
                                </p>
                                <p style={{
                                  marginTop: '4px',
                                  fontSize: '14px',
                                  color: '#6b7280',
                                  margin: '4px 0 0 0'
                                }}>
                                  {notification.content}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div style={{
                          padding: '16px 0',
                          textAlign: 'center',
                          fontSize: '14px',
                          color: '#6b7280'
                        }}>
                          {t('notifications.empty')}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div style={{ position: 'relative' }}>
              <button
                onClick={() => navigate('/settings')}
                style={{
                  padding: '8px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f3f4f6'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent'
                }}
              >
                <Settings style={{ height: '20px', width: '20px' }} />
              </button>
            </div>

            <div style={{ position: 'relative' }}>
              <button
                onClick={() => navigate('/profile')}
                style={{
                  padding: '8px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f3f4f6'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent'
                }}
              >
                <User style={{ height: '20px', width: '20px' }} />
              </button>
            </div>

            <div style={{ position: 'relative' }}>
              <button
                onClick={handleLogout}
                style={{
                  padding: '8px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f3f4f6'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent'
                }}
              >
                <LogOut style={{ height: '20px', width: '20px' }} />
              </button>
            </div>
          </nav>
        </div>
      </div>
    </header>
  )
}
