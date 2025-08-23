import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import { 
  Bell, 
  Shield, 
  Palette, 
  Globe, 
  Eye, 
  Save, 
  Moon, 
  Sun,
  Smartphone,
  Mail,
  Volume2,
  Trophy
} from 'lucide-react'
import { useTheme } from '../hooks/useTheme'
import { api, users, settings } from '../lib/api'
import toast from 'react-hot-toast'

interface NotificationSettings {
  email: boolean
  push: boolean
  sound: boolean
}

interface PrivacySettings {
  profile_visibility: 'public' | 'private'
  show_activity: boolean
  show_results: boolean
}

export default function SettingsPage() {
  const { theme, toggleTheme } = useTheme()
  const { language, setLanguage, t } = useLanguage()
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [notifications, setNotifications] = useState<NotificationSettings>({
    email: true,
    push: true,
    sound: true
  })
  const [privacy, setPrivacy] = useState<PrivacySettings>({
    profile_visibility: 'public',
    show_activity: true,
    show_results: true
  })

  useEffect(() => {
    loadUserSettings()
  }, [])

  const loadUserSettings = async () => {
    try {
      setInitialLoading(true)
      // 只有在用户已登录时才尝试获取设置
      if (user?.id) {
        const { data } = await settings.get()
        
        const userSettings = data
        if (userSettings.notifications) {
          setNotifications({ ...notifications, ...userSettings.notifications })
        }
        if (userSettings.privacy) {
          setPrivacy({ ...privacy, ...userSettings.privacy })
        }
        if (userSettings.appearance?.language) {
          setLanguage(userSettings.appearance.language)
        }
      }
    } catch (error: any) {
      console.error('加载设置错误:', error)
      // 静默失败，使用默认设置
    } finally {
      setInitialLoading(false)
    }
  }

  const handleSaveSettings = async () => {
    setLoading(true)
    try {
      // 只有在用户已登录时才尝试保存设置
      if (user?.id) {
        await settings.save({
          notifications,
          privacy,
          appearance: {
            theme,
            language
          }
        })
      } else {
        // 未登录时，只更新本地存储的语言设置
        localStorage.setItem('language', language)
      }
      
      // 使用翻译函数显示成功消息
      toast.success(t('settings.success'))
    } catch (error: any) {
      console.error('保存设置错误:', error)
      toast.error(error.message || t('settings.error'))
    } finally {
      setLoading(false)
    }
  }

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-8">{t('settings.title')}</h1>

      {/* 通知设置 */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">{t('settings.notifications')}</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Mail className="h-5 w-5" />
              <span>{t('settings.email')}</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={notifications.email}
                onChange={(e) => setNotifications({ ...notifications, email: e.target.checked })}
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Smartphone className="h-5 w-5" />
              <span>{t('settings.push')}</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={notifications.push}
                onChange={(e) => setNotifications({ ...notifications, push: e.target.checked })}
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Volume2 className="h-5 w-5" />
              <span>{t('settings.sound')}</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={notifications.sound}
                onChange={(e) => setNotifications({ ...notifications, sound: e.target.checked })}
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>
      </section>

      {/* 隐私设置 */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">{t('settings.privacy')}</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Eye className="h-5 w-5" />
              <span>{t('settings.profile_visibility')}</span>
            </div>
            <select
              className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1"
              value={privacy.profile_visibility}
              onChange={(e) => setPrivacy({ ...privacy, profile_visibility: e.target.value as 'public' | 'private' })}
            >
              <option value="public">{t('settings.public')}</option>
              <option value="private">{t('settings.private')}</option>
            </select>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Bell className="h-5 w-5" />
              <span>{t('settings.show_activity')}</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={privacy.show_activity}
                onChange={(e) => setPrivacy({ ...privacy, show_activity: e.target.checked })}
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Trophy className="h-5 w-5" />
              <span>{t('settings.show_results')}</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={privacy.show_results}
                onChange={(e) => setPrivacy({ ...privacy, show_results: e.target.checked })}
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>
      </section>

      {/* 外观设置 */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">{t('settings.appearance')}</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Palette className="h-5 w-5" />
              <span>{t('settings.theme')}</span>
            </div>
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800"
            >
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Globe className="h-5 w-5" />
              <span>{t('settings.language')}</span>
            </div>
            <select
              className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              <option value="zh-CN">{t('language.zh-CN')}</option>
              <option value="en-US">{t('language.en-US')}</option>
            </select>
          </div>
        </div>
      </section>

      {/* 保存按钮 */}
      <div className="flex justify-end">
        <button
          onClick={handleSaveSettings}
          disabled={loading}
          className="flex items-center space-x-2 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save className="h-5 w-5" />
          <span>{loading ? t('settings.saving') : t('settings.save')}</span>
        </button>
      </div>
    </div>
  )
}