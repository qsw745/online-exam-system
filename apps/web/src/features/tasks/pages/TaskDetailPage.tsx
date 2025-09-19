import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { App, Card, Space, Button } from 'antd'
import dayjs from '@/shared/utils/dayjs'
import { TaskDetail } from '../components/TaskDetail'
import { TaskForm } from '../components/TaskForm'
import { useTaskById } from '../hooks/useTaskById'
import { tasksApi } from '@/shared/api/endpoints/tasks'
import { isSuccess } from '@/shared/api/http'

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [sp, setSp] = useSearchParams()
  const { message } = App.useApp()
  const nav = useNavigate()

  const { loading, task, refetch } = useTaskById(id)
  const [editing, setEditing] = useState(sp.get('edit') === '1')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setEditing(sp.get('edit') === '1')
  }, [sp])

  const initial = useMemo(() => {
    if (!task) return undefined
    const deptIds =
      (task as any).assigned_department_ids ??
      ((task as any).assigned_departments ?? []).map((d: any) => d?.id).filter(Boolean)
    const userIds =
      (task as any).assigned_user_ids ?? (task.assigned_users ?? []).map((u: any) => u?.id).filter(Boolean)

    return {
      title: task.title ?? '',
      description: task.description ?? '',
      status: (task.status as any) ?? 'not_started',
      type: (task.type as any) ?? 'practice',
      // 统一为字符串（与控件 value 一致）
      exam_id: (task as any)?.exam_id != null ? String((task as any).exam_id) : undefined,
      paper_id: (task as any)?.paper_id != null ? String((task as any).paper_id) : undefined,
      start_time: task.start_time ? dayjs(task.start_time) : undefined,
      end_time: task.end_time ? dayjs(task.end_time) : undefined,
      assigned_user_ids: (userIds ?? []).map((id: any) => String(id)),
      assigned_department_ids: (deptIds ?? []).map((id: any) => String(id)),
    }
  }, [task])

  const enterEdit = () => {
    sp.set('edit', '1')
    setSp(sp, { replace: true })
  }
  const cancelEdit = () => {
    sp.delete('edit')
    setSp(sp, { replace: true })
  }

  const onSubmit = async (payload: any) => {
    if (!id) return
    try {
      setSaving(true)
      const res: any = (await (tasksApi as any).update?.(id, payload)) ?? {}
      if (!isSuccess(res)) throw new Error(res?.error || res?.message || '保存失败')
      message.success('保存成功')
      cancelEdit()
      await refetch()
    } catch (e: any) {
      message.error(e?.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const onStart = (t: any) => {
    if (!t) return
    if (t.type === 'exam') {
      nav(`/exam/${t.exam_id}`)
    } else {
      nav(`/practice/${t.id}`)
    }
  }

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      {editing ? (
        <Card
          title="编辑任务"
          extra={
            <Space>
              <Button onClick={() => nav(-1)}>返回</Button>
              <Button onClick={cancelEdit}>取消编辑</Button>
            </Space>
          }
          variant="outlined"
          loading={loading}
        >
          <TaskForm readOnly={false} initial={initial as any} submitting={saving} onSubmit={onSubmit} />
        </Card>
      ) : (
        <TaskDetail
          task={task as any}
          loading={loading}
          onStart={onStart}
          onBack={() => nav(-1)}
          onEdit={() => enterEdit()}
        />
      )}
    </Space>
  )
}
