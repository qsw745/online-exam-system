import { Card, Empty, Space } from 'antd'
import type { Task } from '../hooks/useTasksQuery'
import TaskCard from './TaskCard'

type MobileTaskListProps = {
  tasks: Task[]
  loading?: boolean
  onStart: (task: Task) => void
  onView?: (task: Task) => void
}

export default function MobileTaskList({ tasks, loading = false, onStart, onView }: MobileTaskListProps) {
  if (loading && tasks.length === 0) {
    return <Card loading aria-label="正在加载任务" />
  }

  if (tasks.length === 0) {
    return <Empty description="当前没有符合条件的任务" />
  }

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      {tasks.map(task => (
        <TaskCard key={task.id} task={task} loading={loading} onStart={onStart} onView={onView} />
      ))}
    </Space>
  )
}
