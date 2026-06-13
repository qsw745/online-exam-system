// apps/backend/src/modules/discussions/domain/discussion.types.ts
import type { RowDataPacket } from 'mysql2'

export interface IDiscussion extends RowDataPacket {
  id: number
  user_id: number
  category_id: number
  title: string
  content: string
  tags: string[]
  related_type: 'question' | 'exam' | 'task' | 'general'
  related_id: number | null
  is_pinned: boolean
  is_locked: boolean
  is_featured: boolean
  view_count: number
  reply_count: number
  like_count: number
  last_reply_at: Date
  last_reply_user_id: number | null
  created_at: Date
  updated_at: Date
  username?: string
  avatar?: string
  category_name?: string
  category_color?: string
  is_liked?: boolean
  is_bookmarked?: boolean
  is_followed?: boolean
}

export interface IDiscussionReply extends RowDataPacket {
  id: number
  discussion_id: number
  user_id: number
  parent_id: number | null
  content: string
  is_solution: boolean
  like_count: number
  reply_count: number
  created_at: Date
  updated_at: Date
  username?: string
  avatar?: string
  is_liked?: boolean
  children?: IDiscussionReply[]
}

export interface IDiscussionCategory extends RowDataPacket {
  id: number
  name: string
  description: string
  icon: string
  color: string
  sort_order: number
  is_active: boolean
  discussions_count?: number
}

export interface IDiscussionTag extends RowDataPacket {
  id: number
  name: string
  color: string
  usage_count: number
}
