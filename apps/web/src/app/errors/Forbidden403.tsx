// src/pages/errors/Forbidden403.tsx
import { Button, Result } from 'antd'
import { useNavigate } from 'react-router-dom'
import { translate } from '@/shared/utils/i18n'

export default function Forbidden403() {
  const nav = useNavigate()
  return (
    <Result
      status="403"
      title="403"
      subTitle={translate('visible.52d79fd215')}
      extra={
        <Button type="primary" onClick={() => nav('/dashboard')}>
          {translate('app.home')}</Button>
      }
    />
  )
}
