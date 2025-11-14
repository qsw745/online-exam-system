// 保留你原有的导入路径
import { pool } from '@/infrastructure/db/index.js'
import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import type { IFavorite, IFavoriteCategory, IFavoriteItem } from '../domain/favorites.model.js'

/** 统一的最小 Query 接口，避免 “Pool | PoolConnection 没有 query” 的联合类型报错 */
type Queryable = { query<T = any>(sql: string, params?: any[]): Promise<[T, any]> }
const asQ = (x: any): Queryable => x as Queryable

/** 简单列缓存，避免频繁访问 information_schema */
const columnExistsCache = new Map<string, boolean>()
async function hasColumn(table: string, column: string, conn?: PoolConnection): Promise<boolean> {
  const key = `${table}.${column}`
  if (columnExistsCache.has(key)) return columnExistsCache.get(key)!
  const cx = asQ(conn ?? pool)

  const [dbRows] = await cx.query<RowDataPacket[]>('SELECT DATABASE() AS db')
  const db = String((dbRows?.[0] as any)?.db ?? '')

  const [rows] = await cx.query<RowDataPacket[]>(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
    [db, table, column]
  )
  const ok = rows.length > 0
  columnExistsCache.set(key, ok)
  return ok
}

type FavoriteSchema = {
  nameColumn: 'name' | 'title'
  hasDescription: boolean
  hasIsPublic: boolean
  hasCategory: boolean
}

type FavoriteItemSchema = {
  hasTitle: boolean
  hasDescription: boolean
  hasTags: boolean
  hasNotes: boolean
  hasSortOrder: boolean
  hasCreatedAt: boolean
  hasUpdatedAt: boolean
}

export class FavoritesRepository {
  private favoriteSchema: FavoriteSchema | null = null
  private favoriteItemsSchema: FavoriteItemSchema | null = null

  private db(conn?: PoolConnection): Queryable {
    return asQ(conn ?? pool)
  }

  private async getFavoriteSchema(conn?: PoolConnection): Promise<FavoriteSchema> {
    if (this.favoriteSchema) return this.favoriteSchema
    const nameColumn = (await hasColumn('favorites', 'name', conn))
      ? 'name'
      : (await hasColumn('favorites', 'title', conn))
        ? 'title'
        : 'name'
    const schema: FavoriteSchema = {
      nameColumn,
      hasDescription: await hasColumn('favorites', 'description', conn),
      hasIsPublic: await hasColumn('favorites', 'is_public', conn),
      hasCategory: await hasColumn('favorites', 'category_id', conn),
    }
    this.favoriteSchema = schema
    return schema
  }

  private async getFavoriteItemsSchema(conn?: PoolConnection): Promise<FavoriteItemSchema> {
    if (this.favoriteItemsSchema) return this.favoriteItemsSchema
    const schema: FavoriteItemSchema = {
      hasTitle: await hasColumn('favorite_items', 'title', conn),
      hasDescription: await hasColumn('favorite_items', 'description', conn),
      hasTags: await hasColumn('favorite_items', 'tags', conn),
      hasNotes: await hasColumn('favorite_items', 'notes', conn),
      hasSortOrder: await hasColumn('favorite_items', 'sort_order', conn),
      hasCreatedAt: await hasColumn('favorite_items', 'created_at', conn),
      hasUpdatedAt: await hasColumn('favorite_items', 'updated_at', conn),
    }
    this.favoriteItemsSchema = schema
    return schema
  }

  private normalizeFavoriteRows(rows: IFavorite[]): IFavorite[] {
    return rows.map(row => {
      const anyRow = row as any
      if (anyRow && typeof anyRow.name === 'undefined' && typeof anyRow.title !== 'undefined') {
        anyRow.name = anyRow.title
      }
      if (typeof anyRow.is_public === 'undefined') anyRow.is_public = false
      if (typeof anyRow.category_id === 'undefined') anyRow.category_id = null
      return row
    })
  }

  async findByUser(
    userId: number,
    options: { category_id?: number; is_public?: boolean; orderBy?: 'updated_at' | 'created_at' | 'id' } = {},
    conn?: PoolConnection
  ): Promise<IFavorite[]> {
    const order = options.orderBy ?? 'id'
    const schema = await this.getFavoriteSchema(conn)
    const where: string[] = ['f.user_id = ?']
    const args: any[] = [userId]
    if (schema.hasCategory && typeof options.category_id === 'number') {
      where.push('f.category_id = ?')
      args.push(options.category_id)
    }
    if (schema.hasIsPublic && typeof options.is_public === 'boolean') {
      where.push('f.is_public = ?')
      args.push(options.is_public)
    }

    const selectParts = [
      'f.*',
      `f.${schema.nameColumn} AS name`,
      schema.hasCategory ? 'fc.name AS category_name' : 'NULL AS category_name',
      schema.hasCategory ? 'fc.color AS category_color' : 'NULL AS category_color',
      '(SELECT COUNT(*) FROM favorite_items fi WHERE fi.favorite_id = f.id) AS items_count',
    ]
    const joinCategory = schema.hasCategory ? 'LEFT JOIN favorite_categories fc ON f.category_id = fc.id' : ''

    const sql = `
      SELECT ${selectParts.join(', ')}
      FROM favorites f
      ${joinCategory}
      WHERE ${where.join(' AND ')}
      ORDER BY f.${order} DESC`

    const [rows] = await this.db(conn).query<IFavorite[]>(sql, args)
    return this.normalizeFavoriteRows(rows)
  }

  async findByIdForUser(favId: number, userId: number, conn?: PoolConnection): Promise<IFavorite | null> {
    const schema = await this.getFavoriteSchema(conn)
    const selectParts = [
      'f.*',
      `f.${schema.nameColumn} AS name`,
      schema.hasCategory ? 'fc.name AS category_name' : 'NULL AS category_name',
      schema.hasCategory ? 'fc.color AS category_color' : 'NULL AS category_color',
    ]
    const joinCategory = schema.hasCategory ? 'LEFT JOIN favorite_categories fc ON f.category_id = fc.id' : ''
    const sql = `
      SELECT ${selectParts.join(', ')}
      FROM favorites f
      ${joinCategory}
      WHERE f.id = ? AND f.user_id = ?`
    const [rows] = await this.db(conn).query<IFavorite[]>(sql, [favId, userId])
    const normalized = this.normalizeFavoriteRows(rows)
    return normalized[0] ?? null
  }

  async findPublicOrOwnedById(favId: number, userId: number, conn?: PoolConnection): Promise<IFavorite | null> {
    const schema = await this.getFavoriteSchema(conn)
    const selectParts = [
      'f.*',
      `f.${schema.nameColumn} AS name`,
      schema.hasCategory ? 'fc.name AS category_name' : 'NULL AS category_name',
      schema.hasCategory ? 'fc.color AS category_color' : 'NULL AS category_color',
    ]
    const joinCategory = schema.hasCategory ? 'LEFT JOIN favorite_categories fc ON f.category_id = fc.id' : ''
    const ownership = schema.hasIsPublic ? '(f.user_id = ? OR f.is_public = TRUE)' : 'f.user_id = ?'
    const sql = `
      SELECT ${selectParts.join(', ')}
      FROM favorites f
      ${joinCategory}
      WHERE f.id = ? AND ${ownership}`
    const [rows] = await this.db(conn).query<IFavorite[]>(sql, [favId, userId])
    const normalized = this.normalizeFavoriteRows(rows)
    return normalized[0] ?? null
  }

  async insertFavorite(
    conn: PoolConnection,
    data: {
      user_id: number
      name: string
      description?: string
      is_public: boolean
      category_id: number | null
    }
  ): Promise<number> {
    const schema = await this.getFavoriteSchema(conn)

    const cols: string[] = ['user_id', schema.nameColumn]
    const qms: string[] = ['?', '?']
    const args: any[] = [data.user_id, data.name]

    if (schema.hasDescription) {
      cols.push('description')
      qms.push('?')
      args.push(data.description ?? '')
    }

    if (schema.hasIsPublic) {
      cols.push('is_public')
      qms.push('?')
      args.push(data.is_public)
    }

    if (schema.hasCategory) {
      cols.push('category_id')
      qms.push('?')
      args.push(data.category_id)
    }

    cols.push('updated_at')
    qms.push('NOW()')

    const sql = `INSERT INTO favorites (${cols.join(', ')}) VALUES (${qms.join(', ')})`
    const [ret] = await asQ(conn).query<ResultSetHeader>(sql, args)
    return ret.insertId
  }

  async updateFavorite(
    conn: PoolConnection,
    favId: number,
    userId: number,
    patch: { name?: string; description?: string; is_public?: boolean; category_id?: number | null }
  ): Promise<boolean> {
    const fields: string[] = []
    const args: any[] = []
    const schema = await this.getFavoriteSchema(conn)

    if (patch.name !== undefined) {
      fields.push(`${schema.nameColumn} = ?`)
      args.push(patch.name)
    }
    if (schema.hasDescription && patch.description !== undefined) {
      fields.push('description = ?')
      args.push(patch.description)
    }
    if (schema.hasIsPublic && patch.is_public !== undefined) {
      fields.push('is_public = ?')
      args.push(patch.is_public)
    }
    if (schema.hasCategory && patch.category_id !== undefined) {
      fields.push('category_id = ?')
      args.push(patch.category_id)
    }

    fields.push('updated_at = NOW()')

    const [ret] = await asQ(conn).query<ResultSetHeader>(
      `UPDATE favorites SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`,
      [...args, favId, userId]
    )
    return ret.affectedRows > 0
  }

  async deleteFavorite(conn: PoolConnection, favId: number, userId: number): Promise<boolean> {
    const [ret] = await asQ(conn).query<ResultSetHeader>('DELETE FROM favorites WHERE id = ? AND user_id = ?', [
      favId,
      userId,
    ])
    return ret.affectedRows > 0
  }

  async listItems(favoriteId: number, conn?: PoolConnection): Promise<IFavoriteItem[]> {
    const schema = await this.getFavoriteItemsSchema(conn)
    const orderParts: string[] = []
    if (schema.hasSortOrder) orderParts.push('fi.sort_order ASC')
    if (schema.hasCreatedAt) orderParts.push('fi.created_at DESC')
    if (!orderParts.length) orderParts.push('fi.id DESC')
    const orderClause = `ORDER BY ${orderParts.join(', ')}`
    const [rows] = await this.db(conn).query<IFavoriteItem[]>(
      `SELECT fi.* FROM favorite_items fi WHERE fi.favorite_id = ? ${orderClause}`,
      [favoriteId]
    )
    return rows
  }

  async existsItem(favoriteId: number, type: string, itemId: number, conn?: PoolConnection): Promise<boolean> {
    const [rows] = await this.db(conn).query<RowDataPacket[]>(
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
    const schema = await this.getFavoriteItemsSchema(conn)
    const cols = ['favorite_id', 'item_type', 'item_id']
    const qms = ['?', '?', '?']
    const args: any[] = [data.favorite_id, data.item_type, data.item_id]

    if (schema.hasTitle) {
      cols.push('title')
      qms.push('?')
      args.push(data.title)
    }
    if (schema.hasDescription) {
      cols.push('description')
      qms.push('?')
      args.push(data.description)
    }
    if (schema.hasTags) {
      cols.push('tags')
      qms.push('?')
      args.push(data.tags)
    }
    if (schema.hasNotes) {
      cols.push('notes')
      qms.push('?')
      args.push(data.notes)
    }
    if (schema.hasCreatedAt) {
      cols.push('created_at')
      qms.push('NOW()')
    }
    if (schema.hasUpdatedAt) {
      cols.push('updated_at')
      qms.push('NOW()')
    }

    const sql = `INSERT INTO favorite_items (${cols.join(', ')}) VALUES (${qms.join(', ')})`
    const [ret] = await asQ(conn).query<ResultSetHeader>(sql, args)
    return ret.insertId
  }

  async deleteItem(conn: PoolConnection, itemId: number, favoriteId: number): Promise<boolean> {
    const [ret] = await asQ(conn).query<ResultSetHeader>(
      'DELETE FROM favorite_items WHERE id = ? AND favorite_id = ?',
      [itemId, favoriteId]
    )
    return ret.affectedRows > 0
  }

  async searchItems(
    userId: number,
    opt: { keyword?: string; item_type?: string; favorite_id?: number },
    conn?: PoolConnection
  ): Promise<IFavoriteItem[]> {
    const schema = await this.getFavoriteItemsSchema(conn)
    let where = 'WHERE f.user_id = ?'
    const args: any[] = [userId]
    if (opt.keyword) {
      const likeParts: string[] = []
      if (schema.hasTitle) {
        likeParts.push('fi.title LIKE ?')
        args.push(`%${opt.keyword}%`)
      }
      if (schema.hasDescription) {
        likeParts.push('fi.description LIKE ?')
        args.push(`%${opt.keyword}%`)
      }
      if (schema.hasNotes) {
        likeParts.push('fi.notes LIKE ?')
        args.push(`%${opt.keyword}%`)
      }
      if (likeParts.length) {
        where += ` AND (${likeParts.join(' OR ')})`
      }
    }
    if (opt.item_type) {
      where += ' AND fi.item_type = ?'
      args.push(opt.item_type)
    }
    if (opt.favorite_id) {
      where += ' AND fi.favorite_id = ?'
      args.push(opt.favorite_id)
    }

    const orderParts: string[] = []
    if (schema.hasUpdatedAt) orderParts.push('fi.updated_at DESC')
    if (schema.hasCreatedAt && !schema.hasUpdatedAt) orderParts.push('fi.created_at DESC')
    if (!orderParts.length) orderParts.push('fi.id DESC')
    const orderClause = `ORDER BY ${orderParts.join(', ')}`

    const [rows] = await this.db(conn).query<IFavoriteItem[]>(
      `SELECT fi.*
       FROM favorite_items fi
       JOIN favorites f ON fi.favorite_id = f.id
       ${where}
       ${orderClause}
       LIMIT 50`,
      args
    )
    return rows
  }

  async allCategories(conn?: PoolConnection): Promise<IFavoriteCategory[]> {
    const [rows] = await this.db(conn).query<IFavoriteCategory[]>(
      'SELECT * FROM favorite_categories ORDER BY sort_order ASC'
    )
    return rows
  }

  /** 批量插入分类（用于首次自动种子） */
  async insertCategoriesBulk(
    conn: PoolConnection,
    items: Array<Pick<IFavoriteCategory, 'name' | 'description' | 'color' | 'icon' | 'sort_order'>>
  ): Promise<void> {
    if (!items.length) return
    const cols = ['name', 'description', 'color', 'icon', 'sort_order']
    const values: any[] = []
    const qms = items.map(i => {
      values.push(i.name, i.description ?? '', i.color ?? '#A78BFA', i.icon ?? '', i.sort_order ?? 0)
      return '(?, ?, ?, ?, ?)'
    })
    await asQ(conn).query<ResultSetHeader>(
      `INSERT INTO favorite_categories (${cols.join(', ')}) VALUES ${qms.join(', ')}`,
      values
    )
  }
}
