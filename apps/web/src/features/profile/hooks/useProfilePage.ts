import { profileApi, type ProfileForm } from '@/shared/api/endpoints/profile'
import { useAuth } from '@/shared/contexts/AuthContext'
import { useLanguage } from '@/shared/contexts/LanguageContext'
import { App } from 'antd'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { getAbsoluteAvatarUrl, revokeObjectUrl } from '../utils/avatar'

const fields = ['nickname', 'email', 'phone', 'bio', 'school', 'class_name'] as const
const profileFields = (data: ProfileForm | null | undefined): ProfileForm =>
  Object.fromEntries(fields.map(key => [key, data?.[key] ?? '']))

export function useProfilePage() {
  const { message } = App.useApp()
  const { user, applyProfile } = useAuth()
  const { t } = useLanguage()
  const [form, setFormValue] = useState<ProfileForm>(() => profileFields(user))
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [savedAvatar, setSavedAvatar] = useState(user?.avatar_url ?? '')
  const [initialLoading, setInitialLoading] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)
  const generation = useRef(0)
  const submitLock = useRef(false)
  const editedFields = useRef(new Set<string>())
  const lastUrl = useRef('')

  useLayoutEffect(() => {
    generation.current += 1
    submitLock.current = false
    editedFields.current.clear()
    return () => { generation.current += 1 }
  }, [user?.id])

  useEffect(() => {
    let active = true
    setInitialLoading(true)
    setError(null)
    setSaveError(null)
    setLoading(false)
    setAvatarFile(null)
    setPreviewUrl('')
    revokeObjectUrl(lastUrl.current)
    lastUrl.current = ''
    void profileApi.get().then(result => {
      if (!active) return
      if (!result.success || !result.data) throw new Error(('error' in result ? result.error : '') || '个人资料加载失败，请重试')
      const data = profileFields(result.data)
      setFormValue(previous => Object.fromEntries(fields.map(key => [key, editedFields.current.has(key) ? previous[key] : data[key]])))
      setSavedAvatar(result.data.avatar_url || result.data.avatar || '')
    }).catch(error => {
      if (active) setError(error instanceof Error ? error.message : '个人资料加载失败，请重试')
    }).finally(() => { if (active) setInitialLoading(false) })
    return () => { active = false }
  }, [user?.id, retry])

  useEffect(() => () => revokeObjectUrl(lastUrl.current), [])
  const setForm = useCallback((patch: Partial<ProfileForm>) => {
    for (const key of Object.keys(patch)) editedFields.current.add(key)
    setFormValue(previous => ({ ...previous, ...patch }))
    setSaveError(null)
  }, [])

  const onAvatarPick = (file: File) => {
    if (loading || initialLoading) return
    if (!/^image\//.test(file.type)) { message.error(t('profile.image_only')); return }
    if (file.size > 5 * 1024 * 1024) { message.error(t('profile.image_too_large')); return }
    revokeObjectUrl(lastUrl.current)
    lastUrl.current = URL.createObjectURL(file)
    setAvatarFile(file)
    setPreviewUrl(lastUrl.current)
    setSaveError(null)
  }

  const submit = async () => {
    if (submitLock.current || initialLoading || error || !user?.id) return
    const payload = Object.fromEntries(fields.map(key => [key, form[key]?.trim() ?? ''])) as ProfileForm
    if (!payload.nickname || payload.nickname.length > 50) { setSaveError('昵称需为 1–50 个字符'); return }
    if (!payload.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) { setSaveError('请输入有效的邮箱地址'); return }
    if (payload.phone && (payload.phone.length < 3 || payload.phone.length > 30)) { setSaveError('联系电话需为 3–30 个字符，或留空'); return }
    const version = generation.current
    submitLock.current = true
    setLoading(true)
    setSaveError(null)
    let profileSaved = false
    try {
      const result = await profileApi.update(payload)
      if (version !== generation.current) return
      if (!result.success || !result.data) throw new Error(('error' in result ? result.error : '') || '资料保存失败，请重试')
      profileSaved = true
      const data = profileFields(result.data)
      setFormValue(data)
      applyProfile(user.id, { ...data, avatar_url: result.data.avatar_url || result.data.avatar || savedAvatar })
      if (avatarFile) {
        const fd = new FormData()
        fd.append('avatar', avatarFile)
        const uploaded = await profileApi.uploadAvatar(fd)
        if (version !== generation.current) return
        if (!uploaded.success || !uploaded.data) throw new Error(('error' in uploaded ? uploaded.error : '') || '头像上传失败')
        const avatar = uploaded.data.avatar_url || uploaded.data.avatar
        if (!avatar) throw new Error('头像上传结果不完整，请重试')
        setSavedAvatar(avatar)
        applyProfile(user.id, { avatar_url: avatar })
        setAvatarFile(null)
        setPreviewUrl('')
        revokeObjectUrl(lastUrl.current)
        lastUrl.current = ''
      }
      message.success(t('profile.update_success'))
    } catch (error) {
      if (version !== generation.current) return
      const detail = error instanceof Error ? error.message : '保存失败，请重试'
      setSaveError(profileSaved ? `个人资料已保存，头像尚未保存：${detail}。已保留所选图片，请重试。` : detail)
    } finally {
      if (version === generation.current) { submitLock.current = false; setLoading(false) }
    }
  }

  return { t, user, form, setForm, avatarSrc: previewUrl || getAbsoluteAvatarUrl(savedAvatar || user?.avatar_url) || '/default-avatar.png',
    onAvatarPick, initialLoading, loading, error, saveError, retry: () => setRetry(value => value + 1), submit }
}
