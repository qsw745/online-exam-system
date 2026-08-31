import { Alert, App, Button, Card, Form, Input, List, Modal, Space, Typography } from 'antd'
import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { accountDeletionApi, type DeletionPreview } from '@/shared/api/endpoints/accountDeletion'
import { useAuth } from '@/shared/contexts/AuthContext'

const { Paragraph, Text, Title } = Typography

export default function AccountDeletionCard() {
  const { message } = App.useApp()
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [form] = Form.useForm<{ password: string; confirmationPhrase: string }>()
  const [open, setOpen] = useState(false)
  const [preview, setPreview] = useState<DeletionPreview | null>(null)
  const [loading, setLoading] = useState(false)

  const showPreview = async () => {
    setLoading(true)
    try {
      const result = await accountDeletionApi.preview()
      if (!result.success) throw new Error(result.error)
      setPreview(result.data)
      setOpen(true)
    } catch (error: any) {
      message.error(error?.message || '暂时无法读取注销说明')
    } finally {
      setLoading(false)
    }
  }

  const submit = async (values: { password: string; confirmationPhrase: string }) => {
    setLoading(true)
    try {
      const result = await accountDeletionApi.request(values)
      if (!result.success) throw new Error(result.error)
      form.resetFields()
      setOpen(false)
      await signOut()
      navigate('/account-deletion', {
        replace: true,
        state: { requested: result.data, email: user?.email },
      })
    } catch (error: any) {
      message.error(error?.message || '注销申请提交失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Card>
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Title level={4} style={{ margin: 0 }}>账号注销</Title>
          <Paragraph type="secondary" style={{ margin: 0 }}>
            提交后账号会进入待删除状态并退出所有设备。系统将在宽限期后清理或匿名化可删除数据；依法需要的最小范围记录可能继续保留。
          </Paragraph>
          <Button danger icon={<Trash2 size={18} />} loading={loading} onClick={showPreview}>
            查看注销范围并申请
          </Button>
        </Space>
      </Card>

      <Modal
        open={open}
        title="申请注销问衡账号"
        footer={null}
        destroyOnHidden
        maskClosable={false}
        onCancel={() => {
          form.resetFields()
          setOpen(false)
        }}
      >
        {preview && (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Alert type="warning" showIcon message={preview.disclaimer} />
            <div>
              <Text strong>将删除或匿名化</Text>
              <List size="small" dataSource={preview.deleteOrAnonymize} renderItem={item => <List.Item>{item}</List.Item>} />
            </div>
            <div>
              <Text strong>可能依法限期保留</Text>
              <List size="small" dataSource={preview.conditionalRetention} renderItem={item => <List.Item>{item}</List.Item>} />
            </div>
            <Text>预计宽限期：{preview.graceDays} 天</Text>

            <Form form={form} layout="vertical" onFinish={submit}>
              <Form.Item
                name="password"
                label="重新输入当前账号密码"
                rules={[{ required: true, message: '请输入当前密码' }]}
              >
                <Input.Password autoComplete="current-password" />
              </Form.Item>
              <Form.Item
                name="confirmationPhrase"
                label={<>请输入确认词：<Text code>{preview.confirmationPhrase}</Text></>}
                rules={[
                  { required: true, message: '请输入完整确认词' },
                  { validator: (_, value) => value === preview.confirmationPhrase
                    ? Promise.resolve()
                    : Promise.reject(new Error('确认词必须完全一致')) },
                ]}
              >
                <Input autoComplete="off" />
              </Form.Item>
              <Button danger type="primary" htmlType="submit" block loading={loading}>
                提交注销申请并退出所有设备
              </Button>
            </Form>
          </Space>
        )}
      </Modal>
    </>
  )
}
