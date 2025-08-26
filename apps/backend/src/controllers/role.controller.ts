import { Request, Response } from 'express';
import { RoleService } from '../services/role.service.js';
import { CreateRoleRequest, UpdateRoleRequest } from '../models/menu.model.js';


/**
 * 获取所有角色（支持分页和搜索）
 */
export const getAllRoles = async (req: Request, res: Response) => {
  try {
    const { page, pageSize, keyword } = req.query;
    
    const pageNum = page ? parseInt(page as string) : 1;
    const size = pageSize ? parseInt(pageSize as string) : 10;
    const searchKeyword = keyword && typeof keyword === 'string' && keyword.trim() ? keyword.trim() : undefined;
    
    if (page || pageSize) {
      // 有分页参数时使用分页查询
      if (!isNaN(pageNum) && !isNaN(size) && pageNum > 0 && size > 0) {
          // 分页查询
          const result = await RoleService.getRolesWithPagination(pageNum, size, searchKeyword);
          res.json({
            success: true,
            data: {
              roles: result.roles,
              total: result.total,
              page: pageNum,
              pageSize: size
            }
          });
        } else {
          // 分页参数无效，返回错误
          res.status(400).json({
            success: false,
            message: '无效的分页参数'
          });
        }
      } else {
      // 获取所有角色（保持向后兼容）
      const roles = await RoleService.getAllRoles();
      res.json({
        success: true,
        data: roles
      });
    }
  } catch (error) {
    console.error('获取角色列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取角色列表失败'
    });
  }
};

/**
 * 根据ID获取角色
 */
export const getRoleById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const role = await RoleService.getRoleById(parseInt(id));
    
    if (!role) {
      return res.status(404).json({
        success: false,
        message: '角色不存在'
      });
    }
    
    res.json({
      success: true,
      data: role
    });
  } catch (error) {
    console.error('获取角色详情失败:', error);
    res.status(500).json({
      success: false,
      message: '获取角色详情失败'
    });
  }
};

/**
 * 创建角色
 */
export const createRole = async (req: Request, res: Response) => {
  try {
    const roleData = req.body
    const role = await RoleService.createRole(roleData)

    res.status(201).json({
      success: true,
      data: role,
      message: '角色创建成功',
    })
  } catch (error) {
    console.error('创建角色失败:', error)
    res.status(500).json({
      success: false,
      message: '创建角色失败',
    })
  }
}

/**
 * 更新角色
 */
export const updateRole = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const roleData: UpdateRoleRequest = req.body

    const role = await RoleService.updateRole(parseInt(id), roleData)

    if (!role) {
      return res.status(404).json({
        success: false,
        message: '角色不存在',
      })
    }

    res.json({
      success: true,
      data: role,
      message: '角色更新成功',
    })
  } catch (error) {
    console.error('更新角色失败:', error)
    res.status(500).json({
      success: false,
      message: '更新角色失败',
    })
  }
}

/**
 * 删除角色
 */
export const deleteRole = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const success = await RoleService.deleteRole(parseInt(id))

    if (!success) {
      return res.status(404).json({
        success: false,
        message: '角色不存在或无法删除',
      })
    }

    res.json({
      success: true,
      message: '角色删除成功',
    })
  } catch (error: any) {
    console.error('删除角色失败:', error)

    // 处理特定的业务错误
    if (error.message === '系统角色不允许删除' || error.message === '该角色正在被用户使用，无法删除') {
      return res.status(400).json({
        success: false,
        message: error.message,
      })
    }

    res.status(500).json({
      success: false,
      message: '删除角色失败',
    })
  }
}

/**
 * 获取角色的菜单权限
 */
export const getRoleMenus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const menus = await RoleService.getRoleMenus(parseInt(id));
    
    res.json({
      success: true,
      data: menus
    });
  } catch (error) {
    console.error('获取角色菜单权限失败:', error);
    res.status(500).json({
      success: false,
      message: '获取角色菜单权限失败'
    });
  }
};

/**
 * 设置角色的菜单权限
 */
export const setRoleMenus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { menuIds }: { menuIds: number[] } = req.body

    await RoleService.setRoleMenus(parseInt(id), menuIds)

    res.json({
      success: true,
      message: '角色菜单权限设置成功',
    })
  } catch (error) {
    console.error('设置角色菜单权限失败:', error)
    res.status(500).json({
      success: false,
      message: '设置角色菜单权限失败',
    })
  }
}

/**
 * 获取用户的角色
 */
export const getUserRoles = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const roles = await RoleService.getUserRoles(parseInt(userId));
    
    res.json({
      success: true,
      data: roles
    });
  } catch (error) {
    console.error('获取用户角色失败:', error);
    res.status(500).json({
      success: false,
      message: '获取用户角色失败'
    });
  }
};

/**
 * 设置用户的角色
 */
export const setUserRoles = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params
    const { roleIds }: { roleIds: number[] } = req.body

    await RoleService.setUserRoles(parseInt(userId), roleIds)

    res.json({
      success: true,
      message: '用户角色设置成功',
    })
  } catch (error) {
    console.error('设置用户角色失败:', error)
    res.status(500).json({
      success: false,
      message: '设置用户角色失败',
    })
  }
}

/**
 * 获取角色的用户列表
 */
export const getRoleUsers = async (req: Request, res: Response) => {
  try {
    const { roleId } = req.params;
    const users = await RoleService.getRoleUsers(parseInt(roleId));
    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    console.error('获取角色用户列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取角色用户列表失败'
    });
  }
};

/**
 * 获取下一个排序号
 */
export const getNextSortOrder = async (req: Request, res: Response) => {
  try {
    const nextSortOrder = await RoleService.getNextSortOrder();
    res.json({
      success: true,
      data: nextSortOrder
    });
  } catch (error) {
    console.error('获取下一个排序号失败:', error);
    res.status(500).json({
      success: false,
      message: '获取下一个排序号失败'
    });
  }
};

/**
 * 添加用户到角色
 */
export const addUsersToRole = async (req: AuthRequest, res: Response) => {
  try {
    const { roleId } = req.params;
    const { userIds }: { userIds: number[] } = req.body;
    
    if (!userIds || userIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: '请选择要添加的用户'
      });
    }
    
    await RoleService.addUsersToRole(parseInt(roleId), userIds);
    
    res.json({
      success: true,
      message: `成功添加 ${userIds.length} 个用户到角色`
    });
  } catch (error: any) {
    console.error('添加用户到角色失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '添加用户到角色失败'
    });
  }
};
