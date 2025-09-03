import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { User, Mail, School, Trophy, Calendar, Save, Upload } from 'lucide-react'
import { api, profile } from '../lib/api'
import { message, Card, Input, Button, Space, Typography, Avatar, Upload as AntUpload, Form } from 'antd'
import { useLanguage } from '../contexts/LanguageContext'

const { Title, Text } = Typography

interface ProfileForm {
  nickname: string
  school: string
  class_name: string
}

export default function ProfilePage() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState<ProfileForm>({
    nickname: user?.username || '',
    school: user?.school || '',
    class_name: user?.class_name || ''
  })
  
  // 当用户信息加载完成后，更新表单
  useEffect(() => {
    if (user) {
      setForm({
        nickname: user.username || '',
        school: user.school || '',
        class_name: user.class_name || ''
      })
    }
  }, [user])
  const [avatar, setAvatar] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string>('')

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0]
      setAvatar(file)
      setAvatarPreview(URL.createObjectURL(file))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // 更新个人资料
      await profile.update(form)

      // 如果有新头像，上传头像
      if (avatar) {
        const formData = new FormData()
        formData.append('avatar', avatar)
        await profile.uploadAvatar(formData)
      }

      message.success(t('profile.update_success'))
    } catch (error: any) {
      console.error(t('profile.update_error'), error)
      message.error(error.message || t('profile.update_error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Space
      direction="vertical"
      size="large"
      style={{ width: '100%', maxWidth: 800, margin: '0 auto', padding: '24px' }}
    >
      <Title level={2}>{t('profile.title')}</Title>

      <Card>
        <form onSubmit={handleSubmit}>
          {/* 头像上传 */}
          <Space size="large" style={{ marginBottom: 24 }}>
            <div style={{ position: 'relative' }}>
              <Avatar
                size={96}
                src={
                  avatarPreview ||
                  (user?.avatar_url
                    ? `${import.meta.env.DEV ? '' : import.meta.env.VITE_API_URL || '/api'}${user.avatar_url}`
                    : '/default-avatar.png')
                }
                alt="头像"
              />
              <label
                htmlFor="avatar-upload"
                style={{
                  position: 'absolute',
                  bottom: 0,
                  right: 0,
                  padding: 4,
                  backgroundColor: '#1890ff',
                  color: 'white',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Upload style={{ width: 16, height: 16 }} />
                <input
                  id="avatar-upload"
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleAvatarChange}
                />
              </label>
            </div>
            <Space direction="vertical" size={0}>
              <Text strong>{user?.email}</Text>
              <Text type="secondary">{t('profile.change_avatar')}</Text>
            </Space>
          </Space>

          {/* 基本信息 */}
          <Space direction="vertical" size="middle" style={{ width: '100%', marginBottom: 24 }}>
            <div>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>
                {t('profile.nickname')}
              </Text>
              <Input
                value={form.nickname}
                onChange={e => setForm({ ...form, nickname: e.target.value })}
                placeholder={`${t('app.enter')} ${t('profile.nickname')}`}
              />
            </div>

            <div>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>
                {t('profile.school')}
              </Text>
              <Input
                value={form.school}
                onChange={e => setForm({ ...form, school: e.target.value })}
                placeholder={`${t('app.enter')} ${t('profile.school')}`}
              />
            </div>

            <div>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>
                {t('profile.class')}
              </Text>
              <Input
                value={form.class_name}
                onChange={e => setForm({ ...form, class_name: e.target.value })}
                placeholder={`${t('app.enter')} ${t('profile.class')}`}
              />
            </div>
          </Space>

          {/* 统计信息 */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 16,
              marginBottom: 24,
            }}
          >
            <Card size="small">
              <Space align="center" style={{ marginBottom: 8 }}>
                <Trophy style={{ width: 20, height: 20, color: '#1890ff' }} />
                <Text strong>{t('profile.exam_score')}</Text>
              </Space>
              <div>
                <Title level={2} style={{ margin: 0, fontSize: 32 }}>
                  85.5
                </Title>
                <Text type="secondary">{t('profile.average_score')}</Text>
              </div>
            </Card>

            <Card size="small">
              <Space align="center" style={{ marginBottom: 8 }}>
                <Calendar style={{ width: 20, height: 20, color: '#1890ff' }} />
                <Text strong>{t('profile.exams_taken')}</Text>
              </Space>
              <div>
                <Title level={2} style={{ margin: 0, fontSize: 32 }}>
                  12
                </Title>
                <Text type="secondary">{t('profile.total_exams')}</Text>
              </div>
            </Card>

            <Card size="small">
              <Space align="center" style={{ marginBottom: 8 }}>
                <School style={{ width: 20, height: 20, color: '#1890ff' }} />
                <Text strong>{t('profile.knowledge_points')}</Text>
              </Space>
              <div>
                <Title level={2} style={{ margin: 0, fontSize: 32 }}>
                  156
                </Title>
                <Text type="secondary">{t('profile.mastered')}</Text>
              </div>
            </Card>
          </div>

          {/* 保存按钮 */}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              icon={<Save style={{ width: 20, height: 20 }} />}
            >
              {loading ? t('settings.saving_changes') : t('settings.save_changes')}
            </Button>
          </div>
        </form>
      </Card>
    </Space>
  )
}
