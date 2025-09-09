// apps/backend/src/modules/roles/controllers/role.controller.ts
import type { Request, Response } from 'express'
import type { CreateRoleRequest, UpdateRoleRequest } from '../domain/role.model.js'
import { DuplicateCodeError, RoleService, slugifyCode } from '../services/role.service.js'

// 分页/搜索
export const getAllRoles = async (req: Request, res: Response) => {
  try {
    const page = req.query.page ? parseInt(String(req.query.page), 10) : undefined
    const pageSize = req.query.pageSize ? parseInt(String(req.query.pageSize), 10) : undefined
    const keyword = typeof req.query.keyword === 'string' ? req.query.keyword.trim() : undefined

    if (page && pageSize) {
      const { roles, total } = await RoleService.getRolesWithPagination(page, pageSize, keyword)
      res.json({ success: true, data: { roles, total, page, pageSize } })
      return
    }
    const roles = await RoleService.getAllRoles()
    res.json({ success: true, data: roles })
  } catch (e) {
    console.error('获取角色列表失败:', e)
    res.status(500).json({ success: false, message: '获取角色列表失败' })
  }
}

export const getRoleById = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isFinite(id)) return res.status(400).json({ success: false, message: '无效的角色ID' })
    const role = await RoleService.getRoleById(id)
    if (!role) return res.status(404).json({ success: false, message: '角色不存在' })
    res.json({ success: true, data: role })
  } catch (e) {
    console.error('获取角色详情失败:', e)
    res.status(500).json({ success: false, message: '获取角色详情失败' })
  }
}

export const createRole = async (req: Request, res: Response) => {
  try {
    const payload: CreateRoleRequest = req.body
    if (!payload?.name) return res.status(400).json({ success: false, message: '角色名称不能为空' })
    const role = await RoleService.createRole(payload)
    res.status(201).json({ success: true, data: role, message: '角色创建成功' })
  } catch (e: any) {
    console.error('创建角色失败:', e)
    if (e instanceof DuplicateCodeError) {
      res.status(e.status).json({ success: false, message: e.message })
      return
    }
    if (e?.code === 'ER_DUP_ENTRY') {
      res.status(409).json({ success: false, message: '角色编码已存在，请使用其他编码' })
      return
    }
    res.status(500).json({ success: false, message: e?.message || '创建角色失败' })
  }
}

export const updateRole = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isFinite(id)) return res.status(400).json({ success: false, message: '无效的角色ID' })
    const data: UpdateRoleRequest = req.body
    const role = await RoleService.updateRole(id, data)
    if (!role) return res.status(404).json({ success: false, message: '角色不存在' })
    res.json({ success: true, data: role, message: '角色更新成功' })
  } catch (e: any) {
    console.error('更新角色失败:', e)
    if (e instanceof DuplicateCodeError) {
      res.status(e.status).json({ success: false, message: e.message })
      return
    }
    if (e?.code === 'ER_DUP_ENTRY') {
      res.status(409).json({ success: false, message: '角色编码已存在，请使用其他编码' })
      return
    }
    res.status(500).json({ success: false, message: e?.message || '更新角色失败' })
  }
}

export const deleteRole = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isFinite(id)) return res.status(400).json({ success: false, message: '无效的角色ID' })
    const ok = await RoleService.deleteRole(id)
    if (!ok) return res.status(404).json({ success: false, message: '角色不存在或无法删除' })
    res.json({ success: true, message: '角色删除成功' })
  } catch (e: any) {
    console.error('删除角色失败:', e)
    if (e instanceof Error && ['系统角色不允许删除', '该角色正在被用户使用，无法删除'].includes(e.message)) {
      return res.status(400).json({ success: false, message: e.message })
    }
    res.status(500).json({ success: false, message: e?.message || '删除角色失败' })
  }
}

export const getRoleMenus = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isFinite(id)) return res.status(400).json({ success: false, message: '无效的角色ID' })
    const data = await RoleService.getRoleMenus(id)
    res.json({ success: true, data })
  } catch (e) {
    console.error('获取角色菜单权限失败:', e)
    res.status(500).json({ success: false, message: '获取角色菜单权限失败' })
  }
}

export const setRoleMenus = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id)
    const menuIds: number[] = req.body?.menuIds || []
    if (!Number.isFinite(id)) return res.status(400).json({ success: false, message: '无效的角色ID' })
    if (!Array.isArray(menuIds)) return res.status(400).json({ success: false, message: 'menuIds 必须为数组' })
    await RoleService.setRoleMenus(id, menuIds)
    res.json({ success: true, message: '角色菜单权限设置成功' })
  } catch (e) {
    console.error('设置角色菜单权限失败:', e)
    res.status(500).json({ success: false, message: '设置角色菜单权限失败' })
  }
}

export const getUserRoles = async (req: Request, res: Response) => {
  try {
    const uid = Number(req.params.userId)
    if (!Number.isFinite(uid)) return res.status(400).json({ success: false, message: '无效的用户ID' })
    const data = await RoleService.getUserRoles(uid)
    res.json({ success: true, data })
  } catch (e) {
    console.error('获取用户角色失败:', e)
    res.status(500).json({ success: false, message: '获取用户角色失败' })
  }
}

export const setUserRoles = async (req: Request, res: Response) => {
  try {
    const uid = Number(req.params.userId)
    const roleIds: number[] = req.body?.roleIds || []
    if (!Number.isFinite(uid)) return res.status(400).json({ success: false, message: '无效的用户ID' })
    if (!Array.isArray(roleIds)) return res.status(400).json({ success: false, message: 'roleIds 必须为数组' })
    await RoleService.setUserRoles(uid, roleIds)
    res.json({ success: true, message: '用户角色设置成功' })
  } catch (e) {
    console.error('设置用户角色失败:', e)
    res.status(500).json({ success: false, message: '设置用户角色失败' })
  }
}

export const getRoleUsers = async (req: Request, res: Response) => {
  try {
    const rid = Number(req.params.roleId)
    if (!Number.isFinite(rid)) return res.status(400).json({ success: false, message: '无效的角色ID' })
    const data = await RoleService.getRoleUsers(rid)
    res.json({ success: true, data })
  } catch (e) {
    console.error('获取角色用户列表失败:', e)
    res.status(500).json({ success: false, message: '获取角色用户列表失败' })
  }
}

export const addUsersToRole = async (req: Request, res: Response) => {
  try {
    const rid = Number(req.params.roleId)
    const userIds: number[] = req.body?.userIds || []
    if (!Number.isFinite(rid)) return res.status(400).json({ success: false, message: '无效的角色ID' })
    if (!Array.isArray(userIds) || !userIds.length) {
      return res.status(400).json({ success: false, message: '请选择要添加的用户' })
    }
    await RoleService.addUsersToRole(rid, userIds.map(Number))
    res.json({ success: true, message: `成功添加 ${userIds.length} 个用户到角色` })
  } catch (e: any) {
    console.error('添加用户到角色失败:', e)
    res.status(500).json({ success: false, message: e?.message || '添加用户到角色失败' })
  }
}

export const removeUserFromRole = async (req: Request, res: Response) => {
  try {
    const rid = Number(req.params.roleId)
    const uid = Number(req.params.userId)
    if (!Number.isFinite(rid) || !Number.isFinite(uid)) {
      return res.status(400).json({ success: false, message: '无效的角色ID或用户ID' })
    }
    await RoleService.removeUserFromRole(rid, uid)
    res.json({ success: true, message: '已从角色移除该用户' })
  } catch (e: any) {
    console.error('移除用户失败:', e)
    res.status(500).json({ success: false, message: e?.message || '移除用户失败' })
  }
}

// 便捷校验/推荐编码
export const checkCode = async (req: Request, res: Response) => {
  try {
    const raw = String(req.query.code ?? '').trim()
    const code = slugifyCode(raw)
    if (!code) return res.status(400).json({ success: false, message: 'code 不能为空' })
    const exists = await RoleService.codeExists(code)
    res.json({ success: true, data: { exists, code } })
  } catch (e) {
    console.error('check-code 失败:', e)
    res.status(500).json({ success: false, message: '校验编码失败' })
  }
}
export const suggestCode = async (req: Request, res: Response) => {
  try {
    const name = String(req.query.name ?? '').trim()
    if (!name) return res.status(400).json({ success: false, message: 'name 不能为空' })
    const code = await RoleService.suggestUniqueCode(name)
    res.json({ success: true, data: code })
  } catch (e) {
    console.error('suggest-code 失败:', e)
    res.status(500).json({ success: false, message: '生成编码失败' })
  }
}

// 角色 ⇄ 机构
export const getRoleOrgs = async (req: Request, res: Response) => {
  try {
    const rid = Number(req.params.id)
    if (!Number.isFinite(rid)) return res.status(400).json({ success: false, message: '无效的角色ID' })
    const data = await RoleService.getRoleOrgs(rid)
    res.json({ success: true, data })
  } catch (e: any) {
    console.error('获取角色机构失败:', e)
    res.status(500).json({ success: false, message: e?.message || '获取角色机构失败' })
  }
}
export const addRoleOrgs = async (req: Request, res: Response) => {
  try {
    const rid = Number(req.params.id)
    const orgIds: number[] = (req.body?.orgIds || []).map(Number)
    if (!Number.isFinite(rid)) return res.status(400).json({ success: false, message: '无效的角色ID' })
    if (!Array.isArray(orgIds) || !orgIds.length) {
      return res.status(400).json({ success: false, message: '请选择要关联的机构' })
    }
    const added = await RoleService.addOrgsToRole(rid, orgIds)
    res.json({ success: true, message: `成功关联 ${added} 个机构` })
  } catch (e: any) {
    console.error('关联机构失败:', e)
    res.status(500).json({ success: false, message: e?.message || '关联机构失败' })
  }
}
export const removeRoleOrg = async (req: Request, res: Response) => {
  try {
    const rid = Number(req.params.id)
    const oid = Number(req.params.orgId)
    if (!Number.isFinite(rid) || !Number.isFinite(oid)) {
      return res.status(400).json({ success: false, message: '无效的角色或机构ID' })
    }
    await RoleService.removeOrgFromRole(rid, oid)
    res.json({ success: true, message: '已移除该机构' })
  } catch (e: any) {
    console.error('移除机构失败:', e)
    res.status(500).json({ success: false, message: e?.message || '移除机构失败' })
  }
}

export const getNextSortOrder = async (_req: Request, res: Response) => {
  try {
    const n = await RoleService.getNextSortOrder()
    res.json({ success: true, data: n })
  } catch (e) {
    console.error('获取下一个排序号失败:', e)
    res.status(500).json({ success: false, message: '获取下一个排序号失败' })
  }
}
