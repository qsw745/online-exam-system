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
import dayjs from 'dayjs'
import React, { useEffect, useState } from 'react'
import * as apiModule from '../../lib/api'
import { isSuccess, type ApiFailure } from '../../lib/api'

interface PublishForm {
  title: string
  description?: string
  type?: 'exam' | 'practice'
  start_time?: any
  end_time?: any
  assignees?: number[]
}

interface User {
  id: number
  username: string
  email: string
  status: string
  created_at: string
}

const PublishTaskPage: React.FC = () => {
  const { message: antdMsg } = App.useApp()
  const [form] = Form.useForm<PublishForm>()
  const [submitting, setSubmitting] = useState(false)

  // 选择用户
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
      const resp = await apiModule.users.getAll({ page, limit: pageSize })
      if (isSuccess(resp)) {
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
      } else {
        antdMsg.error((resp as ApiFailure).error || '加载用户失败')
        setUsers([])
        setTotal(0)
      }
    } catch (e: any) {
      console.error(e)
      antdMsg.error(e?.response?.data?.message || '加载用户失败')
      setUsers([])
      setTotal(0)
    } finally {
      setUserLoading(false)
    }
  }

  const publishTask = async (values: PublishForm) => {
    try {
      setSubmitting(true)
      // ✅ 修改为：
      const payload = {
        title: values.title,
        description: values.description ?? '',
        type: values.type ?? 'exam',
        start_time: values.start_time ? values.start_time.toISOString() : undefined,
        end_time: values.end_time ? values.end_time.toISOString() : undefined,
        assigned_user_ids: (values.assignees ?? []).length ? values.assignees : (selectedRowKeys as number[]),
      }

      // ✅ 实际调用后端发布接口
      const resp = await apiModule.tasks.create(payload)
      if (isSuccess(resp)) {
        antdMsg.success('发布成功')
        form.resetFields()
        setSelectedRowKeys([])
      } else {
        antdMsg.error((resp as ApiFailure).error || '发布失败')
      }
    } catch (e: any) {
      console.error(e)
      antdMsg.error(e?.response?.data?.message || '发布失败')
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

      {/* 用 variant="outlined" 代替 bordered */}
      <Card title="发布任务" variant="outlined">
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

      <Card title="可选用户（从这里勾选也可）" variant="outlined">
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
