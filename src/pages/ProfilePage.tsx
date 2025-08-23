import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { User, Mail, School, Trophy, Calendar, Save, Upload } from 'lucide-react'
import { api, profile } from '../lib/api'
import toast from 'react-hot-toast'
import { useLanguage } from '../contexts/LanguageContext'

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

      toast.success(t('profile.update_success'))
    } catch (error: any) {
      console.error(t('profile.update_error'), error)
      toast.error(error.message || t('profile.update_error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-8">{t('profile.title')}</h1>

      <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
        {/* 头像上传 */}
        <div className="flex items-center space-x-4">
          <div className="relative">
            <img
            src={avatarPreview || (user?.avatar_url ? `${import.meta.env.DEV ? '' : import.meta.env.VITE_API_URL || 'http://localhost:3000'}${user.avatar_url}` : '/default-avatar.png')}
            alt="头像"
            className="w-24 h-24 rounded-full object-cover"
          />
            <label
              htmlFor="avatar-upload"
              className="absolute bottom-0 right-0 p-1 bg-primary text-white rounded-full cursor-pointer hover:bg-primary/90"
            >
              <Upload className="w-4 h-4" />
              <input
                id="avatar-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </label>
          </div>
          <div>
            <h3 className="font-medium">{user?.email}</h3>
            <p className="text-sm text-gray-500">{t('profile.change_avatar')}</p>
          </div>
        </div>

        {/* 基本信息 */}
        <div className="space-y-4">
          <div>
            <label htmlFor="nickname" className="block text-sm font-medium mb-1">
              {t('profile.nickname')}
            </label>
            <input
              type="text"
              id="nickname"
              value={form.nickname}
              onChange={(e) => setForm({ ...form, nickname: e.target.value })}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder={`${t('app.enter')} ${t('profile.nickname')}`}
            />
          </div>

          <div>
            <label htmlFor="school" className="block text-sm font-medium mb-1">
              {t('profile.school')}
            </label>
            <input
              type="text"
              id="school"
              value={form.school}
              onChange={(e) => setForm({ ...form, school: e.target.value })}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder={`${t('app.enter')} ${t('profile.school')}`}
            />
          </div>

          <div>
            <label htmlFor="class" className="block text-sm font-medium mb-1">
              {t('profile.class')}
            </label>
            <input
              type="text"
              id="class"
              value={form.class_name}
              onChange={(e) => setForm({ ...form, class_name: e.target.value })}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder={`${t('app.enter')} ${t('profile.class')}`}
            />
          </div>
        </div>

        {/* 统计信息 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 border rounded-md">
            <div className="flex items-center space-x-2 text-primary">
              <Trophy className="w-5 h-5" />
              <span className="font-medium">{t('profile.exam_score')}</span>
            </div>
            <p className="mt-2 text-2xl font-bold">85.5</p>
            <p className="text-sm text-gray-500">{t('profile.average_score')}</p>
          </div>

          <div className="p-4 border rounded-md">
            <div className="flex items-center space-x-2 text-primary">
              <Calendar className="w-5 h-5" />
              <span className="font-medium">{t('profile.exams_taken')}</span>
            </div>
            <p className="mt-2 text-2xl font-bold">12</p>
            <p className="text-sm text-gray-500">{t('profile.total_exams')}</p>
          </div>

          <div className="p-4 border rounded-md">
            <div className="flex items-center space-x-2 text-primary">
              <School className="w-5 h-5" />
              <span className="font-medium">{t('profile.knowledge_points')}</span>
            </div>
            <p className="mt-2 text-2xl font-bold">156</p>
            <p className="text-sm text-gray-500">{t('profile.mastered')}</p>
          </div>
        </div>

        {/* 保存按钮 */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="flex items-center space-x-2 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-5 h-5" />
            <span>{loading ? t('settings.saving_changes') : t('settings.save_changes')}</span>
          </button>
        </div>
      </form>
    </div>
  )
}
