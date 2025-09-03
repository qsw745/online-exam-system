import { EyeOutlined, PauseOutlined, SendOutlined } from '@ant-design/icons'
import {
  App,
  Breadcrumb,
  Button,
  Card,
  Col,
  DatePicker,
  Form,
  Input,
  Pagination,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as apiModule from '../../lib/api'

const { Paragraph, Text } = Typography

type TaskStatus = 'not_started' | 'in_progress' | 'completed' | 'expired' | 'pending' | 'published' | 'unpublished'

interface AssignedUser {
  id: number
  username: string
  email: string
}

interface Task {
  id: string
  title: string
  description: string
  start_time: string
  end_time: string
  status: TaskStatus
  type?: 'exam' | 'practice'
  exam_id?: number
  created_at: string
  updated_at: string
  // ✅ 后端已组装好的分配用户数组
  assigned_users?: AssignedUser[]
}

const statusLabel: Record<TaskStatus, string> = {
  not_started: '待开始',
  pending: '待开始',
  in_progress: '进行中',
  completed: '已完成',
  expired: '已过期',
  published: '已发布',
  unpublished: '已下线',
}

const statusColor: Record<TaskStatus, 'default' | 'processing' | 'success' | 'error' | 'warning'> = {
  not_started: 'default',
  pending: 'default',
  in_progress: 'processing',
  completed: 'success',
  expired: 'error',
  published: 'processing',
  unpublished: 'warning',
}

const MyTasksPage: React.FC = () => {
  const { message } = App.useApp()
  const navigate = useNavigate()

  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<Task[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize])

  const fetchData = async () => {
    try {
      setLoading(true)
      const values = form.getFieldsValue()
      const params: any = {
        page,
        limit: pageSize,
        search: values.keyword || undefined,
        status: values.status && values.status !== 'all' ? values.status : undefined,
      }
      if (values.range?.length === 2) {
        params.start_from = values.range[0].startOf('day').toISOString()
        params.end_to = values.range[1].endOf('day').toISOString()
      }

      const resp = await apiModule.tasks.list(params)
      if (resp.success) {
        const payload: any = resp.data
        if (Array.isArray(payload?.tasks)) {
          setData(payload.tasks)
          setTotal(payload?.pagination?.total ?? payload?.total ?? payload.tasks.length)
        } else if (Array.isArray(payload)) {
          setData(payload)
          setTotal(payload.length)
        } else if (Array.isArray(payload?.data)) {
          setData(payload.data)
          setTotal(payload?.total ?? payload.data.length)
        } else {
          setData([])
          setTotal(0)
        }
      } else {
        message.error(resp.error || '加载任务失败')
        setData([])
        setTotal(0)
      }
    } catch (e: any) {
      console.error(e)
      message.error(e?.response?.data?.message || '加载任务失败')
      setData([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }

  const onSearch = () => {
    setPage(1)
    fetchData()
  }

  const onReset = () => {
    form.resetFields()
    setPage(1)
    fetchData()
  }

  // ✅ 真发布
  const publish = async (id: string) => {
    try {
      const resp = await apiModule.tasks.publish(id)
      if (resp.success) {
        message.success('任务发布成功')
        fetchData()
      } else {
        message.error(resp.error || '发布任务失败')
      }
    } catch (e: any) {
      message.error(e?.response?.data?.message || '发布任务失败')
    }
  }

  // ✅ 真下线
  const unpublish = async (id: string) => {
    try {
      const resp = await apiModule.tasks.unpublish(id)
      if (resp.success) {
        message.success('已取消发布')
        fetchData()
      } else {
        message.error(resp.error || '取消发布失败')
      }
    } catch (e: any) {
      message.error(e?.response?.data?.message || '取消发布失败')
    }
  }

  const columns: ColumnsType<Task> = useMemo(
    () => [
      {
        title: '任务',
        dataIndex: 'title',
        render: (text, record) => (
          <Space direction="vertical" size={2} style={{ maxWidth: 480 }}>
            <Paragraph style={{ margin: 0, fontWeight: 600 }} ellipsis={{ rows: 1, tooltip: text }}>
              {text}
            </Paragraph>
            <Paragraph type="secondary" style={{ margin: 0 }} ellipsis={{ rows: 2, tooltip: record.description }}>
              {record.description}
            </Paragraph>
          </Space>
        ),
      },
      {
        title: '分配用户',
        dataIndex: 'assigned_users',
        width: 240,
        render: (users?: AssignedUser[]) => {
          if (!users || users.length === 0) {
            return (
              <Space direction="vertical" size={2}>
                <Text>未知用户</Text>
                <Text type="secondary">—</Text>
              </Space>
            )
          }
          const [first, ...rest] = users
          return (
            <Space direction="vertical" size={2}>
              <Text>{first.username}</Text>
              <Text type="secondary">{first.email}</Text>
              {rest.length > 0 && <Tag>等 {rest.length + 1} 人</Tag>}
            </Space>
          )
        },
      },
      {
        title: '状态',
        dataIndex: 'status',
        width: 120,
        render: (s: TaskStatus) => <Tag color={statusColor[s]}>{statusLabel[s] || s}</Tag>,
      },
      {
        title: '开始时间',
        dataIndex: 'start_time',
        width: 180,
        render: t => (t ? dayjs(t).format('YYYY-MM-DD HH:mm') : '-'),
      },
      {
        title: '结束时间',
        dataIndex: 'end_time',
        width: 180,
        render: t => (t ? dayjs(t).format('YYYY-MM-DD HH:mm') : '-'),
      },
      {
        title: '创建时间',
        dataIndex: 'created_at',
        width: 180,
        render: t => (t ? dayjs(t).format('YYYY-MM-DD HH:mm') : '-'),
      },
      {
        title: '操作',
        key: 'action',
        fixed: 'right',
        width: 200,
        render: (_, r) => (
          <Space>
            <Tooltip title="查看详情">
              <Button type="link" icon={<EyeOutlined />} onClick={() => navigate(`/admin/task-detail/${r.id}`)}>
                详情
              </Button>
            </Tooltip>

            {r.status !== 'published' ? (
              <Tooltip title="发布任务">
                <Button type="link" icon={<SendOutlined />} onClick={() => publish(r.id)}>
                  发布
                </Button>
              </Tooltip>
            ) : (
              <Tooltip title="取消发布">
                <Button type="link" danger icon={<PauseOutlined />} onClick={() => unpublish(r.id)}>
                  下线
                </Button>
              </Tooltip>
            )}
          </Space>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [navigate]
  )

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Breadcrumb items={[{ title: '任务管理', href: '/tasks' }, { title: '我的任务' }]} />

      <Card title="我的任务" variant="outlined">
        <Form form={form} layout="vertical" onFinish={onSearch}>
          <Row gutter={16}>
            <Col xs={24} sm={12} md={8} lg={6}>
              <Form.Item name="keyword" label="关键词">
                <Input allowClear placeholder="标题 / 描述 / 用户" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8} lg={6}>
              <Form.Item name="status" label="状态" initialValue="all">
                <Select
                  options={[
                    { value: 'all', label: '全部' },
                    { value: 'not_started', label: '待开始' },
                    { value: 'in_progress', label: '进行中' },
                    { value: 'completed', label: '已完成' },
                    { value: 'expired', label: '已过期' },
                    { value: 'published', label: '已发布' },
                    { value: 'unpublished', label: '已下线' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12} lg={12}>
              <Form.Item name="range" label="时间区间">
                <DatePicker.RangePicker showTime style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Space>
            <Button type="primary" htmlType="submit">
              查询
            </Button>
            <Button onClick={onReset}>重置</Button>
          </Space>
        </Form>
      </Card>

      <Card variant="outlined">
        <Table<Task>
          rowKey="id"
          loading={loading}
          dataSource={data}
          columns={columns}
          scroll={{ x: 1000 }}
          pagination={false}
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

export default MyTasksPage
