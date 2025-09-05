export interface Discussion {
  id: number
  title: string
  content: string
  category_id: number
  category_name: string
  category_color?: string
  question_id?: number
  question_title?: string
  author_id: number
  author_name: string
  author_avatar?: string
  likes_count: number
  replies_count: number
  views_count: number
  is_liked: boolean
  is_pinned: boolean
  created_at: string
  updated_at: string
}

export interface Reply {
  id: number
  content: string
  author_id: number
  author_name: string
  author_avatar?: string
  likes_count: number
  is_liked: boolean
  created_at: string
}

export interface DiscussionCategory {
  id: number
  name: string
  description: string
  icon: string
  color: string
  sort_order: number
  is_active: boolean
  discussions_count?: number
}

export type SortBy = 'latest' | 'hot' | 'replies'
