import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, User, LogOut, Settings, Moon, Sun, Menu } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../hooks/useTheme'
import { useLanguage } from '../contexts/LanguageContext'
import { api, auth } from '../lib/api'
import toast from 'react-hot-toast'
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
        toast.error(t('error.load_notifications'))
      }
    } catch (error: any) {
      console.error('加载通知错误:', error)
      toast.error(error.message || t('error.load_notifications'))
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
      toast.error(error.message || t('error.load_unread_count'))
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
      toast.error(t('error.logout'))
    }
  }
  
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <div className="mr-4 flex">
          <a className="mr-6 flex items-center space-x-2" href="/">
            <span className="font-bold">{t('app.title')}</span>
          </a>
        </div>

        <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
          <div className="w-full flex-1 md:w-auto md:flex-none">
            {/* 移动端菜单按钮 */}
            {onMobileMenuToggle && (
              <button
                onClick={onMobileMenuToggle}
                className="md:hidden px-2 py-2 hover:bg-accent hover:text-accent-foreground rounded-md"
              >
                <Menu className="h-5 w-5" />
                <span className="sr-only">打开菜单</span>
              </button>
            )}
          </div>
          <nav className="flex items-center space-x-2">
            <button
              onClick={toggleTheme}
              className="px-2 py-2 hover:bg-accent hover:text-accent-foreground rounded-md"
            >
              {theme === 'dark' ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
              <span className="sr-only">
                {theme === 'dark' ? t('theme.toggle_light') : t('theme.toggle_dark')}
              </span>
            </button>

            <div className="relative" ref={notificationRef}>
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative px-2 py-2 hover:bg-accent hover:text-accent-foreground rounded-md"
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white">
                    {unreadCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 rounded-md bg-popover text-popover-foreground shadow-md ring-1 ring-black ring-opacity-5">
                  <div className="p-4">
                    <h3 className="text-sm font-medium">{t('notifications.title')}</h3>
                    <div className="mt-2 divide-y divide-gray-200">
                      {notificationsLoading ? (
                        <div className="py-4 text-center">
                          <LoadingSpinner />
                        </div>
                      ) : notifications.length > 0 ? (
                        notifications.map((notification) => (
                          <div
                            key={notification.id}
                            className={`py-4 ${!notification.read ? 'bg-muted/50' : ''}`}
                            onClick={() => markAsRead(notification.id)}
                          >
                            <div className="flex items-start">
                              <div className="ml-3 flex-1">
                                <p className="text-sm font-medium text-gray-900">
                                  {notification.title}
                                </p>
                                <p className="mt-1 text-sm text-gray-500">
                                  {notification.content}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="py-4 text-center text-sm text-gray-500">
                          {t('notifications.empty')}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="relative">
              <button
                onClick={() => navigate('/settings')}
                className="px-2 py-2 hover:bg-accent hover:text-accent-foreground rounded-md"
              >
                <Settings className="h-5 w-5" />
              </button>
            </div>

            <div className="relative">
              <button
                onClick={() => navigate('/profile')}
                className="px-2 py-2 hover:bg-accent hover:text-accent-foreground rounded-md"
              >
                <User className="h-5 w-5" />
              </button>
            </div>

            <div className="relative">
              <button
                onClick={handleLogout}
                className="px-2 py-2 hover:bg-accent hover:text-accent-foreground rounded-md"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </nav>
        </div>
      </div>
    </header>
  )
}
