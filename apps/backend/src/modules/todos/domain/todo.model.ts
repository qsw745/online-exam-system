// apps/backend/src/modules/todos/domain/todo.model.ts
import type { RowDataPacket } from 'mysql2'

export interface ITodo extends RowDataPacket {
  id: number
  user_id: number
  title: string
  content: string
  done: boolean // 注意：SQL 中使用 is_done，这里通过 SELECT ... AS done 映射
  created_at: Date
  updated_at: Date
  source?: string
  target_path?: string | null
  metadata?: any
}

export type TodoListData = {
  todos: ITodo[]
  pendingCount: number
}

export type PendingCountData = { pendingCount: number }
