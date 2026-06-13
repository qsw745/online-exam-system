// features/profile/pages/ProfilePage.tsx
import { App, Button, Card, Space, Typography } from 'antd'
import { Save } from 'lucide-react'
import AvatarUploader from '../components/AvatarUploader'
import ProfileForm from '../components/ProfileForm'
import ProfileStats from '../components/ProfileStats'
import { useProfilePage } from '../hooks/useProfilePage'
const { Title } = Typography

export default function ProfilePage() {
  const { t, user, form, setForm, avatarSrc, onAvatarPick, loading, submit } = useProfilePage()

  return (
    <App>
      <Space direction="vertical" size="large" style={{ width: '100%', margin: '0 auto', padding: 24 }}>
        <Title level={2}>{t('profile.title')}</Title>

        <Card>
          <AvatarUploader
            src={avatarSrc}
            onPick={onAvatarPick}
            email={user?.email}
            subtitle={t('profile.change_avatar')}
          />

          <ProfileForm
            value={{
              ...form,
              nickname: form.nickname ?? '',
              email: form.email ?? '',
              phone: form.phone ?? '',
              bio: form.bio ?? '',
            }}
            onChange={patch => setForm({ ...form, ...patch })}
          />

          <ProfileStats t={t} />

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button type="primary" loading={loading} icon={<Save style={{ width: 20, height: 20 }} />} onClick={submit}>
              {loading ? t('settings.saving_changes') : t('settings.save_changes')}
            </Button>
          </div>
        </Card>
      </Space>
    </App>
  )
}
