import { pool } from '@/config/database.js'
import type { RowDataPacket, ResultSetHeader } from 'mysql2'
import type { ProfileDTO, UpdateProfilePayload } from '../domain/profile.model'

type ColMap = {
    email?: string
    nickname?: string
    bio?: string
    avatar?: string         // 映射到 users 表中的 avatar_url / avatar / photo_url 等
    phone?: string          // 映射到 phone / mobile / phone_number / tel 等
}

let CACHED_COLS: Set<string> | null = null
let CACHED_MAP: ColMap | null = null

async function loadUserColumns(): Promise<Set<string>> {
    if (CACHED_COLS) return CACHED_COLS
    const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT COLUMN_NAME as name
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'`
    )
    CACHED_COLS = new Set((rows || []).map(r => String(r.name)))
    return CACHED_COLS
}

async function buildColMap(): Promise<ColMap> {
    if (CACHED_MAP) return CACHED_MAP
    const cols = await loadUserColumns()
    const pick = (cands: string[]) => cands.find(c => cols.has(c))

    // 这些列几乎总在
    const email = pick(['email'])
    const nickname = pick(['nickname', 'display_name'])
    const bio = pick(['bio', 'about'])
    const avatar = pick(['avatar_url', 'avatar', 'photo_url'])
    const phone = pick(['phone', 'mobile', 'phone_number', 'tel'])

    CACHED_MAP = { email, nickname, bio, avatar, phone }
    return CACHED_MAP
}

export class ProfileRepository {
    static async getByUserId(userId: number): Promise<ProfileDTO | null> {
        const map = await buildColMap()

        // 至少要查一个稳定列，email 基本都会有；若极端情况连 email 都没有，就查 id 兜底
        const selectPieces: string[] = []
        if (map.email)    selectPieces.push(`${map.email} as __email`)
        else              selectPieces.push(`id as __id`)
        if (map.nickname) selectPieces.push(`${map.nickname} as __nickname`)
        if (map.bio)      selectPieces.push(`${map.bio} as __bio`)
        if (map.avatar)   selectPieces.push(`${map.avatar} as __avatar`)
        if (map.phone)    selectPieces.push(`${map.phone} as __phone`)
        if(map.school)  selectPieces.push(`${map.school} as __school`)

        const sql = `SELECT ${selectPieces.join(', ')} FROM users WHERE id = ? LIMIT 1`
        const [rows] = await pool.query<RowDataPacket[]>(sql, [userId])
        const r = rows?.[0]
        if (!r) return null

        return {
            email:    r.__email ?? null,
            nickname: r.__nickname ?? null,
            bio:      r.__bio ?? null,
            avatar:   r.__avatar ?? null,
            phone:    r.__phone ?? null,
            school:     r.__school ?? null,
            class_name: r.__class_name ?? null,
        }
    }

    static async update(userId: number, payload: UpdateProfilePayload): Promise<ProfileDTO> {
        const map = await buildColMap()
        const sets: string[] = []
        const params: any[] = []

        // 仅在列存在时才更新，避免 Unknown column
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

        if (sets.length > 0) {
            const sql = `UPDATE users SET ${sets.join(', ')}, updated_at = NOW() WHERE id = ?`
            params.push(userId)
            await pool.query<ResultSetHeader>(sql, params)
        }
        const after = await this.getByUserId(userId)
        return after as ProfileDTO
    }

    static async updateAvatar(userId: number, value: string): Promise<ProfileDTO> {
        const map = await buildColMap()
        const target = map.avatar ?? 'avatar_url' // 尝试最常见命名作为兜底
        const sql = `UPDATE users SET ${target} = ?, updated_at = NOW() WHERE id = ?`
        await pool.query<ResultSetHeader>(sql, [value, userId])
        const after = await this.getByUserId(userId)
        return after as ProfileDTO
    }
}
