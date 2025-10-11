/* eslint-disable @typescript-eslint/no-explicit-any */
import { Pool } from 'mysql2/promise'
import { pool } from '@/config/database'
import { syncMenus } from './syncMenus' // ← 如果你的 syncMenus 定义在其它路径，改为实际导入路径
// 如果上面这行与项目路径不一致，请改成你文中贴出来的那个 sync 文件的默认导出

// === 你们项目里常见的“角色枚举/常量”，没有的话就用名称匹配 ===
const ADMIN_ROLE_CODES = ['SUPER_ADMIN', 'ADMIN'] // 优先用 code
const ADMIN_ROLE_NAMES = ['super_admin', 'admin', '管理员'] // 兜底用 name

// === 按你的表结构改：role_menu / role_permissions / user_menu 三选一 ===
// 下面默认用 role_menu（角色→菜单）做授权，如果你用的是 role_permissions（角色→权限码），见本文底部“可选 SQL”。
const TABLES = {
  menu: 'menus',
  roles: 'roles',
  users: 'users',
  roleMenu: 'role_menu', // 如果你没有 role_menu，而是 role_permissions，请看最后的“可选 SQL”
}

async function findAdminRoleIds(conn: Pool) {
  // 先按 code，再按名称模糊匹配
  const [byCode] = await conn.query<any[]>(
    `SELECT id FROM ${TABLES.roles} WHERE code IN (${ADMIN_ROLE_CODES.map(() => '?').join(',')})`,
    ADMIN_ROLE_CODES
  )
  let ids = byCode.map(r => Number(r.id))

  if (!ids.length) {
    const [byName] = await conn.query<any[]>(
      `SELECT id FROM ${TABLES.roles} WHERE name IN (${ADMIN_ROLE_NAMES.map(() => '?').join(
        ','
      )}) OR LOWER(name) IN (${ADMIN_ROLE_NAMES.map(() => '?').join(',')})`,
      [...ADMIN_ROLE_NAMES, ...ADMIN_ROLE_NAMES.map(s => s.toLowerCase())]
    )
    ids = byName.map(r => Number(r.id))
  }
  if (!ids.length) throw new Error('未找到管理员/超管角色（请检查 roles 表的 code/name）')
  return ids
}

async function getAllSystemMenuIds(conn: Pool) {
  const [rows] = await conn.query<any[]>(
    `SELECT id FROM ${TABLES.menu} WHERE is_system = 1 AND (is_disabled IS NULL OR is_disabled = 0)`
  )
  return rows.map(r => Number(r.id))
}

async function grantAllMenusToRoles(conn: Pool, roleIds: number[], menuIds: number[]) {
  if (!roleIds.length || !menuIds.length) return
  const values: any[] = []
  for (const rid of roleIds) {
    for (const mid of menuIds) {
      values.push([rid, mid])
    }
  }
  // 使用 INSERT IGNORE 防重复
  await conn.query(
    `INSERT IGNORE INTO ${TABLES.roleMenu} (role_id, menu_id) VALUES ${values.map(() => '(?,?)').join(',')}`,
    values.flat()
  )
}

async function main() {
  const conn = pool as Pool
  // 1) 把前端的 MENU_TREE 种子“同步/更新”到数据库
  await syncMenus({ mode: 'patch', removeOrphans: false })

  // 2) 把所有系统菜单授给管理员/超管角色
  const roleIds = await findAdminRoleIds(conn)
  const menuIds = await getAllSystemMenuIds(conn)
  await grantAllMenusToRoles(conn, roleIds, menuIds)

  console.log('[menu-bootstrap] OK: 同步系统菜单并授予管理员全部可见权限')
}

main().catch(e => {
  console.error('[menu-bootstrap] 失败：', e)
  process.exit(1)
})
