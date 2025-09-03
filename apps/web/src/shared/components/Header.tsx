import { useTheme } from '@app/providers/AntdThemeProvider' // 或配置 @app 后写成 @app/providers/AntdThemeProvider
import { api } from '@shared/api/http'
import { message } from 'antd'
import { Bell, LogOut, Menu, Moon, Settings, Sun, User } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'

import LoadingSpinner from './LoadingSpinner'

// ===== 统一 ApiResult 类型与守卫，避免直接 .data 取值导致 TS2339 =====
type ApiSuccess<T = any> = { success: true; data: T; message?: string }
type ApiFailure = { success: false; error?: string; message?: string }
type ApiResult<T = any> = ApiSuccess<T> | ApiFailure
const isSuccess = <T,>(r: any): r is ApiSuccess<T> => r && typeof r === 'object' && r.success === true

/** 从常见返回形态中“捞”出数据：
 *  - 我方拦截器：{ success, data }
 *  - 直出：{ data: {...} } 或 { data: { data: ... } }
 */
function pickData<T>(resp: any, fallback: T): T {
  if (isSuccess<T>(resp)) return (resp.data as T) ?? fallback
  const d = resp?.data
  if (d?.data !== undefined) return (d.data as T) ?? fallback
  return (d as T) ?? fallback
}
// ===================================================================

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
  const { mode, toggle } = useTheme()

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      const resp: ApiResult<{ notifications?: Notification[]; unreadCount?: number }> | any = await api.get(
        '/notifications'
      )

      const data = pickData<{ notifications?: Notification[]; unreadCount?: number }>(resp, {})
      setNotifications(Array.isArray(data.notifications) ? data.notifications : [])
      setUnreadCount(Number(data.unreadCount ?? 0))
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
      const resp: ApiResult<{ unreadCount: number }> | any = await api.get('/notifications/unread-count')
      const data = pickData<{ unreadCount?: number }>(resp, {})
      setUnreadCount(Number(data.unreadCount ?? 0))
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
      setNotifications(prev => prev.map(notif => (notif.id === notificationId ? { ...notif, read: true } : notif)))
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
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        width: '100%',
        // 用 antd 变量，跟随主题
        borderBottom: '1px solid var(--app-colorSplit, #e5e7eb)',
        backgroundColor: 'var(--app-colorBgElevated, rgba(255,255,255,.95))',
        color: 'var(--app-colorText, #111827)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          display: 'flex',
          height: 69,
          alignItems: 'center',
          padding: '0 16px',
          overflow: 'hidden',
        }}
      >
        <div style={{ marginRight: 16, display: 'flex' }}>
          <a
            style={{
              marginRight: 24,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              textDecoration: 'none',
              color: 'var(--app-colorText, inherit)',
            }}
            href="/"
          >
            <span style={{ fontWeight: 700 }}>{t('app.title')}</span>
          </a>
        </div>

        <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ width: '100%', flex: 1 }}>
            {onMobileMenuToggle && (
              <button
                onClick={onMobileMenuToggle}
                style={{
                  display: window.innerWidth < 768 ? 'block' : 'none',
                  padding: 8,
                  border: 'none',
                  backgroundColor: 'transparent',
                  borderRadius: 8,
                  cursor: 'pointer',
                  transition: 'background-color .2s',
                  color: 'var(--app-colorText, inherit)',
                }}
                onMouseEnter={e =>
                  (e.currentTarget.style.backgroundColor =
                    mode === 'dark' ? 'rgba(255,255,255,.10)' : 'rgba(0,0,0,.06)')
                }
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <Menu style={{ height: 20, width: 20 }} />
                <span style={{ position: 'absolute', left: -9999 }}>打开菜单</span>
              </button>
            )}
          </div>

          <nav style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* 主题切换 */}
            <button
              onClick={toggle}
              style={{
                padding: 8,
                border: 'none',
                backgroundColor: 'transparent',
                borderRadius: 8,
                cursor: 'pointer',
                transition: 'background-color .2s',
                color: 'var(--app-colorText, inherit)', // 关键：让图标继承文本色
              }}
              onMouseEnter={e =>
                (e.currentTarget.style.backgroundColor = mode === 'dark' ? 'rgba(255,255,255,.10)' : 'rgba(0,0,0,.06)')
              }
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              aria-label={mode === 'dark' ? t('theme.toggle_light') : t('theme.toggle_dark')}
              title={mode === 'dark' ? t('theme.toggle_light') : t('theme.toggle_dark')}
            >
              {mode === 'dark' ? <Sun style={{ height: 20, width: 20 }} /> : <Moon style={{ height: 20, width: 20 }} />}
            </button>

            {/* 通知 */}
            <div style={{ position: 'relative' }} ref={notificationRef}>
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                style={{
                  position: 'relative',
                  padding: 8,
                  border: 'none',
                  backgroundColor: 'transparent',
                  borderRadius: 8,
                  cursor: 'pointer',
                  transition: 'background-color .2s',
                  color: 'var(--app-colorText, inherit)',
                }}
                onMouseEnter={e =>
                  (e.currentTarget.style.backgroundColor =
                    mode === 'dark' ? 'rgba(255,255,255,.10)' : 'rgba(0,0,0,.06)')
                }
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <Bell style={{ height: 20, width: 20 }} />
                {unreadCount > 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      top: 4,
                      right: 4,
                      display: 'flex',
                      height: 16,
                      width: 16,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '50%',
                      backgroundColor: 'var(--app-colorError, #ef4444)',
                      fontSize: 10,
                      color: '#fff',
                    }}
                  >
                    {unreadCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div
                  style={{
                    position: 'absolute',
                    right: 0,
                    marginTop: 8,
                    width: 320,
                    borderRadius: 10,
                    backgroundColor: 'var(--app-colorBgElevated, #fff)',
                    color: 'var(--app-colorText, #374151)',
                    boxShadow: '0 10px 15px -3px rgba(0,0,0,.1), 0 4px 6px -2px rgba(0,0,0,.05)',
                    border: '1px solid var(--app-colorSplit, rgba(0,0,0,.06))',
                  }}
                >
                  <div style={{ padding: 16 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 500, margin: 0 }}>{t('notifications.title')}</h3>
                    <div style={{ marginTop: 8 }}>
                      {notificationsLoading ? (
                        <div style={{ padding: '16px 0', textAlign: 'center' }}>
                          <LoadingSpinner />
                        </div>
                      ) : notifications.length > 0 ? (
                        notifications.map(n => (
                          <div
                            key={n.id}
                            style={{
                              padding: '16px 0',
                              borderTop: '1px solid var(--app-colorSplit, rgba(0,0,0,.06))',
                              backgroundColor: !n.read
                                ? mode === 'dark'
                                  ? 'rgba(255,255,255,.06)'
                                  : 'rgba(0,0,0,.04)'
                                : 'transparent',
                              cursor: 'pointer',
                            }}
                            onClick={() => markAsRead(n.id)}
                          >
                            <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                              <div style={{ marginLeft: 12, flex: 1 }}>
                                <p style={{ fontSize: 14, fontWeight: 500, margin: 0 }}>{n.title}</p>
                                <p
                                  style={{
                                    marginTop: 4,
                                    fontSize: 14,
                                    color: 'var(--app-colorTextSecondary)',
                                    marginBottom: 0,
                                  }}
                                >
                                  {n.content}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div
                          style={{
                            padding: '16px 0',
                            textAlign: 'center',
                            fontSize: 14,
                            color: 'var(--app-colorTextSecondary)',
                          }}
                        >
                          {t('notifications.empty')}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 设置 */}
            <button
              onClick={() => navigate('/settings')}
              style={{
                padding: 8,
                border: 'none',
                backgroundColor: 'transparent',
                borderRadius: 8,
                cursor: 'pointer',
                transition: 'background-color .2s',
                color: 'var(--app-colorText, inherit)',
              }}
              onMouseEnter={e =>
                (e.currentTarget.style.backgroundColor = mode === 'dark' ? 'rgba(255,255,255,.10)' : 'rgba(0,0,0,.06)')
              }
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <Settings style={{ height: 20, width: 20 }} />
            </button>

            {/* 个人中心 */}
            <button
              onClick={() => navigate('/profile')}
              style={{
                padding: 8,
                border: 'none',
                backgroundColor: 'transparent',
                borderRadius: 8,
                cursor: 'pointer',
                transition: 'background-color .2s',
                color: 'var(--app-colorText, inherit)',
              }}
              onMouseEnter={e =>
                (e.currentTarget.style.backgroundColor = mode === 'dark' ? 'rgba(255,255,255,.10)' : 'rgba(0,0,0,.06)')
              }
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <User style={{ height: 20, width: 20 }} />
            </button>

            {/* 退出 */}
            <button
              onClick={handleLogout}
              style={{
                padding: 8,
                border: 'none',
                backgroundColor: 'transparent',
                borderRadius: 8,
                cursor: 'pointer',
                transition: 'background-color .2s',
                color: 'var(--app-colorText, inherit)',
              }}
              onMouseEnter={e =>
                (e.currentTarget.style.backgroundColor = mode === 'dark' ? 'rgba(255,255,255,.10)' : 'rgba(0,0,0,.06)')
              }
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <LogOut style={{ height: 20, width: 20 }} />
            </button>
          </nav>
        </div>
      </div>
    </header>
  )
}
