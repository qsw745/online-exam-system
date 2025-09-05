// features/tasks/components/TaskDetail.tsx
import { Card, Descriptions, Space, Tag, Typography } from 'antd'
import dayjs from 'dayjs'
import React from 'react'
import { STATUS_COLOR, STATUS_LABEL } from '../constants'
const { Title } = Typography

export const TaskDetail: React.FC<{ task: any; loading?: boolean }> = ({ task, loading }) => {
  if (loading)
    return (
      <Card loading variant="outlined">
        加载中...
      </Card>
    )

  const assigned = task.assigned_users || []
  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Title level={3} style={{ margin: 0 }}>
        任务详情
      </Title>
      <Card
        title={task.title}
        extra={<Tag color={STATUS_COLOR[task.status]}>{STATUS_LABEL[task.status] || task.status}</Tag>}
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
