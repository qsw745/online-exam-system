// src/modules/favorites/favorites.repository.ts
import { pool } from '@infrastructure/db/index.js'
import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import type { IFavorite, IFavoriteCategory, IFavoriteItem } from '../domain/favorites.model.js'

export class FavoritesRepository {
  // 允许不显式传 conn（读操作一般不需要事务）
  private connOrPool(conn?: PoolConnection) {
    return conn ?? pool
  }

  async findByUser(
    userId: number,
    options: { category_id?: number; is_public?: boolean; orderBy?: 'updated_at' | 'created_at' | 'id' } = {}
  ): Promise<IFavorite[]> {
    const order = options.orderBy ?? 'id'
    const where: string[] = ['f.user_id = ?']
    const args: any[] = [userId]
    if (typeof options.category_id === 'number') {
      where.push('f.category_id = ?')
      args.push(options.category_id)
    }
    if (typeof options.is_public === 'boolean') {
      where.push('f.is_public = ?')
      args.push(options.is_public)
    }

    const [rows] = await pool.query<IFavorite[]>(
      `SELECT f.*,
              fc.name AS category_name,
              fc.color AS category_color,
              (SELECT COUNT(*) FROM favorite_items fi WHERE fi.favorite_id = f.id) AS items_count
         FROM favorites f
    LEFT JOIN favorite_categories fc ON f.category_id = fc.id
        WHERE ${where.join(' AND ')}
     ORDER BY f.${order} DESC`,
      args
    )
    return rows
  }

  async findByIdForUser(favId: number, userId: number): Promise<IFavorite | null> {
    const [rows] = await pool.query<IFavorite[]>(
      `SELECT f.*, fc.name AS category_name, fc.color AS category_color
         FROM favorites f
    LEFT JOIN favorite_categories fc ON f.category_id = fc.id
        WHERE f.id = ? AND f.user_id = ?`,
      [favId, userId]
    )
    return rows[0] ?? null
  }

  async findPublicOrOwnedById(favId: number, userId: number): Promise<IFavorite | null> {
    const [rows] = await pool.query<IFavorite[]>(
      `SELECT f.*, fc.name AS category_name, fc.color AS category_color
         FROM favorites f
    LEFT JOIN favorite_categories fc ON f.category_id = fc.id
        WHERE f.id = ? AND (f.user_id = ? OR f.is_public = TRUE)`,
      [favId, userId]
    )
    return rows[0] ?? null
  }

  async insertFavorite(
    conn: PoolConnection,
    data: {
      user_id: number
      name: string
      description: string
      is_public: boolean
      category_id: number | null
    }
  ): Promise<number> {
    const [ret] = await conn.query<ResultSetHeader>(
      `INSERT INTO favorites (user_id, name, description, is_public, category_id, updated_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [data.user_id, data.name, data.description, data.is_public, data.category_id]
    )
    return ret.insertId
  }

  async updateFavorite(
    conn: PoolConnection,
    favId: number,
    userId: number,
    patch: {
      name?: string
      description?: string
      is_public?: boolean
      category_id?: number | null
    }
  ): Promise<boolean> {
    const fields: string[] = []
    const args: any[] = []
    if (patch.name !== undefined) {
      fields.push('name = ?')
      args.push(patch.name)
    }
    if (patch.description !== undefined) {
      fields.push('description = ?')
      args.push(patch.description)
    }
    if (patch.is_public !== undefined) {
      fields.push('is_public = ?')
      args.push(patch.is_public)
    }
    if (patch.category_id !== undefined) {
      fields.push('category_id = ?')
      args.push(patch.category_id)
    }
    if (!fields.length) return true

    fields.push('updated_at = NOW()')
    const [ret] = await conn.query<ResultSetHeader>(
      `UPDATE favorites SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`,
      [...args, favId, userId]
    )
    return ret.affectedRows > 0
  }

  async deleteFavorite(conn: PoolConnection, favId: number, userId: number): Promise<boolean> {
    const [ret] = await conn.query<ResultSetHeader>('DELETE FROM favorites WHERE id = ? AND user_id = ?', [
      favId,
      userId,
    ])
    return ret.affectedRows > 0
  }

  async listItems(favoriteId: number): Promise<IFavoriteItem[]> {
    const [rows] = await pool.query<IFavoriteItem[]>(
      'SELECT * FROM favorite_items WHERE favorite_id = ? ORDER BY sort_order ASC, created_at DESC',
      [favoriteId]
    )
    return rows
  }

  async existsItem(favoriteId: number, type: string, itemId: number): Promise<boolean> {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM favorite_items WHERE favorite_id = ? AND item_type = ? AND item_id = ?',
      [favoriteId, type, itemId]
    )
    return rows.length > 0
  }

  async insertItem(
    conn: PoolConnection,
    data: {
      favorite_id: number
      item_type: string
      item_id: number
      title: string
      description: string
      tags: string
      notes: string
    }
  ): Promise<number> {
    const [ret] = await conn.query<ResultSetHeader>(
      `INSERT INTO favorite_items
         (favorite_id, item_type, item_id, title, description, tags, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [data.favorite_id, data.item_type, data.item_id, data.title, data.description, data.tags, data.notes]
    )
    return ret.insertId
  }

  async deleteItem(conn: PoolConnection, itemId: number, favoriteId: number): Promise<boolean> {
    const [ret] = await conn.query<ResultSetHeader>('DELETE FROM favorite_items WHERE id = ? AND favorite_id = ?', [
      itemId,
      favoriteId,
    ])
    return ret.affectedRows > 0
  }

  async searchItems(
    userId: number,
    opt: { keyword?: string; item_type?: string; favorite_id?: number }
  ): Promise<IFavoriteItem[]> {
    let where = 'WHERE f.user_id = ?'
    const args: any[] = [userId]
    if (opt.keyword) {
      where += ' AND (fi.title LIKE ? OR fi.description LIKE ? OR fi.notes LIKE ?)'
      args.push(`%${opt.keyword}%`, `%${opt.keyword}%`, `%${opt.keyword}%`)
    }
    if (opt.item_type) {
      where += ' AND fi.item_type = ?'
      args.push(opt.item_type)
    }
    if (opt.favorite_id) {
      where += ' AND fi.favorite_id = ?'
      args.push(opt.favorite_id)
    }

    const [rows] = await pool.query<IFavoriteItem[]>(
      `SELECT fi.*
         FROM favorite_items fi
         JOIN favorites f ON fi.favorite_id = f.id
       ${where}
     ORDER BY fi.updated_at DESC
        LIMIT 50`,
      args
    )
    return rows
  }

  async allCategories(): Promise<IFavoriteCategory[]> {
    const [rows] = await pool.query<IFavoriteCategory[]>('SELECT * FROM favorite_categories ORDER BY sort_order ASC')
    return rows
  }
}
