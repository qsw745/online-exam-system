// apps/backend/src/modules/orgs/services/org-user.service.ts
import { OrgUserRepository, getOrgUserColumns, getUserCols } from '../repositories/org-user.repository'
import type { OrgUserListData } from '../domain/org-user.model'
import { pool } from '@config/database'
import { LogRepository } from '@modules/analytics/repositories/log.repository'

export class OrgUserService {
  /** GET 列表（分页/搜索/角色筛选/递归） */
  async listUsers(params: {
    orgId: number
    page: number
    limit: number
    search?: string
    role?: string
    includeChildren?: boolean
  }): Promise<OrgUserListData> {
    const { orgId, page, limit, search, role, includeChildren } = params
    if (!(await OrgUserRepository.orgExists(orgId))) throw new Error('组织不存在')

    // 递归 orgIds
    const { getOrgTable } = await import('../repositories/org-user.repository')
    const orgTable = await getOrgTable()
    const ids = [orgId]
    if (includeChildren) {
      try {
        const [rows] = await pool.query<any[]>(
          `
          WITH RECURSIVE c AS (
            SELECT id FROM ${orgTable} WHERE id=?
            UNION ALL
            SELECT o.id FROM ${orgTable} o JOIN c ON o.parent_id = c.id
          ) SELECT id FROM c
        `,
          [orgId]
        )
        const arr = (rows as any[]).map(r => Number(r.id)).filter(Boolean)
        if (arr.length) {
          ids.splice(0, ids.length, ...arr)
        }
      } catch {
        // MySQL < 8 忽略子机构
      }
    }

    // users 列
    const userCols = await getUserCols()
    const hasEmail = userCols.has('email')
    const hasRealName = userCols.has('real_name')
    const hasPhone = userCols.has('phone')
    const hasIsActive = userCols.has('is_active')
    const hasStatus = userCols.has('status')
    const hasCreatedAt = userCols.has('created_at')
    const hasUpdatedAt = userCols.has('updated_at')

    const selectCols: string[] = ['u.id', 'u.username']
    if (hasEmail) selectCols.push('u.email')
    if (hasRealName) selectCols.push('u.real_name')
    if (hasPhone) selectCols.push('u.phone')
    if (hasIsActive) selectCols.push('u.is_active')
    if (hasStatus) selectCols.push('u.status')
    if (hasCreatedAt) selectCols.push('u.created_at')
    if (hasUpdatedAt) selectCols.push('u.updated_at')

    // where
    const orgIdField = await OrgUserRepository.orgIdField()
    const whereParts: string[] = [`uo.${orgIdField} IN (${ids.map(() => '?').join(',')})`]
    const whereVals: any[] = [...ids]
    if (search) {
      const searchCols = ['username']
      if (hasRealName) searchCols.push('real_name')
      if (hasEmail) searchCols.push('email')
      if (hasPhone) searchCols.push('phone')
      whereParts.push('(' + searchCols.map(c => `u.${c} LIKE ?`).join(' OR ') + ')')
      const like = `%${search}%`
      for (let i = 0; i < searchCols.length; i++) whereVals.push(like)
    }

    if (role) {
      try {
        const [tableCheck] = await pool.query<any[]>(
          `SELECT table_name FROM information_schema.tables 
           WHERE table_schema = DATABASE() AND table_name = 'user_org_roles'`
        )
        if ((tableCheck as any[]).length > 0) {
          whereParts.push(
            `EXISTS (
              SELECT 1 FROM user_org_roles uor
              JOIN roles r ON r.id = uor.role_id
              WHERE uor.user_id = u.id
                AND uor.${orgIdField} IN (${ids.map(() => '?').join(',')})
                AND r.code = ?
            )`
          )
          whereVals.push(...ids, role)
        }
      } catch {}
    }

    const whereSQL = 'WHERE ' + whereParts.join(' AND ')
    const total = await OrgUserRepository.countUsers(whereSQL, whereVals)
    if (total === 0) return { items: [], total: 0, page, limit }

    const rows = await OrgUserRepository.listUsers(selectCols, whereSQL, whereVals, page, limit)
    const items = rows.map((r: any) => {
      const st: 'active' | 'disabled' =
        typeof r.status === 'string'
          ? r.status === 'disabled'
            ? 'disabled'
            : 'active'
          : hasIsActive
          ? Number(r.is_active) === 1
            ? 'active'
            : 'disabled'
          : 'active'
      const base: any = {
        id: r.id,
        username: r.username,
        role_codes: [],
        status: st,
        org_id: r.org_id ?? null,
        org_name: r.org_name ?? null,
      }
      if (hasEmail) base.email = r.email
      if (hasRealName) base.real_name = r.real_name
      if (hasPhone) base.phone = r.phone
      if (hasIsActive) base.is_active = r.is_active
      if (hasCreatedAt) base.created_at = r.created_at
      if (hasUpdatedAt) base.updated_at = r.updated_at
      return base
    })

    return { items, total, page, limit }
  }

  async addUsers(
    user: { id?: number; username?: string } | undefined,
    orgId: number,
    userIds: number[],
    reqMeta?: { ip?: string; ua?: string }
  ) {
    if (!(await OrgUserRepository.orgExists(orgId))) throw new Error('组织不存在')
    const validIds = await OrgUserRepository.userIdsExisting(userIds)
    if (!validIds.length) throw new Error('提供的用户不存在')
    const affected = await OrgUserRepository.insertIgnoreUserOrgs(orgId, validIds)

    await LogRepository.insertUserLog({
      userId: user?.id || 0,
      username: user?.username || undefined,
      action: 'add_users_to_org',
      resourceType: 'organization',
      resourceId: orgId,
      details: { count: affected, user_ids: validIds },
      ipAddress: reqMeta?.ip,
      userAgent: reqMeta?.ua,
    })

    return { added: affected }
  }

  async removeUser(
    user: { id?: number; username?: string } | undefined,
    orgId: number,
    targetUserId: number,
    reqMeta?: { ip?: string; ua?: string }
  ) {
    const cols = await getOrgUserColumns()
    const rel = await OrgUserRepository.relOfUserInOrg(orgId, targetUserId)
    if (!rel) throw new Error('该用户不在此组织下')
    const removingIsPrimary = cols.has('is_primary') ? Number((rel as any).is_primary) === 1 : false

    if (removingIsPrimary) {
      const nextOrgId = await OrgUserRepository.anotherOrgForUser(targetUserId, orgId)
      if (!nextOrgId) throw new Error('该用户仅有此一个组织，不能移除其主组织')
      await OrgUserRepository.clearAllPrimary(targetUserId)
      const ok = await OrgUserRepository.setPrimary(targetUserId, nextOrgId)
      if (!ok) throw new Error('主组织重分配失败')
      const del = await OrgUserRepository.deleteRel(targetUserId, orgId)
      if (!del) throw new Error('移除失败')
    } else {
      const del = await OrgUserRepository.deleteRel(targetUserId, orgId)
      if (!del) throw new Error('移除失败')
    }

    await LogRepository.insertUserLog({
      userId: user?.id || 0,
      username: user?.username || undefined,
      action: 'remove_user_from_org',
      resourceType: 'organization',
      resourceId: orgId,
      details: { user_id: targetUserId },
      ipAddress: reqMeta?.ip,
      userAgent: reqMeta?.ua,
    })

    return { message: '移除成功' }
  }

  async setPrimary(
    user: { id?: number; username?: string } | undefined,
    orgId: number,
    targetUserId: number,
    reqMeta?: { ip?: string; ua?: string }
  ) {
    if (!(await OrgUserRepository.orgExists(orgId))) throw new Error('组织或用户不存在')
    await OrgUserRepository.ensureRel(targetUserId, orgId)
    await OrgUserRepository.clearAllPrimary(targetUserId)
    const ok = await OrgUserRepository.setPrimary(targetUserId, orgId)
    if (!ok) throw new Error('设置主组织失败')

    await LogRepository.insertUserLog({
      userId: user?.id || 0,
      username: user?.username || undefined,
      action: 'set_primary_org',
      resourceType: 'organization',
      resourceId: orgId,
      details: { user_id: targetUserId, org_id: orgId },
      ipAddress: reqMeta?.ip,
      userAgent: reqMeta?.ua,
    })

    return { user_id: targetUserId, org_id: orgId }
  }

  async moveUser(
    user: { id?: number; username?: string } | undefined,
    fromOrgId: number,
    toOrgId: number,
    targetUserId: number,
    reqMeta?: { ip?: string; ua?: string }
  ) {
    if (fromOrgId === toOrgId) throw new Error('源与目标机构相同')
    if (!(await OrgUserRepository.orgExists(fromOrgId)) || !(await OrgUserRepository.orgExists(toOrgId))) {
      throw new Error('组织或用户不存在')
    }

    await OrgUserRepository.ensureRel(targetUserId, toOrgId)
    await OrgUserRepository.clearAllPrimary(targetUserId)
    const ok = await OrgUserRepository.setPrimary(targetUserId, toOrgId)
    if (!ok) throw new Error('设置目标主组织失败')
    await OrgUserRepository.deleteRel(targetUserId, fromOrgId)

    await LogRepository.insertUserLog({
      userId: user?.id || 0,
      username: user?.username || undefined,
      action: 'move_user_org',
      resourceType: 'organization',
      resourceId: toOrgId,
      details: { user_id: targetUserId, from_org_id: fromOrgId, to_org_id: toOrgId },
      ipAddress: reqMeta?.ip,
      userAgent: reqMeta?.ua,
    })

    return { user_id: targetUserId, from_org_id: fromOrgId, to_org_id: toOrgId }
  }
}
