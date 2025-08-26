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
import { Card, Switch, Select, Button, Space, Typography, Spin, Row, Col, message } from 'antd'

const { Title, Text } = Typography
const { Option } = Select

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
      message.success(t('settings.success'))
    } catch (error: any) {
      console.error('保存设置错误:', error)
      message.error(error.message || t('settings.error'))
    } finally {
      setLoading(false)
    }
  }

  if (initialLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2} style={{ marginBottom: '32px' }}>{t('settings.title')}</Title>

      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* 通知设置 */}
        <Card title={t('settings.notifications')} size="default">
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Row justify="space-between" align="middle">
              <Col>
                <Space>
                  <Mail style={{ width: 16, height: 16 }} />
                  <Text>{t('settings.email')}</Text>
                </Space>
              </Col>
              <Col>
                <Switch
                  checked={notifications.email}
                  onChange={(checked) => setNotifications({ ...notifications, email: checked })}
                />
              </Col>
            </Row>

            <Row justify="space-between" align="middle">
              <Col>
                <Space>
                  <Smartphone style={{ width: 16, height: 16 }} />
                  <Text>{t('settings.push')}</Text>
                </Space>
              </Col>
              <Col>
                <Switch
                  checked={notifications.push}
                  onChange={(checked) => setNotifications({ ...notifications, push: checked })}
                />
              </Col>
            </Row>

            <Row justify="space-between" align="middle">
              <Col>
                <Space>
                  <Volume2 style={{ width: 16, height: 16 }} />
                  <Text>{t('settings.sound')}</Text>
                </Space>
              </Col>
              <Col>
                <Switch
                  checked={notifications.sound}
                  onChange={(checked) => setNotifications({ ...notifications, sound: checked })}
                />
              </Col>
            </Row>
          </Space>
        </Card>

        {/* 隐私设置 */}
        <Card title={t('settings.privacy')} size="default">
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Row justify="space-between" align="middle">
              <Col>
                <Space>
                  <Eye style={{ width: 16, height: 16 }} />
                  <Text>{t('settings.profile_visibility')}</Text>
                </Space>
              </Col>
              <Col>
                <Select
                  value={privacy.profile_visibility}
                  onChange={(value) => setPrivacy({ ...privacy, profile_visibility: value })}
                  style={{ width: 120 }}
                >
                  <Option value="public">{t('settings.public')}</Option>
                  <Option value="private">{t('settings.private')}</Option>
                </Select>
              </Col>
            </Row>

            <Row justify="space-between" align="middle">
              <Col>
                <Space>
                  <Bell style={{ width: 16, height: 16 }} />
                  <Text>{t('settings.show_activity')}</Text>
                </Space>
              </Col>
              <Col>
                <Switch
                  checked={privacy.show_activity}
                  onChange={(checked) => setPrivacy({ ...privacy, show_activity: checked })}
                />
              </Col>
            </Row>

            <Row justify="space-between" align="middle">
              <Col>
                <Space>
                  <Trophy style={{ width: 16, height: 16 }} />
                  <Text>{t('settings.show_results')}</Text>
                </Space>
              </Col>
              <Col>
                <Switch
                  checked={privacy.show_results}
                  onChange={(checked) => setPrivacy({ ...privacy, show_results: checked })}
                />
              </Col>
            </Row>
          </Space>
        </Card>

        {/* 外观设置 */}
        <Card title={t('settings.appearance')} size="default">
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Row justify="space-between" align="middle">
              <Col>
                <Space>
                  <Palette style={{ width: 16, height: 16 }} />
                  <Text>{t('settings.theme')}</Text>
                </Space>
              </Col>
              <Col>
                <Button
                  onClick={toggleTheme}
                  icon={theme === 'dark' ? <Sun style={{ width: 16, height: 16 }} /> : <Moon style={{ width: 16, height: 16 }} />}
                  type="default"
                />
              </Col>
            </Row>

            <Row justify="space-between" align="middle">
              <Col>
                <Space>
                  <Globe style={{ width: 16, height: 16 }} />
                  <Text>{t('settings.language')}</Text>
                </Space>
              </Col>
              <Col>
                <Select
                  value={language}
                  onChange={(value) => setLanguage(value)}
                  style={{ width: 120 }}
                >
                  <Option value="zh-CN">{t('language.zh-CN')}</Option>
                  <Option value="en-US">{t('language.en-US')}</Option>
                </Select>
              </Col>
            </Row>
          </Space>
        </Card>
      </Space>

      {/* 保存按钮 */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
        <Button
          type="primary"
          onClick={handleSaveSettings}
          loading={loading}
          icon={<Save style={{ width: 16, height: 16 }} />}
        >
          {loading ? t('settings.saving') : t('settings.save')}
        </Button>
      </div>
    </div>
  )
}