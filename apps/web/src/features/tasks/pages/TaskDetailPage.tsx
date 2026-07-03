// src/features/tasks/pages/TaskDetailPage.tsx
import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { App, Card, Space, Button } from 'antd'
import dayjs from '@/shared/utils/dayjs'
import { TaskDetail } from '../components/TaskDetail'
import { TaskForm } from '../components/TaskForm'
import { useTaskById } from '../hooks/useTaskById'
import { tasksApi } from '@/shared/api/endpoints/tasks'
import { isSuccess } from '@/shared/api/http'
import { translate } from '@/shared/utils/i18n'

/** ─── 工具：把可能是 string/number 的值安全转成 number ───────────────────────── */
const toNum = (v: any): number | undefined => {
  if (v === null || v === undefined || v === '') return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}
const toNumArr = (a: any): number[] =>
  Array.isArray(a)
    ? a
        .map(x => toNum(typeof x === 'object' ? x?.value ?? x?.id ?? x : x))
        .filter((n): n is number => typeof n === 'number')
    : []

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

  /** 生成表单初始值（全部用 number 做 value，避免 Select 不回显） */
  const initial = useMemo(() => {
    if (!task) return undefined

    // 部门与用户 ID 归一化
    const deptIdsRaw =
      (task as any).assigned_department_ids ?? ((task as any).assigned_departments ?? []).map((d: any) => d?.id)
    const userIdsRaw = (task as any).assigned_user_ids ?? (task as any).assigned_users ?? []

    // 试卷 / 考试 ID（后端可能给的是字符串）
    const paperId = toNum((task as any).paper_id ?? (task as any).paperId) ?? undefined
    const examId = toNum((task as any).exam_id ?? (task as any).examId)

    return {
      title: task.title ?? '',
      description: task.description ?? '',
      status: (task.status as any) ?? 'not_started',
      type: (task.type as any) ?? 'practice',

      // 统一为 number，匹配 antd Select 选项的 value
      exam_id: examId,
      paper_id: paperId,

      start_time: task.start_time ? dayjs(task.start_time) : undefined,
      end_time: task.end_time ? dayjs(task.end_time) : undefined,

      assigned_user_ids: toNumArr(
        Array.isArray(userIdsRaw) ? userIdsRaw.map((u: any) => (typeof u === 'object' ? u?.id : u)) : userIdsRaw
      ),
      assigned_department_ids: toNumArr(deptIdsRaw),
    }
  }, [task])

  /** 关键：依赖初始值生成一个 key，数据变化时强制重挂载表单，确保 initialValues 生效 */
  const formKey = useMemo(() => {
    if (!task || !initial) return 'task-form-empty'
    const sig = JSON.stringify({
      id: task.id,
      exam_id: initial.exam_id,
      paper_id: initial.paper_id,
      dept: initial.assigned_department_ids,
      users: initial.assigned_user_ids,
      st: initial.start_time?.valueOf?.(),
      et: initial.end_time?.valueOf?.(),
    })
    return `task-form-${sig}`
  }, [task, initial])

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
      // 提交前再做一遍 number 归一化，防止控件返回字符串
      const normalizeDate = (input: any) => {
        if (!input) return null
        if (typeof input === 'string') return input
        if (typeof input?.format === 'function') return input.format('YYYY-MM-DD HH:mm:ss')
        if (input instanceof Date && !isNaN(input.getTime())) {
          return dayjs(input).format('YYYY-MM-DD HH:mm:ss')
        }
        return null
      }

      const patch = {
        ...payload,
        exam_id: toNum(payload?.exam_id),
        paper_id: toNum(payload?.paper_id),
        assigned_user_ids: toNumArr(payload?.assigned_user_ids),
        assigned_department_ids: toNumArr(payload?.assigned_department_ids),
        start_time: normalizeDate(payload?.start_time),
        end_time: normalizeDate(payload?.end_time),
      }

      const res: any = (await (tasksApi as any).update?.(id, patch)) ?? {}
      if (!isSuccess(res)) throw new Error(res?.error || res?.message || '保存失败')
      message.success(translate('orgs.message.save_success'))
      cancelEdit()
      await refetch()
    } catch (e: any) {
      message.error(e?.message || translate('roles.message.save_failed'))
    } finally {
      setSaving(false)
    }
  }

  const onStart = (t: any) => {
    if (!t) return
    if (t.type === 'exam') {
      const examId = toNum(t.exam_id ?? t.examId)
      if (examId) nav(`/exam/${examId}`)
    } else {
      nav(`/practice/${t.id}`)
    }
  }

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      {editing ? (
        <Card
          title={translate('jobs.edit_job')}
          extra={
            <Space>
              <Button onClick={() => nav(-1)}>{translate('app.back')}</Button>
              <Button onClick={cancelEdit}>{translate('auto.c698df948d')}</Button>
            </Space>
          }
          variant="outlined"
          loading={loading}
        >
          {/* 给 key 强制重挂载，确保 initialValues 生效并正确回显 */}
          <TaskForm key={formKey} readOnly={false} initial={initial as any} submitting={saving} onSubmit={onSubmit} />
        </Card>
      ) : (
        <TaskDetail
          task={task as any}
          loading={loading}
          onStart={onStart as any}
          onBack={() => nav(-1)}
          onEdit={() => enterEdit()}
        />
      )}
    </Space>
  )
}
