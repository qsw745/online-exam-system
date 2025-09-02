import { PlusOutlined, SendOutlined } from '@ant-design/icons'
import {
  App,
  Breadcrumb,
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  Pagination,
  Radio,
  Select,
  Space,
  Table,
  Tag,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs, { Dayjs } from 'dayjs'
import React, { useEffect, useState } from 'react'
import { users as usersApi, tasks as tasksApi, type ApiResult, type ApiSuccess } from '../../lib/api'

interface PublishForm {
  title: string
  description?: string
  type?: 'exam' | 'practice'
  start_time?: Dayjs
  end_time?: Dayjs
  assignees?: number[] // 可选：也可以用下方表格勾选
}

interface User {
  id: number
  username: string
  email: string
  status: string
  created_at: string
}

/** 类型守卫：判断 ApiResult 是否失败结构 */
const isFailure = <T,>(r: ApiResult<T>): r is { success: false; error: string } => r.success === false

const PublishTaskPage: React.FC = () => {
  const { message } = App.useApp()
  const [form] = Form.useForm<PublishForm>()
  const [submitting, setSubmitting] = useState(false)

  // 选择用户（用下方列表作为选择器）
  const [userLoading, setUserLoading] = useState(false)
  const [users, setUsers] = useState<User[]>([])
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState(0)

  useEffect(() => {
    loadUsers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize])

  const loadUsers = async () => {
    try {
      setUserLoading(true)
      const resp = await usersApi.getAll({ page, limit: pageSize })
      if (isFailure(resp)) {
        message.error(resp.error || '加载用户失败')
        setUsers([])
        setTotal(0)
        return
      }

      // resp 是成功结构
      const payload: any = resp.data
      let rows: User[] = []
      let totalCount = 0

      if (Array.isArray(payload?.users)) {
        rows = payload.users
        totalCount = payload?.total ?? payload.users.length
      } else if (Array.isArray(payload)) {
        rows = payload
        totalCount = payload.length
      } else if (Array.isArray(payload?.data)) {
        rows = payload.data
        totalCount = payload?.total ?? payload.data.length
      }

      setUsers(rows)
      setTotal(totalCount)
    } catch (e: any) {
      console.error(e)
      message.error(e?.response?.data?.message || '加载用户失败')
      setUsers([])
      setTotal(0)
    } finally {
      setUserLoading(false)
    }
  }

  const publishTask = async (values: PublishForm) => {
    try {
      // 基本校验：开始/结束时间
      if (!values.start_time || !values.end_time) {
        message.error('请填写开始时间与结束时间')
        return
      }
      if (values.end_time.isBefore(values.start_time)) {
        message.error('结束时间必须晚于开始时间')
        return
      }

      setSubmitting(true)

      // 统一整理 payload
      const payload = {
        title: values.title.trim(),
        description: (values.description || '').trim(),
        type: values.type ?? 'exam',
        start_time: values.start_time.toISOString(),
        end_time: values.end_time.toISOString(),
        // assignees 取表单或表格勾选（优先表单）
        assignee_ids:
          (values.assignees && values.assignees.length > 0 ? values.assignees : (selectedRowKeys as number[])) || [],
      }

      // ✅ 真正调用发布接口（POST /tasks）
      const resp = await tasksApi.create(payload)
      if (isFailure(resp)) {
        message.error(resp.error || '发布失败')
        return
      }

      // 成功
      message.success('发布成功')
      form.resetFields()
      setSelectedRowKeys([])
    } catch (e: any) {
      console.error(e)
      message.error(e?.response?.data?.message || '发布失败')
    } finally {
      setSubmitting(false)
    }
  }

  const columns: ColumnsType<User> = [
    { title: '用户名', dataIndex: 'username' },
    { title: '邮箱', dataIndex: 'email' },
    {
      title: '状态',
      dataIndex: 'status',
      render: (s: string) => <Tag color={s === 'active' ? 'green' : 'red'}>{s === 'active' ? '正常' : '禁用'}</Tag>,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      render: t => (t ? dayjs(t).format('YYYY-MM-DD HH:mm') : '-'),
    },
  ]

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Breadcrumb items={[{ title: '任务管理', href: '/tasks' }, { title: '发布任务' }]} />

      <Card title="发布任务" bordered>
        <Form<PublishForm> form={form} layout="vertical" onFinish={publishTask}>
          <Form.Item
            label="任务标题"
            name="title"
            rules={[
              { required: true, message: '请输入任务标题' },
              { max: 80, message: '最多 80 字' },
            ]}
          >
            <Input placeholder="例如：期中考试 - 数学（高一）" />
          </Form.Item>

          <Form.Item label="任务描述" name="description" rules={[{ max: 500, message: '最多 500 字' }]}>
            <Input.TextArea placeholder="补充说明..." rows={3} />
          </Form.Item>

          <Space size="large" wrap>
            <Form.Item label="任务类型" name="type" initialValue="exam">
              <Radio.Group>
                <Radio.Button value="exam">考试</Radio.Button>
                <Radio.Button value="practice">练习</Radio.Button>
              </Radio.Group>
            </Form.Item>

            <Form.Item label="开始时间" name="start_time" rules={[{ required: true, message: '请选择开始时间' }]}>
              <DatePicker showTime />
            </Form.Item>

            <Form.Item label="结束时间" name="end_time" rules={[{ required: true, message: '请选择结束时间' }]}>
              <DatePicker showTime />
            </Form.Item>
          </Space>

          <Form.Item label="指定用户（可选）" name="assignees">
            <Select
              mode="multiple"
              allowClear
              placeholder="不选表示使用下方表格勾选"
              options={users.map(u => ({ label: `${u.username}（${u.email}）`, value: u.id }))}
              maxTagCount="responsive"
            />
          </Form.Item>

          <Space>
            <Button type="primary" htmlType="submit" icon={<SendOutlined />} loading={submitting}>
              发布
            </Button>
            <Button htmlType="button" icon={<PlusOutlined />} onClick={() => form.resetFields()}>
              清空
            </Button>
          </Space>
        </Form>
      </Card>

      <Card title="可选用户（从这里勾选也可）" bordered>
        <Table<User>
          rowKey="id"
          loading={userLoading}
          dataSource={users}
          columns={columns}
          pagination={false}
          rowSelection={{
            selectedRowKeys,
            onChange: keys => setSelectedRowKeys(keys),
          }}
        />
        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
          <Pagination
            current={page}
            pageSize={pageSize}
            total={total}
            showSizeChanger
            showQuickJumper
            onChange={(p, ps) => {
              setPage(p)
              setPageSize(ps)
            }}
            showTotal={(t, range) => `共 ${t} 条，当前 ${range[0]}-${range[1]}`}
          />
        </div>
      </Card>
    </Space>
  )
}

export default PublishTaskPage
