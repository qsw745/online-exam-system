import React from 'react'
import { Button, Card, Space, Tag, Typography } from 'antd'
import { Calendar } from 'lucide-react'
import StatusTag from './StatusTag'
import type { Task } from '../hooks/useTasksQuery'
import { getStudentTaskAction } from '../constants/studentTaskAction'
import { translate } from '@/shared/utils/i18n'
import { formatDateTime } from '@/shared/utils/datetime'

const { Title, Text } = Typography

function fmt(t?: string | number | Date | null) {
  return t ? formatDateTime(t) : '-'
}

export const TaskCard: React.FC<{
  task: Task
  onStart: (task: Task) => void
  onView?: (task: Task) => void
  loading?: boolean
}> = ({ task, onStart, onView, loading }) => {
  const action = getStudentTaskAction(task)

  return (
    <Card className="student-task-card" loading={!!loading}>
      <Space className="student-task-card__layout" style={{ width: '100%' }} align="start">
        <div style={{ flex: 1 }}>
          <Space wrap style={{ marginBottom: 8 }}>
            <Title level={4} style={{ margin: 0 }}>
              {task.title}
            </Title>
            <Tag color={task.type === 'exam' ? 'red' : 'blue'}>{task.type === 'exam' ? translate('nav.exams') : translate('menus.exam-practice')}</Tag>
            <StatusTag status={action.visibleStatus} />
          </Space>

          {task.description ? (
            <Text className="student-task-card__description" type="secondary" style={{ marginBottom: 16 }}>
              {task.description}
            </Text>
          ) : null}

          <Space direction="vertical" size="small">
            {task.start_time && (
              <Space>
                <Calendar size={16} />
                <Text type="secondary">{translate('auto.76a0ba5c77')}{fmt(task.start_time)}</Text>
              </Space>
            )}
            {task.end_time && (
              <Space>
                <Calendar size={16} />
                <Text type="secondary">{translate('auto.75090948a1')}{fmt(task.end_time)}</Text>
              </Space>
            )}
          </Space>
        </div>

        <div className="student-task-card__action">
          <Button type="primary" disabled={action.disabled} onClick={() => onStart(task)}>
            {action.label}
          </Button>
          {action.reason && <Text type="secondary" className="student-task-card__action-reason">{action.reason}</Text>}
          {onView && <Button onClick={() => onView(task)}>查看详情</Button>}
        </div>
      </Space>
    </Card>
  )
}

export default TaskCard
