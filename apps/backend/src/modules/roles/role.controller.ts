import { Request, Response } from 'express'
import { CreateRoleRequest, UpdateRoleRequest } from './models/menu.model.js'
import { DuplicateCodeError, RoleService, slugifyCode } from './role.service.js'

import type { AuthRequest } from 'types/auth.js'

/**
 * 获取所有角色（支持分页和搜索）
 */
export const getAllRoles = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page, pageSize, keyword } = req.query

    const pageNum = page ? parseInt(page as string, 10) : 1
    const size = pageSize ? parseInt(pageSize as string, 10) : 10
    const searchKeyword = typeof keyword === 'string' && keyword.trim() ? keyword.trim() : undefined

    if (page || pageSize) {
      if (!Number.isNaN(pageNum) && !Number.isNaN(size) && pageNum > 0 && size > 0) {
        const result = await RoleService.getRolesWithPagination(pageNum, size, searchKeyword)
        res.json({
          success: true,
          data: {
            roles: result.roles,
            total: result.total,
            page: pageNum,
            pageSize: size,
          },
        })
        return
      } else {
        res.status(400).json({ success: false, message: '无效的分页参数' })
        return
      }
    } else {
      const roles = await RoleService.getAllRoles()
      res.json({ success: true, data: roles })
      return
    }
  } catch (error: unknown) {
    console.error('获取角色列表失败:', error)
    res.status(500).json({ success: false, message: '获取角色列表失败' })
    return
  }
}

/** 从角色移除单个用户 */
export const removeUserFromRole = async (req: Request, res: Response): Promise<void> => {
  try {
    const { roleId, userId } = req.params
    const rid = parseInt(roleId, 10)
    const uid = parseInt(userId, 10)
    if (Number.isNaN(rid) || Number.isNaN(uid)) {
      res.status(400).json({ success: false, message: '无效的角色ID或用户ID' })
      return
    }

    await RoleService.removeUserFromRole(rid, uid)
    res.json({ success: true, message: '已从角色移除该用户' })
    return
  } catch (error: unknown) {
    console.error('移除用户失败:', error)
    if (error instanceof Error) {
      // 常见业务错误直接 400 返回
      if (['角色不存在', '用户不存在', '该用户不在此角色中'].includes(error.message)) {
        res.status(400).json({ success: false, message: error.message })
        return
      }
    }
    res.status(500).json({ success: false, message: '移除用户失败' })
    return
  }
}

/**
 * 根据ID获取角色
 */
export const getRoleById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const roleId = parseInt(id, 10)
    if (Number.isNaN(roleId)) {
      res.status(400).json({ success: false, message: '无效的角色ID' })
      return
    }

    const role = await RoleService.getRoleById(roleId)

    if (!role) {
      res.status(404).json({ success: false, message: '角色不存在' })
      return
    }

    res.json({ success: true, data: role })
    return
  } catch (error: unknown) {
    console.error('获取角色详情失败:', error)
    res.status(500).json({ success: false, message: '获取角色详情失败' })
    return
  }
}

/**
 * 创建角色（409 语义化错误）
 */
export const createRole = async (req: Request, res: Response): Promise<void> => {
  try {
    const roleData: CreateRoleRequest = req.body
    if (!roleData?.name) {
      res.status(400).json({ success: false, message: '角色名称不能为空' })
      return
    }

    const role = await RoleService.createRole(roleData)

    res.status(201).json({
      success: true,
      data: role,
      message: '角色创建成功',
    })
    return
  } catch (error: any) {
    console.error('创建角色失败:', error)
    if (error instanceof DuplicateCodeError) {
      res.status(error.status).json({ success: false, message: error.message })
      return
    }
    // 兜底：数据库唯一键也映射为 409
    if (error?.code === 'ER_DUP_ENTRY') {
      res.status(409).json({ success: false, message: '角色编码已存在，请使用其他编码' })
      return
    }
    res.status(500).json({ success: false, message: '创建角色失败' })
    return
  }
}

/**
 * 更新角色（409 语义化错误）
 */
export const updateRole = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const roleId = parseInt(id, 10)
    if (Number.isNaN(roleId)) {
      res.status(400).json({ success: false, message: '无效的角色ID' })
      return
    }

    const roleData: UpdateRoleRequest = req.body
    const role = await RoleService.updateRole(roleId, roleData)

    if (!role) {
      res.status(404).json({ success: false, message: '角色不存在' })
      return
    }

    res.json({ success: true, data: role, message: '角色更新成功' })
    return
  } catch (error: any) {
    console.error('更新角色失败:', error)
    if (error instanceof DuplicateCodeError) {
      res.status(error.status).json({ success: false, message: error.message })
      return
    }
    if (error?.code === 'ER_DUP_ENTRY') {
      res.status(409).json({ success: false, message: '角色编码已存在，请使用其他编码' })
      return
    }
    res.status(500).json({ success: false, message: '更新角色失败' })
    return
  }
}

/**
 * 删除角色
 */
export const deleteRole = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const roleId = parseInt(id, 10)
    if (Number.isNaN(roleId)) {
      res.status(400).json({ success: false, message: '无效的角色ID' })
      return
    }

    const success = await RoleService.deleteRole(roleId)

    if (!success) {
      res.status(404).json({ success: false, message: '角色不存在或无法删除' })
      return
    }

    res.json({ success: true, message: '角色删除成功' })
    return
  } catch (error: unknown) {
    console.error('删除角色失败:', error)

    // 处理特定的业务错误
    if (
      error instanceof Error &&
      (error.message === '系统角色不允许删除' || error.message === '该角色正在被用户使用，无法删除')
    ) {
      res.status(400).json({ success: false, message: error.message })
      return
    }

    res.status(500).json({ success: false, message: '删除角色失败' })
    return
  }
}

/**
 * 获取角色的菜单权限
 */
export const getRoleMenus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const roleId = parseInt(id, 10)
    if (Number.isNaN(roleId)) {
      res.status(400).json({ success: false, message: '无效的角色ID' })
      return
    }

    const menus = await RoleService.getRoleMenus(roleId)
    res.json({ success: true, data: menus })
    return
  } catch (error: unknown) {
    console.error('获取角色菜单权限失败:', error)
    res.status(500).json({ success: false, message: '获取角色菜单权限失败' })
    return
  }
}

/**
 * 设置角色的菜单权限
 */
export const setRoleMenus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const roleId = parseInt(id, 10)
    if (Number.isNaN(roleId)) {
      res.status(400).json({ success: false, message: '无效的角色ID' })
      return
    }

    const { menuIds }: { menuIds: number[] } = req.body
    if (!Array.isArray(menuIds)) {
      res.status(400).json({ success: false, message: 'menuIds 必须为数组' })
      return
    }

    await RoleService.setRoleMenus(roleId, menuIds)
    res.json({ success: true, message: '角色菜单权限设置成功' })
    return
  } catch (error: unknown) {
    console.error('设置角色菜单权限失败:', error)
    res.status(500).json({ success: false, message: '设置角色菜单权限失败' })
    return
  }
}

/**
 * 获取用户的角色
 */
export const getUserRoles = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params
    const uid = parseInt(userId, 10)
    if (Number.isNaN(uid)) {
      res.status(400).json({ success: false, message: '无效的用户ID' })
      return
    }

    const roles = await RoleService.getUserRoles(uid)
    res.json({ success: true, data: roles })
    return
  } catch (error: unknown) {
    console.error('获取用户角色失败:', error)
    res.status(500).json({ success: false, message: '获取用户角色失败' })
    return
  }
}

/**
 * 设置用户的角色
 */
export const setUserRoles = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params
    const uid = parseInt(userId, 10)
    if (Number.isNaN(uid)) {
      res.status(400).json({ success: false, message: '无效的用户ID' })
      return
    }

    const { roleIds }: { roleIds: number[] } = req.body
    if (!Array.isArray(roleIds)) {
      res.status(400).json({ success: false, message: 'roleIds 必须为数组' })
      return
    }

    await RoleService.setUserRoles(uid, roleIds)
    res.json({ success: true, message: '用户角色设置成功' })
    return
  } catch (error: unknown) {
    console.error('设置用户角色失败:', error)
    res.status(500).json({ success: false, message: '设置用户角色失败' })
    return
  }
}

/**
 * 获取角色的用户列表
 */
export const getRoleUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { roleId } = req.params
    const rid = parseInt(roleId, 10)
    if (Number.isNaN(rid)) {
      res.status(400).json({ success: false, message: '无效的角色ID' })
      return
    }

    const users = await RoleService.getRoleUsers(rid)
    res.json({ success: true, data: users })
    return
  } catch (error: unknown) {
    console.error('获取角色用户列表失败:', error)
    res.status(500).json({ success: false, message: '获取角色用户列表失败' })
    return
  }
}

/**
 * 获取下一个排序号
 */
export const getNextSortOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const nextSortOrder = await RoleService.getNextSortOrder()
    res.json({ success: true, data: nextSortOrder })
  } catch (error: unknown) {
    console.error('获取下一个排序号失败:', error)
    res.status(500).json({ success: false, message: '获取下一个排序号失败' })
  }
  return
}

/**
 * 添加用户到角色
 */
export const addUsersToRole = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { roleId } = req.params
    const rid = parseInt(roleId, 10)
    if (Number.isNaN(rid)) {
      res.status(400).json({ success: false, message: '无效的角色ID' })
      return
    }

    const { userIds }: { userIds: number[] } = req.body

    if (!Array.isArray(userIds) || userIds.length === 0) {
      res.status(400).json({ success: false, message: '请选择要添加的用户' })
      return
    }

    await RoleService.addUsersToRole(rid, userIds)
    res.json({ success: true, message: `成功添加 ${userIds.length} 个用户到角色` })
    return
  } catch (error: unknown) {
    console.error('添加用户到角色失败:', error)
    const message = error instanceof Error ? error.message : '添加用户到角色失败'
    res.status(500).json({ success: false, message })
    return
  }
}

/** 新增：校验编码唯一性 */
export const checkCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const raw = String(req.query.code ?? '').trim()
    const code = slugifyCode(raw)
    if (!code) {
      res.status(400).json({ success: false, message: 'code 不能为空' })
      return
    }
    const exists = await RoleService.codeExists(code)
    res.json({ success: true, data: { exists, code } })
  } catch (e) {
    console.error('check-code 失败:', e)
    res.status(500).json({ success: false, message: '校验编码失败' })
  }
}

/** 新增：给定名称返回一个可用的编码 */
export const suggestCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const name = String(req.query.name ?? '').trim()
    if (!name) {
      res.status(400).json({ success: false, message: 'name 不能为空' })
      return
    }
    const code = await RoleService.suggestUniqueCode(name)
    res.json({ success: true, data: code })
  } catch (e) {
    console.error('suggest-code 失败:', e)
    res.status(500).json({ success: false, message: '生成编码失败' })
  }
}
// ===== 角色 ⇄ 机构 =====
export const getRoleOrgs = async (req: Request, res: Response): Promise<void> => {
  try {
    const rid = Number(req.params.id)
    if (!Number.isFinite(rid)) {
      res.status(400).json({ success: false, message: '无效的角色ID' })
      return
    }
    const data = await RoleService.getRoleOrgs(rid)
    res.json({ success: true, data })
  } catch (e: any) {
    console.error('获取角色机构失败:', e)
    res.status(500).json({ success: false, message: e?.message || '获取角色机构失败' })
  }
}

export const addRoleOrgs = async (req: Request, res: Response): Promise<void> => {
  try {
    const rid = Number(req.params.id)
    const { orgIds } = req.body as { orgIds: number[] }
    if (!Number.isFinite(rid)) {
      res.status(400).json({ success: false, message: '无效的角色ID' })
      return
    }
    if (!Array.isArray(orgIds) || orgIds.length === 0) {
      res.status(400).json({ success: false, message: '请选择要关联的机构' })
      return
    }
    const added = await RoleService.addOrgsToRole(rid, orgIds)
    res.json({ success: true, message: `成功关联 ${added} 个机构` })
  } catch (e: any) {
    console.error('关联机构失败:', e)
    // 常见业务错误直接 400
    if (e?.message && ['角色不存在', '没有可添加的机构'].includes(e.message)) {
      res.status(400).json({ success: false, message: e.message })
      return
    }
    res.status(500).json({ success: false, message: e?.message || '关联机构失败' })
  }
}

export const removeRoleOrg = async (req: Request, res: Response): Promise<void> => {
  try {
    const rid = Number(req.params.id)
    const oid = Number(req.params.orgId)
    if (!Number.isFinite(rid) || !Number.isFinite(oid)) {
      res.status(400).json({ success: false, message: '无效的角色或机构ID' })
      return
    }
    await RoleService.removeOrgFromRole(rid, oid)
    res.json({ success: true, message: '已移除该机构' })
  } catch (e: any) {
    console.error('移除机构失败:', e)
    if (e?.message && ['角色不存在', '机构不存在', '该角色未关联该机构'].includes(e.message)) {
      res.status(400).json({ success: false, message: e.message })
      return
    }
    res.status(500).json({ success: false, message: e?.message || '移除机构失败' })
  }
}
