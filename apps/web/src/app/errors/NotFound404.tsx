// src/pages/errors/NotFound404.tsx
import { Button, Result } from 'antd'
import { useNavigate } from 'react-router-dom'
import { translate } from '@/shared/utils/i18n'

export default function NotFound404() {
  const nav = useNavigate()
  return (
    <Result
      status="404"
      title="404"
      subTitle={translate('visible.dbb45aade3')}
      extra={
        <Button type="primary" onClick={() => nav('/dashboard')}>
          {translate('app.home')}</Button>
      }
    />
  )
}
