import type { UserDTO } from '@/shared/api/http'
import type { CreateNotificationForm } from '@/shared/hooks/useNotifications'
import { Button, Checkbox, Form, Input, Modal, Select, Space } from 'antd'
import { Send } from 'lucide-react'
import AttachmentUploader from './AttachmentUploader'
import { translate } from '@/shared/utils/i18n'
const { TextArea } = Input
const { Option } = Select

export default function NotificationFormModal({
  open,
  onClose,
  form,
  users,
  editing,
  onSubmit,
}: {
  open: boolean
  onClose: () => void
  form: any
  users: UserDTO[]
  editing: any
  onSubmit: (v: CreateNotificationForm) => void
}) {
  return (
    <Modal
      maskClosable={false}
      title={editing ? translate('visible.72c7b22318') : translate('visible.8d99406bb7')}
      open={open}
      onCancel={onClose}
      footer={null}
      width={600}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={onSubmit}
        initialValues={{ type: 'info', send_to_all: false, attachments: [] }}
      >
        <Form.Item name="title" label={translate('auto.8947e58a24')} rules={[{ required: true, message: translate('auto.20adc1f6a1') }]}>
          <Input placeholder={translate('auto.20adc1f6a1')} />
        </Form.Item>
        <Form.Item name="content" label={translate('auto.4ae73120bb')} rules={[{ required: true, message: translate('auto.d0a35bee13') }]}>
          <TextArea rows={4} placeholder={translate('auto.d0a35bee13')} showCount maxLength={500} />
        </Form.Item>
        <Form.Item name="type" label={translate('auto.1cf9ae8f64')} rules={[{ required: true, message: translate('auto.a66c882c58') }]}> 
          <Select placeholder={translate('auto.a66c882c58')}>
            <Option value="info">{translate('auto.2da40f4073')}</Option>
            <Option value="success">{translate('auto.51991a5d11')}</Option>
            <Option value="warning">{translate('auto.5521e368d8')}</Option>
            <Option value="error">{translate('questions.tf_false')}</Option>
          </Select>
        </Form.Item>

        <Form.Item name="attachments" label={translate('auto.99f6fe6c41')}>
          <AttachmentUploader />
        </Form.Item>

        {/* 编辑时不展示分发范围（只改内容与类型） */}
        {!editing && (
          <>
            <Form.Item name="send_to_all" valuePropName="checked">
              <Checkbox>{translate('auto.9bef7ccca9')}</Checkbox>
            </Form.Item>
            <Form.Item noStyle shouldUpdate={(p, c) => p.send_to_all !== c.send_to_all}>
              {({ getFieldValue }) => {
                const sendAll = getFieldValue('send_to_all')
                return sendAll ? (
                  <Form.Item name="role_filter" label={translate('auto.63907d452d')}>
                    <Select placeholder={translate('auto.a81a34ed70')} allowClear>
                      <Option value="admin">{translate('auth.demo_admin')}</Option>
                      <Option value="teacher">{translate('auth.demo_teacher')}</Option>
                      <Option value="student">{translate('auth.demo_student')}</Option>
                    </Select>
                  </Form.Item>
                ) : (
                  <Form.Item name="user_ids" label={translate('auto.2f35bf7f1e')} rules={[{ required: true, message: translate('auto.e73c3e046e') }]}>
                    <Select mode="multiple" placeholder={translate('auto.4392ab8c4a')} showSearch optionFilterProp="children">
                      {users.map(u => {
                        const displayName =
                          (u as any).real_name ??
                          (u as any).nickname ??
                          u.username ??
                          (u.email ? u.email.split('@')[0] : translate('users.tag.user'))
                        return (
                          <Option key={u.id} value={u.id}>
                            {displayName}（{u.role}）
                          </Option>
                        )
                      })}
                    </Select>
                  </Form.Item>
                )
              }}
            </Form.Item>
          </>
        )}

        <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
          <Space>
            <Button onClick={onClose}>{translate('app.cancel')}</Button>
            <Button type="primary" htmlType="submit" icon={<Send style={{ width: 16, height: 16 }} />}>
              {editing ? translate('visible.d9db02d07a') : translate('aiAssistant.send')}
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  )
}
