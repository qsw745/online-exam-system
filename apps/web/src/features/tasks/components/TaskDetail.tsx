import React from 'react'
import { Card, Descriptions, Space, Tag, Typography, Button } from 'antd'
import dayjs from '@/shared/utils/dayjs'
import StatusTag from './StatusTag'
import type { Task } from '@/shared/types/tasks'

const { Title } = Typography

export const TaskDetail: React.FC<{
  task: Task | null
  loading?: boolean
  onStart?: (task: Task) => void
  onBack?: () => void
  onEdit?: (task: Task) => void
}> = ({ task, loading, onStart, onBack, onEdit }) => {
  if (loading) {
    return (
      <Card loading variant="outlined">
        加载中...
      </Card>
    )
  }
  if (!task) {
    return <Card variant="outlined">未找到任务</Card>
  }

  const assigned: any[] = (task as any).assigned_users ?? (task as any).assignedUsers ?? []

  const canStart = (() => {
    const now = new Date()
    const s = task.start_time ? new Date(task.start_time) : undefined
    const e = task.end_time ? new Date(task.end_time) : undefined
    if (s && now < s) return false
    if (e && now > e) return false
    return task.status === 'not_started' || task.status === 'in_progress'
  })()

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Title level={3} style={{ margin: 0 }}>
        任务详情
      </Title>

      <Card
        title={task.title || '—'}
        extra={
          <Space>
            <Button onClick={onBack}>返回</Button>
            {onEdit && (
              <Button type="primary" ghost onClick={() => onEdit(task)}>
                编辑
              </Button>
            )}
            <StatusTag status={task.status as any} />
            {onStart && canStart && (
              <Button type="primary" onClick={() => onStart(task)}>
                {task.type === 'exam' ? '进入考试' : '开始练习'}
              </Button>
            )}
          </Space>
        }
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
          <Descriptions.Item label="关联考试ID">
            {(task as any).exam_id ?? (task as any).examId ?? '-'}
          </Descriptions.Item>
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
                      {u.username || u.nickname || u.real_name || `用户${u.id}`}
                      {u.email ? `（${u.email}）` : ''}
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

export default TaskDetail
