import AppBreadcrumb from '@/shared/components/AppBreadcrumb'
import { Card, Space } from 'antd'
import React, { useMemo } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { TaskForm } from '../components/TaskForm'
import { useTaskById } from '../hooks/useTaskById'
import { useTaskSubmit } from '../hooks/useTaskSubmit'
const TaskCreatePage: React.FC = () => {
  const { id } = useParams<{ id?: string }>()
  const loc = useLocation()

  const nav = useNavigate()
  // ★ 用路径判断：包含 detail/view 则视图模式，否则编辑；无 id 则创建
  const mode: 'create' | 'edit' | 'view' = !id ? 'create' : /\/(detail|view)\//.test(loc.pathname) ? 'view' : 'edit'
  const { loading, task } = useTaskById(id)
  const { submitting, submit } = useTaskSubmit({
    mode,
    id,
    onSuccess: () => nav('/admin/tasks/list', { replace: true }),
  })

  const initial = useMemo(() => {
    if (!task) return undefined
    return {
      title: task.title,
      description: task.description,
      status: task.status as any,
      type: task.type as any,
      exam_id: (task as any).exam_id ? String((task as any).exam_id) : undefined,
      paper_id: (task as any).paper_id ? String((task as any).paper_id) : undefined,
      // ★ 重要：把字符串转成 dayjs，否则 DatePicker 不可编辑/不显示
      start_time: task.start_time ? dayjs(task.start_time) : undefined,
      end_time: task.end_time ? dayjs(task.end_time) : undefined,
      assigned_user_ids: (task.assigned_users ?? []).map((u: any) => String(u.id)),
      assigned_department_ids: Array.isArray((task as any)?.assigned_departments)
        ? (task as any).assigned_departments.map((d: any) => String(d.id))
        : undefined,
    }
  }, [task])

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <AppBreadcrumb />
      <Card
        title={mode === 'view' ? '查看任务' : mode === 'edit' ? '编辑任务' : '创建任务'}
        variant="outlined"
        loading={loading}
      >
        <TaskForm readOnly={mode === 'view'} initial={initial as any} submitting={submitting} onSubmit={submit} />
      </Card>
    </Space>
  )
}
export default TaskCreatePage
