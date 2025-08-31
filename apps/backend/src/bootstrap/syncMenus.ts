import { RowDataPacket, ResultSetHeader } from 'mysql2'
import { pool } from '../config/database.js'
import { MENU_TREE, type MenuSeed } from './menu.config.js'

type DbMenu = RowDataPacket & {
  id: number
  name: string
  path: string | null
  parent_id: number | null
}

const ALLOWED_MENU_TYPES = new Set(['menu', 'page', 'button', 'link', 'iframe', 'dir'])
const normalizeMenuType = (t?: string) => {
  const v = (t ?? 'menu').toLowerCase()
  // 如果你的表的枚举还不包含 'page'，这里可按需把 page 映射为 menu
  return ALLOWED_MENU_TYPES.has(v) ? v : 'menu'
}

/** 把树同步到 DB：无则插入，有则更新；保持层级与 sort_order */
export async function syncMenus(options?: { removeOrphans?: boolean }) {
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    // 读出全部菜单，建立 name 和 path 两个 map
    const [rows] = await conn.query<DbMenu[]>('SELECT id, name, path, parent_id FROM menus')
    const name2id = new Map<string, number>()
    const path2id = new Map<string, number>()
    rows.forEach(r => {
      name2id.set(r.name, r.id)
      if (r.path) path2id.set(r.path, r.id)
    })

    const seenNames = new Set<string>()
    let autoSort = 1

    async function upsertNode(node: MenuSeed, parentId: number | null, level: number) {
      seenNames.add(node.name)

      const metaJson = node.meta ? JSON.stringify(node.meta) : null
      const path = node.path ?? null

      // 先按 name 匹配；没有再按 path 匹配（path 不为空时）
      let existsId: number | null = name2id.get(node.name) ?? (path ? path2id.get(path) ?? null : null)

      const payload = {
        title: node.title,
        path,
        component: node.component ?? null,
        icon: node.icon ?? null,
        parent_id: parentId,
        sort_order: node.sort_order ?? autoSort++,
        level,
        is_hidden: !!node.is_hidden,
        is_disabled: !!node.is_disabled,
        is_system: node.is_system ?? false,
        menu_type: normalizeMenuType(node.menu_type),
        permission_code: node.permission_code ?? null,
        redirect: node.redirect ?? null,
        meta: metaJson,
      }

      if (existsId) {
        await conn.query(
          `UPDATE menus SET
             name=?,
             title=?, path=?, component=?, icon=?, parent_id=?, sort_order=?, level=?,
             is_hidden=?, is_disabled=?, is_system=?, menu_type=?, permission_code=?, redirect=?, meta=CAST(? AS JSON),
             updated_at=CURRENT_TIMESTAMP
           WHERE id=?`,
          [
            node.name, // 用配置的 name 接管这条记录
            payload.title,
            payload.path,
            payload.component,
            payload.icon,
            payload.parent_id,
            payload.sort_order,
            payload.level,
            payload.is_hidden,
            payload.is_disabled,
            payload.is_system,
            payload.menu_type,
            payload.permission_code,
            payload.redirect,
            payload.meta,
            existsId,
          ]
        )
        // 更新内存索引（path 或 name 可能变化）
        name2id.set(node.name, existsId)
        if (payload.path) path2id.set(payload.path, existsId)
        return existsId
      } else {
        const [res] = await conn.query<ResultSetHeader>(
          `INSERT INTO menus
             (name, title, path, component, icon, parent_id, sort_order, level,
              is_hidden, is_disabled, is_system, menu_type, permission_code, redirect, meta, created_at, updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,CAST(? AS JSON),NOW(),NOW())`,
          [
            node.name,
            payload.title,
            payload.path,
            payload.component,
            payload.icon,
            payload.parent_id,
            payload.sort_order,
            payload.level,
            payload.is_hidden,
            payload.is_disabled,
            payload.is_system,
            payload.menu_type,
            payload.permission_code,
            payload.redirect,
            payload.meta,
          ]
        )
        const newId = res.insertId
        name2id.set(node.name, newId)
        if (payload.path) path2id.set(payload.path, newId)
        return newId
      }
    }

    async function walk(nodes: MenuSeed[], parentId: number | null, level: number) {
      // 兄弟节点按 sort_order 排
      const ordered = [...nodes].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      for (const n of ordered) {
        const id = await upsertNode(n, parentId, level)
        if (n.children?.length) {
          await walk(n.children, id, level + 1)
        }
      }
    }

    await walk(MENU_TREE, null, 1)

    // 可选：删除“孤儿”（配置里已删除、库里还存在的）
    if (options?.removeOrphans) {
      const extra = rows.filter(r => !seenNames.has(r.name))
      if (extra.length) {
        const ids = extra.map(e => e.id)
        await conn.query(`DELETE FROM menus WHERE id IN (${ids.map(() => '?').join(',')})`, ids)
      }
    }

    await conn.commit()
    console.log(`[menu-sync] 完成：共同步 ${seenNames.size} 个菜单`)
  } catch (e) {
    await conn.rollback()
    console.error('[menu-sync] 失败：', e)
    throw e
  } finally {
    conn.release()
  }
}
