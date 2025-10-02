import React from 'react'
import { Button, Result } from 'antd'

export default function ServerError500() {
  return (
    <Result
      status="500"
      title="500"
      subTitle="抱歉，服务器发生错误。"
      extra={
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <a
            href="/"
            onClick={e => {
              e.preventDefault()
              window.location.assign('/') // 不依赖 React Router
            }}
          >
            <Button type="primary">返回首页</Button>
          </a>
          <Button onClick={() => window.location.reload()}>刷新页面</Button>
        </div>
      }
    />
  )
}
