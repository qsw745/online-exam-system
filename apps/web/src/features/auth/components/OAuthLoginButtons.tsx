import { GithubOutlined, GoogleOutlined } from '@ant-design/icons'
import { Alert, Button, Divider, Space } from 'antd'
import { useEffect, useState } from 'react'
import { auth } from '@/shared/api/endpoints/auth'
import { useLanguage } from '@/shared/contexts/LanguageContext'

type Provider = 'github' | 'google'
type ProviderState = Record<Provider, boolean>

type Props = {
  keep7Days: boolean
  disabled?: boolean
}

const defaults: ProviderState = { github: false, google: false }

export function OAuthLoginButtons({ keep7Days, disabled }: Props) {
  const { t } = useLanguage()
  const [providers, setProviders] = useState<ProviderState>(defaults)
  const [loadingProvider, setLoadingProvider] = useState<Provider | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    auth
      .oauthProviders()
      .then((res: any) => {
        const list = res?.data?.providers ?? res?.providers ?? []
        const next = { ...defaults }
        for (const item of list) {
          if ((item?.provider === 'github' || item?.provider === 'google') && item?.enabled) {
            next[item.provider as Provider] = true
          }
        }
        if (alive) setProviders(next)
      })
      .catch(() => {
        if (alive) setProviders(defaults)
      })
    return () => {
      alive = false
    }
  }, [])

  const enabledProviders = (Object.keys(providers) as Provider[]).filter(provider => providers[provider])
  if (enabledProviders.length === 0) return null

  const start = (provider: Provider) => {
    setError('')
    setLoadingProvider(provider)
    try {
      window.location.assign(auth.oauthStartUrl(provider, { keep7Days, next: '/dashboard' }))
    } catch {
      setLoadingProvider(null)
      setError(t('auth.oauth_start_failed'))
    }
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <Divider plain>{t('auth.oauth_divider')}</Divider>
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} />}
      <Space direction="vertical" style={{ width: '100%' }} size={8}>
        {providers.github && (
          <Button
            block
            size="large"
            icon={<GithubOutlined />}
            loading={loadingProvider === 'github'}
            disabled={disabled || !!loadingProvider}
            onClick={() => start('github')}
          >
            {t('auth.login_with_github')}
          </Button>
        )}
        {providers.google && (
          <Button
            block
            size="large"
            icon={<GoogleOutlined />}
            loading={loadingProvider === 'google'}
            disabled={disabled || !!loadingProvider}
            onClick={() => start('google')}
          >
            {t('auth.login_with_google')}
          </Button>
        )}
      </Space>
    </div>
  )
}
