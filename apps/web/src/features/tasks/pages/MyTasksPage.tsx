// features/tasks/pages/MyTasksPage.tsx
import { Breadcrumb, Card, Pagination, Space } from 'antd'
import React from 'react'
import { useNavigate } from 'react-router-dom'
import { FilterBar } from '../components/FilterBar'
import { TasksTable } from '../components/TasksTable'
import { useTasksQuery } from '../hooks/useTasksQuery'
import { tasksService } from '../services/tasks.service'

const MyTasksPage: React.FC = () => {
  const nav = useNavigate()
  const { rows, total, page, pageSize, setPage, setPageSize, loading, filters, search, reset, refetch } =
    useTasksQuery()

  const handlePublish = async (id: string) => {
    await tasksService.publish(id)
    refetch()
  }
  const handleUnpublish = async (id: string) => {
    await tasksService.unpublish(id)
    refetch()
  }

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Breadcrumb items={[{ title: '任务管理', href: '/tasks' }, { title: '我的任务' }]} />

      <Card title="我的任务" variant="outlined">
        <FilterBar value={filters} onSearch={search} onReset={reset} />
      </Card>

      <Card variant="outlined">
        <TasksTable
          data={rows}
          loading={loading}
          onView={id => nav(`/admin/task-detail/${id}`)}
          onPublish={handlePublish}
          onUnpublish={handleUnpublish}
        />
        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
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
        </div>
      </Card>
    </Space>
  )
}
export default MyTasksPage
