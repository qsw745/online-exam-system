// features/tasks/pages/TaskCreatePage.tsx
import React, { useMemo, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { App, Card, Space } from 'antd'
import { TaskForm } from '../components/TaskForm'
import { useTaskById } from '../hooks/useTaskById'
import { tasksApi } from '@/shared/api/endpoints/tasks'

const TaskCreatePage: React.FC = () => {
  const { message } = App.useApp()
  const nav = useNavigate()
  const { id } = useParams<{ id?: string }>()
  const loc = useLocation()
  const mode: 'create' | 'edit' | 'view' = id ? (loc.pathname.includes('/task-detail/') ? 'view' : 'edit') : 'create'

  const { loading, task } = useTaskById(id)
  const [submitting, setSubmitting] = useState(false)

  const initial = useMemo(() => {
    if (!task) return undefined
    return {
      title: task.title,
      description: task.description,
      status: task.status,
      type: task.type,
      exam_id: task.exam_id?.toString(),
      start_time: task.start_time,
      end_time: task.end_time,
      assigned_user_ids: (task.assigned_users ?? []).map((u: any) => String(u.id)),
    }
  }, [task])

  const submit = async (payload: any) => {
    try {
      setSubmitting(true)
      if (mode === 'edit' && id) await tasksApi.update(id, payload)
      else await tasksApi.create(payload)
      message.success(mode === 'edit' ? '更新成功' : '创建成功')
      // ★ 创建/更新后进入“发布任务”
      nav('/admin/tasks/public', { replace: true })
    } catch (e: any) {
      message.error(e?.message || '保存失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card title={mode === 'view' ? '查看任务' : mode === 'edit' ? '编辑任务' : '创建任务'} variant="outlined">
        <TaskForm readOnly={mode === 'view'} initial={initial as any} submitting={submitting} onSubmit={submit} />
      </Card>
    </Space>
  )
}
export default TaskCreatePage
