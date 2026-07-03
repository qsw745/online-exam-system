// src/shared/components/AuthDebugger.tsx
import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { message } from 'antd'
import { translate } from '@/shared/utils/i18n'
import { formatDateTime } from '@/shared/utils/datetime'

interface AuthDebuggerProps {
  onClose: () => void
}

const AuthDebugger: React.FC<AuthDebuggerProps> = ({ onClose }) => {
  const { user, loading: authLoading, signIn } = useAuth()
  const [debugInfo, setDebugInfo] = useState<any>(null)
  const [isLoggingIn, setIsLoggingIn] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token')
    const userRole = localStorage.getItem('userRole') || sessionStorage.getItem('userRole')

    let tokenInfo: any = null
    if (token) {
      try {
        const base64Url = token.split('.')[1]
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
        const jsonPayload = decodeURIComponent(
          atob(base64)
            .split('')
            .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
            .join('')
        )
        const payload = JSON.parse(jsonPayload)
        const expirationTime = payload.exp * 1000
        const isExpired = Date.now() >= expirationTime
        tokenInfo = {
          payload,
          isExpired,
          expiresAt: formatDateTime(expirationTime),
        }
      } catch (err: any) {
        tokenInfo = { error: err?.message || '解析失败' }
      }
    }

    setDebugInfo({
      authLoading,
      user: user ? { id: user.id, email: user.email, role: user.role } : null,
      token: token ? 'exists' : 'missing',
      userRole,
      tokenInfo,
    })
  }, [authLoading, user])

  const handleClearAuth = () => {
    localStorage.removeItem('token')
    sessionStorage.removeItem('token')
    localStorage.removeItem('userRole')
    sessionStorage.removeItem('userRole')
    localStorage.removeItem('rememberedEmail')
    message.success(translate('auto.5ca18f899f'))
    setTimeout(() => {
      window.location.reload()
    }, 1000)
  }

  const handleQuickLogin = async () => {
    setIsLoggingIn(true)
    try {
      await signIn('admin@demo.com', 'demo123456', true)
      message.success(translate('auto.2991317aba'))
      onClose()
    } catch (error: any) {
      message.error(error?.message || translate('auto.aeb6c8a818'))
    } finally {
      setIsLoggingIn(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">{translate('auto.bb69a8d5ec')}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <div className="bg-blue-50 p-4 rounded">
            <h3 className="font-semibold mb-2">{translate('auto.18455c0fcd')}</h3>
            <div className="text-sm space-y-1">
              <div>
                <strong>{translate('auto.d5a20230a4')}</strong> admin@demo.com / demo123456
              </div>
              <div>
                <strong>{translate('auto.64aa8b6ff4')}</strong> teacher@demo.com / demo123456
              </div>
              <div>
                <strong>{translate('auto.1f59687651')}</strong> student@demo.com / demo123456
              </div>
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded">
            <h3 className="font-semibold mb-2">{translate('auto.62ac59c7f7')}</h3>
            <pre className="text-sm bg-white p-2 rounded border overflow-x-auto">
              {JSON.stringify(debugInfo, null, 2)}
            </pre>
          </div>

          <div className="flex space-x-2">
            <button
              onClick={handleQuickLogin}
              disabled={isLoggingIn}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            >
              {isLoggingIn ? translate('visible.ec507ddfa7') : translate('visible.48775d3202')}
            </button>

            <button onClick={handleClearAuth} className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600">
              {translate('auto.3ed1804327')}</button>

            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              {translate('auto.5a5a7a890c')}</button>
          </div>

          <div className="text-sm text-gray-600">
            <p>
              <strong>{translate('auto.132accd7e0')}</strong>
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>{translate('auto.24ca641571')}</li>
              <li>{translate('auto.4838ec457b')}</li>
              <li>{translate('auto.83f12db31f')}</li>
              <li>{translate('auto.333732fcc3')}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AuthDebugger
