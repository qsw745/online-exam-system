import type { Request } from 'express'

export interface AuthUser {
  id: number
  username: string
  email: string
  role?: 'student' | 'teacher' | 'admin' | null
}

export type AuthRequest = Request & { user?: AuthUser }
