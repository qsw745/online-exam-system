// apps/backend/src/modules/profile/repositories/profile.repository.ts
import { pool } from '@/config/database.js'
import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { ProfileDTO, UpdateProfilePayload } from '../domain/profile.model'

// 最小化的可查询接口，避免与全局 Pool 冲突
type Queryable = {
  query<T = any>(sql: string, params?: any[]): Promise<[T, any]>
}

// 统一使用 queryable
const db: Queryable = pool as unknown as Queryable

type ColMap = {
  email?: string
  nickname?: string
  bio?: string
  avatar?: string
  phone?: string
  school?: string
  class_name?: string
}

let CACHED_COLS: Set<string> | null = null
let CACHED_MAP: ColMap | null = null

async function loadUserColumns(): Promise<Set<string>> {
  if (CACHED_COLS) return CACHED_COLS
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT COLUMN_NAME as name
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'`
  )
  CACHED_COLS = new Set((rows || []).map((r: RowDataPacket) => String((r as any).name)))
  return CACHED_COLS
}

async function buildColMap(): Promise<ColMap> {
  if (CACHED_MAP) return CACHED_MAP
  const cols = await loadUserColumns()
  const pick = (cands: string[]) => cands.find(c => cols.has(c))

  const email = pick(['email'])
  const nickname = pick(['nickname', 'display_name'])
  const bio = pick(['bio', 'about'])
  const avatar = pick(['avatar_url', 'avatar', 'photo_url'])
  const phone = pick(['phone', 'mobile', 'phone_number', 'tel'])

  const school = pick(['school', 'school_name', 'college', 'organization', 'org'])
  const class_name = pick(['class_name', 'class', 'clazz', 'group_name'])

  CACHED_MAP = { email, nickname, bio, avatar, phone, school, class_name }
  return CACHED_MAP
}

export class ProfileRepository {
  static async getByUserId(userId: number): Promise<ProfileDTO | null> {
    const map = await buildColMap()
    const selectPieces: string[] = []

    if (map.email) selectPieces.push(`${map.email} as __email`)
    else selectPieces.push(`id as __id`)
    if (map.nickname) selectPieces.push(`${map.nickname} as __nickname`)
    if (map.bio) selectPieces.push(`${map.bio} as __bio`)
    if (map.avatar) selectPieces.push(`${map.avatar} as __avatar`)
    if (map.phone) selectPieces.push(`${map.phone} as __phone`)
    if (map.school) selectPieces.push(`${map.school} as __school`)
    if (map.class_name) selectPieces.push(`${map.class_name} as __class_name`)

    const sql = `SELECT ${selectPieces.join(', ')} FROM users WHERE id = ? LIMIT 1`
    const [rows] = await db.query<RowDataPacket[]>(sql, [userId])
    const r = rows?.[0]
    if (!r) return null

    return {
      email: (r as any).__email ?? null,
      nickname: (r as any).__nickname ?? null,
      bio: (r as any).__bio ?? null,
      avatar: (r as any).__avatar ?? null,
      phone: (r as any).__phone ?? null,
      school: (r as any).__school ?? null,
      class_name: (r as any).__class_name ?? null,
    }
  }

  static async update(userId: number, payload: UpdateProfilePayload): Promise<ProfileDTO> {
    const map = await buildColMap()
    const sets: string[] = []
    const params: any[] = []

    if (payload.email !== undefined && map.email) {
      sets.push(`${map.email} = ?`)
      params.push(payload.email)
    }
    if (payload.nickname !== undefined && map.nickname) {
      sets.push(`${map.nickname} = ?`)
      params.push(payload.nickname)
    }
    if (payload.bio !== undefined && map.bio) {
      sets.push(`${map.bio} = ?`)
      params.push(payload.bio)
    }
    if (payload.avatar !== undefined && map.avatar) {
      sets.push(`${map.avatar} = ?`)
      params.push(payload.avatar)
    }
    if (payload.phone !== undefined && map.phone) {
      sets.push(`${map.phone} = ?`)
      params.push(payload.phone)
    }
    if (payload.school !== undefined && map.school) {
      sets.push(`${map.school} = ?`)
      params.push(payload.school)
    }
    if (payload.class_name !== undefined && map.class_name) {
      sets.push(`${map.class_name} = ?`)
      params.push(payload.class_name)
    }

    if (sets.length > 0) {
      const sql = `UPDATE users SET ${sets.join(', ')}, updated_at = NOW() WHERE id = ?`
      params.push(userId)
      await db.query<ResultSetHeader>(sql, params)
    }
    const after = await this.getByUserId(userId)
    return after as ProfileDTO
  }

  static async updateAvatar(userId: number, value: string): Promise<ProfileDTO> {
    const map = await buildColMap()
    const target = map.avatar ?? 'avatar_url'
    const sql = `UPDATE users SET ${target} = ?, updated_at = NOW() WHERE id = ?`
    await db.query<ResultSetHeader>(sql, [value, userId])
    const after = await this.getByUserId(userId)
    return after as ProfileDTO
  }
}
