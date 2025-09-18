import React from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { TaskDetail } from '../components/TaskDetail'
import { useTaskById } from '../hooks/useTaskById'

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { loading, task } = useTaskById(id)
  const nav = useNavigate()

  const onStart = (t: any) => {
    if (!t) return
    if (t.type === 'exam') {
      // ★ 用 exam_id，而不是 task.id
      nav(`/exam/${t.exam_id}`)
    } else {
      nav(`/practice/${t.id}`)
    }
  }

  return <TaskDetail task={task as any} loading={loading} onStart={onStart} />
}
