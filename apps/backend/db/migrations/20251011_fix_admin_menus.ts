/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Knex } from 'knex'

// （可选）调用应用内的 syncMenus，把前端种子写进 menus 表并打上 is_system=1
let trySyncMenus: null | (() => Promise<void>) = null
try {
  // 按你的实际路径改；改不对也没关系，catch 后继续执行
  // 例如：'../../src/modules/menus/syncMenus' 或 '../../src/modules/menu/syncMenus'
  // @ts-ignore
  const mod = require('../../src/modules/menu/syncMenus')
  trySyncMenus = async () => {
    const fn = mod.syncMenus || mod.default
    if (typeof fn === 'function') {
      await fn({ mode: 'patch', removeOrphans: false })
      console.log('[migration] syncMenus(): done.')
    }
  }
} catch {
  /* ignore */
}

/** 表名（与你仓库保持一致：role_menus 为复数） */
const T = {
  menus: 'menus',
  roles: 'roles',
  roleMenus: 'role_menus', // ✅ 与仓库 Repository 保持一致
  users: 'users',
  userRoles: 'user_roles',
  userOrgRoles: 'user_org_roles',
  userOrganizations: 'user_organizations',
}

const ADMIN_ROLE_CODES = ['SUPER_ADMIN', 'ADMIN']
const ADMIN_ROLE_NAMES = ['super_admin', 'admin', '管理员', '超级管理员']

/* ----------------- 工具：探测表/列是否存在 ----------------- */
async function hasTable(knex: Knex, table: string) {
  return knex.schema.hasTable(table)
}
async function hasCol(knex: Knex, table: string, col: string) {
  try {
    return knex.schema.hasColumn(table, col)
  } catch {
    return false
  }
}

/* 不区分大小写相等（兼容 MySQL/PG） */
function ilike(knex: Knex, col: string, values: string[]) {
  const ins = values.map(v => knex.raw('LOWER(??)=LOWER(?)', [col, v]))
  return (qb: Knex.QueryBuilder) =>
    qb.where(function () {
      ins.forEach((expr, i) => (i === 0 ? this.where(expr) : this.orWhere(expr)))
    })
}

async function ensureAdminRoleIds(knex: Knex): Promise<number[]> {
  const found = await knex(T.roles)
    .select('id', 'code', 'name')
    .where(function () {
      this.whereIn('code', ADMIN_ROLE_CODES)
        .orWhere(ilike(knex, 'name', ADMIN_ROLE_NAMES))
        .orWhere(ilike(knex, 'code', ADMIN_ROLE_CODES))
    })

  if (found.length) return found.map(r => Number(r.id))

  // 若不存在则创建一个 SUPER_ADMIN（谨慎：不在 down 里删除角色）
  const [id] = await knex(T.roles).insert({
    name: '超级管理员',
    code: 'SUPER_ADMIN',
    description: '系统内置超管，拥有全部系统菜单访问权限（由迁移创建）',
    sort_order: 1,
    is_system: 1,
    is_disabled: 0,
  })
  return [Number(id)]
}

async function getAllSystemMenuIds(knex: Knex): Promise<number[]> {
  const rows = await knex(T.menus)
    .select('id')
    .where({ is_system: 1 })
    .andWhere(qb => qb.whereNull('is_disabled').orWhere('is_disabled', 0))
  return rows.map(r => Number(r.id))
}

async function grantMenus(knex: Knex, roleIds: number[], menuIds: number[]) {
  if (!roleIds.length || !menuIds.length) return
  const pairs = roleIds.flatMap(rid => menuIds.map(mid => ({ role_id: rid, menu_id: mid })))
  await knex(T.roleMenus).insert(pairs).onConflict(['role_id', 'menu_id']).ignore()
}

/** 可选：把用户名/邮箱为 admin 的账户挂到管理员角色（存在相应字段/表才执行） */
async function attachAdminUser(knex: Knex, adminRoleIds: number[]) {
  if (!adminRoleIds.length) return
  if (!(await hasTable(knex, T.users))) return

  const canUsername = await hasCol(knex, T.users, 'username')
  const canAccount = await hasCol(knex, T.users, 'account')
  const canEmail = await hasCol(knex, T.users, 'email')

  // 逐步尝试匹配条件（按可用列构造 where）
  let q = knex(T.users).first('id')
  let hasWhere = false
  if (canUsername) {
    q = q.where(ilike(knex, 'username', ['admin']))
    hasWhere = true
  }
  if (canAccount) {
    q = hasWhere ? q.orWhere(ilike(knex, 'account', ['admin'])) : q.where(ilike(knex, 'account', ['admin']))
    hasWhere = true
  }
  if (canEmail) {
    const emails = ['admin@admin', 'admin@local', 'admin@example.com']
    const exprs = emails.map(e => knex.raw('LOWER(??)=LOWER(?)', ['email', e]))
    q = hasWhere
      ? q.orWhere(function () {
          exprs.forEach((ex, i) => (i === 0 ? this.where(ex) : this.orWhere(ex)))
        })
      : q.where(function () {
          exprs.forEach((ex, i) => (i === 0 ? this.where(ex) : this.orWhere(ex)))
        })
    hasWhere = true
  }

  if (!hasWhere) return // 没有任何可用匹配列就跳过

  const admin = await q
  if (!admin) return
  const uid = Number(admin.id)

  // user_roles（全局角色）存在才写
  if (await hasTable(knex, T.userRoles)) {
    await knex(T.userRoles)
      .insert(adminRoleIds.map(rid => ({ user_id: uid, role_id: rid })))
      .onConflict(['user_id', 'role_id'])
      .ignore()
  }

  // 若存在按组织授予的两张表，再尝试把 admin 挂到其主组织
  if ((await hasTable(knex, T.userOrganizations)) && (await hasTable(knex, T.userOrgRoles))) {
    const hasPrimary = await hasCol(knex, T.userOrganizations, 'is_primary')
    const primaryOrgQ = knex(T.userOrganizations).first('org_id').where({ user_id: uid })
    const primaryOrg = hasPrimary
      ? await primaryOrgQ.orderBy([
          { column: 'is_primary', order: 'desc' },
          { column: 'org_id', order: 'asc' },
        ])
      : await primaryOrgQ.orderBy([{ column: 'org_id', order: 'asc' }])

    if (primaryOrg?.org_id != null) {
      await knex(T.userOrgRoles)
        .insert(
          adminRoleIds.map(rid => ({
            user_id: uid,
            org_id: Number(primaryOrg.org_id),
            role_id: rid,
            assigned_at: knex.fn.now(),
          }))
        )
        .onConflict(['user_id', 'org_id', 'role_id'])
        .ignore()
    }
  }
}

/** 可选：清理 Redis 菜单/权限缓存 */
async function clearMenuCachesIfPossible() {
  try {
    // @ts-ignore
    const mod = require('../../src/common/redis/cache')
    const RC = mod.default || mod
    if (RC?.keys && RC?.del) {
      const pats = ['menuTree:*', 'perm:*', 'menuTree:scope:*']
      for (const p of pats) {
        const ks = await RC.keys(p)
        if (ks?.length) await RC.del(ks)
      }
      console.log('[migration] redis menu caches cleared.')
    }
  } catch {
    /* ignore */
  }
}

export async function up(knex: Knex): Promise<void> {
  // 1) 同步系统菜单（可选）
  if (trySyncMenus) {
    try {
      await trySyncMenus()
    } catch {}
  }

  // 2) 管理员角色（若无则创建）
  const adminRoleIds = await ensureAdminRoleIds(knex)

  // 3) 全部系统菜单
  const menuIds = await getAllSystemMenuIds(knex)

  // 4) 授权到 role_menus（幂等）
  await grantMenus(knex, adminRoleIds, menuIds)

  // 5) 把 admin 用户（若能识别到）挂到管理员角色（幂等 & 按表结构自动降级）
  await attachAdminUser(knex, adminRoleIds)

  // 6) 清缓存（可选）
  await clearMenuCachesIfPossible()

  console.log(`[migration] ✓ 管理员角色(${adminRoleIds.join(',')}) 已拥有 ${menuIds.length} 个系统菜单权限`)
}

export async function down(knex: Knex): Promise<void> {
  // 回滚：仅移除“管理员角色 × 系统菜单”的授权，不动角色/用户本身，避免误删
  const adminRoleIds = await ensureAdminRoleIds(knex)
  if (!adminRoleIds.length) return
  const menuIds = await getAllSystemMenuIds(knex)
  if (!menuIds.length) return

  await knex(T.roleMenus).whereIn('role_id', adminRoleIds).whereIn('menu_id', menuIds).delete()

  await clearMenuCachesIfPossible()
  console.log('[migration] ✗ 已移除 管理员角色 × 系统菜单 的授权条目')
}
