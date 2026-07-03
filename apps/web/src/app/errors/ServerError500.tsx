import React from 'react'
import { Button, Result } from 'antd'
import { withAppBasePath } from '@/shared/router/basePath'
import { translate } from '@/shared/utils/i18n'

export default function ServerError500() {
  return (
    <Result
      status="500"
      title="500"
      subTitle={translate('visible.ec037f8d9b')}
      extra={
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <a
            href={withAppBasePath('/dashboard')}
            onClick={e => {
              e.preventDefault()
              window.location.assign(withAppBasePath('/dashboard')) // 不依赖 React Router
            }}
          >
            <Button type="primary">{translate('app.home')}</Button>
          </a>
          <Button onClick={() => window.location.reload()}>{translate('auto.5a5a7a890c')}</Button>
        </div>
      }
    />
  )
}
