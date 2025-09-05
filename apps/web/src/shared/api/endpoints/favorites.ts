// src/shared/api/endpoints/favorites.ts
import { api } from '../core/httpClient'

export interface Favorite {
  id: number
  name: string
  description?: string
  category_id: number
  category_name?: string
  category_color?: string
  is_public: boolean
  items_count: number
  created_at: string
  updated_at: string
}
export interface FavoriteItem {
  id: number
  question_id: number
  question_title: string
  question_type: string
  difficulty: string
  subject: string
  added_at: string
}
export interface FavoriteCategory {
  id: number
  name: string
  description: string
  color: string
  icon: string
  sort_order: number
}

// ---- 轻量归一化辅助 ----
function pickArray<T = any>(res: any, fallback: T[] = []): T[] {
  const d = res?.data
  if (Array.isArray(d)) return d as T[]
  if (Array.isArray(d?.data)) return d.data as T[]
  if (Array.isArray(d?.favorites)) return d.favorites as T[]
  if (Array.isArray(d?.items)) return d.items as T[]
  if (Array.isArray(d?.categories)) return d.categories as T[]
  return fallback
}
function pickObject<T = any>(res: any, fallback: T | null = null): T | null {
  const d = res?.data
  if (d && typeof d === 'object') return d as T
  if (d?.data && typeof d.data === 'object') return d.data as T
  return fallback
}

export const favoritesApi = {
  async list(): Promise<Favorite[]> {
    const res = await api.get('/favorites')
    return pickArray<Favorite>(res, [])
  },
  async items(favoriteId: number): Promise<FavoriteItem[]> {
    const res = await api.get(`/favorites/${favoriteId}/items`)
    return pickArray<FavoriteItem>(res, [])
  },
  async categories(): Promise<FavoriteCategory[]> {
    const res = await api.get('/favorites/categories/list')
    return pickArray<FavoriteCategory>(res, [])
  },
  async create(payload: Partial<Favorite>): Promise<Favorite | null> {
    const res = await api.post('/favorites', payload)
    return pickObject<Favorite>(res)
  },
  async update(id: number, payload: Partial<Favorite>): Promise<Favorite | null> {
    const res = await api.put(`/favorites/${id}`, payload)
    return pickObject<Favorite>(res)
  },
  async remove(id: number): Promise<void> {
    await api.delete(`/favorites/${id}`)
  },
  async removeItem(favoriteId: number, itemId: number): Promise<void> {
    await api.delete(`/favorites/${favoriteId}/items/${itemId}`)
  },
  async share(id: number): Promise<string | null> {
    const res = await api.post(`/favorites/${id}/share`)
    const data = pickObject<{ share_link?: string }>(res, {})
    return data?.share_link ?? null
  },
}
export default favoritesApi
