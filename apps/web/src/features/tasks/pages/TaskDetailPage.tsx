// apps/web/src/pages/tasks/TaskDetailPage.tsx
import { Card, Descriptions, Space, Tag, Typography } from 'antd'
import dayjs from 'dayjs'
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import * as api from '@shared/api/http'

const { Title } = Typography

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [loading, setLoading] = useState(true)
  const [task, setTask] = useState<any>(null)

  useEffect(() => {
    ;(async () => {
      if (!id) return
      setLoading(true)
      const resp = await api.tasks.getById(id)
      if (resp.success) {
        const d = (resp.data as any)?.task ?? resp.data
        setTask(d)
      }
      setLoading(false)
    })()
  }, [id])

  if (!task) {
    return (
      <Card loading={loading} variant="outlined">
        加载中...
      </Card>
    )
  }

  const labelMap: any = {
    not_started: '待开始',
    in_progress: '进行中',
    completed: '已完成',
    expired: '已过期',
    published: '已发布',
    unpublished: '已下线',
  }
  const colorMap: any = {
    not_started: 'default',
    in_progress: 'processing',
    completed: 'success',
    expired: 'error',
    published: 'processing',
    unpublished: 'warning',
  }

  const assigned = task.assigned_users || []

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Title level={3} style={{ margin: 0 }}>
        任务详情
      </Title>

      <Card
        title={task.title}
        extra={<Tag color={colorMap[task.status]}>{labelMap[task.status] || task.status}</Tag>}
        variant="outlined"
      >
        <Descriptions column={1} bordered size="middle">
          <Descriptions.Item label="描述">{task.description || '-'}</Descriptions.Item>
          <Descriptions.Item label="类型">{task.type === 'exam' ? '考试' : '练习'}</Descriptions.Item>
          <Descriptions.Item label="开始时间">
            {task.start_time ? dayjs(task.start_time).format('YYYY-MM-DD HH:mm') : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="结束时间">
            {task.end_time ? dayjs(task.end_time).format('YYYY-MM-DD HH:mm') : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="关联考试ID">{task.exam_id ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="创建时间">
            {task.created_at ? dayjs(task.created_at).format('YYYY-MM-DD HH:mm') : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="更新时间">
            {task.updated_at ? dayjs(task.updated_at).format('YYYY-MM-DD HH:mm') : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="分配用户">
            <Space wrap>
              {assigned.length
                ? assigned.map((u: any) => (
                    <Tag key={u.id}>
                      {u.username}（{u.email}）
                    </Tag>
                  ))
                : '-'}
            </Space>
          </Descriptions.Item>
        </Descriptions>
      </Card>
    </Space>
  )
}
