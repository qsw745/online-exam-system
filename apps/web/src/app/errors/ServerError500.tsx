// src/pages/errors/ServerError500.tsx
import { Button, Result } from 'antd'
import { useNavigate } from 'react-router-dom'

export default function ServerError500() {
  const nav = useNavigate()
  return (
    <Result
      status="500"
      title="500"
      subTitle="抱歉，服务器出错了。"
      extra={
        <Button type="primary" onClick={() => nav('/dashboard')}>
          返回首页
        </Button>
      }
    />
  )
}
