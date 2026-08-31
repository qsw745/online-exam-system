import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { LoginForm } from './LoginForm'

vi.mock('@/shared/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}))

const noop = () => undefined

describe('LoginForm', () => {
  it('iOS 能关闭尚未接入原生审核流程的人脸登录入口', () => {
    render(
      <MemoryRouter>
        <LoginForm
          email=""
          password=""
          rememberMe={false}
          keep7Days={false}
          loading={false}
          faceLoginLoading={false}
          submitDisabled={false}
          inputsDisabled={false}
          isLocked={false}
          lockCountdownText="00:00"
          lockTryRemainSec={0}
          lockRetryCountdownText="00:00"
          captchaRequired={false}
          captcha=""
          onCaptchaChange={noop}
          onRefreshCaptcha={noop}
          onEmailChange={noop}
          onPasswordChange={noop}
          onRememberChange={noop}
          onKeep7DaysChange={noop}
          onSubmit={noop}
          onFaceLogin={noop}
          showFaceLogin={false}
        />
      </MemoryRouter>,
    )

    expect(screen.queryByText('auth.face_login')).not.toBeInTheDocument()
  })
})
