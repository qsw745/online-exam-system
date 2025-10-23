// apps/backend/src/common/middleware/jwt-role-hydrator.ts
/* eslint-disable @/typescript-eslint/no-explicit-any */
declare const Buffer: any

import type { Request, Response, NextFunction } from 'express'

function decodeJwtPayload(token: string): any {
  try {
    const part = token.split('.')[1]
    if (!part) return null
    const buf = typeof Buffer !== 'undefined' ? Buffer.from(part, 'base64') : part
    const json = typeof buf === 'string' ? atob(buf) : buf.toString('utf8')
    return JSON.parse(json)
  } catch {
    return null
  }
}

/** 从 token 补齐 req.user.roles / req.user.role_ids / req.user.role（不校验签名，仅 decode） */
export function jwtRoleHydrator() {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      const hdr = req.get('authorization')
      const token = hdr && hdr.startsWith('Bearer ') ? hdr.slice(7) : null
      if (!token) return next()

      const payload: any = decodeJwtPayload(token) || {}

      // 兼容已有 req.user
      const u: any = (req as any).user ?? {}
      const merged: any = {
        id: u.id,
      
        email: u.email,
      }

      // 合并 roles / role_ids
      const tokenRoles = Array.isArray(payload.roles)
        ? payload.roles.map((r: any) => ({ id: Number(r?.id), code: String(r?.code || '') }))
        : []
      const tokenRoleIds = Array.isArray(payload.role_ids)
        ? payload.role_ids.map((n: any) => Number(n)).filter(Number.isFinite)
        : []

      const existingRoles = Array.isArray(u.roles) ? u.roles : []
      const existingRoleIds = Array.isArray(u.role_ids) ? u.role_ids : []

      const byId = new Map<number, { id: number; code: string }>()
      for (const r of [...existingRoles, ...tokenRoles]) {
        const id = Number(r?.id)
        if (Number.isFinite(id)) byId.set(id, { id, code: String(r?.code || '') })
      }
      const allRoles = Array.from(byId.values())

      const idSet = new Set<number>([...existingRoleIds, ...tokenRoleIds].filter(Number.isFinite))
      for (const r of allRoles) idSet.add(r.id)
      const allRoleIds = Array.from(idSet)

      // 推断一个全局 role（给旧守卫兜底）
      const codes = new Set(allRoles.map(r => r.code.toLowerCase()))
      let globalRole: 'admin' | 'teacher' | 'student' | null = null
      if (codes.has('super_admin') || codes.has('superadmin') || codes.has('admin')) globalRole = 'admin'
      else if (codes.has('teacher')) globalRole = 'teacher'
      else if (codes.has('student')) globalRole = 'student'

      merged.roles = allRoles.length ? allRoles : undefined
      merged.role_ids = allRoleIds.length ? allRoleIds : undefined
      merged.role = u.role ?? globalRole ?? null
      ;(req as any).user = merged
    } catch {
      // 忽略 decode 失败
    }
    next()
  }
}
