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
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as apiModule from '../../lib/api'

type TaskStatus = 'not_started' | 'in_progress' | 'completed' | 'expired' | 'pending'

interface Task {
  id: string
  title: string
  description: string
  start_time: string
  end_time: string
  status: TaskStatus
  type?: 'exam' | 'practice'
  exam_id?: number
  username?: string
  email?: string
  created_at: string
  updated_at: string
}

const statusLabel: Record<TaskStatus, string> = {
  not_started: '待开始',
  pending: '待开始',
  in_progress: '进行中',
  completed: '已完成',
  expired: '已过期',
}

const statusColor: Record<TaskStatus, string> = {
  not_started: 'default',
  pending: 'default',
  in_progress: 'processing',
  completed: 'success',
  expired: 'error',
}

const MyTasksPage: React.FC = () => {
  const { message } = App.useApp()
  const navigate = useNavigate()

  // 查询与分页
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<Task[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  useEffect(() => {
    // 初始查询
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
        // 兼容不同返回结构
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

  // 操作：发布/取消发布（演示，按需接后端）
  const publish = async (id: string) => {
    try {
      message.success('任务发布成功（示例）')
      fetchData()
    } catch (e: any) {
      message.error(e?.response?.data?.message || '发布任务失败')
    }
  }

  const unpublish = async (id: string) => {
    try {
      message.success('已取消发布（示例）')
      fetchData()
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
          <Space direction="vertical" size={2}>
            <span style={{ fontWeight: 600 }}>{text}</span>
            <span style={{ color: '#8c8c8c' }}>{record.description}</span>
          </Space>
        ),
      },
      {
        title: '分配用户',
        dataIndex: 'username',
        width: 200,
        render: (_, r) => (
          <Space direction="vertical" size={2}>
            <span>{r.username || '未知用户'}</span>
            <span style={{ color: '#8c8c8c' }}>{r.email}</span>
          </Space>
        ),
      },
      {
        title: '状态',
        dataIndex: 'status',
        width: 120,
        render: (s: TaskStatus) => <Tag color={statusColor[s]}>{statusLabel[s]}</Tag>,
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
        width: 180,
        render: (_, r) => (
          <Space>
            <Tooltip title="查看详情">
              <Button type="link" icon={<EyeOutlined />} onClick={() => navigate(`/admin/task-detail/${r.id}`)} />
            </Tooltip>
            {r.status === 'not_started' ? (
              <Tooltip title="发布任务">
                <Button type="link" icon={<SendOutlined />} onClick={() => publish(r.id)} />
              </Tooltip>
            ) : r.status === 'in_progress' ? (
              <Tooltip title="取消发布">
                <Button type="link" danger icon={<PauseOutlined />} onClick={() => unpublish(r.id)} />
              </Tooltip>
            ) : null}
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
      <Card title="我的任务" bordered>
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

      <Card bordered>
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
