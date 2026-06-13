import type { Knex } from 'knex'

type RoleSeed = {
  code: 'SUPER_ADMIN' | 'ADMIN' | 'TEACHER' | 'STUDENT'
  name: string
  description: string
  sort_order: number
}

type MenuRow = {
  id: number
  name: string
  parent_id: number | null
}

const CORE_ROLES: RoleSeed[] = [
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

async function tableExists(knex: Knex, table: string) {
  return knex.schema.hasTable(table)
}

async function getTableColumns(knex: Knex, table: string): Promise<Set<string>> {
  const [rows] = await knex.raw(`SHOW COLUMNS FROM \`${table}\``)
  return new Set((rows || []).map((r: any) => String(r.Field)))
}

function pickExistingColumns<T extends Record<string, any>>(cols: Set<string>, values: T) {
  const out: Record<string, any> = {}
  for (const [key, value] of Object.entries(values)) {
    if (cols.has(key)) out[key] = value
  }
  return out
}

async function ensureCoreRoles(knex: Knex): Promise<Map<RoleSeed['code'], number>> {
  const cols = await getTableColumns(knex, 'roles')
  const ids = new Map<RoleSeed['code'], number>()

  for (const role of CORE_ROLES) {
    let row = await knex('roles').whereRaw('LOWER(code)=LOWER(?)', [role.code]).orderBy('id', 'asc').first()
    if (!row) {
      await knex('roles').insert(
        pickExistingColumns(cols, {
          name: role.name,
          code: role.code,
          description: role.description,
          sort_order: role.sort_order,
          is_system: 1,
          is_disabled: 0,
          created_at: knex.fn.now(),
          updated_at: knex.fn.now(),
        })
      )
      row = await knex('roles').whereRaw('LOWER(code)=LOWER(?)', [role.code]).orderBy('id', 'asc').first()
    }
    if (row?.id) ids.set(role.code, Number(row.id))
  }

  return ids
}

async function ensureDefaultOrgRole(knex: Knex, studentRoleId: number | undefined) {
  if (!studentRoleId) return
  if (!(await tableExists(knex, 'organizations')) || !(await tableExists(knex, 'org_default_roles'))) return

  let org = await knex('organizations').where({ code: 'default' }).first()
  if (!org) {
    const cols = await getTableColumns(knex, 'organizations')
    await knex('organizations').insert(
      pickExistingColumns(cols, {
        name: '默认机构',
        code: 'default',
        is_disabled: 0,
        created_at: knex.fn.now(),
        updated_at: knex.fn.now(),
      })
    )
    org = await knex('organizations').where({ code: 'default' }).first()
  }
  if (!org?.id) return

  const exists = await knex('org_default_roles').where({ org_id: org.id, role_id: studentRoleId }).first()
  if (!exists) await knex('org_default_roles').insert({ org_id: org.id, role_id: studentRoleId })
}

function collectDescendants(roots: string[], menus: MenuRow[]): number[] {
  const byName = new Map<string, MenuRow>()
  const byParent = new Map<number | null, MenuRow[]>()
  for (const menu of menus) {
    byName.set(menu.name, menu)
    const parentId = menu.parent_id == null ? null : Number(menu.parent_id)
    const list = byParent.get(parentId) ?? []
    list.push(menu)
    byParent.set(parentId, list)
  }

  const ids = new Set<number>()
  const visit = (menu?: MenuRow) => {
    if (!menu) return
    const id = Number(menu.id)
    if (ids.has(id)) return
    ids.add(id)
    for (const child of byParent.get(id) ?? []) visit(child)
  }

  for (const root of roots) visit(byName.get(root))
  return [...ids]
}

function addAncestors(menuIds: number[], menus: MenuRow[]): number[] {
  const byId = new Map<number, MenuRow>()
  for (const menu of menus) byId.set(Number(menu.id), menu)
  const ids = new Set<number>(menuIds)
  for (const id of menuIds) {
    let cur = byId.get(id)
    while (cur?.parent_id != null) {
      const parentId = Number(cur.parent_id)
      ids.add(parentId)
      cur = byId.get(parentId)
    }
  }
  return [...ids]
}

async function grantMenus(knex: Knex, roleId: number | undefined, menuIds: number[]) {
  if (!roleId || !menuIds.length) return
  const uniqueIds = [...new Set(menuIds.map(Number).filter(Number.isFinite))]
  if (!uniqueIds.length) return
  const vals = uniqueIds.flatMap(menuId => [roleId, menuId])
  await knex.raw(
    `INSERT IGNORE INTO role_menus (role_id, menu_id) VALUES ${uniqueIds.map(() => '(?, ?)').join(', ')}`,
    vals
  )
}

export async function up(knex: Knex): Promise<void> {
  if (!(await tableExists(knex, 'roles')) || !(await tableExists(knex, 'menus')) || !(await tableExists(knex, 'role_menus'))) {
    return
  }

  const roleIds = await ensureCoreRoles(knex)
  await ensureDefaultOrgRole(knex, roleIds.get('STUDENT'))

  const menus = (await knex('menus')
    .select('id', 'name', 'parent_id')
    .where('is_system', 1)
    .where(builder => builder.whereNull('is_disabled').orWhere('is_disabled', 0))) as MenuRow[]

  const allMenuIds = menus.map(m => Number(m.id))
  const studentMenuIds = addAncestors(collectDescendants(STUDENT_MENU_ROOTS, menus), menus)
  const teacherMenuIds = addAncestors(collectDescendants(TEACHER_MENU_ROOTS, menus), menus)

  await grantMenus(knex, roleIds.get('SUPER_ADMIN'), allMenuIds)
  await grantMenus(knex, roleIds.get('ADMIN'), allMenuIds)
  await grantMenus(knex, roleIds.get('STUDENT'), studentMenuIds)
  await grantMenus(knex, roleIds.get('TEACHER'), teacherMenuIds)
}

export async function down(_knex: Knex): Promise<void> {
  // 数据修复迁移不删除生产权限，避免回滚误伤人工配置。
}
