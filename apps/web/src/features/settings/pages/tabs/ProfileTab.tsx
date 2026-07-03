import React, { useEffect, useState } from 'react'
import { App, Button } from 'antd'
import { Save } from 'lucide-react'
import AvatarUploader from '@/features/profile/components/AvatarUploader'
import ProfileForm, { type ProfileFormType } from '@/features/profile/components/ProfileForm'
import { useLanguage } from '@/shared/contexts/LanguageContext'
import { useAuth } from '@/shared/contexts/AuthContext'
import { api } from '@/shared/api/http'
import { profileApi } from '@/shared/api/endpoints/profile'
import { translate } from '@/shared/utils/i18n'

export default function ProfileTab() {
  const { t } = useLanguage()
  const { message } = App.useApp()
  const { user, loading } = useAuth()

  const [form, setForm] = useState<ProfileFormType | null>(null)
  const [saving, setSaving] = useState(false)
  const [initialLoading, setInitialLoading] = useState(false)

  // ① 首次进入 / 用户变化时，调用后端 /profile 拿“完整档案”
  useEffect(() => {
    if (!user?.id) return
    let alive = true
    ;(async () => {
      try {
        setInitialLoading(true)
        const resp: any = await api.get('/profile')
        const data = (resp?.data?.data ?? resp?.data ?? resp) || {}
        if (!alive) return
        setForm({
          nickname: data.nickname ?? user.nickname ?? '',
          school: data.school ?? '',
          class_name: data.class_name ?? '',
          email: data.email ?? user.email ?? '',
          phone: data.phone ?? '',
          bio: data.bio ?? '',
        })
      } catch (e) {
        // 失败时兜底用 user
        if (!form) {
          setForm({
            nickname: user.nickname ?? '',
            school: user.school ?? '',
            class_name: user.class_name ?? '',
            email: user.email ?? '',
            phone: (user as any).phone ?? '',
            bio: (user as any).bio ?? '',
          })
        }
      } finally {
        setInitialLoading(false)
      }
    })()
    return () => {
      alive = false
    }
    // 只在 user.id 变化时重新取
  }, [user?.id])

  const patchForm = (patch: Partial<ProfileFormType>) => setForm(prev => (prev ? { ...prev, ...patch } : prev))

  const handlePickAvatar = async (file: File) => {
    console.log('pick avatar:', file)
  }

  // ② 保存后，再读一次 /profile 回填，保证看到的就是后端真实数据
  const handleSave = async () => {
    if (!form) return
    try {
      setSaving(true)
      await profileApi.update(form)
      const fresh: any = await api.get('/profile')
      const d = (fresh?.data?.data ?? fresh?.data ?? fresh) || {}
      setForm({
        nickname: d.nickname ?? form.nickname ?? '',
        school: d.school ?? form.school ?? '',
        class_name: d.class_name ?? form.class_name ?? '',
        email: d.email ?? form.email ?? '',
        phone: d.phone ?? form.phone ?? '',
        bio: d.bio ?? form.bio ?? '',
      })
      message.success(translate('auto.6bb7331a78'))
    } catch (e: any) {
      console.error(e)
      message.error(e?.message || translate('roles.message.update_failed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ maxWidth: 720 }}>
      <h2 style={{ marginBottom: 16 }}>{t('profile.title') || translate('nav.profile')}</h2>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
        <AvatarUploader
          src={(user as any)?.avatar_url || (user as any)?.avatar || undefined}
          email={user?.email}
          subtitle={t('profile.avatar_tip') || translate('visible.d519557cb7')}
          onPick={handlePickAvatar}
        />
      </div>

      {!form ? (
        <div style={{ color: 'var(--app-colorTextTertiary,#999)' }}>
          {initialLoading || loading ? translate('auto.300ee3dee4') : translate('common.no_data')}
        </div>
      ) : (
        <>
          <ProfileForm value={form} onChange={patchForm} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <Button type="primary" loading={saving} icon={<Save size={18} />} onClick={handleSave}>
              {saving ? translate('visible.6644f06197') : translate('visible.8ff18db8f9')}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
