// apps/web/src/features/dashboard/components/RecentTasksList.tsx
import { Button, Card, Empty, List, Space, Tag, Typography } from 'antd'
import { BookmarkPlus, Calendar, Play } from 'lucide-react'
import React from 'react'
import { Link } from 'react-router-dom'
import dayjs from '@/shared/utils/dayjs'
import { translate } from '@/shared/utils/i18n'
import { formatDateTime } from '@/shared/utils/datetime'

const { Text } = Typography

type UiStatus = 'not_started' | 'in_progress' | 'completed' | 'expired'
type TaskType = 'exam' | 'practice' | (string & {})

export interface RecentTask {
  id: number | string
  title: string
  start_time?: string | null
  type: TaskType
  status: UiStatus | string
}

type Props = {
  title: string
  viewAllText: string
  emptyText: string
  tasks: RecentTask[]
  locale: 'zh-CN' | 'en-US'
  label: { start: string; exam: string; practice: string }
  onStartTask?: (task: RecentTask) => void
}

const STATUS_TAG_COLORS: Record<UiStatus, 'default' | 'processing' | 'success' | 'error'> = {
  not_started: 'default',
  in_progress: 'processing',
  completed: 'success',
  expired: 'error',
}

const STATUS_LABELS: Record<UiStatus, string> = {
  not_started: '未开始',
  in_progress: '进行中',
  completed: '已完成',
  expired: '已过期',
}

function toUiStatus(s: string): UiStatus {
  if (s === 'not_started' || s === 'in_progress' || s === 'completed' || s === 'expired') return s
  if (s === 'published') return 'in_progress'
  if (s === 'unpublished' || s === 'draft') return 'not_started'
  return 'not_started'
}

const canStartStatus = (status: UiStatus) => status === 'not_started' || status === 'in_progress'

export const RecentTasksList: React.FC<Props> = ({
  title,
  viewAllText,
  emptyText,
  tasks,
  locale,
  label,
  onStartTask,
}) => {
  const getTaskTypeText = (type: TaskType) => (type === 'exam' ? label.exam : label.practice)

  return (
    <Card
      title={title}
      extra={
        <Link to="/tasks/my" style={{ color: '#1890ff' }}>
          {viewAllText}
        </Link>
      }
    >
      {tasks.length > 0 ? (
        <List
          dataSource={tasks}
          renderItem={task => {
            const ui = toUiStatus(String(task.status))
            let start = '-'
            if (task.start_time) {
              const d = dayjs(task.start_time)
              if (d.isValid()) start = formatDateTime(task.start_time) || '-'
            }
            const clickable = Boolean(onStartTask)
            const canStart = onStartTask && canStartStatus(ui)
            return (
              <List.Item
                actions={
                  onStartTask
                    ? [
                        <Button
                          type="link"
                          size="small"
                          key="start"
                          icon={<Play style={{ width: 14, height: 14 }} />}
                          onClick={e => {
                            e.preventDefault()
                            e.stopPropagation()
                            if (canStart) onStartTask(task)
                          }}
                          disabled={!canStart}
                        >
                          {task.type === 'exam' ? translate('visible.d5b9caf5ec') : translate('auto.5c007a10e6')}
                        </Button>,
                      ]
                    : undefined
                }
              >
                <List.Item.Meta
                  title={
                    <Text
                      strong
                      style={{ cursor: clickable ? 'pointer' : 'default' }}
                      onClick={clickable ? () => onStartTask?.(task) : undefined}
                    >
                      {task.title}
                    </Text>
                  }
                  description={
                    <Space>
                      <Calendar style={{ width: 14, height: 14 }} />
                      <Text type="secondary">
                        {label.start}: {start}
                      </Text>
                    </Space>
                  }
                />
                <Space>
                  <Tag color={task.type === 'exam' ? 'red' : 'blue'}>{getTaskTypeText(task.type)}</Tag>
                  <Tag color={STATUS_TAG_COLORS[ui]}>{STATUS_LABELS[ui]}</Tag>
                </Space>
              </List.Item>
            )
          }}
        />
      ) : (
        <Empty image={<BookmarkPlus style={{ width: 48, height: 48, color: '#d9d9d9' }} />} description={emptyText} />
      )}
    </Card>
  )
}

export default RecentTasksList
