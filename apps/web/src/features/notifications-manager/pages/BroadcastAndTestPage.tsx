import { App, Button, Card, Form, Input, Radio, Space, Select } from 'antd'
import React, { useCallback, useEffect, useState } from 'react'
import { usersApi } from '@/shared/api/endpoints/users'
import { notificationsApi } from '@/shared/api/endpoints/notifications'

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
      message.warning('请至少选择一位受众')
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
      message.success('群发已提交')
      form.resetFields(['audience', 'title', 'content'])
    } catch (e: any) {
      message.error(e?.message || '发送失败')
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
      message.success('测试消息已发送')
      testForm.resetFields()
    } catch (e: any) {
      message.error(e?.message || '测试发送失败')
    } finally {
      setTesting(false)
    }
  }

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Card title="消息群发">
        <Form form={form} layout="vertical" onFinish={handleBroadcast}>
          <Form.Item name="channel" label="渠道" initialValue="site">
            <Radio.Group>
              <Radio.Button value="site">站内信</Radio.Button>
              <Radio.Button value="email">邮件</Radio.Button>
              <Radio.Button value="sms">短信</Radio.Button>
              <Radio.Button value="webhook">Webhook</Radio.Button>
            </Radio.Group>
          </Form.Item>
          <Form.Item name="audience" label="受众" rules={[{ required: true, message: '请选择至少一位接收人' }]}>
            <Select
              mode="multiple"
              placeholder="搜索并选择用户"
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
          <Form.Item name="title" label="标题" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="content" label="内容" rules={[{ required: true }]}>
            <Input.TextArea rows={6} />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={sending}>
            发送
          </Button>
        </Form>
      </Card>

      <Card title="单人测试发送">
        <Form form={testForm} layout="inline" onFinish={handleTestSend}>
          <Form.Item name="userId" rules={[{ required: true, message: '请选择接收用户' }]}>
            <Select
              style={{ width: 280 }}
              placeholder="搜索并选择用户"
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
            <Input placeholder="标题" style={{ width: 220 }} />
          </Form.Item>
          <Form.Item name="content" rules={[{ required: true }]}>
            <Input placeholder="内容" style={{ width: 320 }} />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={testing}>
            测试发送
          </Button>
        </Form>
      </Card>
    </Space>
  )
}
