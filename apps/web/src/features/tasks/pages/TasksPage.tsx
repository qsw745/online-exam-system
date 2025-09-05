// features/tasks/pages/TasksPage.tsx
import React from 'react'
import { Card, Empty, Pagination, Select, Space, Input, Typography } from 'antd'
import { useNavigate } from 'react-router-dom'
import { TaskCard } from '../components/TaskCard'
import { useTasksQuery } from '../hooks/useTasksQuery'

const { Title, Text } = Typography

const TasksPage: React.FC = () => {
  const nav = useNavigate()
  const { rows, total, page, pageSize, setPage, loading, filters, search } = useTasksQuery(10)

  const onStart = (task: any) => {
    if (task.type === 'exam' && task.exam_id) nav(`/exam/${task.id}`)
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card>
        <Title level={2} style={{ margin: 0 }}>
          我的任务
        </Title>
        <Text type="secondary">查看和管理您的考试和练习任务</Text>
      </Card>

      <Card>
        <Space wrap style={{ width: '100%' }}>
          <Input
            placeholder="搜索任务..."
            style={{ width: 300 }}
            allowClear
            onChange={e => search({ ...filters, keyword: e.target.value })}
          />
          <Select
            value={filters.status ?? 'all'}
            onChange={v => search({ ...filters, status: v })}
            style={{ width: 120 }}
          >
            <Select.Option value="all">所有状态</Select.Option>
            <Select.Option value="not_started">待开始</Select.Option>
            <Select.Option value="in_progress">进行中</Select.Option>
            <Select.Option value="completed">已完成</Select.Option>
            <Select.Option value="expired">已过期</Select.Option>
          </Select>
          <Select
            value={(filters as any).type ?? 'all'}
            onChange={v => search({ ...filters, type: v })}
            style={{ width: 120 }}
          >
            <Select.Option value="all">所有类型</Select.Option>
            <Select.Option value="exam">考试</Select.Option>
            <Select.Option value="practice">练习</Select.Option>
          </Select>
        </Space>
      </Card>

      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        {rows.map(t => (
          <TaskCard key={t.id} task={t} onStart={onStart} />
        ))}
        {!rows.length && <Empty description="暂无任务" />}
      </Space>

      {total > 0 && (
        <Card>
          <Pagination current={page} pageSize={pageSize} total={total} onChange={p => setPage(p)} />
        </Card>
      )}
    </Space>
  )
}
export default TasksPage
