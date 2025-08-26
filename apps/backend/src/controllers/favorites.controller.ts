import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { pool } from '../config/database.js';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { ApiResponse } from '../types/response.js';
import crypto from 'crypto';
import { FavoritesService } from '../services/favorites.service.js';

interface IFavorite extends RowDataPacket {
  id: number;
  user_id: number;
  name: string;
  description: string;
  is_public: boolean;
  category_id: number;
  created_at: Date;
  updated_at: Date;
  category_name?: string;
  category_color?: string;
  items_count?: number;
}

interface IFavoriteItem extends RowDataPacket {
  id: number;
  favorite_id: number;
  item_type: 'question' | 'exam' | 'task' | 'note';
  item_id: number;
  title: string;
  description: string;
  tags: string[];
  notes: string;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
}

interface IFavoriteCategory extends RowDataPacket {
  id: number;
  name: string;
  description: string;
  color: string;
  icon: string;
  sort_order: number;
}

export class FavoritesController {
  private favoritesService: FavoritesService;

  constructor() {
    this.favoritesService = new FavoritesService();
  }

  // 获取用户收藏夹列表
  static async getFavorites(req: AuthRequest, res: Response<ApiResponse<{ favorites: IFavorite[]; categories: IFavoriteCategory[] }>>) {
    try {
      const userId = req.user?.id;
      const { category_id, is_public } = req.query;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: '未授权访问'
        });
      }

      let whereClause = 'WHERE f.user_id = ?';
      const params: any[] = [userId];

      if (category_id) {
        whereClause += ' AND f.category_id = ?';
        params.push(category_id);
      }

      if (is_public !== undefined) {
        whereClause += ' AND f.is_public = ?';
        params.push(is_public === 'true');
      }

      const [favorites] = await pool.query<IFavorite[]>(
        `SELECT f.*, fc.name as category_name, fc.color as category_color,
                COUNT(fi.id) as items_count
         FROM favorites f
         LEFT JOIN favorite_categories fc ON f.category_id = fc.id
         LEFT JOIN favorite_items fi ON f.id = fi.favorite_id
         ${whereClause}
         GROUP BY f.id
         ORDER BY f.updated_at DESC`,
        params
      );

      const [categories] = await pool.query<IFavoriteCategory[]>(
        'SELECT * FROM favorite_categories ORDER BY sort_order ASC'
      );

      return res.json({
        success: true,
        data: { favorites, categories }
      });
    } catch (error) {
      console.error('获取收藏夹列表错误:', error);
      return res.status(500).json({
        success: false,
        error: '获取收藏夹列表失败'
      });
    }
  }

  // 获取收藏夹详情
  static async getFavoriteById(req: AuthRequest, res: Response<ApiResponse<{ favorite: IFavorite; items: IFavoriteItem[] }>>) {
    try {
      const userId = req.user?.id;
      const favoriteId = parseInt(req.params.id);

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: '未授权访问'
        });
      }

      if (isNaN(favoriteId)) {
        return res.status(400).json({
          success: false,
          error: '无效的收藏夹ID'
        });
      }

      // 获取收藏夹信息
      const [favorites] = await pool.query<IFavorite[]>(
        `SELECT f.*, fc.name as category_name, fc.color as category_color
         FROM favorites f
         LEFT JOIN favorite_categories fc ON f.category_id = fc.id
         WHERE f.id = ? AND (f.user_id = ? OR f.is_public = TRUE)`,
        [favoriteId, userId]
      );

      if (favorites.length === 0) {
        return res.status(404).json({
          success: false,
          error: '收藏夹不存在或无权访问'
        });
      }

      // 获取收藏项目
      const [items] = await pool.query<IFavoriteItem[]>(
        'SELECT * FROM favorite_items WHERE favorite_id = ? ORDER BY sort_order ASC, created_at DESC',
        [favoriteId]
      );

      // 记录访问日志
      if (favorites[0].user_id !== userId) {
        await pool.query(
          'INSERT INTO favorite_access_logs (favorite_id, user_id, access_type, ip_address) VALUES (?, ?, ?, ?)',
          [favoriteId, userId, 'view', req.ip]
        );
      }

      return res.json({
        success: true,
        data: { favorite: favorites[0], items }
      });
    } catch (error) {
      console.error('获取收藏夹详情错误:', error);
      return res.status(500).json({
        success: false,
        error: '获取收藏夹详情失败'
      });
    }
  }

  // 创建收藏夹
  static async createFavorite(req: AuthRequest, res: Response<ApiResponse<IFavorite>>) {
    try {
      const userId = req.user?.id;
      const { name, description, is_public, category_id } = req.body;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: '未授权访问'
        });
      }

      if (!name || name.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: '收藏夹名称不能为空'
        });
      }

      const [result] = await pool.query<ResultSetHeader>(
        'INSERT INTO favorites (user_id, name, description, is_public, category_id) VALUES (?, ?, ?, ?, ?)',
        [userId, name.trim(), description || '', is_public || false, category_id || null]
      );

      const [favorite] = await pool.query<IFavorite[]>(
        `SELECT f.*, fc.name as category_name, fc.color as category_color
         FROM favorites f
         LEFT JOIN favorite_categories fc ON f.category_id = fc.id
         WHERE f.id = ?`,
        [result.insertId]
      );

      return res.status(201).json({
        success: true,
        data: favorite[0]
      });
    } catch (error) {
      console.error('创建收藏夹错误:', error);
      return res.status(500).json({
        success: false,
        error: '创建收藏夹失败'
      });
    }
  }

  // 更新收藏夹
  static async updateFavorite(req: AuthRequest, res: Response<ApiResponse<IFavorite>>) {
    try {
      const userId = req.user?.id;
      const favoriteId = parseInt(req.params.id);
      const { name, description, is_public, category_id } = req.body;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: '未授权访问'
        });
      }

      if (isNaN(favoriteId)) {
        return res.status(400).json({
          success: false,
          error: '无效的收藏夹ID'
        });
      }

      // 检查权限
      const [favorites] = await pool.query<IFavorite[]>(
        'SELECT * FROM favorites WHERE id = ? AND user_id = ?',
        [favoriteId, userId]
      );

      if (favorites.length === 0) {
        return res.status(404).json({
          success: false,
          error: '收藏夹不存在或无权修改'
        });
      }

      await pool.query(
        'UPDATE favorites SET name = ?, description = ?, is_public = ?, category_id = ? WHERE id = ?',
        [name || favorites[0].name, description || favorites[0].description, 
         is_public !== undefined ? is_public : favorites[0].is_public, 
         category_id !== undefined ? category_id : favorites[0].category_id, favoriteId]
      );

      const [updatedFavorite] = await pool.query<IFavorite[]>(
        `SELECT f.*, fc.name as category_name, fc.color as category_color
         FROM favorites f
         LEFT JOIN favorite_categories fc ON f.category_id = fc.id
         WHERE f.id = ?`,
        [favoriteId]
      );

      return res.json({
        success: true,
        data: updatedFavorite[0]
      });
    } catch (error) {
      console.error('更新收藏夹错误:', error);
      return res.status(500).json({
        success: false,
        error: '更新收藏夹失败'
      });
    }
  }

  // 删除收藏夹
  static async deleteFavorite(req: AuthRequest, res: Response<ApiResponse<null>>) {
    try {
      const userId = req.user?.id;
      const favoriteId = parseInt(req.params.id);

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: '未授权访问'
        });
      }

      if (isNaN(favoriteId)) {
        return res.status(400).json({
          success: false,
          error: '无效的收藏夹ID'
        });
      }

      const [result] = await pool.query<ResultSetHeader>(
        'DELETE FROM favorites WHERE id = ? AND user_id = ?',
        [favoriteId, userId]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          error: '收藏夹不存在或无权删除'
        });
      }

      return res.json({
        success: true,
        data: null
      });
    } catch (error) {
      console.error('删除收藏夹错误:', error);
      return res.status(500).json({
        success: false,
        error: '删除收藏夹失败'
      });
    }
  }

  // 添加收藏项目
  static async addFavoriteItem(req: AuthRequest, res: Response<ApiResponse<IFavoriteItem>>) {
    try {
      const userId = req.user?.id;
      const favoriteId = parseInt(req.params.id);
      const { item_type, item_id, title, description, tags, notes } = req.body;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: '未授权访问'
        });
      }

      if (isNaN(favoriteId)) {
        return res.status(400).json({
          success: false,
          error: '无效的收藏夹ID'
        });
      }

      // 检查收藏夹权限
      const [favorites] = await pool.query<IFavorite[]>(
        'SELECT * FROM favorites WHERE id = ? AND user_id = ?',
        [favoriteId, userId]
      );

      if (favorites.length === 0) {
        return res.status(404).json({
          success: false,
          error: '收藏夹不存在或无权操作'
        });
      }

      // 检查是否已收藏
      const [existing] = await pool.query<IFavoriteItem[]>(
        'SELECT * FROM favorite_items WHERE favorite_id = ? AND item_type = ? AND item_id = ?',
        [favoriteId, item_type, item_id]
      );

      if (existing.length > 0) {
        return res.status(400).json({
          success: false,
          error: '该项目已在收藏夹中'
        });
      }

      const [result] = await pool.query<ResultSetHeader>(
        'INSERT INTO favorite_items (favorite_id, item_type, item_id, title, description, tags, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [favoriteId, item_type, item_id, title || '', description || '', JSON.stringify(tags || []), notes || '']
      );

      const [item] = await pool.query<IFavoriteItem[]>(
        'SELECT * FROM favorite_items WHERE id = ?',
        [result.insertId]
      );

      return res.status(201).json({
        success: true,
        data: item[0]
      });
    } catch (error) {
      console.error('添加收藏项目错误:', error);
      return res.status(500).json({
        success: false,
        error: '添加收藏项目失败'
      });
    }
  }

  // 删除收藏项目
  static async removeFavoriteItem(req: AuthRequest, res: Response<ApiResponse<null>>) {
    try {
      const userId = req.user?.id;
      const favoriteId = parseInt(req.params.id);
      const itemId = parseInt(req.params.itemId);

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: '未授权访问'
        });
      }

      if (isNaN(favoriteId) || isNaN(itemId)) {
        return res.status(400).json({
          success: false,
          error: '无效的ID'
        });
      }

      // 检查权限
      const [favorites] = await pool.query<IFavorite[]>(
        'SELECT * FROM favorites WHERE id = ? AND user_id = ?',
        [favoriteId, userId]
      );

      if (favorites.length === 0) {
        return res.status(404).json({
          success: false,
          error: '收藏夹不存在或无权操作'
        });
      }

      const [result] = await pool.query<ResultSetHeader>(
        'DELETE FROM favorite_items WHERE id = ? AND favorite_id = ?',
        [itemId, favoriteId]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          error: '收藏项目不存在'
        });
      }

      return res.json({
        success: true,
        data: null
      });
    } catch (error) {
      console.error('删除收藏项目错误:', error);
      return res.status(500).json({
        success: false,
        error: '删除收藏项目失败'
      });
    }
  }

  // 生成分享链接
  static async generateShareLink(req: AuthRequest, res: Response<ApiResponse<{ share_code: string; share_url: string }>>) {
    try {
      const userId = req.user?.id;
      const favoriteId = parseInt(req.params.id);
      const { permission, expires_in_days } = req.body;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: '未授权访问'
        });
      }

      if (isNaN(favoriteId)) {
        return res.status(400).json({
          success: false,
          error: '无效的收藏夹ID'
        });
      }

      // 检查权限
      const [favorites] = await pool.query<IFavorite[]>(
        'SELECT * FROM favorites WHERE id = ? AND user_id = ?',
        [favoriteId, userId]
      );

      if (favorites.length === 0) {
        return res.status(404).json({
          success: false,
          error: '收藏夹不存在或无权操作'
        });
      }

      // 生成分享码
      const shareCode = crypto.randomBytes(16).toString('hex');
      const expiresAt = expires_in_days ? new Date(Date.now() + expires_in_days * 24 * 60 * 60 * 1000) : null;

      await pool.query(
        'INSERT INTO favorite_shares (favorite_id, shared_by, permission, share_code, expires_at) VALUES (?, ?, ?, ?, ?)',
        [favoriteId, userId, permission || 'view', shareCode, expiresAt]
      );

      const shareUrl = `${req.protocol}://${req.get('host')}/shared/favorites/${shareCode}`;

      return res.json({
        success: true,
        data: { share_code: shareCode, share_url: shareUrl }
      });
    } catch (error) {
      console.error('生成分享链接错误:', error);
      return res.status(500).json({
        success: false,
        error: '生成分享链接失败'
      });
    }
  }

  // 通过分享码访问收藏夹
  static async getSharedFavorite(req: AuthRequest, res: Response<ApiResponse<{ favorite: IFavorite; items: IFavoriteItem[] }>>) {
    try {
      const userId = req.user?.id;
      const shareCode = req.params.shareCode;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: '未授权访问'
        });
      }

      // 查找分享记录
      const [shares] = await pool.query<RowDataPacket[]>(
        'SELECT * FROM favorite_shares WHERE share_code = ? AND (expires_at IS NULL OR expires_at > NOW())',
        [shareCode]
      );

      if (shares.length === 0) {
        return res.status(404).json({
          success: false,
          error: '分享链接不存在或已过期'
        });
      }

      const share = shares[0];
      const favoriteId = share.favorite_id;

      // 获取收藏夹信息
      const [favorites] = await pool.query<IFavorite[]>(
        `SELECT f.*, fc.name as category_name, fc.color as category_color
         FROM favorites f
         LEFT JOIN favorite_categories fc ON f.category_id = fc.id
         WHERE f.id = ?`,
        [favoriteId]
      );

      if (favorites.length === 0) {
        return res.status(404).json({
          success: false,
          error: '收藏夹不存在'
        });
      }

      // 获取收藏项目
      const [items] = await pool.query<IFavoriteItem[]>(
        'SELECT * FROM favorite_items WHERE favorite_id = ? ORDER BY sort_order ASC, created_at DESC',
        [favoriteId]
      );

      // 记录访问日志
      await pool.query(
        'INSERT INTO favorite_access_logs (favorite_id, user_id, access_type, ip_address) VALUES (?, ?, ?, ?)',
        [favoriteId, userId, 'share', req.ip]
      );

      return res.json({
        success: true,
        data: { favorite: favorites[0], items }
      });
    } catch (error) {
      console.error('访问分享收藏夹错误:', error);
      return res.status(500).json({
        success: false,
        error: '访问分享收藏夹失败'
      });
    }
  }

  // 获取收藏夹分类
  static async getCategories(req: AuthRequest, res: Response<ApiResponse<IFavoriteCategory[]>>) {
    try {
      const [categories] = await pool.query<IFavoriteCategory[]>(
        'SELECT * FROM favorite_categories ORDER BY sort_order ASC'
      );

      return res.json({
        success: true,
        data: categories
      });
    } catch (error) {
      console.error('获取收藏夹分类错误:', error);
      return res.status(500).json({
        success: false,
        error: '获取收藏夹分类失败'
      });
    }
  }

  // 检查收藏状态
  static async checkFavoriteStatus(req: AuthRequest, res: Response<ApiResponse<{ is_favorited: boolean }>>) {
    try {
      const userId = req.user?.id;
      const { itemType, itemId } = req.params;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: '未授权访问'
        });
      }

      const [items] = await pool.query<RowDataPacket[]>(
        'SELECT fi.id FROM favorite_items fi INNER JOIN favorites f ON fi.favorite_id = f.id WHERE f.user_id = ? AND fi.item_type = ? AND fi.item_id = ?',
        [userId, itemType, parseInt(itemId)]
      );

      return res.json({
        success: true,
        data: { is_favorited: items.length > 0 }
      });
    } catch (error) {
      console.error('检查收藏状态错误:', error);
      return res.status(500).json({
        success: false,
        error: '检查收藏状态失败'
      });
    }
  }

  // 快速收藏
  static async quickFavorite(req: AuthRequest, res: Response<ApiResponse<null>>) {
    try {
      const userId = req.user?.id;
      const { item_type, item_id, title, description } = req.body;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: '未授权访问'
        });
      }

      // 获取或创建默认收藏夹
      let [favorites] = await pool.query<IFavorite[]>(
        'SELECT * FROM favorites WHERE user_id = ? AND name = "默认收藏夹" LIMIT 1',
        [userId]
      );

      let favoriteId;
      if (favorites.length === 0) {
        const [result] = await pool.query<ResultSetHeader>(
          'INSERT INTO favorites (user_id, name, description, is_public) VALUES (?, ?, ?, ?)',
          [userId, '默认收藏夹', '系统自动创建的默认收藏夹', false]
        );
        favoriteId = result.insertId;
      } else {
        favoriteId = favorites[0].id;
      }

      // 检查是否已收藏
      const [existing] = await pool.query<IFavoriteItem[]>(
        'SELECT * FROM favorite_items WHERE favorite_id = ? AND item_type = ? AND item_id = ?',
        [favoriteId, item_type, item_id]
      );

      if (existing.length > 0) {
        return res.status(400).json({
          success: false,
          error: '该项目已收藏'
        });
      }

      await pool.query<ResultSetHeader>(
        'INSERT INTO favorite_items (favorite_id, item_type, item_id, title, description, tags, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [favoriteId, item_type, item_id, title || '', description || '', JSON.stringify([]), '']
      );

      return res.json({
        success: true,
        data: null
      });
    } catch (error) {
      console.error('快速收藏错误:', error);
      return res.status(500).json({
        success: false,
        error: '收藏失败'
      });
    }
  }

  // 取消收藏
  static async unfavoriteItem(req: AuthRequest, res: Response<ApiResponse<null>>) {
    try {
      const userId = req.user?.id;
      const { item_type, item_id } = req.body;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: '未授权访问'
        });
      }

      const [result] = await pool.query<ResultSetHeader>(
        'DELETE fi FROM favorite_items fi INNER JOIN favorites f ON fi.favorite_id = f.id WHERE f.user_id = ? AND fi.item_type = ? AND fi.item_id = ?',
        [userId, item_type, item_id]
      );

      if (result.affectedRows === 0) {
        return res.status(400).json({
          success: false,
          error: '该项目未收藏'
        });
      }

      return res.json({
        success: true,
        data: null
      });
    } catch (error) {
      console.error('取消收藏错误:', error);
      return res.status(500).json({
        success: false,
        error: '取消收藏失败'
      });
    }
  }

  // 搜索收藏项目
  static async searchFavoriteItems(req: AuthRequest, res: Response<ApiResponse<IFavoriteItem[]>>) {
    try {
      const userId = req.user?.id;
      const { keyword, item_type, favorite_id } = req.query;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: '未授权访问'
        });
      }

      let whereClause = 'WHERE f.user_id = ?';
      const params: any[] = [userId];

      if (keyword) {
        whereClause += ' AND (fi.title LIKE ? OR fi.description LIKE ?)';
        params.push(`%${keyword}%`, `%${keyword}%`);
      }

      if (item_type) {
        whereClause += ' AND fi.item_type = ?';
        params.push(item_type);
      }

      if (favorite_id) {
        whereClause += ' AND fi.favorite_id = ?';
        params.push(favorite_id);
      }

      const [items] = await pool.query<IFavoriteItem[]>(
        `SELECT fi.* FROM favorite_items fi 
         INNER JOIN favorites f ON fi.favorite_id = f.id 
         ${whereClause} 
         ORDER BY fi.created_at DESC`,
        params
      );

      return res.json({
        success: true,
        data: items
      });
    } catch (error) {
      console.error('搜索收藏项目错误:', error);
      return res.status(500).json({
        success: false,
        error: '搜索失败'
      });
    }
  }

  // 批量移动收藏项目
  static async moveItemsToFavorite(req: AuthRequest, res: Response<ApiResponse<null>>) {
    try {
      const userId = req.user?.id;
      const { item_ids, target_favorite_id } = req.body;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: '未授权访问'
        });
      }

      // 检查目标收藏夹权限
      const [targetFavorites] = await pool.query<IFavorite[]>(
        'SELECT * FROM favorites WHERE id = ? AND user_id = ?',
        [target_favorite_id, userId]
      );

      if (targetFavorites.length === 0) {
        return res.status(404).json({
          success: false,
          error: '目标收藏夹不存在或无权操作'
        });
      }

      const [result] = await pool.query<ResultSetHeader>(
        'UPDATE favorite_items fi INNER JOIN favorites f ON fi.favorite_id = f.id SET fi.favorite_id = ? WHERE f.user_id = ? AND fi.id IN (?)',
        [target_favorite_id, userId, item_ids]
      );

      return res.json({
        success: true,
        data: null
      });
    } catch (error) {
      console.error('批量移动收藏项目错误:', error);
      return res.status(500).json({
        success: false,
        error: '移动失败'
      });
    }
  }

  // 复制收藏夹
  static async copyFavorite(req: AuthRequest, res: Response<ApiResponse<{ favorite_id: number }>>) {
    try {
      const userId = req.user?.id;
      const favoriteId = parseInt(req.params.id);
      const { new_name } = req.body;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: '未授权访问'
        });
      }

      if (isNaN(favoriteId)) {
        return res.status(400).json({
          success: false,
          error: '无效的收藏夹ID'
        });
      }

      // 获取源收藏夹
      const [sourceFavorites] = await pool.query<IFavorite[]>(
        'SELECT * FROM favorites WHERE id = ? AND (user_id = ? OR is_public = TRUE)',
        [favoriteId, userId]
      );

      if (sourceFavorites.length === 0) {
        return res.status(404).json({
          success: false,
          error: '源收藏夹不存在或无权访问'
        });
      }

      const sourceFavorite = sourceFavorites[0];

      // 创建新收藏夹
      const [result] = await pool.query<ResultSetHeader>(
        'INSERT INTO favorites (user_id, name, description, is_public, category_id) VALUES (?, ?, ?, ?, ?)',
        [userId, new_name || `${sourceFavorite.name} - 副本`, sourceFavorite.description, false, sourceFavorite.category_id]
      );

      const newFavoriteId = result.insertId;

      // 复制收藏项目
      await pool.query(
        'INSERT INTO favorite_items (favorite_id, item_type, item_id, title, description, tags, notes, sort_order) SELECT ?, item_type, item_id, title, description, tags, notes, sort_order FROM favorite_items WHERE favorite_id = ?',
        [newFavoriteId, favoriteId]
      );

      return res.json({
        success: true,
        data: { favorite_id: newFavoriteId }
      });
    } catch (error) {
      console.error('复制收藏夹错误:', error);
      return res.status(500).json({
        success: false,
        error: '复制失败'
      });
    }
  }

  // 更新收藏项目排序
  static async updateItemsOrder(req: AuthRequest, res: Response<ApiResponse<null>>) {
    try {
      const userId = req.user?.id;
      const favoriteId = parseInt(req.params.id);
      const { item_orders } = req.body;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: '未授权访问'
        });
      }

      if (isNaN(favoriteId)) {
        return res.status(400).json({
          success: false,
          error: '无效的收藏夹ID'
        });
      }

      // 检查权限
      const [favorites] = await pool.query<IFavorite[]>(
        'SELECT * FROM favorites WHERE id = ? AND user_id = ?',
        [favoriteId, userId]
      );

      if (favorites.length === 0) {
        return res.status(404).json({
          success: false,
          error: '收藏夹不存在或无权操作'
        });
      }

      // 批量更新排序
      for (const order of item_orders) {
        await pool.query(
          'UPDATE favorite_items SET sort_order = ? WHERE id = ? AND favorite_id = ?',
          [order.sort_order, order.item_id, favoriteId]
        );
      }

      return res.json({
        success: true,
        data: null
      });
    } catch (error) {
      console.error('更新收藏项目排序错误:', error);
      return res.status(500).json({
        success: false,
        error: '排序更新失败'
      });
    }
  }

  // 获取用户收藏统计
  static async getUserFavoriteStats(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: '未授权访问'
        });
      }

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
      );

      return res.json({
        success: true,
        data: stats[0]
      });
    } catch (error) {
      console.error('获取用户收藏统计错误:', error);
      return res.status(500).json({
        success: false,
        error: '获取统计失败'
      });
    }
  }

  // 获取热门公开收藏夹
  static async getPopularPublicFavorites(req: AuthRequest, res: Response<ApiResponse<IFavorite[]>>) {
    try {
      const limit = parseInt(req.query.limit as string) || 10;

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
      );

      return res.json({
        success: true,
        data: favorites
      });
    } catch (error) {
      console.error('获取热门公开收藏夹错误:', error);
      return res.status(500).json({
        success: false,
        error: '获取热门收藏夹失败'
      });
    }
  }
}