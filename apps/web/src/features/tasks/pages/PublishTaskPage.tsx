// features/tasks/pages/PublishTaskPage.tsx
import { Breadcrumb, Card, Space, App } from 'antd'
import React, { useMemo, useState } from 'react'
import { PublishTaskForm } from '../components/PublishTaskForm'
import { UsersTable } from '../../users/components/UsersTable'
import { useUsersQuery } from '../../users/hooks/useUsersQuery'
import { tasksService } from '../services/tasks.service'

const PublishTaskPage: React.FC = () => {
  const { message } = App.useApp()
  const { rows: users, total, loading, page, pageSize, setPage, setPageSize, refetch } = useUsersQuery()
  const [submitting, setSubmitting] = useState(false)
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])

  const options = useMemo(() => users.map(u => ({ label: `${u.username}（${u.email}）`, value: u.id })), [users])

  const onSubmit = async (payload: any) => {
    try {
      setSubmitting(true)
      // 若表单没选 assignees，则用表格勾选
      if ((!payload.assigned_user_ids || payload.assigned_user_ids.length === 0) && selectedRowKeys.length) {
        payload.assigned_user_ids = selectedRowKeys as number[]
      }
      await tasksService.create(payload)
      message.success('发布成功')
      setSelectedRowKeys([])
      refetch()
    } catch (e: any) {
      console.error(e)
      message.error(e?.message || '发布失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Breadcrumb items={[{ title: '任务管理', href: '/tasks' }, { title: '发布任务' }]} />

      <Card title="发布任务" variant="outlined">
        <PublishTaskForm usersForSelect={options} loading={submitting} onSubmit={onSubmit} />
      </Card>

      <Card title="可选用户（从这里勾选也可）" variant="outlined">
        <UsersTable
          data={users}
          loading={loading}
          selectedRowKeys={selectedRowKeys}
          onSelectChange={setSelectedRowKeys}
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={(p, ps) => {
            setPage(p)
            setPageSize(ps)
          }}
        />
      </Card>
    </Space>
  )
}
export default PublishTaskPage
