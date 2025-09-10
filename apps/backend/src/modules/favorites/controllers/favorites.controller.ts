import type { Response, Request } from 'express'
import crypto from 'node:crypto'
import type { ApiResponse } from '@/types/response.js'
import { FavoritesService } from '../services/favorites.service.js'

type MaybeAuth = Request & { user?: { id?: number | string } }
const svc = new FavoritesService()

function ensureUser(req: MaybeAuth): number {
  const id = req.user?.id
  if (!id) {
    ;(req.res as any)?.status?.(401)?.json?.({ error: '未授权访问' })
    throw new Error('UNAUTHORIZED')
  }
  return Number(id)
}

export class FavoritesController {
  // GET /
  static async list(req: MaybeAuth, res: Response<ApiResponse<any>>) {
    const userId = ensureUser(req)
    const category_id = req.query.category_id ? Number(req.query.category_id) : undefined
    const is_public = req.query.is_public !== undefined ? String(req.query.is_public) === 'true' : undefined
    const favorites = await svc.list(userId, { category_id, is_public })
    const categories = await svc.categories().catch(() => undefined)
    return res.json({ success: true, data: categories ? { favorites, categories } : favorites })
  }

  // GET /categories/list  ← 新增
  static async getCategories(_req: MaybeAuth, res: Response<ApiResponse<any>>) {
    const list = await svc.categories()
    return res.json({ success: true, data: list })
  }

  // GET /:id
  static async getById(req: MaybeAuth, res: Response<ApiResponse<any>>) {
    const userId = ensureUser(req)
    const id = Number(req.params.id)
    if (!Number.isFinite(id)) return res.status(400).json({ success: false, error: '无效的收藏夹ID' } as any)
    const data = await svc.getByIdForRead(userId, id)
    return res.json({ success: true, data })
  }

  // POST /
  static async create(req: MaybeAuth, res: Response<ApiResponse<any>>) {
    const userId = ensureUser(req)
    const payload = {
      userId,
      name: String(req.body?.name ?? '').trim() || '默认收藏',
      description: req.body?.description ?? '',
      is_public: !!req.body?.is_public,
      category_id: req.body?.category_id ?? null,
    }
    const fav = await svc.create(payload as any)
    return res.status(201).json({ success: true, data: fav })
  }

  // PUT /:id
  static async update(req: MaybeAuth, res: Response<ApiResponse<any>>) {
    const userId = ensureUser(req)
    const id = Number(req.params.id)
    if (!Number.isFinite(id)) return res.status(400).json({ success: false, error: '无效的收藏夹ID' } as any)
    const fav = await svc.update({
      id,
      userId,
      name: req.body?.name,
      description: req.body?.description,
      is_public: typeof req.body?.is_public === 'boolean' ? req.body.is_public : undefined,
      category_id: req.body?.category_id,
    } as any)
    return res.json({ success: true, data: fav })
  }

  // DELETE /:id
  static async remove(req: MaybeAuth, res: Response<ApiResponse<null>>) {
    const userId = ensureUser(req)
    const id = Number(req.params.id)
    if (!Number.isFinite(id)) return res.status(400).json({ success: false, error: '无效的收藏夹ID' } as any)
    await svc.remove(userId, id)
    return res.json({ success: true, data: null })
  }

  // GET /:id/items
  static async getItems(req: MaybeAuth, res: Response<ApiResponse<any>>) {
    const userId = ensureUser(req)
    const favoriteId = Number(req.params.id)
    if (!Number.isFinite(favoriteId)) return res.status(400).json({ success: false, error: '无效的收藏夹ID' } as any)
    const items = await svc.listItemsByFavorite(userId, favoriteId)
    return res.json({ success: true, data: items })
  }

  // POST /:id/items
  static async addItem(req: MaybeAuth, res: Response<ApiResponse<any>>) {
    const userId = ensureUser(req)
    const favoriteId = Number(req.params.id)
    if (!Number.isFinite(favoriteId)) return res.status(400).json({ success: false, error: '无效的收藏夹ID' } as any)

    const item_type = String(req.body?.item_type ?? 'question')
    const item_id = Number(req.body?.item_id ?? req.body?.question_id)
    if (!Number.isFinite(item_id)) return res.status(400).json({ success: false, error: '无效的条目ID' } as any)

    const data = await svc.addItem({
      favoriteId,
      userId,
      item_type,
      item_id,
      title: req.body?.title ?? '',
      description: req.body?.description ?? '',
      tags: Array.isArray(req.body?.tags) ? req.body.tags : [],
      notes: req.body?.notes ?? '',
    } as any)
    return res.status(201).json({ success: true, data })
  }

  // DELETE /:id/items/:itemId
  static async removeItem(req: MaybeAuth, res: Response<ApiResponse<null>>) {
    const userId = ensureUser(req)
    const favoriteId = Number(req.params.id)
    const itemId = Number(req.params.itemId)
    if (!Number.isFinite(favoriteId) || !Number.isFinite(itemId)) {
      return res.status(400).json({ success: false, error: '无效的ID' } as any)
    }
    await svc.removeItem(userId, favoriteId, itemId)
    return res.json({ success: true, data: null })
  }

  // POST /:id/share
  static async share(req: MaybeAuth, res: Response<ApiResponse<{ share_code: string; share_url: string }>>) {
    const userId = ensureUser(req)
    const favoriteId = Number(req.params.id)
    if (!Number.isFinite(favoriteId)) return res.status(400).json({ success: false, error: '无效的收藏夹ID' } as any)
    const share_code = crypto.randomBytes(16).toString('hex')
    const share_url = `${req.protocol}://${req.get('host')}/shared/favorites/${share_code}`
    return res.json({ success: true, data: { share_code, share_url } })
  }

  // GET /search
  static async searchItems(req: MaybeAuth, res: Response<ApiResponse<any>>) {
    const userId = ensureUser(req)
    const items = await svc.searchItems(userId, {
      keyword: req.query.keyword ? String(req.query.keyword) : undefined,
      item_type: req.query.item_type ? String(req.query.item_type) : undefined,
      favorite_id: req.query.favorite_id ? Number(req.query.favorite_id) : undefined,
    })
    return res.json({ success: true, data: items ?? [] })
  }
}

export default FavoritesController
