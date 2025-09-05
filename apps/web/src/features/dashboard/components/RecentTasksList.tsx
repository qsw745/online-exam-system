import { Card, Empty, List, Space, Tag, Typography } from 'antd'
import { BookmarkPlus, Calendar } from 'lucide-react'
import React from 'react'
import type { Task } from '../types'
import dayjs from '@shared/utils/dayjs'
import { Link } from 'react-router-dom'

const { Text } = Typography

export const RecentTasksList: React.FC<{
  title: string
  viewAllText: string
  emptyText: string
  tasks: Task[]
  locale: 'zh-CN' | 'en-US'
  label: { start: string; exam: string; practice: string }
}> = ({ title, viewAllText, emptyText, tasks, locale, label }) => {
  const getStatusTagColor = (status: string) =>
    ((
      {
        not_started: 'default',
        in_progress: 'processing',
        completed: 'success',
        expired: 'error',
      } as const
    )[status as any] || 'default')

  const getTaskTypeText = (type: string) => (type === 'exam' ? label.exam : label.practice)

  return (
    <Card
      title={title}
      extra={
        <Link to="/tasks" style={{ color: '#1890ff' }}>
          {viewAllText}
        </Link>
      }
    >
      {tasks.length > 0 ? (
        <List
          dataSource={tasks}
          renderItem={task => (
            <List.Item>
              <List.Item.Meta
                title={<Text strong>{task.title}</Text>}
                description={
                  <Space>
                    <Calendar style={{ width: 14, height: 14 }} />
                    <Text type="secondary">
                      {label.start}: {dayjs(task.start_time).locale(locale).format('YYYY/MM/DD HH:mm')}
                    </Text>
                  </Space>
                }
              />
              <Space>
                <Tag color={task.type === 'exam' ? 'red' : 'blue'}>{getTaskTypeText(task.type)}</Tag>
                <Tag color={getStatusTagColor(task.status)}>{task.status}</Tag>
              </Space>
            </List.Item>
          )}
        />
      ) : (
        <Empty image={<BookmarkPlus style={{ width: 48, height: 48, color: '#d9d9d9' }} />} description={emptyText} />
      )}
    </Card>
  )
}
