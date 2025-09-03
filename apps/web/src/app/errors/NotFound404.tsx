// src/pages/errors/NotFound404.tsx
import { Button, Result } from 'antd'
import { useNavigate } from 'react-router-dom'

export default function NotFound404() {
  const nav = useNavigate()
  return (
    <Result
      status="404"
      title="404"
      subTitle="页面不存在或已被移除。"
      extra={
        <Button type="primary" onClick={() => nav('/dashboard')}>
          返回首页
        </Button>
      }
    />
  )
}
