import type { Request, Response, NextFunction } from 'express'
import { extractUserRoleIds } from './role-auth.js' // 下面第2步里会把 extract 导出

export function logUserRoles(req: Request, _res: Response, next: NextFunction) {
  try {
    // 打印一次就够了，避免刷屏
    if ((req as any).__roles_logged) return next()
    ;(req as any).__roles_logged = true

    const user = (req as any).user
    const ids = extractUserRoleIds(user)
    console.info('[auth-debug] user=', JSON.stringify(user))
    console.info('[auth-debug] extracted roleIds=', ids)
  } catch (e) {
    console.warn('[auth-debug] parse error:', e)
  }
  next()
}
