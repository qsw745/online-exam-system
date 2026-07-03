import { App, Button, Card, Form, Input, Radio, Space, Select } from 'antd'
import React, { useCallback, useEffect, useState } from 'react'
import { usersApi } from '@/shared/api/endpoints/users'
import { notificationsApi } from '@/shared/api/endpoints/notifications'
import { translate } from '@/shared/utils/i18n'

export default function BroadcastAndTestPage() {
  const [form] = Form.useForm()
  const [testForm] = Form.useForm()
  const { message } = App.useApp()
  const [userOptions, setUserOptions] = useState<Array<{ label: string; value: number }>>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [sending, setSending] = useState(false)
  const [testing, setTesting] = useState(false)

  const fetchUsers = useCallback(async (keyword = '') => {
    setLoadingUsers(true)
    try {
      const data = await usersApi.list({ page: 1, limit: 20, search: keyword || undefined })
      const options = (data.users || []).map(u => ({
        value: u.id,
        label: `${u.nickname || u.username || `用户#${u.id}`}${u.email ? `（${u.email}）` : ''}`,
      }))
      setUserOptions(options)
    } catch {
      setUserOptions([])
    } finally {
      setLoadingUsers(false)
    }
  }, [])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const handleBroadcast = async (values: { channel: string; audience: number[]; title: string; content: string }) => {
    if (!values.audience?.length) {
      message.warning(translate('auto.c87f7f31a1'))
      return
    }
    setSending(true)
    try {
      await notificationsApi.createBatch({
        user_ids: values.audience,
        title: values.title,
        content: values.content,
        type: values.channel || 'site',
      })
      message.success(translate('auto.4a5a23a919'))
      form.resetFields(['audience', 'title', 'content'])
    } catch (e: any) {
      message.error(e?.message || translate('auto.e767d34c78'))
    } finally {
      setSending(false)
    }
  }

  const handleTestSend = async (values: { userId: number; title: string; content: string }) => {
    setTesting(true)
    try {
      await notificationsApi.create({
        user_id: values.userId,
        title: values.title,
        content: values.content,
        type: 'site',
      })
      message.success(translate('auto.09b30e8054'))
      testForm.resetFields()
    } catch (e: any) {
      message.error(e?.message || translate('auto.11e6a3e332'))
    } finally {
      setTesting(false)
    }
  }

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Card title={translate('auto.b092a787c7')}>
        <Form form={form} layout="vertical" onFinish={handleBroadcast}>
          <Form.Item name="channel" label={translate('auto.c152be9f50')} initialValue="site">
            <Radio.Group>
              <Radio.Button value="site">{translate('auto.ab2bf56c23')}</Radio.Button>
              <Radio.Button value="email">{translate('menus.system-mail')}</Radio.Button>
              <Radio.Button value="sms">{translate('auto.17e1a481d8')}</Radio.Button>
              <Radio.Button value="webhook">Webhook</Radio.Button>
            </Radio.Group>
          </Form.Item>
          <Form.Item name="audience" label={translate('auto.312812248a')} rules={[{ required: true, message: translate('auto.2107df803f') }]}>
            <Select
              mode="multiple"
              placeholder={translate('auto.2b8462c7dc')}
              showSearch
              allowClear
              filterOption={false}
              options={userOptions}
              loading={loadingUsers}
              onSearch={fetchUsers}
              onDropdownVisibleChange={open => {
                if (open && !userOptions.length) fetchUsers()
              }}
            />
          </Form.Item>
          <Form.Item name="title" label={translate('papers.field_title')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="content" label={translate('auto.163aec9194')} rules={[{ required: true }]}>
            <Input.TextArea rows={6} />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={sending}>
            {translate('aiAssistant.send')}</Button>
        </Form>
      </Card>

      <Card title={translate('auto.6f339b5628')}>
        <Form form={testForm} layout="inline" onFinish={handleTestSend}>
          <Form.Item name="userId" rules={[{ required: true, message: translate('auto.e73c3e046e') }]}>
            <Select
              style={{ width: 280 }}
              placeholder={translate('auto.2b8462c7dc')}
              showSearch
              filterOption={false}
              allowClear
              options={userOptions}
              loading={loadingUsers}
              onSearch={fetchUsers}
              onDropdownVisibleChange={open => {
                if (open && !userOptions.length) fetchUsers()
              }}
            />
          </Form.Item>
          <Form.Item name="title" rules={[{ required: true }]}>
            <Input placeholder={translate('papers.field_title')} style={{ width: 220 }} />
          </Form.Item>
          <Form.Item name="content" rules={[{ required: true }]}>
            <Input placeholder={translate('auto.163aec9194')} style={{ width: 320 }} />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={testing}>
            {translate('auto.614cdaef43')}</Button>
        </Form>
      </Card>
    </Space>
  )
}
