import crypto from 'crypto'
import { Response } from 'express'
import { ResultSetHeader, RowDataPacket } from 'mysql2'
import { pool } from '@config/database.js'
import { FavoritesService } from '../../modules/favorites/favorites.service.js'
import { AuthRequest } from 'types/auth.js'
import { ApiResponse } from 'types/response.js'

import {
  createFavoriteSchema,
  updateFavoriteSchema,
  addFavoriteItemSchema,
  quickFavoriteSchema,
  checkStatusParamsSchema,
  moveItemsSchema,
  updateOrderSchema,
  searchItemsQuerySchema,
  zodErrors,
} from '../../common/validation/favorites.schema.js'

import { HttpError, ValidationError } from '../../common/errors/http-error.js'

interface IFavorite extends RowDataPacket {
  id: number
  user_id: number
  name: string
  description: string
  is_public: boolean
  category_id: number | null
  created_at?: Date
  updated_at?: Date
  category_name?: string
  category_color?: string
  items_count?: number
}

interface IFavoriteItem extends RowDataPacket {
  id: number
  favorite_id: number
  item_type: 'question' | 'exam' | 'task' | 'note'
  item_id: number
  title: string
  description: string
  tags: string[] | string
  notes: string
  sort_order: number
  created_at?: Date
  updated_at?: Date
}

interface IFavoriteCategory extends RowDataPacket {
  id: number
  name: string
  description: string
  color: string
  icon: string
  sort_order: number
}

function ensureUser(req: AuthRequest): number {
  const userId = req.user?.id
  if (!userId) throw HttpError.unauthorized('未授权访问')
  return Number(userId)
}

function dbDetails(e: any) {
  const { code, errno, sqlState, sqlMessage, sql } = e || {}
  return { code, errno, sqlState, sqlMessage, sql }
}

export class FavoritesController {
  private favoritesService: FavoritesService

  constructor() {
    this.favoritesService = new FavoritesService()
  }

  /** 动态选择 favorites 表可用的排序列（updated_at > created_at > id） */
  private static async resolveFavoritesOrderColumn(): Promise<'updated_at' | 'created_at' | 'id'> {
    try {
      const [cols] = await pool.query<RowDataPacket[]>(`SHOW COLUMNS FROM favorites`)
      const names = new Set((cols as any[]).map(c => String(c.Field)))
      if (names.has('updated_at')) return 'updated_at'
      if (names.has('created_at')) return 'created_at'
      return 'id'
    } catch {
      return 'id'
    }
  }

  // 获取用户收藏夹列表
  static async getFavorites(
    req: AuthRequest,
    res: Response<ApiResponse<{ favorites: IFavorite[]; categories: IFavoriteCategory[] }>>
  ) {
    try {
      const userId = ensureUser(req)
      const { category_id, is_public } = req.query

      let whereClause = 'WHERE f.user_id = ?'
      const params: any[] = [userId]

      if (category_id) {
        whereClause += ' AND f.category_id = ?'
        params.push(Number(category_id))
      }
      if (is_public !== undefined) {
        whereClause += ' AND f.is_public = ?'
        params.push(String(is_public) === 'true')
      }

      const orderColumn = await FavoritesController.resolveFavoritesOrderColumn()

      const [favorites] = await pool.query<IFavorite[]>(
        `SELECT f.*, fc.name as category_name, fc.color as category_color,
                COUNT(fi.id) as items_count
         FROM favorites f
         LEFT JOIN favorite_categories fc ON f.category_id = fc.id
         LEFT JOIN favorite_items fi ON f.id = fi.favorite_id
         ${whereClause}
         GROUP BY f.id
         ORDER BY f.${orderColumn} DESC`,
        params
      )

      const [categories] = await pool.query<IFavoriteCategory[]>(
        'SELECT * FROM favorite_categories ORDER BY sort_order ASC'
      )

      return res.json({ success: true, data: { favorites, categories } })
    } catch (error) {
      throw HttpError.internal('获取收藏夹列表失败', { error: dbDetails(error) })
    }
  }

  // 获取收藏夹详情
  static async getFavoriteById(
    req: AuthRequest,
    res: Response<ApiResponse<{ favorite: IFavorite; items: IFavoriteItem[] }>>
  ) {
    try {
      const userId = ensureUser(req)
      const favoriteId = parseInt(req.params.id)
      if (isNaN(favoriteId)) throw new ValidationError('请求参数验证失败', ['无效的收藏夹ID'])

      const [favorites] = await pool.query<IFavorite[]>(
        `SELECT f.*, fc.name as category_name, fc.color as category_color
         FROM favorites f
         LEFT JOIN favorite_categories fc ON f.category_id = fc.id
         WHERE f.id = ? AND (f.user_id = ? OR f.is_public = TRUE)`,
        [favoriteId, userId]
      )
      if (favorites.length === 0) throw HttpError.notFound('收藏夹不存在或无权访问')

      const [items] = await pool.query<IFavoriteItem[]>(
        'SELECT * FROM favorite_items WHERE favorite_id = ? ORDER BY sort_order ASC, created_at DESC',
        [favoriteId]
      )

      if (favorites[0].user_id !== userId) {
        await pool.query(
          'INSERT INTO favorite_access_logs (favorite_id, user_id, access_type, ip_address) VALUES (?, ?, ?, ?)',
          [favoriteId, userId, 'view', req.ip]
        )
      }
      return res.json({ success: true, data: { favorite: favorites[0], items } })
    } catch (error) {
      if (error instanceof HttpError) throw error
      throw HttpError.internal('获取收藏夹详情失败', { error: dbDetails(error) })
    }
  }

  // 创建收藏夹 —— 改为使用 Zod + 抛 ValidationError，让统一错误处理中间件打印堆栈
  static async createFavorite(req: AuthRequest, res: Response<ApiResponse<IFavorite>>) {
    try {
      const userId = ensureUser(req)
      const parsed = createFavoriteSchema.safeParse(req.body)
      if (!parsed.success) throw new ValidationError('请求参数验证失败', zodErrors(parsed.error))

      const { name, description, is_public, category_id } = parsed.data

      const [result] = await pool.query<ResultSetHeader>(
        'INSERT INTO favorites (user_id, name, description, is_public, category_id) VALUES (?, ?, ?, ?, ?)',
        [userId, name.trim(), description || '', !!is_public, category_id ?? null]
      )

      const [favorite] = await pool.query<IFavorite[]>(
        `SELECT f.*, fc.name as category_name, fc.color as category_color
         FROM favorites f
         LEFT JOIN favorite_categories fc ON f.category_id = fc.id
         WHERE f.id = ?`,
        [result.insertId]
      )

      return res.status(201).json({ success: true, data: favorite[0] })
    } catch (error) {
      if (error instanceof HttpError) throw error
      throw HttpError.internal('创建收藏夹失败', { error: dbDetails(error), body: req.body })
    }
  }

  // 更新收藏夹
  static async updateFavorite(req: AuthRequest, res: Response<ApiResponse<IFavorite>>) {
    try {
      const userId = ensureUser(req)
      const favoriteId = parseInt(req.params.id)
      if (isNaN(favoriteId)) throw new ValidationError('请求参数验证失败', ['无效的收藏夹ID'])

      const parsed = updateFavoriteSchema.safeParse(req.body)
      if (!parsed.success) throw new ValidationError('请求参数验证失败', zodErrors(parsed.error))

      const [favorites] = await pool.query<IFavorite[]>('SELECT * FROM favorites WHERE id = ? AND user_id = ?', [
        favoriteId,
        userId,
      ])
      if (favorites.length === 0) throw HttpError.notFound('收藏夹不存在或无权修改')

      const payload = {
        name: parsed.data.name ?? favorites[0].name,
        description: parsed.data.description ?? favorites[0].description,
        is_public: parsed.data.is_public ?? favorites[0].is_public,
        category_id: parsed.data.category_id ?? favorites[0].category_id,
      }

      await pool.query('UPDATE favorites SET name = ?, description = ?, is_public = ?, category_id = ? WHERE id = ?', [
        payload.name,
        payload.description,
        payload.is_public,
        payload.category_id,
        favoriteId,
      ])

      const [updatedFavorite] = await pool.query<IFavorite[]>(
        `SELECT f.*, fc.name as category_name, fc.color as category_color
         FROM favorites f
         LEFT JOIN favorite_categories fc ON f.category_id = fc.id
         WHERE f.id = ?`,
        [favoriteId]
      )

      return res.json({ success: true, data: updatedFavorite[0] })
    } catch (error) {
      if (error instanceof HttpError) throw error
      throw HttpError.internal('更新收藏夹失败', { error: dbDetails(error), body: req.body })
    }
  }

  // 删除收藏夹
  static async deleteFavorite(req: AuthRequest, res: Response<ApiResponse<null>>) {
    try {
      const userId = ensureUser(req)
      const favoriteId = parseInt(req.params.id)
      if (isNaN(favoriteId)) throw new ValidationError('请求参数验证失败', ['无效的收藏夹ID'])

      const [result] = await pool.query<ResultSetHeader>('DELETE FROM favorites WHERE id = ? AND user_id = ?', [
        favoriteId,
        userId,
      ])
      if (result.affectedRows === 0) throw HttpError.notFound('收藏夹不存在或无权删除')

      return res.json({ success: true, data: null })
    } catch (error) {
      if (error instanceof HttpError) throw error
      throw HttpError.internal('删除收藏夹失败', { error: dbDetails(error) })
    }
  }

  // 添加收藏项目
  static async addFavoriteItem(req: AuthRequest, res: Response<ApiResponse<IFavoriteItem>>) {
    try {
      const userId = ensureUser(req)
      const favoriteId = parseInt(req.params.id)
      if (isNaN(favoriteId)) throw new ValidationError('请求参数验证失败', ['无效的收藏夹ID'])

      const parsed = addFavoriteItemSchema.safeParse(req.body)
      if (!parsed.success) throw new ValidationError('请求参数验证失败', zodErrors(parsed.error))

      const { item_type, item_id, title, description, tags, notes } = parsed.data

      const [favorites] = await pool.query<IFavorite[]>('SELECT * FROM favorites WHERE id = ? AND user_id = ?', [
        favoriteId,
        userId,
      ])
      if (favorites.length === 0) throw HttpError.notFound('收藏夹不存在或无权操作')

      const [existing] = await pool.query<IFavoriteItem[]>(
        'SELECT * FROM favorite_items WHERE favorite_id = ? AND item_type = ? AND item_id = ?',
        [favoriteId, item_type, item_id]
      )
      if (existing.length > 0) throw new ValidationError('请求参数验证失败', ['该项目已在收藏夹中'])

      const [result] = await pool.query<ResultSetHeader>(
        'INSERT INTO favorite_items (favorite_id, item_type, item_id, title, description, tags, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [favoriteId, item_type, item_id, title || '', description || '', JSON.stringify(tags || []), notes || '']
      )

      const [item] = await pool.query<IFavoriteItem[]>('SELECT * FROM favorite_items WHERE id = ?', [result.insertId])
      return res.status(201).json({ success: true, data: item[0] })
    } catch (error) {
      if (error instanceof HttpError) throw error
      throw HttpError.internal('添加收藏项目失败', { error: dbDetails(error), body: req.body })
    }
  }

  // 删除收藏项目
  static async removeFavoriteItem(req: AuthRequest, res: Response<ApiResponse<null>>) {
    try {
      const userId = ensureUser(req)
      const favoriteId = parseInt(req.params.id)
      const itemId = parseInt(req.params.itemId)
      if (isNaN(favoriteId) || isNaN(itemId)) {
        throw new ValidationError('请求参数验证失败', ['无效的ID'])
      }

      const [favorites] = await pool.query<IFavorite[]>('SELECT * FROM favorites WHERE id = ? AND user_id = ?', [
        favoriteId,
        userId,
      ])
      if (favorites.length === 0) throw HttpError.notFound('收藏夹不存在或无权操作')

      const [result] = await pool.query<ResultSetHeader>(
        'DELETE FROM favorite_items WHERE id = ? AND favorite_id = ?',
        [itemId, favoriteId]
      )
      if (result.affectedRows === 0) throw HttpError.notFound('收藏项目不存在')

      return res.json({ success: true, data: null })
    } catch (error) {
      if (error instanceof HttpError) throw error
      throw HttpError.internal('删除收藏项目失败', { error: dbDetails(error) })
    }
  }

  // 生成分享链接
  static async generateShareLink(
    req: AuthRequest,
    res: Response<ApiResponse<{ share_code: string; share_url: string }>>
  ) {
    try {
      const userId = ensureUser(req)
      const favoriteId = parseInt(req.params.id)
      if (isNaN(favoriteId)) throw new ValidationError('请求参数验证失败', ['无效的收藏夹ID'])

      const { permission, expires_in_days } = req.body

      const [favorites] = await pool.query<IFavorite[]>('SELECT * FROM favorites WHERE id = ? AND user_id = ?', [
        favoriteId,
        userId,
      ])
      if (favorites.length === 0) throw HttpError.notFound('收藏夹不存在或无权操作')

      const shareCode = crypto.randomBytes(16).toString('hex')
      const expiresAt = expires_in_days ? new Date(Date.now() + Number(expires_in_days) * 24 * 60 * 60 * 1000) : null

      await pool.query(
        'INSERT INTO favorite_shares (favorite_id, shared_by, permission, share_code, expires_at) VALUES (?, ?, ?, ?, ?)',
        [favoriteId, userId, permission || 'view', shareCode, expiresAt]
      )

      const shareUrl = `${req.protocol}://${req.get('host')}/shared/favorites/${shareCode}`
      return res.json({ success: true, data: { share_code: shareCode, share_url: shareUrl } })
    } catch (error) {
      if (error instanceof HttpError) throw error
      throw HttpError.internal('生成分享链接失败', { error: dbDetails(error), body: req.body })
    }
  }

  // 通过分享码访问收藏夹
  static async getSharedFavorite(
    req: AuthRequest,
    res: Response<ApiResponse<{ favorite: IFavorite; items: IFavoriteItem[] }>>
  ) {
    try {
      const userId = ensureUser(req)
      const shareCode = req.params.shareCode

      const [shares] = await pool.query<RowDataPacket[]>(
        'SELECT * FROM favorite_shares WHERE share_code = ? AND (expires_at IS NULL OR expires_at > NOW())',
        [shareCode]
      )
      if (shares.length === 0) throw HttpError.notFound('分享链接不存在或已过期')

      const share: any = shares[0]
      const favoriteId = Number(share.favorite_id)

      const [favorites] = await pool.query<IFavorite[]>(
        `SELECT f.*, fc.name as category_name, fc.color as category_color
         FROM favorites f
         LEFT JOIN favorite_categories fc ON f.category_id = fc.id
         WHERE f.id = ?`,
        [favoriteId]
      )
      if (favorites.length === 0) throw HttpError.notFound('收藏夹不存在')

      const [items] = await pool.query<IFavoriteItem[]>(
        'SELECT * FROM favorite_items WHERE favorite_id = ? ORDER BY sort_order ASC, created_at DESC',
        [favoriteId]
      )

      await pool.query(
        'INSERT INTO favorite_access_logs (favorite_id, user_id, access_type, ip_address) VALUES (?, ?, ?, ?)',
        [favoriteId, userId, 'share', req.ip]
      )

      return res.json({ success: true, data: { favorite: favorites[0], items } })
    } catch (error) {
      if (error instanceof HttpError) throw error
      throw HttpError.internal('访问分享收藏夹失败', { error: dbDetails(error) })
    }
  }

  // 获取收藏夹分类
  static async getCategories(req: AuthRequest, res: Response<ApiResponse<IFavoriteCategory[]>>) {
    try {
      const [categories] = await pool.query<IFavoriteCategory[]>(
        'SELECT * FROM favorite_categories ORDER BY sort_order ASC'
      )
      return res.json({ success: true, data: categories })
    } catch (error) {
      throw HttpError.internal('获取收藏夹分类失败', { error: dbDetails(error) })
    }
  }

  // 检查收藏状态
  static async checkFavoriteStatus(req: AuthRequest, res: Response<ApiResponse<{ is_favorited: boolean }>>) {
    try {
      const userId = ensureUser(req)
      const parsed = checkStatusParamsSchema.safeParse(req.params)
      if (!parsed.success) throw new ValidationError('请求参数验证失败', zodErrors(parsed.error))

      const { itemType, itemId } = parsed.data

      const [items] = await pool.query<RowDataPacket[]>(
        'SELECT fi.id FROM favorite_items fi INNER JOIN favorites f ON fi.favorite_id = f.id WHERE f.user_id = ? AND fi.item_type = ? AND fi.item_id = ?',
        [userId, itemType, itemId]
      )

      return res.json({ success: true, data: { is_favorited: items.length > 0 } })
    } catch (error) {
      if (error instanceof HttpError) throw error
      throw HttpError.internal('检查收藏状态失败', { error: dbDetails(error) })
    }
  }

  // 快速收藏
  static async quickFavorite(req: AuthRequest, res: Response<ApiResponse<null>>) {
    try {
      const userId = ensureUser(req)
      const parsed = quickFavoriteSchema.safeParse(req.body)
      if (!parsed.success) throw new ValidationError('请求参数验证失败', zodErrors(parsed.error))

      const { item_type, item_id, title, description } = parsed.data

      let [favorites] = await pool.query<IFavorite[]>(
        'SELECT * FROM favorites WHERE user_id = ? AND name = "默认收藏夹" LIMIT 1',
        [userId]
      )

      let favoriteId: number
      if (favorites.length === 0) {
        const [result] = await pool.query<ResultSetHeader>(
          'INSERT INTO favorites (user_id, name, description, is_public) VALUES (?, ?, ?, ?)',
          [userId, '默认收藏夹', '系统自动创建的默认收藏夹', false]
        )
        favoriteId = result.insertId
      } else {
        favoriteId = favorites[0].id
      }

      const [existing] = await pool.query<IFavoriteItem[]>(
        'SELECT * FROM favorite_items WHERE favorite_id = ? AND item_type = ? AND item_id = ?',
        [favoriteId, item_type, item_id]
      )
      if (existing.length > 0) throw new ValidationError('请求参数验证失败', ['该项目已收藏'])

      await pool.query<ResultSetHeader>(
        'INSERT INTO favorite_items (favorite_id, item_type, item_id, title, description, tags, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [favoriteId, item_type, item_id, title || '', description || '', JSON.stringify([]), '']
      )

      return res.json({ success: true, data: null })
    } catch (error) {
      if (error instanceof HttpError) throw error
      throw HttpError.internal('收藏失败', { error: dbDetails(error), body: req.body })
    }
  }

  // 取消收藏
  static async unfavoriteItem(req: AuthRequest, res: Response<ApiResponse<null>>) {
    try {
      const userId = ensureUser(req)
      const { item_type, item_id } = req.body || {}
      const parsed = quickFavoriteSchema.pick({ item_type: true, item_id: true }).safeParse({ item_type, item_id })
      if (!parsed.success) throw new ValidationError('请求参数验证失败', zodErrors(parsed.error))

      const [result] = await pool.query<ResultSetHeader>(
        'DELETE fi FROM favorite_items fi INNER JOIN favorites f ON fi.favorite_id = f.id WHERE f.user_id = ? AND fi.item_type = ? AND fi.item_id = ?',
        [userId, parsed.data.item_type, parsed.data.item_id]
      )
      if (result.affectedRows === 0) throw new ValidationError('请求参数验证失败', ['该项目未收藏'])

      return res.json({ success: true, data: null })
    } catch (error) {
      if (error instanceof HttpError) throw error
      throw HttpError.internal('取消收藏失败', { error: dbDetails(error), body: req.body })
    }
  }

  // 搜索收藏项目
  static async searchFavoriteItems(req: AuthRequest, res: Response<ApiResponse<IFavoriteItem[]>>) {
    try {
      const userId = ensureUser(req)
      const parsed = searchItemsQuerySchema.safeParse(req.query)
      if (!parsed.success) throw new ValidationError('请求参数验证失败', zodErrors(parsed.error))

      const { keyword, item_type, favorite_id } = parsed.data

      let whereClause = 'WHERE f.user_id = ?'
      const params: any[] = [userId]

      if (keyword) {
        whereClause += ' AND (fi.title LIKE ? OR fi.description LIKE ?)'
        params.push(`%${keyword}%`, `%${keyword}%`)
      }
      if (item_type) {
        whereClause += ' AND fi.item_type = ?'
        params.push(item_type)
      }
      if (favorite_id) {
        whereClause += ' AND fi.favorite_id = ?'
        params.push(Number(favorite_id))
      }

      const [items] = await pool.query<IFavoriteItem[]>(
        `SELECT fi.* FROM favorite_items fi 
         INNER JOIN favorites f ON fi.favorite_id = f.id 
         ${whereClause} 
         ORDER BY fi.created_at DESC`,
        params
      )

      return res.json({ success: true, data: items })
    } catch (error) {
      if (error instanceof HttpError) throw error
      throw HttpError.internal('搜索失败', { error: dbDetails(error) })
    }
  }

  // 批量移动收藏项目
  static async moveItemsToFavorite(req: AuthRequest, res: Response<ApiResponse<null>>) {
    try {
      const userId = ensureUser(req)
      const parsed = moveItemsSchema.safeParse(req.body)
      if (!parsed.success) throw new ValidationError('请求参数验证失败', zodErrors(parsed.error))

      const { item_ids, target_favorite_id } = parsed.data

      const [targetFavorites] = await pool.query<IFavorite[]>('SELECT * FROM favorites WHERE id = ? AND user_id = ?', [
        target_favorite_id,
        userId,
      ])
      if (targetFavorites.length === 0) throw HttpError.notFound('目标收藏夹不存在或无权操作')

      await pool.query<ResultSetHeader>(
        'UPDATE favorite_items fi INNER JOIN favorites f ON fi.favorite_id = f.id SET fi.favorite_id = ? WHERE f.user_id = ? AND fi.id IN (?)',
        [target_favorite_id, userId, item_ids]
      )

      return res.json({ success: true, data: null })
    } catch (error) {
      if (error instanceof HttpError) throw error
      throw HttpError.internal('移动失败', { error: dbDetails(error), body: req.body })
    }
  }

  // 复制收藏夹
  static async copyFavorite(req: AuthRequest, res: Response<ApiResponse<{ favorite_id: number }>>) {
    try {
      const userId = ensureUser(req)
      const favoriteId = parseInt(req.params.id)
      if (isNaN(favoriteId)) throw new ValidationError('请求参数验证失败', ['无效的收藏夹ID'])

      const new_name = (req.body?.new_name ?? '').toString().trim()
      if (!new_name) throw new ValidationError('请求参数验证失败', ['新名称不能为空'])

      const [sourceFavorites] = await pool.query<IFavorite[]>(
        'SELECT * FROM favorites WHERE id = ? AND (user_id = ? OR is_public = TRUE)',
        [favoriteId, userId]
      )
      if (sourceFavorites.length === 0) throw HttpError.notFound('源收藏夹不存在或无权访问')

      const sourceFavorite = sourceFavorites[0]

      const [result] = await pool.query<ResultSetHeader>(
        'INSERT INTO favorites (user_id, name, description, is_public, category_id) VALUES (?, ?, ?, ?, ?)',
        [
          userId,
          new_name || `${sourceFavorite.name} - 副本`,
          sourceFavorite.description,
          false,
          sourceFavorite.category_id,
        ]
      )
      const newFavoriteId = result.insertId

      await pool.query(
        'INSERT INTO favorite_items (favorite_id, item_type, item_id, title, description, tags, notes, sort_order) SELECT ?, item_type, item_id, title, description, tags, notes, sort_order FROM favorite_items WHERE favorite_id = ?',
        [newFavoriteId, favoriteId]
      )

      return res.json({ success: true, data: { favorite_id: newFavoriteId } })
    } catch (error) {
      if (error instanceof HttpError) throw error
      throw HttpError.internal('复制失败', { error: dbDetails(error) })
    }
  }

  // 更新收藏项目排序
  static async updateItemsOrder(req: AuthRequest, res: Response<ApiResponse<null>>) {
    try {
      const userId = ensureUser(req)
      const favoriteId = parseInt(req.params.id)
      if (isNaN(favoriteId)) throw new ValidationError('请求参数验证失败', ['无效的收藏夹ID'])

      const parsed = updateOrderSchema.safeParse(req.body)
      if (!parsed.success) throw new ValidationError('请求参数验证失败', zodErrors(parsed.error))

      for (const order of parsed.data.item_orders) {
        await pool.query('UPDATE favorite_items SET sort_order = ? WHERE id = ? AND favorite_id = ?', [
          order.sort_order,
          order.item_id,
          favoriteId,
        ])
      }

      return res.json({ success: true, data: null })
    } catch (error) {
      if (error instanceof HttpError) throw error
      throw HttpError.internal('排序更新失败', { error: dbDetails(error) })
    }
  }

  // 获取用户收藏统计
  static async getUserFavoriteStats(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const userId = ensureUser(req)

      const [stats] = await pool.query<RowDataPacket[]>(
        `SELECT 
           COUNT(DISTINCT f.id) as favorites_count,
           COUNT(DISTINCT fi.id) as items_count,
           COUNT(DISTINCT CASE WHEN fi.item_type = 'question' THEN fi.id END) as questions_count,
           COUNT(DISTINCT CASE WHEN fi.item_type = 'exam' THEN fi.id END) as exams_count,
           COUNT(DISTINCT CASE WHEN fi.item_type = 'task' THEN fi.id END) as tasks_count,
           COUNT(DISTINCT CASE WHEN fi.item_type = 'note' THEN fi.id END) as notes_count
         FROM favorites f
         LEFT JOIN favorite_items fi ON f.id = fi.favorite_id
         WHERE f.user_id = ?`,
        [userId]
      )

      return res.json({ success: true, data: stats[0] })
    } catch (error) {
      throw HttpError.internal('获取统计失败', { error: dbDetails(error) })
    }
  }

  // 获取热门公开收藏夹
  static async getPopularPublicFavorites(req: AuthRequest, res: Response<ApiResponse<IFavorite[]>>) {
    try {
      const limit = parseInt(req.query.limit as string) || 10

      const [favorites] = await pool.query<IFavorite[]>(
        `SELECT f.*, fc.name as category_name, fc.color as category_color,
                COUNT(fi.id) as items_count,
                COUNT(DISTINCT fal.user_id) as views_count
         FROM favorites f
         LEFT JOIN favorite_categories fc ON f.category_id = fc.id
         LEFT JOIN favorite_items fi ON f.id = fi.favorite_id
         LEFT JOIN favorite_access_logs fal ON f.id = fal.favorite_id
         WHERE f.is_public = TRUE
         GROUP BY f.id
         ORDER BY views_count DESC, items_count DESC
         LIMIT ?`,
        [limit]
      )

      return res.json({ success: true, data: favorites })
    } catch (error) {
      throw HttpError.internal('获取热门收藏夹失败', { error: dbDetails(error) })
    }
  }
}
