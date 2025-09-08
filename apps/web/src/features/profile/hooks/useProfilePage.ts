// features/profile/hooks/useProfilePage.ts
import { useEffect, useMemo, useState, useRef } from 'react'
import { message } from 'antd'
import { profileApi, type ProfileForm } from '@shared/api/endpoints/profile'
import { getAbsoluteAvatarUrl, revokeObjectUrl } from '../utils/avatar'
import { useAuth } from '@shared/contexts/AuthContext'
import { useLanguage } from '@shared/contexts/LanguageContext'

export function useProfilePage() {
  const { user, ...authCtx } = useAuth()
  const { t } = useLanguage()

  // 表单
  const [form, setForm] = useState<ProfileForm>({
    nickname: user?.nickname || user?.username || '',
    school: user?.school || '',
    class_name: user?.class_name || '',
  })

  // 头像
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string>('')

  // 加载态
  const [loading, setLoading] = useState(false)

  // 同步用户更新
  useEffect(() => {
    if (!user) return
    setForm({
      nickname: user.nickname || user.username || '',
      school: user.school || '',
      class_name: user.class_name || '',
    })
  }, [user])

  // 预览 URL 释放
  const lastUrl = useRef<string>('')
  useEffect(() => {
    return () => revokeObjectUrl(lastUrl.current)
  }, [])
  const onAvatarPick = (file: File) => {
    // 简单校验
    if (!/^image\//.test(file.type)) {
      message.error(t('profile.image_only') || '仅支持图片文件')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      message.error(t('profile.image_too_large') || '图片不能超过 5MB')
      return
    }
    setAvatarFile(file)
    const url = URL.createObjectURL(file)
    revokeObjectUrl(lastUrl.current)
    lastUrl.current = url
    setPreviewUrl(url)
  }

  const avatarSrc = useMemo(() => {
    const apiBase = import.meta.env.VITE_API_URL || ''
    const raw = user?.avatar_url || ''
    const absolute = getAbsoluteAvatarUrl(raw, apiBase)
    return previewUrl || absolute || '/default-avatar.png'
  }, [previewUrl, user?.avatar_url])

  const submit = async () => {
    setLoading(true)
    try {
      // 1) 更新资料
      await profileApi.update({
        nickname: form.nickname?.trim(),
        school: form.school?.trim(),
        class_name: form.class_name?.trim(),
      })

      // 2) 上传头像（若选择了新头像）
      if (avatarFile) {
        const fd = new FormData()
        fd.append('avatar', avatarFile)
        await profileApi.uploadAvatar(fd)
      }

      // 3) 刷新用户（统一从 AuthContext 暴露方法；保留降级兼容）
      const anyCtx = authCtx as any
      if (typeof anyCtx.reload === 'function') await anyCtx.reload()
      if (typeof anyCtx.refreshUser === 'function') await anyCtx.refreshUser()

      message.success(t('profile.update_success'))
    } catch (e: any) {
      console.error('update profile error', e)
      message.error(e?.message || t('profile.update_error'))
    } finally {
      setLoading(false)
    }
  }

  return {
    t,
    user,
    form,
    setForm,
    avatarSrc,
    onAvatarPick,
    loading,
    submit,
  }
}
