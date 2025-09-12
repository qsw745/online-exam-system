import { Request, Response } from 'express'
import { MenuService } from '../services/menus.service.js'
import type {
  CreateMenuRequest,
  UpdateMenuRequest,
  CreateRoleRequest,
  UpdateRoleRequest,
} from '../domain/menu.model.js'

/** 同时支持 ?unitId 和请求头 x-org-id 作为单位上下文 */
function pickOrgId(req: Request): number | undefined {
  const q = req.query.unitId
  if (q != null && q !== '' && !Number.isNaN(Number(q))) return Number(q)
  const h = req.header('x-org-id')
  return h ? Number(h) : undefined
}

export class MenuController {
  // 极简前端路由树（系统层）
  static async getRouteTreeForFrontend(_req: Request, res: Response): Promise<void> {
    try {
      const menus = await MenuService.getAllMenus()
      type Node = {
        id: number
        path?: string
        component?: string
        redirect?: string
        is_disabled?: boolean
        is_hidden?: boolean
        parent_id?: number | null
        sort_order?: number | null
        children?: Node[]
      }
      const nodes: Node[] = menus.map(m => ({
        id: m.id,
        path: m.path || undefined,
        component: m.component || undefined,
        redirect: m.redirect || undefined,
        is_disabled: !!m.is_disabled,
        is_hidden: !!m.is_hidden,
        parent_id: m.parent_id ?? null,
        sort_order: m.sort_order ?? null,
        children: [],
      }))
      const id2 = new Map<number, Node>()
      nodes.forEach(n => id2.set(n.id, n))
      const roots: Node[] = []
      nodes.forEach(n => {
        const p = n.parent_id ? id2.get(n.parent_id) : undefined
        if (p) (p.children ||= []).push(n)
        else roots.push(n)
      })
      const sortTree = (list: Node[]) => {
        list.sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999))
        list.forEach(c => c.children && sortTree(c.children))
      }
      sortTree(roots)
      res.json({ success: true, data: roots })
    } catch (e) {
      console.error('[menu] getRouteTreeForFrontend error:', e)
      res.status(500).json({ success: false, message: '获取菜单路由失败' })
    }
  }

  // ---- 菜单（读）
  static async getAllMenus(req: Request, res: Response): Promise<void> {
    try {
      const scope = String(req.query.scope ?? '').toLowerCase() as '' | 'system' | 'unit'
      const unitId = pickOrgId(req)
      if (scope === 'unit' && !unitId) {
        return void res.status(400).json({ success: false, message: '缺少 unitId（可用 ?unitId 或 x-org-id 请求头）' })
      }
      const menus = await MenuService.getAllMenus({ scope, unitId })
      res.json({ success: true, data: menus })
    } catch (error) {
      console.error('获取菜单列表失败:', error)
      res.status(500).json({ success: false, message: '获取菜单列表失败' })
    }
  }

  static async getMenuTree(req: Request, res: Response): Promise<void> {
    try {
      const scope = String(req.query.scope ?? '').toLowerCase() as '' | 'system' | 'unit'
      const unitId = pickOrgId(req)
      if (scope === 'unit' && !unitId) {
        return void res.status(400).json({ success: false, message: '缺少 unitId（可用 ?unitId 或 x-org-id 请求头）' })
      }
      const menuTree = await MenuService.getMenuTree({ scope, unitId })
      res.json({ success: true, data: menuTree })
    } catch (error) {
      console.error('获取菜单树失败:', error)
      res.status(500).json({ success: false, message: '获取菜单树失败' })
    }
  }

  static async getMenuById(req: Request, res: Response): Promise<void> {
    try {
      const idNum = Number.parseInt(req.params.id, 10)
      if (Number.isNaN(idNum)) {
        return void res.status(400).json({ success:false, message:'非法的菜单ID' })
      }
      const menu = await MenuService.getMenuById(idNum)
      if (!menu) return void res.status(404).json({ success: false, message: '菜单不存在' })
      res.json({ success: true, data: menu })
    } catch (error) {
      console.error('获取菜单详情失败:', error)
      res.status(500).json({ success: false, message: '获取菜单详情失败' })
    }
  }

  // ---- 菜单（写）—单位覆盖：必须有单位上下文
  static async createMenu(req: Request, res: Response) {
    try {
      const scope = String(req.query.scope ?? '').toLowerCase() as '' | 'system' | 'unit'
      if (scope !== 'unit') {
        return void res.status(403).json({ success:false, message:'系统菜单不可在此创建' })
      }
      const unitId = pickOrgId(req)
      const { sys_menu_id, ...patch } = req.body
      if (!unitId || !sys_menu_id) {
        return void res.status(400).json({ success:false, message:'缺少 unitId 或 sys_menu_id' })
      }
      await MenuService.createMenu({ ...(patch||{}), unitId, sys_menu_id })
      return void res.status(201).json({ success:true, message:'已保存单位覆盖' })
    } catch (e:any) {
      res.status(500).json({ success:false, message:e?.message || '创建失败' })
    }
  }

  static async updateMenu(req: Request, res: Response) {
    try {
      const scope = String(req.query.scope ?? '').toLowerCase() as '' | 'system' | 'unit'
      if (scope !== 'unit') {
        return void res.status(403).json({ success:false, message:'系统菜单不可在此修改' })
      }
      const unitId = pickOrgId(req)
      const id = Number(req.params.id) // sys_menu_id
      if (!unitId) return void res.status(400).json({ success:false, message:'缺少 unitId（?unitId 或 x-org-id）' })
      await MenuService.updateMenu({ id, unitId, sys_menu_id: id, ...req.body })
      return void res.json({ success:true, message:'已保存单位覆盖' })
    } catch (e:any) {
      res.status(500).json({ success:false, message:e?.message || '更新失败' })
    }
  }

  static async deleteMenu(req: Request, res: Response) {
    try {
      const scope = String(req.query.scope ?? '').toLowerCase() as '' | 'system' | 'unit'
      const id = Number(req.params.id)
      if (scope === 'unit') {
        const unitId = pickOrgId(req)
        if (!unitId) return void res.status(400).json({ success:false, message:'缺少 unitId（?unitId 或 x-org-id）' })
        await MenuService.deleteMenu(id, unitId, true)
        return void res.json({ success:true, message:'已移除单位覆盖' })
      }
      return void res.status(403).json({ success:false, message:'系统菜单不可在此删除' })
    } catch (e:any) {
      res.status(500).json({ success:false, message:e?.message || '删除失败' })
    }
  }

  static async batchUpdateMenuSort(req: Request, res: Response): Promise<void> {
    try {
      const { menuUpdates } = req.body
      if (!Array.isArray(menuUpdates)) {
        res.status(400).json({ success: false, message: '请提供有效的菜单更新数据' })
        return
      }
      const scope = String(req.query.scope ?? '').toLowerCase() as '' | 'system' | 'unit'
      const unitId = pickOrgId(req)

      if (scope === 'unit' && !unitId) {
        return void res.status(400).json({ success:false, message:'缺少 unitId（?unitId 或 x-org-id）' })
      }
      await MenuService.batchUpdateMenuSort(menuUpdates, { scope: scope || undefined, unitId })
      res.json({ success: true, message: '批量更新排序成功' })
    } catch (error) {
      console.error('批量更新菜单排序失败:', error)
      const msg = error instanceof Error ? error.message : '批量更新菜单排序失败'
      res.status(500).json({ success: false, message: msg })
    }
  }

  // ---- Roles & Users（保持不变）
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
      const updateData: Omit<UpdateRoleRequest, 'id'> = req.body
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
      const data = orgId
          ? await MenuService.getUserMenuPermissionsInOrg(Number(userId), orgId)
          : await MenuService.getUserMenuPermissions(Number(userId))
      res.json({ success: true, data })
    } catch (error) {
      console.error('获取用户菜单权限失败:', error)
      res.status(500).json({ success: false, message: '获取用户菜单权限失败' })
    }
  }

  static async getUserMenuTree(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params
      const menuTree = await MenuService.getUserMenuTree(parseInt(userId, 10))
      res.json({ success: true, data: menuTree })
    } catch (error) {
      console.error('获取用户菜单树失败:', error)
      res.status(500).json({ success: false, message: '获取用户菜单树失败' })
    }
  }

  static async getCurrentUserMenuTree(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id
      if (!userId) return void res.status(401).json({ success: false, message: '用户未登录' })
      const orgIdHeader = pickOrgId(req)
      const tree = orgIdHeader
          ? await MenuService.getUserMenuTreeInOrg(userId, orgIdHeader)
          : await MenuService.getUserMenuTree(userId)
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
