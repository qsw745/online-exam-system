// features/tasks/components/TaskCard.tsx
import { Button, Card, Space, Tag, Typography } from 'antd'
import React from 'react'
import { STATUS_COLOR, STATUS_LABEL } from '../constants'
import { Calendar } from 'lucide-react'

const { Title, Text } = Typography

export const TaskCard: React.FC<{
  task: any
  onStart: (task: any) => void
}> = ({ task, onStart }) => {
  const canStart = (() => {
    const now = new Date()
    const s = new Date(task.start_time)
    const e = new Date(task.end_time)
    return task.status === 'not_started' && now >= s && now <= e
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
            <Tag color={STATUS_COLOR[task.status]}>{STATUS_LABEL[task.status] || task.status}</Tag>
          </Space>
          <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
            {task.description}
          </Text>
          <Space direction="vertical" size="small">
            <Space>
              <Calendar size={16} />
              <Text type="secondary">开始：{new Date(task.start_time).toLocaleString('zh-CN')}</Text>
            </Space>
            <Space>
              <Calendar size={16} />
              <Text type="secondary">结束：{new Date(task.end_time).toLocaleString('zh-CN')}</Text>
            </Space>
          </Space>
        </div>
        <div>
          {canStart ? (
            <Button type="primary" onClick={() => onStart(task)}>
              开始{task.type === 'exam' ? '考试' : '练习'}
            </Button>
          ) : (
            <Button disabled>{STATUS_LABEL[task.status] || '不可开始'}</Button>
          )}
        </div>
      </Space>
    </Card>
  )
}
