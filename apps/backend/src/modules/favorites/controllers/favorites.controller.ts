import type { Request } from 'express'
import crypto from 'node:crypto'
import type { Res } from '@/types/response.js'
import { FavoritesService } from '../services/favorites.service.js'

type MaybeAuth = Request & { user?: { id?: number | string } }
const svc = new FavoritesService()

function ensureUser(req: MaybeAuth, res: Res): number {
  const id = req.user?.id
  if (!id) {
    res.unauthorized('未授权访问')
    throw new Error('UNAUTHORIZED')
  }
  return Number(id)
}

export class FavoritesController {
  // GET /
  static async list(req: MaybeAuth, res: Res) {
    try {
      const userId = ensureUser(req, res)
      const category_id = req.query.category_id ? Number(req.query.category_id) : undefined
      const is_public = req.query.is_public !== undefined ? String(req.query.is_public) === 'true' : undefined
      const favorites = await svc.list(userId, { category_id, is_public })
      const categories = await svc.categories().catch(() => undefined)
      return res.ok<any>(categories ? { favorites, categories } : favorites)
    } catch (e: any) {
      return res.internal(e?.message || '获取收藏列表失败')
    }
  }

  // GET /categories/list
  static async getCategories(_req: MaybeAuth, res: Res) {
    try {
      const list = await svc.categories()
      return res.ok<any>(list)
    } catch (e: any) {
      return res.internal(e?.message || '获取分类失败')
    }
  }

  // GET /:id
  static async getById(req: MaybeAuth, res: Res) {
    try {
      const userId = ensureUser(req, res)
      const id = Number(req.params.id)
      if (!Number.isFinite(id)) return res.internal('无效的收藏夹ID')
      const data = await svc.getByIdForRead(userId, id)
      return res.ok<any>(data)
    } catch (e: any) {
      return res.internal(e?.message || '获取收藏夹详情失败')
    }
  }

  // POST /
  static async create(req: MaybeAuth, res: Res) {
    try {
      const userId = ensureUser(req, res)
      const payload = {
        userId,
        name: String(req.body?.name ?? '').trim() || '默认收藏',
        description: req.body?.description ?? '',
        is_public: !!req.body?.is_public,
        category_id: req.body?.category_id ?? null,
      }
      const fav = await svc.create(payload as any)
      return res.ok<any>(fav, '创建成功')
    } catch (e: any) {
      return res.internal(e?.message || '创建收藏夹失败')
    }
  }

  // PUT /:id
  static async update(req: MaybeAuth, res: Res) {
    try {
      const userId = ensureUser(req, res)
      const id = Number(req.params.id)
      if (!Number.isFinite(id)) return res.internal('无效的收藏夹ID')
      const fav = await svc.update({
        id,
        userId,
        name: req.body?.name,
        description: req.body?.description,
        is_public: typeof req.body?.is_public === 'boolean' ? req.body.is_public : undefined,
        category_id: req.body?.category_id,
      } as any)
      return res.ok<any>(fav, '更新成功')
    } catch (e: any) {
      return res.internal(e?.message || '更新收藏夹失败')
    }
  }

  // DELETE /:id
  static async remove(req: MaybeAuth, res: Res) {
    try {
      const userId = ensureUser(req, res)
      const id = Number(req.params.id)
      if (!Number.isFinite(id)) return res.internal('无效的收藏夹ID')
      await svc.remove(userId, id)
      return res.ok<null>(null)
    } catch (e: any) {
      return res.internal(e?.message || '删除收藏夹失败')
    }
  }

  // GET /:id/items
  static async getItems(req: MaybeAuth, res: Res) {
    try {
      const userId = ensureUser(req, res)
      const favoriteId = Number(req.params.id)
      if (!Number.isFinite(favoriteId)) return res.internal('无效的收藏夹ID')
      const items = await svc.listItemsByFavorite(userId, favoriteId)
      return res.ok<any>(items)
    } catch (e: any) {
      return res.internal(e?.message || '获取收藏条目失败')
    }
  }

  // POST /:id/items
  static async addItem(req: MaybeAuth, res: Res) {
    try {
      const userId = ensureUser(req, res)
      const favoriteId = Number(req.params.id)
      if (!Number.isFinite(favoriteId)) return res.internal('无效的收藏夹ID')

      const item_type = String(req.body?.item_type ?? 'question')
      const item_id = Number(req.body?.item_id ?? req.body?.question_id)
      if (!Number.isFinite(item_id)) return res.internal('无效的条目ID')

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
      return res.ok<any>(data, '添加成功')
    } catch (e: any) {
      return res.internal(e?.message || '添加收藏条目失败')
    }
  }

  // DELETE /:id/items/:itemId
  static async removeItem(req: MaybeAuth, res: Res) {
    try {
      const userId = ensureUser(req, res)
      const favoriteId = Number(req.params.id)
      const itemId = Number(req.params.itemId)
      if (!Number.isFinite(favoriteId) || !Number.isFinite(itemId)) {
        return res.internal('无效的ID')
      }
      await svc.removeItem(userId, favoriteId, itemId)
      return res.ok<null>(null)
    } catch (e: any) {
      return res.internal(e?.message || '删除收藏条目失败')
    }
  }

  // POST /:id/share
  static async share(req: MaybeAuth, res: Res) {
    try {
      const userId = ensureUser(req, res)
      const favoriteId = Number(req.params.id)
      if (!Number.isFinite(favoriteId)) return res.internal('无效的收藏夹ID')
      const share_code = crypto.randomBytes(16).toString('hex')
      const host = (req as any).get?.('host') || (req.headers as any)?.host || ''
      const protocol = (req as any).protocol || 'http'
      const share_url = `${protocol}://${host}/shared/favorites/${share_code}`
      return res.ok<{ share_code: string; share_url: string }>({ share_code, share_url })
    } catch (e: any) {
      return res.internal(e?.message || '生成分享链接失败')
    }
  }

  // GET /search
  static async searchItems(req: MaybeAuth, res: Res) {
    try {
      const userId = ensureUser(req, res)
      const items = await svc.searchItems(userId, {
        keyword: req.query.keyword ? String(req.query.keyword) : undefined,
        item_type: req.query.item_type ? String(req.query.item_type) : undefined,
        favorite_id: req.query.favorite_id ? Number(req.query.favorite_id) : undefined,
      })
      return res.ok<any>(items ?? [])
    } catch (e: any) {
      return res.internal(e?.message || '搜索收藏条目失败')
    }
  }
}

export default FavoritesController
