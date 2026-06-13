import { Alert, Button, Card, Spin, Typography } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { auth } from '@/shared/api/endpoints/auth'
import {
  getAuthStorageFlag,
  setAccessToken,
  setAuthStorageFlag,
  type AuthStorageMode,
} from '@/shared/api/core/storage'
import { useAuth } from '@/shared/contexts/AuthContext'
import { useLanguage } from '@/shared/contexts/LanguageContext'

const { Text } = Typography

function sanitizeNext(raw: string | null) {
  const value = String(raw || '/dashboard')
    .trim()
    .replace(/\\/g, '/')
  if (!value || value.startsWith('//') || /^[a-z][a-z0-9+.-]*:/i.test(value)) return '/dashboard'
  return value.startsWith('/') ? value : `/${value}`
}

function modeFromQuery(raw: string | null): AuthStorageMode {
  return raw === '7d' || raw === 'local' || raw === 'session' ? raw : getAuthStorageFlag()
}

export default function OAuthCallbackPage() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const { reload } = useAuth()
  const [params] = useSearchParams()
  const [error, setError] = useState('')

  const next = useMemo(() => sanitizeNext(params.get('next')), [params])
  const mode = useMemo(() => modeFromQuery(params.get('mode')), [params])

  useEffect(() => {
    let alive = true
    ;(async () => {
      if (params.get('error')) {
        setError(t('auth.oauth_failed'))
        return
      }
      try {
        setAuthStorageFlag(mode)
        const res: any = await auth.refresh()
        const token = res?.data?.token ?? res?.token
        if (!token) throw new Error('missing token')
        setAccessToken(token, mode)
        await reload().catch(() => undefined)
        if (alive) navigate(next, { replace: true })
      } catch {
        if (alive) setError(t('auth.oauth_failed'))
      }
    })()
    return () => {
      alive = false
    }
  }, [mode, navigate, next, params, reload, t])

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <Card style={{ width: '100%', maxWidth: 420 }}>
        {error ? (
          <>
            <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />
            <Link to="/login">
              <Button type="primary" block>
                {t('auth.login_now')}
              </Button>
            </Link>
          </>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <Spin />
            <Text style={{ display: 'block', marginTop: 16 }}>{t('auth.oauth_finishing')}</Text>
          </div>
        )}
      </Card>
    </div>
  )
}
