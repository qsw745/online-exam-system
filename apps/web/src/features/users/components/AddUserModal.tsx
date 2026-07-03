import { useOrgTree } from '@/shared/hooks'
import { App, Col, Form, Input, Modal, Row, Select, Space, Switch, TreeSelect, Typography } from 'antd'
import React from 'react'
import { useLanguage } from '@/shared/contexts/LanguageContext'
import { translate } from '@/shared/utils/i18n'

const { Text } = Typography

type Gender = '男' | '女' | '保密'

type FormValues = {
  nickname: string
  username: string
  password: string
  phone?: string
  email?: string
  gender?: Gender
  org_id?: number
  enabled?: boolean
  remark?: string
}

export type SubmitPayload = {
  nickname: string
  password: string
  phone?: string
  email?: string
  gender?: Gender
  org_id?: number
  status: 'active' | 'disabled'
  remark?: string
}

function treeToTreeSelectData(tree: any[], fallback: (node: any) => string): any[] {
  if (!Array.isArray(tree)) return []
  return tree.map((n: any) => ({
    title: n?.title ?? n?.name ?? n?.label ?? fallback(n),
    value: n?.id,
    key: n?.id,
    children: treeToTreeSelectData(n?.children || n?.nodes || [], fallback),
  }))
}

export const AddUserModal: React.FC<{
  open: boolean
  defaultOrgId?: number | null
  onCancel: () => void
  onSubmit: (payload: SubmitPayload) => Promise<void> | void
}> = ({ open, defaultOrgId, onCancel, onSubmit }) => {
  const { message } = App.useApp()
  const { t } = useLanguage()
  const [form] = Form.useForm<FormValues>()
  const { tree, loading: treeLoading, refetch } = useOrgTree()
  const formatMessage = React.useCallback(
    (template: string, vars: Record<string, string | number> = {}) =>
      template.replace(/\{(\w+)\}/g, (_, key) => (vars[key] !== undefined ? String(vars[key]) : '')),
    []
  )

  React.useEffect(() => {
    if (!open) return
    form.resetFields()
    form.setFieldsValue({
      enabled: true,
      gender: undefined,
      org_id: defaultOrgId ?? undefined,
    })
    void refetch()
  }, [open, defaultOrgId, form, refetch])

  const [submitting, setSubmitting] = React.useState(false)

  const handleOk = async () => {
    try {
      const v = await form.validateFields()
      const payload: SubmitPayload = {
        nickname: v.nickname.trim(),
        password: v.password,
        phone: v.phone?.trim() || undefined,
        email: v.email?.trim() || undefined,
        gender: v.gender || undefined,
        org_id: v.org_id || undefined,
        status: v.enabled ? 'active' : 'disabled',
        remark: v.remark?.trim() || undefined,
      }
      setSubmitting(true)
      await onSubmit(payload)
      message.success(t('users.message.create_success'))
      onCancel()
    } finally {
      setSubmitting(false)
    }
  }

  const treeData = React.useMemo(
    () => treeToTreeSelectData(tree as any, node => formatMessage(t('users.org_tree.fallback'), { id: node?.id ?? '' })),
    [tree, t, formatMessage]
  )

  return (
    <Modal
      open={open}
      title={
        <Space>
          <Text strong>{t('users.button.add')}</Text>
        </Space>
      }
      onCancel={onCancel}
      onOk={handleOk}
      okText={t('app.confirm')}
      cancelText={t('app.cancel')}
      okButtonProps={{ loading: submitting }}
      maskClosable={false}
      width={1000}
      styles={{ body: { paddingTop: 12 } }}
      destroyOnHidden
    >
      <Form<FormValues>
        form={form}
        layout="horizontal"
        labelCol={{ flex: '92px' }}
        wrapperCol={{ flex: 'auto' }}
        colon={false}
      >
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              label={t('users.form.nickname')}
              name="nickname"
              rules={[{ required: true, message: t('users.form.nickname_required') }]}
            >
              <Input placeholder={t('users.form.nickname_placeholder')} allowClear />
            </Form.Item>
          </Col>
          {/* <Col span={12}>
            <Form.Item
              label="用户名称"
              name="username"
              rules={[
                { required: true, message: '请输入用户名称' },
                { min: 3, message: '长度至少 3 个字符' },
              ]}
            >
              <Input placeholder="请输入用户名称" allowClear />
            </Form.Item>
          </Col> */}

          <Col span={12}>
            <Form.Item
              label={t('users.form.password')}
              name="password"
              rules={[
                { required: true, message: t('users.form.password_required') },
                { min: 6, message: formatMessage(t('users.form.password_min'), { count: 6 }) },
              ]}
            >
              <Input.Password placeholder={t('users.form.password_placeholder')} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label={t('users.form.phone')}
              name="phone"
              rules={[{ pattern: /^1\d{10}$/, message: t('users.form.phone_invalid') }]}
            >
              <Input placeholder={t('users.form.phone_placeholder')} allowClear />
            </Form.Item>
          </Col>

          <Col span={12}>
            <Form.Item
              label={t('users.form.email')}
              name="email"
              rules={[{ type: 'email', message: t('users.form.email_invalid') }]}
            >
              <Input placeholder={t('users.form.email_placeholder')} allowClear />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label={t('users.form.gender')} name="gender">
              <Select
                placeholder={t('users.form.gender_placeholder')}
                allowClear
                options={[
                  { label: t('users.gender.male'), value: translate('users.gender.male') },
                  { label: t('users.gender.female'), value: translate('users.gender.female') },
                  { label: t('users.gender.secret'), value: translate('users.gender.secret') },
                ]}
              />
            </Form.Item>
          </Col>

          <Col span={12}>
            <Form.Item label={t('users.form.org')} name="org_id">
              <TreeSelect
                loading={treeLoading}
                treeData={treeData}
                allowClear
                placeholder={t('users.form.org_placeholder')}
                showSearch
                treeDefaultExpandAll
                style={{ width: '100%' }}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label={t('users.form.status')} name="enabled" valuePropName="checked">
              <Space>
                <Switch />
                <Text type="success">{t('users.status.enable')}</Text>
              </Space>
            </Form.Item>
          </Col>

          <Col span={24}>
            <Form.Item label={t('users.form.remark')} name="remark">
              <Input.TextArea rows={3} placeholder={t('users.form.remark_placeholder')} allowClear />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Modal>
  )
}

export default AddUserModal
