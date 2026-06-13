/* eslint-disable @typescript-eslint/no-explicit-any */
import { type Pool, type ResultSetHeader, type RowDataPacket } from 'mysql2/promise'
import { pool } from '@/config/database'
import { del, keys } from '@/common/redis/cache'

type CoreRole = {
  code: 'SUPER_ADMIN' | 'ADMIN' | 'TEACHER' | 'STUDENT'
  name: string
  description: string
  sort_order: number
}

type MenuRow = RowDataPacket & {
  id: number
  name: string
  parent_id: number | null
}

const CORE_ROLES: CoreRole[] = [
  { code: 'SUPER_ADMIN', name: '超级管理员', description: '拥有全部系统权限', sort_order: 1 },
  { code: 'ADMIN', name: '管理员', description: '系统管理员', sort_order: 2 },
  { code: 'TEACHER', name: '教师', description: '教学管理与考试管理角色', sort_order: 3 },
  { code: 'STUDENT', name: '学生', description: '学生角色', sort_order: 4 },
]

const STUDENT_MENU_ROOTS = [
  'dashboard',
  'learning',
  'notify-center',
  'task-center',
  'exam',
  'question',
  'analytics',
  'profile',
]

const TEACHER_MENU_ROOTS = ['dashboard', 'question', 'analytics', 'profile', 'exam-admin', 'system-tasks', 'system-workflows', 'system-notify']

async function getColumns(conn: Pool, table: string): Promise<Set<string>> {
  const [rows] = await conn.query<RowDataPacket[]>(`SHOW COLUMNS FROM \`${table}\``)
  return new Set(rows.map(r => String((r as any).Field)))
}

async function findRoleId(conn: Pool, code: string, hasOrgId: boolean): Promise<number | null> {
  const orderSql = hasOrgId ? 'ORDER BY org_id IS NOT NULL, id' : 'ORDER BY id'
  const [rows] = await conn.query<RowDataPacket[]>(
    `SELECT id FROM roles WHERE LOWER(code)=LOWER(?) ${orderSql} LIMIT 1`,
    [code]
  )
  const row = rows[0]
  return row ? Number((row as any).id) : null
}

async function insertCoreRole(conn: Pool, cols: Set<string>, role: CoreRole): Promise<number> {
  const names: string[] = []
  const placeholders: string[] = []
  const vals: any[] = []
  const pushValue = (column: string, value: any) => {
    if (!cols.has(column)) return
    names.push(`\`${column}\``)
    placeholders.push('?')
    vals.push(value)
  }
  const pushNow = (column: string) => {
    if (!cols.has(column)) return
    names.push(`\`${column}\``)
    placeholders.push('NOW()')
  }

  pushValue('name', role.name)
  pushValue('code', role.code)
  pushValue('description', role.description)
  pushValue('sort_order', role.sort_order)
  pushValue('is_system', 1)
  pushValue('is_disabled', 0)
  pushNow('created_at')
  pushNow('updated_at')

  const [res] = await conn.query<ResultSetHeader>(
    `INSERT INTO roles (${names.join(', ')}) VALUES (${placeholders.join(', ')})`,
    vals
  )
  return Number(res.insertId)
}

async function ensureCoreRoles(conn: Pool): Promise<Map<string, number>> {
  const cols = await getColumns(conn, 'roles')
  const result = new Map<string, number>()
  for (const role of CORE_ROLES) {
    const existing = await findRoleId(conn, role.code, cols.has('org_id'))
    const id = existing ?? (await insertCoreRole(conn, cols, role))
    result.set(role.code, id)
  }
  return result
}

async function ensureDefaultOrgAndStudentRole(conn: Pool, studentRoleId: number) {
  const orgCols = await getColumns(conn, 'organizations')
  let [orgRows] = await conn.query<RowDataPacket[]>(`SELECT id FROM organizations WHERE code='default' LIMIT 1`)
  if (!orgRows.length) {
    const names: string[] = []
    const placeholders: string[] = []
    const vals: any[] = []
    const pushValue = (column: string, value: any) => {
      if (!orgCols.has(column)) return
      names.push(`\`${column}\``)
      placeholders.push('?')
      vals.push(value)
    }
    const pushNow = (column: string) => {
      if (!orgCols.has(column)) return
      names.push(`\`${column}\``)
      placeholders.push('NOW()')
    }
    pushValue('name', '默认机构')
    pushValue('code', 'default')
    pushValue('is_disabled', 0)
    pushNow('created_at')
    pushNow('updated_at')
    await conn.query(`INSERT INTO organizations (${names.join(', ')}) VALUES (${placeholders.join(', ')})`, vals)
    ;[orgRows] = await conn.query<RowDataPacket[]>(`SELECT id FROM organizations WHERE code='default' LIMIT 1`)
  }
  const orgId = Number((orgRows[0] as any)?.id)
  if (!orgId) return

  await conn.query(`INSERT IGNORE INTO org_default_roles (org_id, role_id) VALUES (?, ?)`, [orgId, studentRoleId])
}

async function ensureUserOrganizationMemberships(conn: Pool) {
  await conn.query(`
    INSERT IGNORE INTO user_organizations (user_id, org_id, is_primary, assigned_at)
    SELECT picked.user_id, picked.org_id, 1, NOW()
      FROM (
        SELECT user_id, MIN(org_id) AS org_id
          FROM user_org_roles
         GROUP BY user_id
      ) picked
      LEFT JOIN user_organizations uo ON uo.user_id = picked.user_id
     WHERE uo.user_id IS NULL
  `)
}

function collectDescendants(roots: string[], menus: MenuRow[]): number[] {
  const byParent = new Map<number | null, MenuRow[]>()
  const byName = new Map<string, MenuRow>()
  for (const menu of menus) {
    const parentId = menu.parent_id == null ? null : Number(menu.parent_id)
    byName.set(String(menu.name), menu)
    const arr = byParent.get(parentId) ?? []
    arr.push(menu)
    byParent.set(parentId, arr)
  }

  const picked = new Set<number>()
  const visit = (menu: MenuRow | undefined) => {
    if (!menu) return
    const id = Number(menu.id)
    if (picked.has(id)) return
    picked.add(id)
    for (const child of byParent.get(id) ?? []) visit(child)
  }

  for (const root of roots) visit(byName.get(root))
  return [...picked]
}

function addAncestors(menuIds: number[], menus: MenuRow[]): number[] {
  const byId = new Map<number, MenuRow>()
  for (const menu of menus) byId.set(Number(menu.id), menu)
  const picked = new Set<number>(menuIds)
  for (const id of menuIds) {
    let cur = byId.get(id)
    while (cur?.parent_id != null) {
      const parentId = Number(cur.parent_id)
      if (picked.has(parentId)) {
        cur = byId.get(parentId)
        continue
      }
      picked.add(parentId)
      cur = byId.get(parentId)
    }
  }
  return [...picked]
}

async function getEnabledSystemMenus(conn: Pool): Promise<MenuRow[]> {
  const [rows] = await conn.query<MenuRow[]>(
    `SELECT id, name, parent_id
       FROM menus
      WHERE is_system=1 AND (is_disabled IS NULL OR is_disabled=0)`
  )
  return rows.map(r => ({ ...r, id: Number(r.id), parent_id: r.parent_id == null ? null : Number(r.parent_id) }))
}

async function grantMenus(conn: Pool, roleId: number | undefined, menuIds: number[]) {
  if (!roleId || !menuIds.length) return
  const uniqueIds = [...new Set(menuIds.map(Number).filter(Number.isFinite))]
  if (!uniqueIds.length) return
  const placeholders = uniqueIds.map(() => '(?, ?)').join(', ')
  const vals = uniqueIds.flatMap(menuId => [roleId, menuId])
  await conn.query(`INSERT IGNORE INTO role_menus (role_id, menu_id) VALUES ${placeholders}`, vals)
}

async function clearMenuPermissionCache() {
  try {
    const patterns = ['menuTree:*', 'perm:*']
    for (const pattern of patterns) {
      const found = await keys(pattern)
      if (found.length) await del(found)
    }
  } catch {}
}

export async function ensureDefaultMenuGrants() {
  const conn = pool as Pool
  const roleIds = await ensureCoreRoles(conn)
  await ensureDefaultOrgAndStudentRole(conn, roleIds.get('STUDENT')!)
  await ensureUserOrganizationMemberships(conn)

  const menus = await getEnabledSystemMenus(conn)
  const allMenuIds = menus.map(m => Number(m.id))
  const studentMenuIds = addAncestors(collectDescendants(STUDENT_MENU_ROOTS, menus), menus)
  const teacherMenuIds = addAncestors(collectDescendants(TEACHER_MENU_ROOTS, menus), menus)

  await grantMenus(conn, roleIds.get('SUPER_ADMIN'), allMenuIds)
  await grantMenus(conn, roleIds.get('ADMIN'), allMenuIds)
  await grantMenus(conn, roleIds.get('STUDENT'), studentMenuIds)
  await grantMenus(conn, roleIds.get('TEACHER'), teacherMenuIds)

  await clearMenuPermissionCache()
  console.log(
    `[menu-grants] ensured defaults: admin=${allMenuIds.length}, student=${studentMenuIds.length}, teacher=${teacherMenuIds.length}`
  )
}

export default ensureDefaultMenuGrants
