// apps/backend/src/bootstrap/syncMenus.ts
import type { RowDataPacket, ResultSetHeader } from 'mysql2'

import { pool } from '../config/database.js'
import { MENU_TREE, type MenuSeed } from './menu.config.js'

// 用“普通行类型”，不要继承 RowDataPacket
type DbMenuRow = {
  id: number
  name: string
  path: string | null
  parent_id: number | null
  sort_order: number | null
  level: number | null
  is_system?: number
}
// 仅用于 query 的返回类型：满足 mysql2 的约束
type DbMenuRowFromDB = DbMenuRow & RowDataPacket
type SyncMode = 'force' | 'patch' | 'insertOnly'

const ALLOWED_MENU_TYPES = new Set(['menu', 'page', 'button', 'link', 'iframe', 'dir'])
const normalizeMenuType = (t?: string) => {
  const v = (t ?? 'menu').toLowerCase()
  return ALLOWED_MENU_TYPES.has(v) ? v : 'menu'
}

export async function syncMenus(options?: { removeOrphans?: boolean; mode?: SyncMode }) {
  const mode: SyncMode = options?.mode ?? 'patch'
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    // 用 DbMenuRow 做泛型即可
  const [rows] = await conn.query<DbMenuRowFromDB[]>(
    'SELECT id, name, path, parent_id, sort_order, level, is_system FROM menus'
  )

    const name2row = new Map<string, DbMenuRow>()
    const path2row = new Map<string, DbMenuRow>()
    rows.forEach(r => {
      name2row.set(r.name, r)
      if (r.path) path2row.set(r.path, r)
    })

    const seenNames = new Set<string>()
    let autoSort = 1

    async function upsertNode(node: MenuSeed, parentId: number | null, level: number) {
      seenNames.add(node.name)
      const metaJson = node.meta ? JSON.stringify(node.meta) : null
      const path = node.path ?? null

      // 先按 name 找，找不到再按 path 找
      let exists: DbMenuRow | undefined = name2row.get(node.name) ?? (path ? path2row.get(path) : undefined)

      // 软字段
      const soft = {
        title: node.title,
        path,
        component: node.component ?? null,
        icon: node.icon ?? null,
        is_hidden: !!node.is_hidden,
        is_disabled: !!node.is_disabled,
        is_system: node.is_system ?? false,
        menu_type: normalizeMenuType(node.menu_type),
        permission_code: node.permission_code ?? null,
        redirect: node.redirect ?? null,
        meta: metaJson,
      }

      // 结构字段
      let parent_id = parentId
      let sort_order = node.sort_order ?? autoSort++
      let levelVal = level

      if (exists && (mode === 'patch' || mode === 'insertOnly')) {
        // 保留人工结构
        parent_id = exists.parent_id
        sort_order = exists.sort_order ?? sort_order
        levelVal = exists.level ?? levelVal
      }

      if (exists) {
        if (mode === 'insertOnly') return exists.id

        await conn.query(
          `UPDATE menus SET
             name=?, title=?, path=?, component=?, icon=?,
             parent_id=?, sort_order=?, level=?,
             is_hidden=?, is_disabled=?, is_system=?, menu_type=?,
             permission_code=?, redirect=?, meta=CAST(? AS JSON),
             updated_at=CURRENT_TIMESTAMP
           WHERE id=?`,
          [
            node.name,
            soft.title,
            soft.path,
            soft.component,
            soft.icon,
            parent_id,
            sort_order,
            levelVal,
            soft.is_hidden,
            soft.is_disabled,
            soft.is_system,
            soft.menu_type,
            soft.permission_code,
            soft.redirect,
            soft.meta,
            exists.id,
          ]
        )

        // 用普通对象更新到 map（现在类型是 DbMenuRow，安全）
        const nextRow: DbMenuRow = {
          ...exists,
          name: node.name,
          path: soft.path,
          parent_id,
          sort_order,
          level: levelVal,
        }
        name2row.set(node.name, nextRow)
        if (soft.path) path2row.set(soft.path, nextRow)
        return exists.id
      } else {
        const [res] = await conn.query<ResultSetHeader>(
          `INSERT INTO menus
             (name, title, path, component, icon, parent_id, sort_order, level,
              is_hidden, is_disabled, is_system, menu_type, permission_code, redirect, meta,
              created_at, updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,CAST(? AS JSON),NOW(),NOW())`,
          [
            node.name,
            soft.title,
            soft.path,
            soft.component,
            soft.icon,
            parent_id,
            sort_order,
            levelVal,
            soft.is_hidden,
            soft.is_disabled,
            soft.is_system,
            soft.menu_type,
            soft.permission_code,
            soft.redirect,
            soft.meta,
          ]
        )
        const newId = res.insertId
        const newRow: DbMenuRow = {
          id: newId,
          name: node.name,
          path: soft.path,
          parent_id,
          sort_order,
          level: levelVal,
        }
        name2row.set(node.name, newRow)
        if (soft.path) path2row.set(soft.path, newRow)
        return newId
      }
    }

    async function walk(nodes: MenuSeed[], parentId: number | null, level: number) {
      const ordered = [...nodes].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      for (const n of ordered) {
        const id = await upsertNode(n, parentId, level)
        if (n.children?.length) await walk(n.children, id, level + 1)
      }
    }

    await walk(MENU_TREE, null, 1)

    if (options?.removeOrphans) {
      const extra = rows.filter(r => !seenNames.has(r.name))
      if (extra.length) {
        await conn.query(
          `DELETE FROM menus WHERE id IN (${extra.map(() => '?').join(',')})`,
          extra.map(e => e.id)
        )
      }
    }

    await conn.commit()
    console.log(`[menu-sync] 完成：共同步 ${seenNames.size} 个菜单（mode=${options?.mode ?? 'patch'}）`)
  } catch (e) {
    await conn.rollback()
    console.error('[menu-sync] 失败：', e)
    throw e
  } finally {
    conn.release()
  }
}
