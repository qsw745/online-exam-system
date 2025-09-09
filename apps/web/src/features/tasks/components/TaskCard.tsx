// src/features/tasks/components/TaskCard.tsx
import React from 'react'
import { Button, Card, Space, Tag, Typography } from 'antd'
import { Calendar } from 'lucide-react'
import StatusTag from './StatusTag'
import type { Task } from '@/shared/types/tasks'

const { Title, Text } = Typography

export const TaskCard: React.FC<{
  task: Task
  onStart: (task: Task) => void
}> = ({ task, onStart }) => {
  const canStart = (() => {
    if (task.status !== 'not_started') return false
    const now = new Date()
    const s = task.start_time ? new Date(task.start_time) : undefined
    const e = task.end_time ? new Date(task.end_time) : undefined
    if (s && now < s) return false
    if (e && now > e) return false
    return true
  })()

  return (
    <Card>
      <Space style={{ width: '100%' }} align="start">
        <div style={{ flex: 1 }}>
          <Space wrap style={{ marginBottom: 8 }}>
            <Title level={4} style={{ margin: 0 }}>
              {task.title}
            </Title>
            <Tag color={task.type === 'exam' ? 'red' : 'blue'}>{task.type === 'exam' ? '考试' : '练习'}</Tag>
            <StatusTag status={task.status} />
          </Space>

          {task.description ? (
            <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
              {task.description}
            </Text>
          ) : null}

          <Space direction="vertical" size="small">
            {task.start_time && (
              <Space>
                <Calendar size={16} />
                <Text type="secondary">开始：{new Date(task.start_time).toLocaleString('zh-CN')}</Text>
              </Space>
            )}
            {task.end_time && (
              <Space>
                <Calendar size={16} />
                <Text type="secondary">结束：{new Date(task.end_time).toLocaleString('zh-CN')}</Text>
              </Space>
            )}
          </Space>
        </div>

        <div>
          {canStart ? (
            <Button type="primary" onClick={() => onStart(task)}>
              开始{task.type === 'exam' ? '考试' : '练习'}
            </Button>
          ) : (
            <Button disabled>
              <StatusTag status={task.status} />
            </Button>
          )}
        </div>
      </Space>
    </Card>
  )
}

export default TaskCard
