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

        // ① 拉取“全部菜单”做碰撞检测（name/path 唯一性以全表为准）
        const [allRows] = await conn.query<DbMenuRowFromDB[]>(
            'SELECT id, name, title, path, component, icon, parent_id, sort_order, level, is_hidden, is_disabled, is_system, menu_type, permission_code, redirect, meta FROM menus'
        )

        // ② 仅系统菜单：用于“保留人工结构”的取值来源
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

            // 先找“系统内已存在”的
            let exists: DbMenuRow | undefined =
                name2System.get(node.name) ?? (path ? path2System.get(path) : undefined)

            // 若系统内不存在，但“全表”里有同名/同路径（通常是单位菜单），则“提升为系统菜单”
            if (!exists) {
                const any = name2Any.get(node.name) ?? (path ? path2Any.get(path) : undefined)
                if (any) {
                    // insertOnly 模式：最小化改动，仅把 is_system 提升避免唯一键冲突
                    if (mode === 'insertOnly') {
                        await conn.query(
                            `UPDATE menus SET is_system=1, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
                            [any.id]
                        )
                    } else {
                        // patch/force：按软字段更新；结构字段 patch 保留、force 覆盖
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
                    // 刷新映射（现在它是系统菜单了）
                    name2System.set(promoted.name, promoted)
                    if (promoted.path) path2System.set(promoted.path, promoted)
                    name2Any.set(promoted.name, promoted)
                    if (promoted.path) path2Any.set(promoted.path, promoted)

                    exists = promoted
                }
            }

            // 软字段（插入/更新共用）
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

            // 结构字段（插入或 force 时生效；patch 时优先保留库里已有）
            let parent_id = parentId
            let sort_order = node.sort_order ?? autoSort++
            let levelVal = level

            if (exists && (mode === 'patch' || mode === 'insertOnly')) {
                parent_id = (exists as any).parent_id
                sort_order = (exists as any).sort_order ?? sort_order
                levelVal = (exists as any).level ?? levelVal
            }

            if (exists) {
                if (mode === 'insertOnly') return exists.id

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
                if (soft.path) path2System.set(soft.path, nextRow)
                name2Any.set(node.name, nextRow)
                if (soft.path) path2Any.set(soft.path, nextRow)
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
                if (soft.path) path2System.set(soft.path, newRow)
                name2Any.set(node.name, newRow)
                if (soft.path) path2Any.set(soft.path, newRow)
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

        // 仅在“系统菜单集合”里删除孤儿，避免误删单位菜单
        if (options?.removeOrphans) {
            const extraSystemRows = Array.from(name2System.keys())
                .filter(name => !seenNames.has(name)) // 当前系统集合中的名字，但不在种子里
                .map(name => name2System.get(name)!)
            if (extraSystemRows.length) {
                await conn.query(
                    `DELETE FROM menus WHERE is_system=1 AND id IN (${extraSystemRows.map(() => '?').join(',')})`,
                    extraSystemRows.map(r => r.id)
                )
            }
        }

        await conn.commit()
        console.log(`[menu-sync] 完成：系统菜单同步 ${seenNames.size} 个（mode=${mode}）`)
    } catch (e: unknown) {
        await conn.rollback()
        console.error('[menu-sync] 失败：', e)
        throw e
    } finally {
        conn.release()
    }
}

export default syncMenus
