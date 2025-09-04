import { ResultSetHeader, RowDataPacket } from 'mysql2'
import { pool } from '../config/database.js'

interface IFavoriteItem {
  id: number
  favorite_id: number
  item_type: 'question' | 'exam' | 'task' | 'note'
  item_id: number
  title: string
  description: string
  tags: string[]
  notes: string
  sort_order: number
  created_at: Date
  updated_at: Date
}

interface IFavoriteStats {
  total_favorites: number
  total_items: number
  public_favorites: number
  shared_favorites: number
  categories_used: number
}

export class FavoritesService {
  // 检查用户是否已收藏某个项目
  async isItemFavorited(userId: number, itemType: string, itemId: number): Promise<boolean> {
    try {
      const [result] = await pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) as count FROM favorite_items fi
         JOIN favorites f ON fi.favorite_id = f.id
         WHERE f.user_id = ? AND fi.item_type = ? AND fi.item_id = ?`,
        [userId, itemType, itemId]
      )
      return result[0].count > 0
    } catch (error) {
      console.error('检查收藏状态错误:', error)
      return false
    }
  }

  // 快速收藏项目到默认收藏夹
  async quickFavorite(
    userId: number,
    itemType: string,
    itemId: number,
    title?: string,
    description?: string
  ): Promise<boolean> {
    const connection = await pool.getConnection()
    try {
      await connection.beginTransaction()

      // 查找或创建默认收藏夹
      let [favorites] = await connection.query<RowDataPacket[]>(
        'SELECT id FROM favorites WHERE user_id = ? AND name = "默认收藏夹" LIMIT 1',
        [userId]
      )

      let favoriteId: number
      if (favorites.length === 0) {
        // 创建默认收藏夹
        const [result] = await connection.query<ResultSetHeader>(
          'INSERT INTO favorites (user_id, name, description) VALUES (?, ?, ?)',
          [userId, '默认收藏夹', '系统自动创建的默认收藏夹']
        )
        favoriteId = result.insertId
      } else {
        favoriteId = favorites[0].id
      }

      // 检查是否已收藏
      const [existing] = await connection.query<RowDataPacket[]>(
        'SELECT id FROM favorite_items WHERE favorite_id = ? AND item_type = ? AND item_id = ?',
        [favoriteId, itemType, itemId]
      )

      if (existing.length > 0) {
        await connection.rollback()
        return false // 已收藏
      }

      // 添加收藏项目
      await connection.query(
        'INSERT INTO favorite_items (favorite_id, item_type, item_id, title, description) VALUES (?, ?, ?, ?, ?)',
        [favoriteId, itemType, itemId, title || '', description || '']
      )

      await connection.commit()
      return true
    } catch (error) {
      await connection.rollback()
      console.error('快速收藏错误:', error)
      return false
    } finally {
      connection.release()
    }
  }

  // 取消收藏项目
  async unfavoriteItem(userId: number, itemType: string, itemId: number): Promise<boolean> {
    try {
      const [result] = await pool.query<ResultSetHeader>(
        `DELETE fi FROM favorite_items fi
         JOIN favorites f ON fi.favorite_id = f.id
         WHERE f.user_id = ? AND fi.item_type = ? AND fi.item_id = ?`,
        [userId, itemType, itemId]
      )
      return result.affectedRows > 0
    } catch (error) {
      console.error('取消收藏错误:', error)
      return false
    }
  }

  // 获取用户收藏统计
  async getUserFavoriteStats(userId: number): Promise<IFavoriteStats> {
    try {
      const [stats] = await pool.query<RowDataPacket[]>(
        `SELECT 
           COUNT(DISTINCT f.id) as total_favorites,
           COUNT(DISTINCT fi.id) as total_items,
           COUNT(DISTINCT CASE WHEN f.is_public = TRUE THEN f.id END) as public_favorites,
           COUNT(DISTINCT fs.id) as shared_favorites,
           COUNT(DISTINCT f.category_id) as categories_used
         FROM favorites f
         LEFT JOIN favorite_items fi ON f.id = fi.favorite_id
         LEFT JOIN favorite_shares fs ON f.id = fs.favorite_id
         WHERE f.user_id = ?`,
        [userId]
      )

      return {
        total_favorites: stats[0].total_favorites || 0,
        total_items: stats[0].total_items || 0,
        public_favorites: stats[0].public_favorites || 0,
        shared_favorites: stats[0].shared_favorites || 0,
        categories_used: stats[0].categories_used || 0,
      }
    } catch (error) {
      console.error('获取收藏统计错误:', error)
      return {
        total_favorites: 0,
        total_items: 0,
        public_favorites: 0,
        shared_favorites: 0,
        categories_used: 0,
      }
    }
  }

  // 搜索收藏项目
  async searchFavoriteItems(
    userId: number,
    keyword: string,
    itemType?: string,
    favoriteId?: number
  ): Promise<IFavoriteItem[]> {
    try {
      let whereClause = 'WHERE f.user_id = ? AND (fi.title LIKE ? OR fi.description LIKE ? OR fi.notes LIKE ?)'
      const params: any[] = [userId, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`]

      if (itemType) {
        whereClause += ' AND fi.item_type = ?'
        params.push(itemType)
      }
      if (favoriteId) {
        whereClause += ' AND fi.favorite_id = ?'
        params.push(favoriteId)
      }

      // ✅ 这里改：IFavoriteItem[] -> (RowDataPacket & IFavoriteItem)[]
      const [items] = await pool.query<(RowDataPacket & IFavoriteItem)[]>(
        `SELECT fi.*, f.name as favorite_name
       FROM favorite_items fi
       JOIN favorites f ON fi.favorite_id = f.id
       ${whereClause}
       ORDER BY fi.updated_at DESC
       LIMIT 50`,
        params
      )

      return items // 类型现在满足 Promise<IFavoriteItem[]>
    } catch (error) {
      console.error('搜索收藏项目错误:', error)
      return []
    }
  }

  // 批量移动收藏项目
  async moveItemsToFavorite(userId: number, itemIds: number[], targetFavoriteId: number): Promise<boolean> {
    const connection = await pool.getConnection()
    try {
      await connection.beginTransaction()

      // 检查目标收藏夹权限
      const [targetFavorite] = await connection.query<RowDataPacket[]>(
        'SELECT id FROM favorites WHERE id = ? AND user_id = ?',
        [targetFavoriteId, userId]
      )

      if (targetFavorite.length === 0) {
        await connection.rollback()
        return false
      }

      // 批量更新收藏项目
      const placeholders = itemIds.map(() => '?').join(',')
      await connection.query(
        `UPDATE favorite_items fi
         JOIN favorites f ON fi.favorite_id = f.id
         SET fi.favorite_id = ?
         WHERE f.user_id = ? AND fi.id IN (${placeholders})`,
        [targetFavoriteId, userId, ...itemIds]
      )

      await connection.commit()
      return true
    } catch (error) {
      await connection.rollback()
      console.error('批量移动收藏项目错误:', error)
      return false
    } finally {
      connection.release()
    }
  }

  // 复制收藏夹
  async copyFavorite(userId: number, sourceFavoriteId: number, newName: string): Promise<number | null> {
    const connection = await pool.getConnection()
    try {
      await connection.beginTransaction()

      // 获取源收藏夹信息
      const [sourceFavorites] = await connection.query<RowDataPacket[]>(
        'SELECT * FROM favorites WHERE id = ? AND (user_id = ? OR is_public = TRUE)',
        [sourceFavoriteId, userId]
      )

      if (sourceFavorites.length === 0) {
        await connection.rollback()
        return null
      }

      const sourceFavorite = sourceFavorites[0]

      // 创建新收藏夹
      const [result] = await connection.query<ResultSetHeader>(
        'INSERT INTO favorites (user_id, name, description, category_id) VALUES (?, ?, ?, ?)',
        [userId, newName, `复制自：${sourceFavorite.name}`, sourceFavorite.category_id]
      )

      const newFavoriteId = result.insertId

      // 复制收藏项目
      await connection.query(
        `INSERT INTO favorite_items (favorite_id, item_type, item_id, title, description, tags, notes, sort_order)
         SELECT ?, item_type, item_id, title, description, tags, notes, sort_order
         FROM favorite_items
         WHERE favorite_id = ?`,
        [newFavoriteId, sourceFavoriteId]
      )

      await connection.commit()
      return newFavoriteId
    } catch (error) {
      await connection.rollback()
      console.error('复制收藏夹错误:', error)
      return null
    } finally {
      connection.release()
    }
  }

  // 清理过期分享链接
  async cleanupExpiredShares(): Promise<number> {
    try {
      const [result] = await pool.query<ResultSetHeader>(
        'DELETE FROM favorite_shares WHERE expires_at IS NOT NULL AND expires_at < NOW()'
      )
      return result.affectedRows
    } catch (error) {
      console.error('清理过期分享链接错误:', error)
      return 0
    }
  }

  // 获取热门公开收藏夹
  async getPopularPublicFavorites(limit: number = 10): Promise<RowDataPacket[]> {
    try {
      const [favorites] = await pool.query<RowDataPacket[]>(
        `SELECT f.*, u.username, fc.name as category_name, fc.color as category_color,
                COUNT(DISTINCT fi.id) as items_count,
                COUNT(DISTINCT fal.id) as views_count
         FROM favorites f
         JOIN users u ON f.user_id = u.id
         LEFT JOIN favorite_categories fc ON f.category_id = fc.id
         LEFT JOIN favorite_items fi ON f.id = fi.favorite_id
         LEFT JOIN favorite_access_logs fal ON f.id = fal.favorite_id AND fal.access_type = 'view'
         WHERE f.is_public = TRUE
         GROUP BY f.id
         ORDER BY views_count DESC, items_count DESC, f.updated_at DESC
         LIMIT ?`,
        [limit]
      )

      return favorites
    } catch (error) {
      console.error('获取热门公开收藏夹错误:', error)
      return []
    }
  }

  // 更新收藏项目排序
  async updateItemsOrder(
    userId: number,
    favoriteId: number,
    itemOrders: { id: number; sort_order: number }[]
  ): Promise<boolean> {
    const connection = await pool.getConnection()
    try {
      await connection.beginTransaction()

      // 检查收藏夹权限
      const [favorites] = await connection.query<RowDataPacket[]>(
        'SELECT id FROM favorites WHERE id = ? AND user_id = ?',
        [favoriteId, userId]
      )

      if (favorites.length === 0) {
        await connection.rollback()
        return false
      }

      // 批量更新排序
      for (const item of itemOrders) {
        await connection.query('UPDATE favorite_items SET sort_order = ? WHERE id = ? AND favorite_id = ?', [
          item.sort_order,
          item.id,
          favoriteId,
        ])
      }

      await connection.commit()
      return true
    } catch (error) {
      await connection.rollback()
      console.error('更新收藏项目排序错误:', error)
      return false
    } finally {
      connection.release()
    }
  }
}
