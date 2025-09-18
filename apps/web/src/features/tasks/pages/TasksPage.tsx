import React from 'react'
import { Card, Empty, Pagination, Select, Space, Input, Typography } from 'antd'
import { useNavigate } from 'react-router-dom'
import { TaskCard } from '../components/TaskCard'
import { useTasksQuery, type Task } from '../hooks/useTasksQuery'

const { Title, Text } = Typography

const TasksPage: React.FC = () => {
  const nav = useNavigate()
  const { rows, total, page, pageSize, setPage, setPageSize, loading, filters, search } = useTasksQuery(10, {
    scope: 'mine',
  })

  const onStart = (task: Task) => {
    if (task.type === 'exam') {
      if (!task.exam_id) return
      nav(`/exam/${task.exam_id}`) // ★ 关键：考试用 exam_id
    } else {
      nav(`/practice/${task.id}`)
    }
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card>
        <Title level={2} style={{ margin: 0 }}>
          我的任务
        </Title>
        <Text type="secondary">查看和完成分配给您的考试与练习</Text>
      </Card>

      <Card>
        <Space wrap style={{ width: '100%' }}>
          <Input
            placeholder="搜索任务..."
            style={{ width: 300 }}
            allowClear
            defaultValue={filters.keyword}
            onChange={e => search({ ...filters, keyword: e.target.value || undefined })}
          />
          <Select
            value={filters.status ?? 'all'}
            onChange={v => search({ ...filters, status: v })}
            style={{ width: 140 }}
            options={[
              { value: 'all', label: '所有状态' },
              { value: 'not_started', label: '待开始' },
              { value: 'published', label: '已发布' },
              { value: 'in_progress', label: '进行中' },
              { value: 'completed', label: '已完成' },
              { value: 'expired', label: '已过期' },
            ]}
          />
          <Select
            value={(filters as any).type ?? 'all'}
            onChange={v => search({ ...filters, type: v as any })}
            style={{ width: 140 }}
            options={[
              { value: 'all', label: '所有类型' },
              { value: 'exam', label: '考试' },
              { value: 'practice', label: '练习' },
            ]}
          />
        </Space>
      </Card>

      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        {rows.map(t => (
          <TaskCard key={t.id} task={t} onStart={onStart} loading={loading} />
        ))}
        {!rows.length && !loading && <Empty description="暂无任务" />}
      </Space>

      {total > 0 && (
        <Card>
          <Pagination
            current={page}
            pageSize={pageSize}
            total={total}
            showSizeChanger
            showQuickJumper
            onChange={(p, ps) => {
              setPage(p)
              setPageSize(ps)
            }}
            showTotal={(t, r) => `共 ${t} 条，当前 ${r[0]}-${r[1]}`}
          />
        </Card>
      )}
    </Space>
  )
}

export default TasksPage
