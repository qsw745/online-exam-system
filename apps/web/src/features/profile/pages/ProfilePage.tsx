// features/profile/pages/ProfilePage.tsx
import { App, Alert, Button, Card, Space, Spin, Typography } from 'antd'
import { Save } from 'lucide-react'
import AvatarUploader from '../components/AvatarUploader'
import ProfileForm from '../components/ProfileForm'
import ProfileStats from '../components/ProfileStats'
import FaceLoginCard from '../components/FaceLoginCard'
import { useProfilePage } from '../hooks/useProfilePage'
import { resolveAppTarget } from '@/platform/appTarget'
import { resolveAuthCapabilities } from '@/features/auth/mobileAuthCapabilities'
import AccountDeletionCard from '../components/AccountDeletionCard'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/shared/contexts/AuthContext'
const { Title } = Typography

const authCapabilities = resolveAuthCapabilities(resolveAppTarget(import.meta.env.VITE_APP_TARGET))

export default function ProfilePage() {
  const { user } = useAuth()
  return <ProfilePageContent key={user?.id} />
}

function ProfilePageContent() {
  const { t, user, form, setForm, avatarSrc, onAvatarPick, loading, initialLoading, error, saveError, retry, submit } = useProfilePage()
  const navigate = useNavigate()
  const { signOut } = useAuth()
  const { modal, message } = App.useApp()

  return (
    <App>
      <Space className="student-profile-page" direction="vertical" size="large" style={{ width: '100%', margin: '0 auto' }}>
        <Title level={2}>{t('profile.title')}</Title>
        {user?.role === 'student' && <div className="student-profile-links">
          <Button onClick={() => navigate('/results')}>我的成绩</Button>
          <Button onClick={() => navigate('/settings')}>应用设置</Button>
          <Button onClick={() => modal.confirm({
            title: '退出当前账号？',
            content: '退出后需要重新登录，已提交的学习记录会保留。',
            okText: '退出登录',
            cancelText: '取消',
            onOk: async () => {
              try {
                await signOut()
                navigate('/login', { replace: true })
              } catch {
                message.error('退出失败，请稍后重试')
                throw new Error('退出失败')
              }
            },
          })}>退出登录</Button>
        </div>}

        {error && <Alert type="error" showIcon message="个人资料暂时无法显示" description={error} action={<Button onClick={retry}>重试</Button>} />}
        <Card>
          <Spin spinning={initialLoading}>
          <AvatarUploader
            src={avatarSrc}
            onPick={onAvatarPick}
            disabled={initialLoading || loading || !!error}
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
            onChange={setForm}
            disabled={initialLoading || loading || !!error}
          />

          </Spin>
          {saveError && <Alert type="error" showIcon message={saveError} style={{ marginBottom: 16 }} />}

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button type="primary" loading={loading} disabled={initialLoading || !!error} icon={<Save style={{ width: 20, height: 20 }} />} onClick={submit}>
              {loading ? t('settings.saving_changes') : t('settings.save_changes')}
            </Button>
          </div>
        </Card>

        <ProfileStats key={user?.id} t={t} />
        {authCapabilities.faceLogin && <FaceLoginCard />}
        <AccountDeletionCard />
      </Space>
    </App>
  )
}
