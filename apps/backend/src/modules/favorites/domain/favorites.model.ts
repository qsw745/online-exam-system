// src/modules/favorites/favorites.model.ts
import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'

export interface IFavorite extends RowDataPacket {
  id: number
  user_id: number
  name: string
  description: string | null
  is_public: boolean
  category_id: number | null
  created_at?: Date
  updated_at?: Date
  category_name?: string | null
  category_color?: string | null
  items_count?: number
}

export interface IFavoriteItem extends RowDataPacket {
  id: number
  favorite_id: number
  item_type: 'question' | 'exam' | 'task' | 'note'
  item_id: number
  title: string | null
  description: string | null
  tags: string | null // 存 JSON 字符串
  notes: string | null
  sort_order: number | null
  created_at?: Date
  updated_at?: Date
}

export interface IFavoriteCategory extends RowDataPacket {
  id: number
  name: string
  description: string | null
  color: string | null
  icon: string | null
  sort_order: number | null
}

export interface IFavoriteShare extends RowDataPacket {
  id: number
  favorite_id: number
  shared_by: number
  share_code: string
  expires_at: Date | null
  created_at: Date
  accessed_at?: Date | null
}

export type CreateFavoriteInput = {
  userId: number
  name: string
  description?: string
  is_public?: boolean
  category_id?: number | null
}

export type UpdateFavoriteInput = {
  id: number
  userId: number
  name?: string
  description?: string
  is_public?: boolean
  category_id?: number | null
}

export type AddFavoriteItemInput = {
  favoriteId: number
  userId: number
  item_type: IFavoriteItem['item_type']
  item_id: number
  title?: string
  description?: string
  tags?: string[] // service 转存为 JSON
  notes?: string
}
