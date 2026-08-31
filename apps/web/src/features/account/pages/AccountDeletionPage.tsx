import { Alert, App, Button, Card, Form, Input, Space, Typography } from 'antd'
import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { accountDeletionApi, type DeletionStatus } from '@/shared/api/endpoints/accountDeletion'
import BrandMark from '@/shared/components/BrandMark'

const { Paragraph, Text, Title } = Typography

export default function AccountDeletionPage() {
  const { message } = App.useApp()
  const location = useLocation()
  const navigate = useNavigate()
  const initial = (location.state as any)?.requested as DeletionStatus | undefined
  const initialEmail = String((location.state as any)?.email || '')
  const [status, setStatus] = useState<DeletionStatus | undefined>(initial)
  const [loading, setLoading] = useState(false)
  const [form] = Form.useForm<{ email: string; password: string }>()

  const run = async (kind: 'status' | 'cancel', values: { email: string; password: string }) => {
    setLoading(true)
    try {
      const result = kind === 'status'
        ? await accountDeletionApi.status(values)
        : await accountDeletionApi.cancel(values)
      if (!result.success) throw new Error(result.error)
      setStatus(result.data)
      if (kind === 'cancel') {
        message.success('注销申请已取消，请重新登录')
        navigate('/login', { replace: true })
      }
    } catch (error: any) {
      message.error(error?.message || '操作失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main style={{ minHeight: '100vh', padding: 'max(24px, env(safe-area-inset-top)) 16px', background: '#f5f7fb' }}>
      <Card style={{ maxWidth: 560, margin: '0 auto', borderRadius: 20 }}>
        <Space direction="vertical" size={20} style={{ width: '100%' }}>
          <Space><BrandMark size={44} /><Title level={2} style={{ margin: 0 }}>账号注销状态</Title></Space>

          {status?.status === 'PENDING' && (
            <Alert
              type="warning"
              showIcon
              message="注销申请已提交，账号尚未完成物理删除"
              description={status.scheduledFor ? `计划处理时间：${new Date(status.scheduledFor).toLocaleString()}` : undefined}
            />
          )}
          {status?.status === 'CANCELLED' && <Alert type="success" showIcon message="注销申请已取消" />}
          {status?.status === 'COMPLETED' && <Alert type="success" showIcon message="注销流程已完成" />}
          {status?.status === 'NOT_REQUESTED' && <Alert type="info" showIcon message="该账号没有注销申请" />}

          <Paragraph type="secondary">
            为保护账号安全，查询或取消均需重新验证邮箱和密码。此页面不会保存密码。
          </Paragraph>
          <Form
            form={form}
            layout="vertical"
            initialValues={{ email: initialEmail, password: '' }}
            onFinish={values => run('status', values)}
          >
            <Form.Item name="email" label="账号邮箱" rules={[{ required: true }, { type: 'email' }]}>
              <Input autoComplete="username" />
            </Form.Item>
            <Form.Item name="password" label="账号密码" rules={[{ required: true }]}>
              <Input.Password autoComplete="current-password" />
            </Form.Item>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Button htmlType="submit" block loading={loading}>查询最新状态</Button>
              {status?.status === 'PENDING' && (
                <Button
                  danger
                  block
                  loading={loading}
                  onClick={async () => {
                    try {
                      await run('cancel', await form.validateFields())
                    } catch {
                      // 表单会在字段旁展示错误。
                    }
                  }}
                >
                  取消注销申请
                </Button>
              )}
            </Space>
          </Form>
          <Text type="secondary">需要重新使用问衡？ <Link to="/login">返回登录</Link></Text>
        </Space>
      </Card>
    </main>
  )
}
