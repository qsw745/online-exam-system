import type { Request, Response } from 'express'
import type { CreateRoleRequest, UpdateRoleRequest } from '../domain/role.model.js'
import { DuplicateCodeError, RoleService, slugifyCode } from '../services/role.service.js'
import { UnitRepo } from '../../menus/repositories/unit-menu.repository.js'
// ✅ 在此文件顶部加上：
type Res<T = any> = Response<T> & {
  ok<D = any>(data?: D, message?: string, extra?: any): Res<T>
  created<D = any>(data?: D, message?: string, extra?: any): Res<T>
  badRequest(message?: string, extra?: any): Res<T>
  unauthorized(message?: string, extra?: any): Res<T>
  forbidden(message?: string, extra?: any): Res<T>
  notFound(message?: string, extra?: any): Res<T>
  tooMany(message?: string, extra?: any): Res<T>
  conflict(message?: string, extra?: any): Res<T>   // 👈 新增
  internal(message?: string, extra?: any): Res<T>
  fail(code: string, httpStatus?: number, message?: string, extra?: any): Res<T>
}
/** ===== 组织下的角色（供 /orgs/:orgId/roles 使用） ===== */
export const listRolesByOrg = async (req: Request, res: Res) => {
  try {
    const orgId = Number(req.params.orgId)
    const page = req.query.page ? parseInt(String(req.query.page), 10) : 1
    const pageSize = req.query.pageSize ? parseInt(String(req.query.pageSize), 10) : 10
    const keyword = typeof req.query.keyword === 'string' ? req.query.keyword.trim() : undefined
    const { roles, total } = await RoleService.getRolesWithPagination(page, pageSize, keyword, orgId)
    return res.ok({ roles, total, page, pageSize })
  } catch (e) {
    console.error('listRolesByOrg 失败:', e)
    return res.internal('获取组织下角色失败')
  }
}

export const createRoleUnderOrg = async (req: Request, res: Res) => {
  try {
    const orgId = Number(req.params.orgId)
    const payload: CreateRoleRequest = { ...req.body, org_id: orgId }
    if (!payload?.name) return res.badRequest('角色名称不能为空')
    const role = await RoleService.createRoleUnderOrg(orgId, payload)
    return res.created(role, '角色创建成功')
  } catch (e: any) {
     console.error('createRoleUnderOrg 失败:', e)
     if (e instanceof DuplicateCodeError) return res.conflict(e.message)
     if (e?.code === 'ER_DUP_ENTRY') {
       const m = String(e?.sqlMessage || e?.message || '')
       if (/uk_org_name|uk_name/i.test(m)) return res.conflict('该机构下角色名称已存在，请使用其他名称')
       if (/uk_org_code|uk_code/i.test(m)) return res.conflict('该机构下角色编码已存在，请使用其他编码')
       return res.conflict('角色已存在')
     }
     if (/已存在/.test(String(e?.message))) return res.conflict(e.message)
     return res.internal(e?.message || '创建角色失败')
  }
}

export const updateRoleUnderOrg = async (req: Request, res: Res) => {
    try {
        const id = Number(req.params.id)
        if (!Number.isFinite(id)) return res.badRequest('无效的角色ID')
        const patch: UpdateRoleRequest = { ...req.body, org_id: Number(req.params.orgId) }
        const role = await RoleService.updateRole(id, patch)
        if (!role) return res.notFound('角色不存在')
        return res.ok(role, '角色更新成功')
    } catch (e: any) {
        console.error('updateRoleUnderOrg 失败:', e)
        if (e instanceof DuplicateCodeError) return res.conflict(e.message)
       if (e?.code === 'ER_DUP_ENTRY') {
         const m = String(e?.sqlMessage || e?.message || '')
         if (/uk_org_name|uk_name/i.test(m)) return res.conflict('该机构下角色名称已存在，请使用其他名称')
         if (/uk_org_code|uk_code/i.test(m)) return res.conflict('该机构下角色编码已存在，请使用其他编码')
         return res.conflict('角色已存在')
       }
        return res.internal(e?.message || '更新角色失败')
    }
}

export const deleteRoleUnderOrg = async (req: Request, res: Res) => {
    try {
        const id = Number(req.params.id)
        if (!Number.isFinite(id)) return res.badRequest('无效的角色ID')
        const ok = await RoleService.deleteRole(id)
        if (!ok) return res.notFound('角色不存在或无法删除')
        return res.ok(null, '角色删除成功')
    } catch (e: any) {
        console.error('deleteRoleUnderOrg 失败:', e)
        if (e instanceof Error && ['系统角色不允许删除', '该角色正在被用户使用，无法删除'].includes(e.message)) {
            return res.badRequest(e.message)
        }
        return res.internal(e?.message || '删除角色失败')
    }
}

/** ===== 角色→单位菜单（优先使用 role.org_id） ===== */
export const getRoleEffectiveMenus = async (req: Request, res: Res) => {
    try {
        const roleId = Number(req.params.id)
        if (!Number.isFinite(roleId)) return res.badRequest('无效的角色ID')

        const role = await RoleService.getRoleById(roleId)
        if (!role) return res.notFound('角色不存在')

        // 优先：role.org_id；其次：允许 ?orgId= 指定（以防角色是全局的）
        const orgIdQ = req.query.orgId != null ? Number(req.query.orgId) : undefined
        const orgId = (role.org_id ?? undefined) ?? orgIdQ
        if (!Number.isFinite(orgId as number)) {
            return res.badRequest('请先在机构页面创建“机构内角色”或指定 orgId')
        }

        const menus = await UnitRepo.findEffectiveMenusForUnit(Number(orgId))
        return res.ok({ orgId: Number(orgId), menus })
    } catch (e: any) {
        console.error('getRoleEffectiveMenus 失败:', e)
        return res.internal(e?.message || '获取角色单位菜单失败')
    }
}

/** ===== 原有 /roles 的其余接口（保持不变） ===== */
export const getAllRoles = async (req: Request, res: Res) => {
    try {
        const page = req.query.page ? parseInt(String(req.query.page), 10) : undefined
        const pageSize = req.query.pageSize ? parseInt(String(req.query.pageSize), 10) : undefined
        const keyword = typeof req.query.keyword === 'string' ? req.query.keyword.trim() : undefined

        if (page && pageSize) {
            const { roles, total } = await RoleService.getRolesWithPagination(page, pageSize, keyword)
            return res.ok({ roles, total, page, pageSize })
        }
        const roles = await RoleService.getAllRoles()
        return res.ok(roles)
    } catch (e) {
        console.error('获取角色列表失败:', e)
        return res.internal('获取角色列表失败')
    }
}

export const getRoleById = async (req: Request, res: Res) => {
    try {
        const id = Number(req.params.id)
        if (!Number.isFinite(id)) return res.badRequest('无效的角色ID')
        const role = await RoleService.getRoleById(id)
        if (!role) return res.notFound('角色不存在')
        return res.ok(role)
    } catch (e) {
        console.error('获取角色详情失败:', e)
        return res.internal('获取角色详情失败')
    }
}

export const createRole = async (req: Request, res: Res) => {
    try {
        const payload: CreateRoleRequest = req.body
        if (!payload?.name) return res.badRequest('角色名称不能为空')
        const role = await RoleService.createRole(payload) // org_id = null（全局）
        return res.created(role, '角色创建成功')
    } catch (e: any) {
        console.error('创建角色失败:', e)
        if (e instanceof DuplicateCodeError) return res.conflict(e.message)
        if (e?.code === 'ER_DUP_ENTRY') return res.conflict('角色编码已存在，请使用其他编码')
        return res.internal(e?.message || '创建角色失败')
    }
}

export const updateRole = async (req: Request, res: Res) => {
    try {
        const id = Number(req.params.id)
        if (!Number.isFinite(id)) return res.badRequest('无效的角色ID')
        const data: UpdateRoleRequest = req.body
        const role = await RoleService.updateRole(id, data)
        if (!role) return res.notFound('角色不存在')
        return res.ok(role, '角色更新成功')
    } catch (e: any) {
        console.error('更新角色失败:', e)
        if (e instanceof DuplicateCodeError) return res.conflict(e.message)
        if (e?.code === 'ER_DUP_ENTRY') return res.conflict('角色编码已存在，请使用其他编码')
        return res.internal(e?.message || '更新角色失败')
    }
}

export const deleteRole = async (req: Request, res: Res) => {
    try {
        const id = Number(req.params.id)
        if (!Number.isFinite(id)) return res.badRequest('无效的角色ID')
        const ok = await RoleService.deleteRole(id)
        if (!ok) return res.notFound('角色不存在或无法删除')
        return res.ok(null, '角色删除成功')
    } catch (e: any) {
        console.error('删除角色失败:', e)
        if (e instanceof Error && ['系统角色不允许删除', '该角色正在被用户使用，无法删除'].includes(e.message)) {
            return res.badRequest(e.message)
        }
        return res.internal(e?.message || '删除角色失败')
    }
}

/** 菜单权限 */
export const getRoleMenus = async (req: Request, res: Res) => {
    try {
        const id = Number(req.params.id)
        if (!Number.isFinite(id)) return res.badRequest('无效的角色ID')
        const data = await RoleService.getRoleMenus(id)
        return res.ok(data)
    } catch (e) {
        console.error('获取角色菜单权限失败:', e)
        return res.internal('获取角色菜单权限失败')
    }
}
export const setRoleMenus = async (req: Request, res: Res) => {
    try {
        const id = Number(req.params.id)
        const menuIds: number[] = req.body?.menuIds || []
        if (!Number.isFinite(id)) return res.badRequest('无效的角色ID')
        if (!Array.isArray(menuIds)) return res.badRequest('menuIds 必须为数组')
        await RoleService.setRoleMenus(id, menuIds)
        return res.ok(null, '角色菜单权限设置成功')
    } catch (e) {
        console.error('设置角色菜单权限失败:', e)
        return res.internal('设置角色菜单权限失败')
    }
}

/** 用户 ⇄ 角色（原有接口） */
export const getUserRoles = async (req: Request, res: Res) => {
    try {
        const uid = Number(req.params.userId)
        if (!Number.isFinite(uid)) return res.badRequest('无效的用户ID')
        const data = await RoleService.getUserRoles(uid)
        return res.ok(data)
    } catch (e) {
        console.error('获取用户角色失败:', e)
        return res.internal('获取用户角色失败')
    }
}
export const setUserRoles = async (req: Request, res: Res) => {
    try {
        const uid = Number(req.params.userId)
        const roleIds: number[] = req.body?.roleIds || []
        if (!Number.isFinite(uid)) return res.badRequest('无效的用户ID')
        if (!Array.isArray(roleIds)) return res.badRequest('roleIds 必须为数组')
        await RoleService.setUserRoles(uid, roleIds)
        return res.ok(null, '用户角色设置成功')
    } catch (e) {
        console.error('设置用户角色失败:', e)
        return res.internal('设置用户角色失败')
    }
}

/** 角色 ⇄ 用户（增删单个用户） */
export const getRoleUsers = async (req: Request, res: Res) => {
    try {
        const rid = Number(req.params.roleId)
        if (!Number.isFinite(rid)) return res.badRequest('无效的角色ID')
        const data = await RoleService.getRoleUsers(rid)
        return res.ok(data)
    } catch (e) {
        console.error('获取角色用户列表失败:', e)
        return res.internal('获取角色用户列表失败')
    }
}
export const addUsersToRole = async (req: Request, res: Res) => {
    try {
        const rid = Number(req.params.roleId)
        const userIds: number[] = req.body?.userIds || []
        if (!Number.isFinite(rid)) return res.badRequest('无效的角色ID')
        if (!Array.isArray(userIds) || !userIds.length) return res.badRequest('请选择要添加的用户')
        await RoleService.addUsersToRole(rid, userIds.map(Number))
        return res.ok(null, `成功添加 ${userIds.length} 个用户到角色`)
    } catch (e: any) {
        console.error('添加用户到角色失败:', e)
        return res.internal(e?.message || '添加用户到角色失败')
    }
}
export const removeUserFromRole = async (req: Request, res: Res) => {
    try {
        const rid = Number(req.params.roleId)
        const uid = Number(req.params.userId)
        if (!Number.isFinite(rid) || !Number.isFinite(uid)) return res.badRequest('无效的角色ID或用户ID')
        await RoleService.removeUserFromRole(rid, uid)
        return res.ok(null, '已从角色移除该用户')
    } catch (e: any) {
        console.error('移除用户失败:', e)
        return res.internal(e?.message || '移除用户失败')
    }
}

/** 编码工具 */
export const checkCode = async (req: Request, res: Res) => {
    try {
        const raw = String(req.query.code ?? '').trim()
        const code = slugifyCode(raw)
        if (!code) return res.badRequest('code 不能为空')
        const exists = await RoleService.codeExists(code, null) // 全局范围
        return res.ok({ exists, code })
    } catch (e) {
        console.error('check-code 失败:', e)
        return res.internal('校验编码失败')
    }
}
export const suggestCode = async (req: Request, res: Res) => {
    try {
        const name = String(req.query.name ?? '').trim()
        if (!name) return res.badRequest('name 不能为空')
        const code = await RoleService.suggestUniqueCode(name, null)
        return res.ok(code)
    } catch (e) {
        console.error('suggest-code 失败:', e)
        return res.internal('生成编码失败')
    }
}

/** 下一个排序值 */
export const getNextSortOrder = async (_req: Request, res: Res) => {
    try {
        const n = await RoleService.getNextSortOrder()
        return res.ok(n)
    } catch (e) {
        console.error('getNextSortOrder 失败:', e)
        return res.internal('获取排序失败')
    }
}

/** ===== 角色 ⇄ 机构（基于 roles.org_id 的一对一实现） ===== */
export const getRoleOrgs = async (req: Request, res: Res) => {
    try {
        const rid = Number(req.params.id)
        if (!Number.isFinite(rid)) return res.badRequest('无效的角色ID')
        const data = await RoleService.getRoleOrgs(rid) // [{id,name?}] 或 []
        return res.ok(data)
    } catch (e: any) {
        console.error('获取角色机构失败:', e)
        return res.internal(e?.message || '获取角色机构失败')
    }
}

export const addRoleOrgs = async (req: Request, res: Res) => {
    try {
        const rid = Number(req.params.id)
        const orgIds: number[] = (req.body?.orgIds || []).map(Number).filter(Number.isFinite)
        if (!Number.isFinite(rid)) return res.badRequest('无效的角色ID')
        if (!orgIds.length) return res.badRequest('请选择要关联的机构')
        const added = await RoleService.addOrgsToRole(rid, orgIds) // 单机构：取第一个
        return res.ok(null, `成功关联 ${added} 个机构`)
    } catch (e: any) {
        console.error('关联机构失败:', e)
        return res.internal(e?.message || '关联机构失败')
    }
}

export const removeRoleOrg = async (req: Request, res: Res) => {
    try {
        const rid = Number(req.params.id)
        const oid = Number(req.params.orgId)
        if (!Number.isFinite(rid) || !Number.isFinite(oid)) return res.badRequest('无效的角色或机构ID')
        await RoleService.removeOrgFromRole(rid, oid)
        return res.ok(null, '已移除该机构')
    } catch (e: any) {
        console.error('移除机构失败:', e)
        return res.internal(e?.message || '移除机构失败')
    }
    
}


export const addUsersToRoleByOrg = async (req: Request, res: Res) => {
  try {
    const roleId = Number(req.params.roleId)
    const orgId = Number(req.body?.orgId ?? req.query?.orgId)
    const includeChildren =
      req.body?.include_children === true || req.body?.include_children === '1' || req.query?.include_children === '1'
    if (![roleId, orgId].every(Number.isFinite)) return res.badRequest('无效的角色或机构ID')

    const added = await RoleService.addUsersFromOrg(roleId, orgId, includeChildren)
    return res.ok({ added }, `成功添加 ${added} 个用户到角色`)
  } catch (e: any) {
    console.error('按机构添加用户到角色失败:', e)
    return res.internal(e?.message || '按机构添加用户失败')
  }
}

