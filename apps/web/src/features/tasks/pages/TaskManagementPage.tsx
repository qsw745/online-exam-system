// features/tasks/pages/TaskManagementPage.tsx
import React from 'react'
import { Breadcrumb, Card, Pagination, Space, App } from 'antd'
import { useNavigate } from 'react-router-dom'
import { FilterBar } from '../components/FilterBar'
import { TaskTable } from '../components/TaskTable'
import { useTasksQuery } from '../hooks/useTasksQuery'
import { tasksService } from '../services/tasks.service'

const TaskManagementPage: React.FC = () => {
  const { message } = App.useApp()
  const nav = useNavigate()
  const { rows, total, page, pageSize, setPage, setPageSize, loading, filters, search, reset, refetch } =
    useTasksQuery()

  const onDelete = async (id: string) => {
    await tasksService.delete(id)
    message.success('删除成功')
    refetch()
  }
  const onPublish = async (id: string) => {
    await tasksService.publish(id)
    message.success('发布成功')
    refetch()
  }
  const onUnpublish = async (id: string) => {
    await tasksService.unpublish(id)
    message.success('已下线')
    refetch()
  }

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Breadcrumb items={[{ title: '任务管理' }]} />
      <Card title="任务管理" variant="outlined">
        <FilterBar value={filters} onSearch={search} onReset={reset} />
      </Card>
      <Card variant="outlined">
        <TaskTable
          data={rows}
          loading={loading}
          onView={id => nav(`/admin/task-detail/${id}`)}
          onEdit={id => nav(`/admin/task-edit/${id}`)}
          onDelete={onDelete}
          onPublish={onPublish}
          onUnpublish={onUnpublish}
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
export default TaskManagementPage
