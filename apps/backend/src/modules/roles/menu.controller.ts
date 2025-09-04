// apps/backend/src/modules/roles/menu.controller.ts
import { Request, Response } from 'express'

// 修正导入路径：当前文件在 modules/roles 下，models 与 service 都在同级目录
import { CreateMenuRequest, CreateRoleRequest, UpdateMenuRequest, UpdateRoleRequest } from './models/menu.model.js'
import { MenuService } from './menu.service.js'

function pickOrgId(req: Request): number | undefined {
  const h = req.header('x-org-id')
  return h ? Number(h) : undefined
}

export class MenuController {
  // ✅ 前端动态路由所需的极简路由树
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

      // 显式标注 m:any，避免 “参数 m 隐式 any” 报错
      const nodes: Node[] = menus.map((m: any) => ({
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

      // 建映射，组树
      const id2node = new Map<number, Node>()
      nodes.forEach(n => id2node.set(n.id, n))

      const roots: Node[] = []
      nodes.forEach(n => {
        const pid = n.parent_id
        if (pid) {
          const p = id2node.get(pid)
          if (p) {
            p.children = p.children || []
            p.children.push(n)
          } else {
            roots.push(n) // 容错：父不存在时作为根节点
          }
        } else {
          roots.push(n)
        }
      })

      // 同层按照 sort_order 再做一次排序
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

  // 获取所有菜单
  static async getAllMenus(_req: Request, res: Response): Promise<void> {
    try {
      const menus = await MenuService.getAllMenus()
      res.json({ success: true, data: menus })
    } catch (error) {
      console.error('获取菜单列表失败:', error)
      res.status(500).json({ success: false, message: '获取菜单列表失败' })
    }
  }

  // 获取菜单树
  static async getMenuTree(_req: Request, res: Response): Promise<void> {
    try {
      const menuTree = await MenuService.getMenuTree()
      res.json({ success: true, data: menuTree })
    } catch (error) {
      console.error('获取菜单树失败:', error)
      res.status(500).json({ success: false, message: '获取菜单树失败' })
    }
  }

  // 根据ID获取菜单
  static async getMenuById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params
      const menu = await MenuService.getMenuById(parseInt(id, 10))

      if (!menu) {
        res.status(404).json({ success: false, message: '菜单不存在' })
        return
      }

      res.json({ success: true, data: menu })
    } catch (error) {
      console.error('获取菜单详情失败:', error)
      res.status(500).json({ success: false, message: '获取菜单详情失败' })
    }
  }

  // 创建菜单
  static async createMenu(req: Request, res: Response): Promise<void> {
    try {
      const menuData: CreateMenuRequest = req.body

      if (!menuData.name || !menuData.title) {
        res.status(400).json({ success: false, message: '菜单名称和标题不能为空' })
        return
      }

      const menuId = await MenuService.createMenu(menuData)
      res.status(201).json({ success: true, data: { id: menuId }, message: '菜单创建成功' })
    } catch (error) {
      console.error('创建菜单失败:', error)
      const msg = error instanceof Error ? error.message : '创建菜单失败'
      res.status(500).json({ success: false, message: msg })
    }
  }

  // 更新菜单
  static async updateMenu(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params
      const updateData: Omit<UpdateMenuRequest, 'id'> = req.body

      const success = await MenuService.updateMenu({ id: parseInt(id, 10), ...updateData })

      if (!success) {
        res.status(404).json({ success: false, message: '菜单不存在或更新失败' })
        return
      }

      res.json({ success: true, message: '菜单更新成功' })
    } catch (error) {
      console.error('更新菜单失败:', error)
      res.status(500).json({ success: false, message: '更新菜单失败' })
    }
  }

  // 删除菜单
  static async deleteMenu(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params

      const success = await MenuService.deleteMenu(parseInt(id, 10))

      if (!success) {
        res.status(404).json({ success: false, message: '菜单不存在或无法删除' })
        return
      }

      res.json({ success: true, message: '菜单删除成功' })
    } catch (error) {
      console.error('删除菜单失败:', error)
      const msg = error instanceof Error ? error.message : '删除菜单失败'
      res.status(500).json({ success: false, message: msg })
    }
  }

  // 批量更新菜单排序
  static async batchUpdateMenuSort(req: Request, res: Response): Promise<void> {
    try {
      const { menuUpdates } = req.body
      if (!Array.isArray(menuUpdates)) {
        res.status(400).json({ success: false, message: '请提供有效的菜单更新数据' })
        return
      }

      const success = await MenuService.batchUpdateMenuSort(menuUpdates)
      if (!success) {
        res.status(400).json({ success: false, message: '批量更新排序失败' })
        return
      }

      res.json({ success: true, message: '批量更新排序成功' })
    } catch (error) {
      console.error('批量更新菜单排序失败:', error)
      const msg = error instanceof Error ? error.message : '批量更新菜单排序失败'
      res.status(500).json({ success: false, message: msg })
    }
  }

  // 获取所有角色
  static async getAllRoles(_req: Request, res: Response): Promise<void> {
    try {
      const roles = await MenuService.getAllRoles()
      res.json({ success: true, data: roles })
    } catch (error) {
      console.error('获取角色列表失败:', error)
      res.status(500).json({ success: false, message: '获取角色列表失败' })
    }
  }

  // 根据ID获取角色
  static async getRoleById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params
      const role = await MenuService.getRoleById(parseInt(id, 10))

      if (!role) {
        res.status(404).json({ success: false, message: '角色不存在' })
        return
      }

      res.json({ success: true, data: role })
    } catch (error) {
      console.error('获取角色详情失败:', error)
      res.status(500).json({ success: false, message: '获取角色详情失败' })
    }
  }

  // 创建角色
  static async createRole(req: Request, res: Response): Promise<void> {
    try {
      const roleData: CreateRoleRequest = req.body
      if (!roleData.name) {
        res.status(400).json({ success: false, message: '角色名称不能为空' })
        return
      }

      const roleId = await MenuService.createRole(roleData)
      res.status(201).json({ success: true, data: { id: roleId }, message: '角色创建成功' })
    } catch (error: any) {
      console.error('创建角色失败:', error)

      // 针对唯一键冲突（示例：uk_name）
      if (
        error?.code === 'ER_DUP_ENTRY' &&
        typeof error?.sqlMessage === 'string' &&
        error.sqlMessage.includes('uk_name')
      ) {
        res.status(400).json({ success: false, message: '角色名称已存在，请使用其他名称' })
        return
      }

      res.status(500).json({ success: false, message: '创建角色失败' })
    }
  }

  // 更新角色
  static async updateRole(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params
      const updateData: Omit<UpdateRoleRequest, 'id'> = req.body

      const success = await MenuService.updateRole({ id: parseInt(id, 10), ...updateData })
      if (!success) {
        res.status(404).json({ success: false, message: '角色不存在或更新失败' })
        return
      }

      res.json({ success: true, message: '角色更新成功' })
    } catch (error) {
      console.error('更新角色失败:', error)
      res.status(500).json({ success: false, message: '更新角色失败' })
    }
  }

  // 删除角色
  static async deleteRole(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params

      const success = await MenuService.deleteRole(parseInt(id, 10))
      if (!success) {
        res.status(404).json({ success: false, message: '角色不存在或无法删除' })
        return
      }

      res.json({ success: true, message: '角色删除成功' })
    } catch (error: any) {
      console.error('删除角色失败:', error)

      if (
        error instanceof Error &&
        (error.message === '系统角色不允许删除' || error.message === '该角色正在被用户使用，无法删除')
      ) {
        res.status(400).json({ success: false, message: error.message })
        return
      }

      res.status(500).json({ success: false, message: '删除角色失败' })
    }
  }

  // 为角色分配菜单权限
  static async assignRoleMenus(req: Request, res: Response): Promise<void> {
    try {
      const { roleId } = req.params
      const { menuIds } = req.body

      if (!Array.isArray(menuIds)) {
        res.status(400).json({ success: false, message: '菜单ID列表格式错误' })
        return
      }

      const success = await MenuService.assignRoleMenus(parseInt(roleId, 10), menuIds)
      if (!success) {
        res.status(500).json({ success: false, message: '分配权限失败' })
        return
      }

      res.json({ success: true, message: '权限分配成功' })
    } catch (error) {
      console.error('分配角色菜单权限失败:', error)
      res.status(500).json({ success: false, message: '分配权限失败' })
    }
  }

  // 获取角色的菜单权限
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

  // 为用户分配角色
  static async assignUserRoles(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params
      const { roleIds } = req.body

      if (!Array.isArray(roleIds)) {
        res.status(400).json({ success: false, message: '角色ID列表格式错误' })
        return
      }

      const success = await MenuService.assignUserRoles(parseInt(userId, 10), roleIds)
      if (!success) {
        res.status(500).json({ success: false, message: '分配角色失败' })
        return
      }

      res.json({ success: true, message: '角色分配成功' })
    } catch (error) {
      console.error('分配用户角色失败:', error)
      res.status(500).json({ success: false, message: '分配角色失败' })
    }
  }

  // 获取用户的角色
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

  // 获取用户的菜单权限（支持 orgId）
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

  // 获取用户可访问的菜单树
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

  // 获取当前用户的菜单树
  static async getCurrentUserMenuTree(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id
      if (!userId) {
        res.status(401).json({ success: false, message: '用户未登录' })
        return
      }

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

  // 组织维度：为用户分配角色
  static async assignUserRolesInOrg(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params
      const { roleIds, orgId } = req.body

      if (!Array.isArray(roleIds) || !orgId) {
        res.status(400).json({ success: false, message: '缺少 orgId 或角色ID列表' })
        return
      }

      const ok = await MenuService.assignUserRolesInOrg(Number(userId), Number(orgId), roleIds.map(Number))
      if (!ok) {
        res.status(500).json({ success: false, message: '分配失败' })
        return
      }

      res.json({ success: true, message: '角色分配成功' })
    } catch (error) {
      console.error('分配用户角色(Org)失败:', error)
      res.status(500).json({ success: false, message: '分配角色失败' })
    }
  }

  // 检查用户菜单权限（按 org 作用域）
  static async checkUserMenuPermission(req: Request, res: Response): Promise<void> {
    try {
      const { userId, menuId } = req.params
      const orgId = pickOrgId(req) || Number(req.query.orgId)
      if (!orgId) {
        res.status(400).json({ success: false, message: '缺少 orgId' })
        return
      }

      const hasPermission = await MenuService.checkUserMenuPermissionInOrg(Number(userId), orgId, Number(menuId))
      res.json({ success: true, data: { hasPermission } })
    } catch (error) {
      console.error('检查用户菜单权限失败:', error)
      res.status(500).json({ success: false, message: '检查权限失败' })
    }
  }

  // 设置用户菜单权限
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

      if (!success) {
        res.status(500).json({ success: false, message: '设置权限失败' })
        return
      }

      res.json({ success: true, message: '权限设置成功' })
    } catch (error) {
      console.error('设置用户菜单权限失败:', error)
      res.status(500).json({ success: false, message: '设置权限失败' })
    }
  }

  // 移除用户菜单权限
  static async removeUserMenuPermission(req: Request, res: Response): Promise<void> {
    try {
      const { userId, menuId } = req.params
      const success = await MenuService.removeUserMenuPermission(parseInt(userId, 10), parseInt(menuId, 10))
      if (!success) {
        res.status(404).json({ success: false, message: '权限不存在或移除失败' })
        return
      }

      res.json({ success: true, message: '权限移除成功' })
    } catch (error) {
      console.error('移除用户菜单权限失败:', error)
      res.status(500).json({ success: false, message: '移除权限失败' })
    }
  }
}
