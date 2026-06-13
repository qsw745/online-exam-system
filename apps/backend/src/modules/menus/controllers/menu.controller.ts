import type { Request, Response } from 'express'
import { MenuService } from '../services/menus.service.js'
import { UnitRepo } from '../repositories/unit-menu.repository.js'
import type {
  CreateMenuRequest,
  UpdateMenuRequest,
  CreateRoleRequest,
  UpdateRoleRequest,
} from '../domain/menu.model.js'

/** 同时支持 ?unitId / ?orgId 和请求头 x-org-id 作为单位上下文 */
function pickOrgId(req: Request): number | undefined {
  const q = (req.query.orgId ?? req.query.unitId) as any
  if (q != null && q !== '' && !Number.isNaN(Number(q))) return Number(q)
  const h = req.header('x-org-id')
  return h ? Number(h) : undefined
}

// 解析严格/绕缓存开关
function pickStrict(req: Request, defaultStrict = false): boolean {
  const raw = String(req.query.strict ?? req.header('x-strict') ?? '').toLowerCase()
  if (raw === '1' || raw === 'true' || raw === 'yes') return true
  if (raw === '0' || raw === 'false' || raw === 'no') return false
  return defaultStrict
}
function pickNoCache(req: Request): boolean {
  const raw = String(req.query.nocache ?? req.header('x-nocache') ?? '').toLowerCase()
  return raw === '1' || raw === 'true' || raw === 'yes'
}

export class MenuController {
  /** 单位“生效”菜单（系统 ⊕ 单位覆盖），供角色授权弹窗等使用 */
  static async getEffectiveMenus(req: Request, res: Response): Promise<void> {
    try {
      const orgId = pickOrgId(req)
      if (!orgId) {
        return void res
          .status(400)
          .json({ success: false, message: '缺少 unitId/orgId（?unitId | ?orgId | x-org-id）' })
      }
      const rows = await UnitRepo.findEffectiveMenusForUnit(orgId)
      res.json({ success: true, data: rows })
    } catch (e: any) {
      console.error('[menu] getEffectiveMenus error:', e)
      res.status(500).json({ success: false, message: e?.message || '获取单位生效菜单失败' })
    }
  }

  // 仅返回“系统功能路由树”
  static async getFunctionsTree(_req: Request, res: Response): Promise<void> {
    try {
      const tree = await MenuService.getMenuTree({ scope: 'system' })
      res.json({ success: true, data: tree })
    } catch (e) {
      res.status(500).json({ success: false, message: '获取功能菜单树失败' })
    }
  }

  // 列表：固定系统范围
  static async getAllMenus(_req: Request, res: Response): Promise<void> {
    try {
      const menus = await MenuService.getAllMenus({ scope: 'system' })
      res.json({ success: true, data: menus })
    } catch (error) {
      res.status(500).json({ success: false, message: '获取菜单列表失败' })
    }
  }

  // 树：固定系统范围
  static async getMenuTree(_req: Request, res: Response): Promise<void> {
    try {
      const menuTree = await MenuService.getMenuTree({ scope: 'system' })
      res.json({ success: true, data: menuTree })
    } catch (error) {
      res.status(500).json({ success: false, message: '获取菜单树失败' })
    }
  }

  static async getUserDefaultMenuTree(req: Request, res: Response): Promise<void> {
    try {
      const userId = Number(req.params.userId)
      if (!Number.isFinite(userId)) return void res.status(400).json({ success: false, message: '无效的用户ID' })
      const orgId = pickOrgId(req)
      const strict = pickStrict(req, true)
      const nocache = pickNoCache(req)
      const tree = await MenuService.getUserMenuTree(userId, { orgId, strict, nocache })
      res.json({ success: true, data: tree })
    } catch (error) {
      console.error('[menu] getUserMenuTree error:', error)
      res.status(500).json({ success: false, message: '获取用户菜单失败' })
    }
  }

  static async getMenuById(req: Request, res: Response): Promise<void> {
    try {
      const idNum = Number.parseInt(req.params.id, 10)
      if (Number.isNaN(idNum)) {
        return void res.status(400).json({ success: false, message: '非法的菜单ID' })
      }
      const menu = await MenuService.getMenuById(idNum)
      if (!menu) return void res.status(404).json({ success: false, message: '菜单不存在' })
      res.json({ success: true, data: menu })
    } catch {
      res.status(500).json({ success: false, message: '获取菜单详情失败' })
    }
  }

  // —— 系统菜单：允许创建/更新/删除 —— //
  static async createMenu(req: Request, res: Response) {
    try {
      const id = await MenuService.createSystemMenu(req.body || {})
      return void res.status(201).json({ success: true, data: { id }, message: '创建成功' })
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || '创建失败' })
    }
  }

  static async updateMenu(req: Request, res: Response) {
    try {
      const id = Number(req.params.id)
      const ok = await MenuService.updateSystemMenu({ id, ...(req.body || {}) })
      return void res.json({ success: ok, message: ok ? '更新成功' : '未修改' })
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || '更新失败' })
    }
  }

  static async deleteMenu(req: Request, res: Response) {
    try {
      const id = Number(req.params.id)
      const ok = await MenuService.deleteSystemMenu(id)
      return void res.json({ success: ok, message: ok ? '删除成功' : '删除失败' })
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || '删除失败' })
    }
  }

  static async batchUpdateMenuSort(req: Request, res: Response): Promise<void> {
    try {
      const { menuUpdates } = req.body
      if (!Array.isArray(menuUpdates)) {
        res.status(400).json({ success: false, message: '请提供有效的菜单更新数据' })
        return
      }
      await MenuService.batchUpdateMenuSort(menuUpdates, { scope: 'system' })
      res.json({ success: true, message: '批量更新排序成功' })
    } catch (error) {
      const msg = error instanceof Error ? error.message : '批量更新菜单排序失败'
      res.status(500).json({ success: false, message: msg })
    }
  }

  // ---- Roles & Users
  static async getAllRoles(_req: Request, res: Response): Promise<void> {
    try {
      const roles = await MenuService.getAllRoles()
      res.json({ success: true, data: roles })
    } catch (error) {
      console.error('获取角色列表失败:', error)
      res.status(500).json({ success: false, message: '获取角色列表失败' })
    }
  }

  static async getRoleById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params
      const role = await MenuService.getRoleById(parseInt(id, 10))
      if (!role) return void res.status(404).json({ success: false, message: '角色不存在' })
      res.json({ success: true, data: role })
    } catch (error) {
      console.error('获取角色详情失败:', error)
      res.status(500).json({ success: false, message: '获取角色详情失败' })
    }
  }

  static async createRole(req: Request, res: Response): Promise<void> {
    try {
      const roleData: CreateRoleRequest = req.body
      if (!roleData.name || !roleData.code) {
        res.status(400).json({ success: false, message: '角色名称与编码不能为空' })
        return
      }
      const roleId = await MenuService.createRole(roleData)
      res.status(201).json({ success: true, data: { id: roleId }, message: '角色创建成功' })
    } catch (error: any) {
      console.error('创建角色失败:', error)
      if (error?.code === 'ER_DUP_ENTRY') {
        res.status(400).json({ success: false, message: '角色名称或编码已存在' })
        return
      }
      res.status(500).json({ success: false, message: error?.message || '创建角色失败' })
    }
  }

  static async updateRole(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params
      const updateData = req.body as Omit<UpdateRoleRequest, 'id'>
      const success = await MenuService.updateRole({ id: parseInt(id, 10), ...updateData })
      if (!success) return void res.status(404).json({ success: false, message: '角色不存在或更新失败' })
      res.json({ success: true, message: '角色更新成功' })
    } catch (error) {
      console.error('更新角色失败:', error)
      res.status(500).json({ success: false, message: '更新角色失败' })
    }
  }

  static async deleteRole(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params
      const success = await MenuService.deleteRole(parseInt(id, 10))
      if (!success) return void res.status(404).json({ success: false, message: '角色不存在或无法删除' })
      res.json({ success: true, message: '角色删除成功' })
    } catch (error: any) {
      console.error('删除角色失败:', error)
      if (error?.message) {
        res.status(400).json({ success: false, message: error.message })
        return
      }
      res.status(500).json({ success: false, message: '删除角色失败' })
    }
  }

  static async assignRoleMenus(req: Request, res: Response): Promise<void> {
    try {
      const { roleId } = req.params
      const { menuIds } = req.body
      if (!Array.isArray(menuIds)) {
        res.status(400).json({ success: false, message: '菜单ID列表格式错误' })
        return
      }
      await MenuService.assignRoleMenus(parseInt(roleId, 10), menuIds)
      res.json({ success: true, message: '权限分配成功' })
    } catch (error) {
      console.error('分配角色菜单权限失败:', error)
      res.status(500).json({ success: false, message: '分配权限失败' })
    }
  }

  static async getRoleMenus(req: Request, res: Response): Promise<void> {
    try {
      const { roleId } = req.params
      const menuIds = await MenuService.getRoleMenus(parseInt(roleId, 10))
      res.json({ success: true, data: menuIds })
    } catch (error) {
      console.error('获取角色菜单权限失败:', error)
      res.status(500).json({ success: false, message: '获取角色菜单权限失败' })
    }
  }

  static async assignUserRoles(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params
      const { roleIds } = req.body
      if (!Array.isArray(roleIds)) {
        res.status(400).json({ success: false, message: '角色ID列表格式错误' })
        return
      }
      const ok = await MenuService.assignUserRoles(parseInt(userId, 10), roleIds)
      if (!ok) return void res.status(500).json({ success: false, message: '分配角色失败' })
      res.json({ success: true, message: '角色分配成功' })
    } catch (error) {
      console.error('分配用户角色失败:', error)
      res.status(500).json({ success: false, message: '分配角色失败' })
    }
  }

  static async getUserRoles(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params
      const roles = await MenuService.getUserRoles(parseInt(userId, 10))
      res.json({ success: true, data: roles })
    } catch (error) {
      console.error('获取用户角色失败:', error)
      res.status(500).json({ success: false, message: '获取用户角色失败' })
    }
  }

  static async getUserMenuPermissions(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params
      const orgId = pickOrgId(req) || Number(req.query.orgId)
      const strict = pickStrict(req) // 支持严格
      const nocache = pickNoCache(req) // 支持绕缓存
      const data = orgId
        ? await MenuService.getUserMenuPermissionsInOrg(Number(userId), orgId, { strict, nocache })
        : await MenuService.getUserMenuPermissions(Number(userId), { strict, nocache })
      res.json({ success: true, data })
    } catch (error) {
      console.error('获取用户菜单权限失败:', error)
      res.status(500).json({ success: false, message: '获取用户菜单权限失败' })
    }
  }

  /** 单位菜单树（按机构 + 角色权限） */
  static async getUserMenuTree(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params
      const orgIdHeader = ((): number | undefined => {
        const q = (req.query.orgId ?? req.query.unitId) as any
        if (q != null && q !== '' && !Number.isNaN(Number(q))) return Number(q)
        const h = req.header('x-org-id')
        return h ? Number(h) : undefined
      })()

      const strict = pickStrict(req) // 默认为非严格，可改默认见 service
      const nocache = pickNoCache(req)

      const tree = orgIdHeader
        ? await MenuService.getUserMenuTreeInOrg(Number(userId), orgIdHeader, { strict, nocache })
        : await MenuService.getUserMenuTree(Number(userId), { strict, nocache })

      res.json({ success: true, data: tree })
    } catch (error) {
      console.error('获取用户菜单树失败:', error)
      res.status(500).json({ success: false, message: '获取用户菜单树失败' })
    }
  }

  /** 当前登录用户 + 单位菜单树 */
  static async getCurrentUserMenuTree(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id
      if (!userId) return void res.status(401).json({ success: false, message: '用户未登录' })
      const orgIdHeader = pickOrgId(req)
      const strict = pickStrict(req)
      const nocache = pickNoCache(req)
      const tree = orgIdHeader
        ? await MenuService.getUserMenuTreeInOrg(userId, orgIdHeader, { strict, nocache })
        : await MenuService.getUserMenuTree(userId, { strict, nocache })
      res.json({ success: true, data: tree })
    } catch (error) {
      console.error('获取当前用户菜单树失败:', error)
      res.status(500).json({ success: false, message: '获取菜单失败' })
    }
  }

  static async checkUserMenuPermission(req: Request, res: Response): Promise<void> {
    try {
      const { userId, menuId } = req.params
      const orgId = pickOrgId(req) || Number(req.query.orgId)
      if (!orgId) return void res.status(400).json({ success: false, message: '缺少 orgId' })
      const hasPermission = await MenuService.checkUserMenuPermissionInOrg(Number(userId), orgId, Number(menuId))
      res.json({ success: true, data: { hasPermission } })
    } catch (error) {
      console.error('检查用户菜单权限失败:', error)
      res.status(500).json({ success: false, message: '检查权限失败' })
    }
  }

  static async setUserMenuPermission(req: Request, res: Response): Promise<void> {
    try {
      const { userId, menuId } = req.params
      const { permissionType } = req.body
      if (!['grant', 'deny'].includes(permissionType)) {
        res.status(400).json({ success: false, message: '权限类型错误' })
        return
      }
      const success = await MenuService.setUserMenuPermission(
        parseInt(userId, 10),
        parseInt(menuId, 10),
        permissionType
      )
      if (!success) return void res.status(500).json({ success: false, message: '设置权限失败' })
      res.json({ success: true, message: '权限设置成功' })
    } catch (error) {
      console.error('设置用户菜单权限失败:', error)
      res.status(500).json({ success: false, message: '设置权限失败' })
    }
  }

  static async removeUserMenuPermission(req: Request, res: Response): Promise<void> {
    try {
      const { userId, menuId } = req.params
      const success = await MenuService.removeUserMenuPermission(parseInt(userId, 10), parseInt(menuId, 10))
      if (!success) return void res.status(404).json({ success: false, message: '权限不存在或移除失败' })
      res.json({ success: true, message: '权限移除成功' })
    } catch (error) {
      console.error('移除用户菜单权限失败:', error)
      res.status(500).json({ success: false, message: '移除权限失败' })
    }
  }
}
export default MenuController
