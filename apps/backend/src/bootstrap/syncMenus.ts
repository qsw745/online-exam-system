/* eslint-disable @typescript-eslint/no-explicit-any */
import type { RowDataPacket, ResultSetHeader } from 'mysql2'
import { pool } from '../config/database.js'
import { MENU_TREE, type MenuSeed } from './menu.config.js'

type DbMenuRow = {
    id: number
    name: string
    title?: string | null
    path: string | null
    component?: string | null
    icon?: string | null
    parent_id: number | null
    sort_order: number | null
    level: number | null
    is_hidden?: number | boolean
    is_disabled?: number | boolean
    is_system?: number | boolean
    menu_type?: string | null
    permission_code?: string | null
    redirect?: string | null
    meta?: any
}
type DbMenuRowFromDB = DbMenuRow & RowDataPacket

type SyncMode = 'force' | 'patch' | 'insertOnly'

const ALLOWED_MENU_TYPES = new Set(['menu', 'page', 'button', 'link', 'iframe', 'dir'])
const normalizeMenuType = (t?: string) => {
    const v = (t ?? 'menu').toLowerCase()
    return ALLOWED_MENU_TYPES.has(v) ? v : 'menu'
}

function markSystem(nodes: MenuSeed[]): MenuSeed[] {
    return (nodes || []).map(n => ({
        ...n,
        is_system: true,
        children: n.children?.length ? markSystem(n.children) : undefined,
    }))
}

export async function syncMenus(options?: { removeOrphans?: boolean; mode?: SyncMode }) {
    const mode: SyncMode = options?.mode ?? 'patch'
    const conn = await pool.getConnection()
    try {
        await conn.beginTransaction()

        const [allRows] = await conn.query<DbMenuRowFromDB[]>(
            'SELECT id, name, title, path, component, icon, parent_id, sort_order, level, is_hidden, is_disabled, is_system, menu_type, permission_code, redirect, meta FROM menus'
        )
        const systemRows = allRows.filter(r => Number(r.is_system ?? 0) === 1)

        const name2Any = new Map<string, DbMenuRow>()
        const path2Any = new Map<string, DbMenuRow>()
        allRows.forEach(r => {
            name2Any.set(r.name, r)
            if (r.path) path2Any.set(r.path, r)
        })

        const name2System = new Map<string, DbMenuRow>()
        const path2System = new Map<string, DbMenuRow>()
        systemRows.forEach(r => {
            name2System.set(r.name, r)
            if (r.path) path2System.set(r.path, r)
        })

        const seenNames = new Set<string>()
        let autoSort = 1
        const seeds = markSystem(MENU_TREE)

        async function upsertNode(node: MenuSeed, parentId: number | null, level: number) {
            seenNames.add(node.name)
            const metaJson = node.meta ? JSON.stringify(node.meta) : null
            const path = node.path ?? null

            // ========== 匹配优先级 ==========
            // 1) 始终优先按 name 在“系统集合”匹配
            // 2) 仅当顶层节点(parentId=null)才允许按 path 在系统集合匹配
            let exists: DbMenuRow | undefined =
                name2System.get(node.name) ??
                (!parentId && path ? path2System.get(path) : undefined)

            // 若系统集合无匹配，尝试从“全表”提升为系统菜单
            if (!exists) {
                const any =
                    name2Any.get(node.name) ??
                    (!parentId && path ? path2Any.get(path) : undefined)
                if (any) {
                    if (mode === 'insertOnly') {
                        await conn.query(`UPDATE menus SET is_system=1, updated_at=CURRENT_TIMESTAMP WHERE id=?`, [any.id])
                    } else {
                        let nextParent = parentId
                        let nextSort = node.sort_order ?? autoSort++
                        let nextLevel = level
                        if (mode === 'patch') {
                            nextParent = any.parent_id
                            nextSort = (any.sort_order as any) ?? nextSort
                            nextLevel = (any.level as any) ?? nextLevel
                        }
                        await conn.query(
                            `UPDATE menus SET
                 name=?, title=?, path=?, component=?, icon=?,
                 parent_id=?, sort_order=?, level=?,
                 is_hidden=?, is_disabled=?, is_system=1, menu_type=?,
                 permission_code=?, redirect=?, meta=CAST(? AS JSON),
                 updated_at=CURRENT_TIMESTAMP
               WHERE id=?`,
                            [
                                node.name,
                                node.title ?? null,
                                path,
                                node.component ?? null,
                                node.icon ?? null,
                                nextParent,
                                nextSort,
                                nextLevel,
                                !!node.is_hidden,
                                !!node.is_disabled,
                                normalizeMenuType(node.menu_type),
                                node.permission_code ?? null,
                                node.redirect ?? null,
                                metaJson,
                                any.id,
                            ]
                        )
                    }

                    const promoted: DbMenuRow = {
                        ...any,
                        name: node.name,
                        path,
                        parent_id: mode === 'patch' ? any.parent_id : parentId,
                        sort_order: mode === 'patch' ? any.sort_order ?? node.sort_order ?? autoSort++ : node.sort_order ?? autoSort++,
                        level: mode === 'patch' ? any.level ?? level : level,
                        is_system: 1,
                    }

                    // 刷新映射：name 一定更新；path 只有顶层才登记，避免父子同 path 冲突
                    name2System.set(promoted.name, promoted)
                    name2Any.set(promoted.name, promoted)
                    if (!promoted.parent_id && promoted.path) {
                        path2System.set(promoted.path, promoted)
                        path2Any.set(promoted.path, promoted)
                    }
                    exists = promoted
                }
            }

            const soft = {
                title: node.title ?? null,
                path,
                component: node.component ?? null,
                icon: node.icon ?? null,
                is_hidden: !!node.is_hidden,
                is_disabled: !!node.is_disabled,
                is_system: 1,
                menu_type: normalizeMenuType(node.menu_type),
                permission_code: node.permission_code ?? null,
                redirect: node.redirect ?? null,
                meta: metaJson,
            }

            let parent_id = parentId
            let sort_order = node.sort_order ?? autoSort++
            let levelVal = level
            if (exists && (mode === 'patch' || mode === 'insertOnly')) {
                parent_id = (exists as any).parent_id
                sort_order = (exists as any).sort_order ?? sort_order
                levelVal = (exists as any).level ?? levelVal
            }

            // ★ 若还没有匹配，但 path 被别的行占用（历史垃圾，如 dashboard-1），直接“回收那条”
            if (!exists && soft.path) {
                const occupied = path2Any.get(soft.path)
                if (occupied) exists = occupied
            }

            if (exists) {
                if (mode !== 'insertOnly') {
                    const oldPath = (exists as any).path as string | null
                    await conn.query(
                        `UPDATE menus SET
                                          name=?, title=?, path=?, component=?, icon=?,
                                          parent_id=?, sort_order=?, level=?,
                                          is_hidden=?, is_disabled=?, is_system=1, menu_type=?,
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
                            soft.menu_type,
                            soft.permission_code,
                            soft.redirect,
                            soft.meta,
                            exists.id,
                        ]
                    )
                    // 如果 path 发生变化，清理旧映射，避免残留 '/dashboard'
                    if (oldPath && oldPath !== soft.path) {
                        path2System.delete(oldPath)
                        path2Any.delete(oldPath)
                    }
                }

                const nextRow: DbMenuRow = {
                    ...exists,
                    name: node.name,
                    path: soft.path,
                    parent_id,
                    sort_order,
                    level: levelVal,
                    is_system: 1,
                }
                name2System.set(node.name, nextRow)
                name2Any.set(node.name, nextRow)
                if (!parent_id && soft.path) {
                    path2System.set(soft.path, nextRow)
                    path2Any.set(soft.path, nextRow)
                }
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
                        1,
                        soft.menu_type,
                        soft.permission_code,
                        soft.redirect,
                        soft.meta,
                    ]
                )
                const newId = (res as any).insertId as number
                const newRow: DbMenuRow = {
                    id: newId,
                    name: node.name,
                    path: soft.path,
                    parent_id,
                    sort_order,
                    level: levelVal,
                    is_system: 1,
                }
                name2System.set(node.name, newRow)
                name2Any.set(node.name, newRow)
                if (!parent_id && soft.path) {
                    path2System.set(soft.path, newRow)
                    path2Any.set(soft.path, newRow)
                }
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

        await walk(seeds, null, 1)

        if (options?.removeOrphans) {
            // 只删除“系统菜单集合”里不再出现的 name，避免误删单位菜单
            const seedNames = new Set(markSystem(MENU_TREE).map(n => n.name))
            const toDelete = Array.from(name2System.values())
                .filter(r => !seedNames.has(r.name))
                .map(r => r.id)
            if (toDelete.length) {
                await conn.query(
                    `DELETE FROM menus WHERE is_system=1 AND id IN (${toDelete.map(() => '?').join(',')})`,
                    toDelete
                )
            }
        }

        await conn.commit()
        console.log(`[menu-sync] 完成：系统菜单同步（mode=${mode}）`)
    } catch (e) {
        await conn.rollback()
        console.error('[menu-sync] 失败：', e)
        throw e
    } finally {
        conn.release()
    }
}

export default syncMenus
