import { pool } from '@/config/database'
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import type { FileRecord, FileType } from '../domain/file.model'

type Queryable = {
  query<T = any>(sql: string, params?: any[]): Promise<[T, any]>
}

const db: Queryable = pool as unknown as Queryable

function parentCondition(parentId: number | null | undefined) {
  if (parentId === null || parentId === undefined) {
    return { clause: 'parent_id IS NULL' as const, params: [] as any[] }
  }
  return { clause: 'parent_id = ?' as const, params: [parentId] as any[] }
}

export const FileRepository = {
  async list(opts: {
    parentId: number | null
    search?: string
    type?: FileType
    limit: number
    offset: number
  }): Promise<FileRecord[]> {
    const where: string[] = ['is_deleted = 0']
    const params: any[] = []
    const parent = parentCondition(opts.parentId)
    where.push(parent.clause)
    params.push(...parent.params)
    if (opts.search) {
      where.push('(name LIKE ? OR original_name LIKE ?)')
      params.push(`%${opts.search}%`, `%${opts.search}%`)
    }
    if (opts.type) {
      where.push('type = ?')
      params.push(opts.type)
    }
    const sql = `SELECT * FROM files WHERE ${where.join(' AND ')} ORDER BY type DESC, updated_at DESC LIMIT ? OFFSET ?`
    params.push(opts.limit, opts.offset)
    const [rows] = await db.query<FileRecord[] & RowDataPacket[]>(sql, params)
    return rows as FileRecord[]
  },

  async count(opts: { parentId: number | null; search?: string; type?: FileType }): Promise<number> {
    const where: string[] = ['is_deleted = 0']
    const params: any[] = []
    const parent = parentCondition(opts.parentId)
    where.push(parent.clause)
    params.push(...parent.params)
    if (opts.search) {
      where.push('(name LIKE ? OR original_name LIKE ?)')
      params.push(`%${opts.search}%`, `%${opts.search}%`)
    }
    if (opts.type) {
      where.push('type = ?')
      params.push(opts.type)
    }
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM files WHERE ${where.join(' AND ')}`,
      params
    )
    return Number((rows?.[0] as any)?.total || 0)
  },

  async stats(parentId: number | null): Promise<{ total_size: number; files: number; folders: number }> {
    const parent = parentCondition(parentId)
    const [rows] = await db.query<RowDataPacket[]>(
      `
      SELECT
        COALESCE(SUM(CASE WHEN type = 'file' THEN size ELSE 0 END), 0) as total_size,
        SUM(CASE WHEN type = 'file' THEN 1 ELSE 0 END) as files,
        SUM(CASE WHEN type = 'folder' THEN 1 ELSE 0 END) as folders
      FROM files
      WHERE is_deleted = 0 AND ${parent.clause}
    `,
      parent.params
    )
    const row = rows?.[0] || { total_size: 0, files: 0, folders: 0 }
    return {
      total_size: Number((row as any).total_size || 0),
      files: Number((row as any).files || 0),
      folders: Number((row as any).folders || 0),
    }
  },

  async findById(id: number): Promise<FileRecord | null> {
    const [rows] = await db.query<FileRecord[] & RowDataPacket[]>('SELECT * FROM files WHERE id = ? LIMIT 1', [id])
    return rows?.[0] || null
  },

  async insert(data: {
    parent_id: number | null
    type: FileType
    name: string
    original_name?: string | null
    ext?: string | null
    size?: number | null
    mime_type?: string | null
    storage_path?: string | null
    download_url?: string | null
    tags?: string | null
    description?: string | null
    version?: string | null
    created_by?: number | null
    updated_by?: number | null
  }): Promise<number> {
    const [ret] = await db.query<ResultSetHeader>(
      `
      INSERT INTO files
      (parent_id, type, name, original_name, ext, size, mime_type, storage_path, download_url, tags, description, version, created_by, updated_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [
        data.parent_id ?? null,
        data.type,
        data.name,
        data.original_name ?? null,
        data.ext ?? null,
        data.size ?? null,
        data.mime_type ?? null,
        data.storage_path ?? null,
        data.download_url ?? null,
        data.tags ?? null,
        data.description ?? null,
        data.version ?? null,
        data.created_by ?? null,
        data.updated_by ?? null,
      ]
    )
    return ret.insertId
  },

  async update(
    id: number,
    patches: Partial<{
      parent_id: number | null
      name: string
      description: string | null
      tags: string | null
      version: string | null
      updated_by: number | null
    }>
  ): Promise<number> {
    const sets: string[] = []
    const params: any[] = []
    if ('parent_id' in patches) {
      if (patches.parent_id === null || patches.parent_id === undefined) {
        sets.push('parent_id = NULL')
      } else {
        sets.push('parent_id = ?')
        params.push(patches.parent_id)
      }
    }
    if (patches.name !== undefined) {
      sets.push('name = ?')
      params.push(patches.name)
    }
    if (patches.description !== undefined) {
      sets.push('description = ?')
      params.push(patches.description)
    }
    if (patches.tags !== undefined) {
      sets.push('tags = ?')
      params.push(patches.tags)
    }
    if (patches.version !== undefined) {
      sets.push('version = ?')
      params.push(patches.version)
    }
    if (patches.updated_by !== undefined) {
      sets.push('updated_by = ?')
      params.push(patches.updated_by)
    }
    if (!sets.length) return 0
    const sql = `UPDATE files SET ${sets.join(', ')}, updated_at = NOW() WHERE id = ?`
    params.push(id)
    const [ret] = await db.query<ResultSetHeader>(sql, params)
    return ret.affectedRows
  },

  async markDeleted(id: number, updatedBy?: number | null): Promise<number> {
    const params: any[] = [updatedBy ?? null, id]
    const [ret] = await db.query<ResultSetHeader>(
      'UPDATE files SET is_deleted = 1, deleted_at = NOW(), updated_at = NOW(), updated_by = ? WHERE id = ?',
      params
    )
    return ret.affectedRows
  },

  async hasChildren(id: number): Promise<boolean> {
    const [rows] = await db.query<RowDataPacket[]>('SELECT COUNT(*) as total FROM files WHERE parent_id = ? AND is_deleted = 0', [
      id,
    ])
    const total = Number((rows?.[0] as any)?.total || 0)
    return total > 0
  },

  async listUploads(opts: {
    search?: string
    page: number
    limit: number
  }): Promise<{ rows: FileRecord[]; total: number }> {
    const where: string[] = ["is_deleted = 0", "type = 'file'"]
    const params: any[] = []
    if (opts.search) {
      where.push('(name LIKE ? OR original_name LIKE ?)')
      params.push(`%${opts.search}%`, `%${opts.search}%`)
    }

    const listParams = [...params, opts.limit, (opts.page - 1) * opts.limit]
    const sql = `SELECT * FROM files WHERE ${where.join(' AND ')} ORDER BY created_at DESC LIMIT ? OFFSET ?`
    const [rows] = await db.query<FileRecord[] & RowDataPacket[]>(sql, listParams)

    const [countRows] = await db.query<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM files WHERE ${where.join(' AND ')}`,
      params
    )
    return {
      rows: rows as FileRecord[],
      total: Number((countRows?.[0] as any)?.total || 0),
    }
  },

  async existsByName(parentId: number | null, name: string, type: FileType): Promise<boolean> {
    const parent = parentCondition(parentId)
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT id FROM files WHERE ${parent.clause} AND name = ? AND type = ? AND is_deleted = 0 LIMIT 1`,
      [...parent.params, name, type]
    )
    return rows.length > 0
  },
}
