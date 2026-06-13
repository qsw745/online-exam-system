import React from 'react'
import { Button, Card, Space, Tag, Typography, Tooltip } from 'antd'
import { Calendar } from 'lucide-react'
import StatusTag from './StatusTag'
import type { Task } from '../hooks/useTasksQuery'
import dayjs from '@/shared/utils/dayjs'

const { Title, Text } = Typography

function fmt(t?: string | number | Date | null) {
  return t ? dayjs(t).format('YYYY-MM-DD HH:mm') : '-'
}

function canStart(task: Task) {
  // 允许开始的几种状态（与后端对齐）
  const allowed = new Set(['not_started', 'published', 'in_progress'])
  if (!allowed.has(task.status)) return { ok: false, reason: '状态不允许开始' }

  const now = dayjs()
  const s = task.start_time ? dayjs(task.start_time) : null
  const e = task.end_time ? dayjs(task.end_time) : null
  if (s && now.isBefore(s)) return { ok: false, reason: '未到开始时间' }
  if (e && !now.isBefore(e)) return { ok: false, reason: '已过截止时间' }

  if (task.type === 'exam' && !task.exam_id) return { ok: false, reason: '缺少考试ID' }
  return { ok: true }
}

function startLabel(t?: Task['type']) {
  return t === 'exam' ? '开始考试' : '开始练习'
}

export const TaskCard: React.FC<{
  task: Task
  onStart: (task: Task) => void
  loading?: boolean
}> = ({ task, onStart, loading }) => {
  const check = canStart(task)

  return (
    <Card loading={!!loading}>
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
                <Text type="secondary">开始：{fmt(task.start_time)}</Text>
              </Space>
            )}
            {task.end_time && (
              <Space>
                <Calendar size={16} />
                <Text type="secondary">结束：{fmt(task.end_time)}</Text>
              </Space>
            )}
          </Space>
        </div>

        <div>
          {check.ok ? (
            <Button type="primary" onClick={() => onStart(task)}>
              {startLabel(task.type)}
            </Button>
          ) : (
            <Tooltip title={check.reason}>
              <Button disabled>{startLabel(task.type)}</Button>
            </Tooltip>
          )}
        </div>
      </Space>
    </Card>
  )
}

export default TaskCard
