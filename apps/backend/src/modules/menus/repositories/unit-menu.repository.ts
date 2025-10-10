import { pool } from '@/config/database'
import type { PoolConnection, RowDataPacket } from 'mysql2/promise'
import type { Menu } from '../domain/menu.model'

type Queryable = { query<T = any>(sql: string, params?: any[]): Promise<[T, any]> }
const asQ = (x: any): Queryable => x as Queryable

/** 统一获取连接（类型安全 & 明确报错） */
async function getConnectionStrict(): Promise<PoolConnection> {
  const fn = (pool as any)?.getConnection
  if (typeof fn !== 'function') {
    throw new Error(
      '[database] pool.getConnection 不可用：请检查 "@/config/database" 的导出是否为 mysql2/promise 的 Pool'
    )
  }
  const conn: PoolConnection = await fn.call(pool)
  return conn
}

// 仅返回“这个单位实际维护过”的覆盖…
async function findOverridesAsMenus(unitId: number): Promise<Menu[]> {
  const [rows] = await asQ(pool).query<RowDataPacket[]>(
    `
SELECT
  m.id,
  COALESCE(um.name, m.name)                           AS name,
  COALESCE(um.title, m.title)                         AS title,
  COALESCE(um.path, m.path)                           AS path,
  COALESCE(um.component, m.component)                 AS component,
  COALESCE(um.icon, m.icon)                           AS icon,
  COALESCE(um.sort_order, m.sort_order)               AS sort_order,
  m.level,
  COALESCE(um.is_hidden, m.is_hidden)                 AS is_hidden,
  COALESCE(um.is_disabled, m.is_disabled)             AS is_disabled,
  0                                                   AS is_system,
  COALESCE(um.menu_type, m.menu_type)                 AS menu_type,
  COALESCE(um.permission_code, m.permission_code)     AS permission_code,
  COALESCE(um.redirect, m.redirect)                   AS redirect,
  COALESCE(um.meta, m.meta)                           AS meta,
  COALESCE(um.parent_sys_id, m.parent_id)             AS parent_id,
  m.created_at, m.updated_at
FROM unit_menus um
JOIN menus m ON m.id = um.sys_menu_id
WHERE um.unit_id = ?
ORDER BY COALESCE(um.sort_order, m.sort_order), m.id
    `,
    [unitId]
  )
  return rows as unknown as Menu[]
}

/** 基于“单位 + 祖先链”的最近覆盖（如果你要做“继承视图”可用它） */
async function findEffectiveMenusForUnit(unitId: number): Promise<Menu[]> {
  const [rows] = await asQ(pool).query<RowDataPacket[]>(
    `
WITH RECURSIVE ancestors AS (
  SELECT id AS anc_id, 0 AS depth
  FROM organizations WHERE id = ?
  UNION ALL
  SELECT o.parent_id AS anc_id, a.depth + 1
  FROM ancestors a
  JOIN organizations o ON o.id = a.anc_id
  WHERE o.parent_id IS NOT NULL
),
nearest_override AS (
  SELECT um.*, a.depth,
         ROW_NUMBER() OVER (PARTITION BY um.sys_menu_id ORDER BY a.depth ASC) AS rn
  FROM unit_menus um
  JOIN ancestors a ON a.anc_id = um.unit_id
)
SELECT
  m.id,
  COALESCE(n.name, m.name)                           AS name,
  COALESCE(n.title, m.title)                         AS title,
  COALESCE(n.path, m.path)                           AS path,
  COALESCE(n.component, m.component)                 AS component,
  COALESCE(n.icon, m.icon)                           AS icon,
  COALESCE(n.sort_order, m.sort_order)               AS sort_order,
  m.level,
  COALESCE(n.is_hidden, m.is_hidden)                 AS is_hidden,
  COALESCE(n.is_disabled, m.is_disabled)             AS is_disabled,
  0                                                  AS is_system,
  COALESCE(n.menu_type, m.menu_type)                 AS menu_type,
  COALESCE(n.permission_code, m.permission_code)     AS permission_code,
  COALESCE(n.redirect, m.redirect)                   AS redirect,
  COALESCE(n.meta, m.meta)                           AS meta,
  COALESCE(n.parent_sys_id, m.parent_id)             AS parent_id,
  m.created_at, m.updated_at
FROM menus m
LEFT JOIN nearest_override n
  ON n.sys_menu_id = m.id AND n.rn = 1
WHERE m.is_disabled = 0
ORDER BY COALESCE(n.sort_order, m.sort_order), m.id
    `,
    [unitId]
  )
  return rows as unknown as Menu[]
}

async function findOverridesByUnit(unitId: number) {
  const [rows] = await asQ(pool).query<RowDataPacket[]>(
    `SELECT * FROM unit_menus WHERE unit_id=? ORDER BY sort_order ASC, id ASC`,
    [unitId]
  )
  return rows
}

async function upsertUnitOverride(
  unitId: number,
  sysMenuId: number,
  patch: {
    name?: string
    title?: string
    path?: string
    component?: string
    icon?: string
    sort_order?: number | null
    is_hidden?: boolean | null
    is_disabled?: boolean | null
    menu_type?: 'menu' | 'button' | 'link' | null
    permission_code?: string | null
    redirect?: string | null
    meta?: any
    parent_sys_id?: number | null
  }
) {
  const ALLOWED = new Set([
    'name',
    'title',
    'path',
    'component',
    'icon',
    'sort_order',
    'is_hidden',
    'is_disabled',
    'menu_type',
    'permission_code',
    'redirect',
    'meta',
    'parent_sys_id',
  ])

  const cols = Object.keys(patch).filter(k => ALLOWED.has(k) && (patch as any)[k] !== undefined)

  const values = cols.map(k =>
    k === 'meta' && (patch as any).meta != null ? JSON.stringify((patch as any).meta) : (patch as any)[k]
  )

  if (!cols.length) {
    await asQ(pool).query(
      `INSERT INTO unit_menus (unit_id, sys_menu_id)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE sys_menu_id = VALUES(sys_menu_id)`,
      [unitId, sysMenuId]
    )
    return
  }

  await asQ(pool).query(
    `INSERT INTO unit_menus (unit_id, sys_menu_id, ${cols.join(', ')})
     VALUES (?, ?, ${cols.map(() => '?').join(', ')})
     ON DUPLICATE KEY UPDATE ${cols.map(c => `${c}=VALUES(${c})`).join(', ')}`,
    [unitId, sysMenuId, ...values]
  )
}

async function deleteUnitOverride(unitId: number, sysMenuId: number) {
  await asQ(pool).query(`DELETE FROM unit_menus WHERE unit_id=? AND sys_menu_id=?`, [unitId, sysMenuId])
}

async function batchUpsertSort(
  unitId: number,
  updates: Array<{ sys_menu_id: number; sort_order?: number; parent_sys_id?: number | null }>
) {
  if (!updates?.length) return
  const conn = await getConnectionStrict()
  try {
    await (conn as any).beginTransaction()
    for (const u of updates) {
      const cols: string[] = []
      const vals: any[] = []
      if (u.sort_order !== undefined) {
        cols.push('sort_order')
        vals.push(u.sort_order)
      }
      if (u.parent_sys_id !== undefined) {
        cols.push('parent_sys_id')
        vals.push(u.parent_sys_id)
      }
      if (!cols.length) continue
      await asQ(conn).query(
        `INSERT INTO unit_menus (unit_id, sys_menu_id, ${cols.join(',')})
         VALUES (?,?,${cols.map(() => '?').join(',')})
         ON DUPLICATE KEY UPDATE ${cols.map(c => `${c}=VALUES(${c})`).join(',')}`,
        [unitId, u.sys_menu_id, ...vals]
      )
    }
    await (conn as any).commit()
  } catch (e) {
    await (conn as any).rollback()
    throw e
  } finally {
    ;(conn as any).release()
  }
}

export const UnitRepo = {
  // 仅覆盖项 -> 用于“单位菜单管理页”，无覆盖时返回空
  findOverridesAsMenus,
  // 继承生效视图 -> 用于“运行态/权限态”聚合展示（可选）
  findEffectiveMenusForUnit,

  findOverridesByUnit,
  upsertUnitOverride,
  deleteUnitOverride,
  batchUpsertSort,
}
export default UnitRepo
