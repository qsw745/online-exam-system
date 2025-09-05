// features/tasks/pages/TaskDetailPage.tsx
import React from 'react'
import { useParams } from 'react-router-dom'
import { TaskDetail } from '../components/TaskDetail'
import { useTaskById } from '../hooks/useTaskById'

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { loading, task } = useTaskById(id)
  return <TaskDetail task={task} loading={loading} />
}
