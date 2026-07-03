import React from 'react'
import { Card, Descriptions, Space, Tag, Typography, Button } from 'antd'
import dayjs from '@/shared/utils/dayjs'
import StatusTag from './StatusTag'
import type { Task } from '@/shared/types/tasks'
import { isStartableStatus, getTaskStatusLabel } from '../constants/taskStatus'
import { translate } from '@/shared/utils/i18n'
import { formatDateTime } from '@/shared/utils/datetime'

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
        {translate('app.loading')}</Card>
    )
  }
  if (!task) {
    return <Card variant="outlined">{translate('auto.4459e7acb5')}</Card>
  }

  const assigned: any[] = (task as any).assigned_users ?? (task as any).assignedUsers ?? []

  // ✅ “可开始”支持 published；时间窗口仍需满足
  const canStart = (() => {
    const now = new Date()
    const s = task.start_time ? new Date(task.start_time) : undefined
    const e = task.end_time ? new Date(task.end_time) : undefined
    if (s && now < s) return false
    if (e && now > e) return false
    return isStartableStatus(task.status as any)
  })()

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Title level={3} style={{ margin: 0 }}>
        {translate('menus.tasks-detail')}</Title>

      <Card
        title={task.title || '—'}
        extra={
          <Space>
            <Button onClick={onBack}>{translate('app.back')}</Button>
            {onEdit && (
              <Button type="primary" ghost onClick={() => onEdit(task)}>
                {translate('app.edit')}</Button>
            )}
            <StatusTag status={task.status as any} />
            {onStart && canStart && (
              <Button type="primary" onClick={() => onStart(task)}>
                {task.type === 'exam' ? translate('visible.d5b9caf5ec') : translate('auto.5c007a10e6')}
              </Button>
            )}
          </Space>
        }
        variant="outlined"
      >
        <Descriptions column={1} bordered size="middle">
          <Descriptions.Item label={translate('papers.desc2')}>{task.description || '-'}</Descriptions.Item>
          <Descriptions.Item label={translate('systemConfig.col_type')}>{task.type === 'exam' ? translate('nav.exams') : translate('menus.exam-practice')}</Descriptions.Item>
          <Descriptions.Item label={translate('auto.045859e792')}>{getTaskStatusLabel(task.status as any)}</Descriptions.Item>
          <Descriptions.Item label={translate('dashboard.start_time')}>
            {task.start_time ? formatDateTime(task.start_time) : '-'}
          </Descriptions.Item>
          <Descriptions.Item label={translate('auto.a0bb9f49ab')}>
            {task.end_time ? formatDateTime(task.end_time) : '-'}
          </Descriptions.Item>
          <Descriptions.Item label={translate('auto.d0d2d98257')}>
            {(task as any).exam_id ?? (task as any).examId ?? '-'}
          </Descriptions.Item>
          <Descriptions.Item label={translate('users.columns.created_at')}>
            {task.created_at ? formatDateTime(task.created_at) : '-'}
          </Descriptions.Item>
          <Descriptions.Item label={translate('papers.col_updated_at')}>
            {task.updated_at ? formatDateTime(task.updated_at) : '-'}
          </Descriptions.Item>
          <Descriptions.Item label={translate('auto.a07cd49a64')}>
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
