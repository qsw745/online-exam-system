// src/modules/favorites/favorites.controller.ts
import type { Response } from 'express'
import crypto from 'node:crypto' // Node 18+，如报类型错误，见文末“TypeScript 设置”
import { HttpError, ValidationError } from '../../../common/errors/http-error.js'
import type { AuthRequest } from '../../../types/auth.js'
import type { ApiResponse } from '../../../types/response.js'
import { FavoritesService } from '../services/favorites.service.js'

const svc = new FavoritesService()

function ensureUser(req: AuthRequest): number {
  const id = req.user?.id
  if (!id) throw HttpError.unauthorized('未授权访问')
  return Number(id)
}

export class FavoritesController {
  static async list(req: AuthRequest, res: Response<ApiResponse<any>>) {
    const userId = ensureUser(req)
    const category_id = req.query.category_id ? Number(req.query.category_id) : undefined
    const is_public = req.query.is_public !== undefined ? String(req.query.is_public) === 'true' : undefined
    const favorites = await svc.list(userId, { category_id, is_public })
    const categories = await svc.categories()
    return res.json({ success: true, data: { favorites, categories } })
  }

  static async getById(req: AuthRequest, res: Response<ApiResponse<any>>) {
    const userId = ensureUser(req)
    const id = Number(req.params.id)
    if (isNaN(id)) throw new ValidationError('请求参数验证失败', ['无效的收藏夹ID'])
    const data = await svc.getByIdForRead(userId, id)
    return res.json({ success: true, data })
  }

  static async create(req: AuthRequest, res: Response<ApiResponse<any>>) {
    const userId = ensureUser(req)
    const fav = await svc.create({
      userId,
      name: String(req.body?.name ?? ''),
      description: req.body?.description,
      is_public: !!req.body?.is_public,
      category_id: req.body?.category_id ?? null,
    })
    return res.status(201).json({ success: true, data: fav })
  }

  static async update(req: AuthRequest, res: Response<ApiResponse<any>>) {
    const userId = ensureUser(req)
    const id = Number(req.params.id)
    if (isNaN(id)) throw new ValidationError('请求参数验证失败', ['无效的收藏夹ID'])
    const fav = await svc.update({
      id,
      userId,
      name: req.body?.name,
      description: req.body?.description,
      is_public: typeof req.body?.is_public === 'boolean' ? req.body.is_public : undefined,
      category_id: req.body?.category_id,
    })
    return res.json({ success: true, data: fav })
  }

  static async remove(req: AuthRequest, res: Response<ApiResponse<null>>) {
    const userId = ensureUser(req)
    const id = Number(req.params.id)
    if (isNaN(id)) throw new ValidationError('请求参数验证失败', ['无效的收藏夹ID'])
    await svc.remove(userId, id)
    return res.json({ success: true, data: null })
  }

  static async addItem(req: AuthRequest, res: Response<ApiResponse<any>>) {
    const userId = ensureUser(req)
    const favoriteId = Number(req.params.id)
    if (isNaN(favoriteId)) throw new ValidationError('请求参数验证失败', ['无效的收藏夹ID'])
    const data = await svc.addItem({
      favoriteId,
      userId,
      item_type: String(req.body?.item_type),
      item_id: Number(req.body?.item_id),
      title: req.body?.title ?? '',
      description: req.body?.description ?? '',
      tags: Array.isArray(req.body?.tags) ? req.body.tags : [],
      notes: req.body?.notes ?? '',
    })
    return res.status(201).json({ success: true, data })
  }

  static async removeItem(req: AuthRequest, res: Response<ApiResponse<null>>) {
    const userId = ensureUser(req)
    const favoriteId = Number(req.params.id)
    const itemId = Number(req.params.itemId)
    if (isNaN(favoriteId) || isNaN(itemId)) throw new ValidationError('请求参数验证失败', ['无效的ID'])
    await svc.removeItem(userId, favoriteId, itemId)
    return res.json({ success: true, data: null })
  }

  // 共享链接（保留你原逻辑，这里只演示生成 code）
  static async share(req: AuthRequest, res: Response<ApiResponse<{ share_code: string; share_url: string }>>) {
    const userId = ensureUser(req)
    const favoriteId = Number(req.params.id)
    if (isNaN(favoriteId)) throw new ValidationError('请求参数验证失败', ['无效的收藏夹ID'])

    const shareCode = crypto.randomBytes(16).toString('hex')
    const shareUrl = `${req.protocol}://${req.get('host')}/shared/favorites/${shareCode}`
    // TODO: 调用 Repository 写入 share 记录（可继续沿用你原实现）
    return res.json({ success: true, data: { share_code: shareCode, share_url: shareUrl } })
  }

  static async searchItems(req: AuthRequest, res: Response<ApiResponse<any>>) {
    const userId = ensureUser(req)
    const items = await svc.searchItems(userId, {
      keyword: req.query.keyword ? String(req.query.keyword) : undefined,
      item_type: req.query.item_type ? String(req.query.item_type) : undefined,
      favorite_id: req.query.favorite_id ? Number(req.query.favorite_id) : undefined,
    })
    return res.json({ success: true, data: items })
  }
}
