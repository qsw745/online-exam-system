/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router, type RequestHandler, type Response } from 'express'
import type { AuthRequest } from '@/types/auth.js'
import { AuthController } from '../controllers/auth.controller.js'
import { PasswordResetController } from '../controllers/password-reset.controller.js'
import { rateLimit } from '@/common/middleware/rate-limit'
import { pool } from '@/config/database'
import bcrypt from 'bcryptjs'

const router = Router()

const wrap =
  (handler: (req: AuthRequest, res: Response) => Promise<unknown> | unknown): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(handler(req as AuthRequest, res)).catch(next)
  }

// 不需要 token 的公开接口
router.post('/register', wrap(AuthController.register))
router.get('/oauth/providers', wrap(AuthController.oauthProviders))
router.get(
  '/oauth/:provider/start',
  rateLimit({ keyBuilder: r => `rl:ip:${(r as any).ip || r.ip}:oauth:start`, limit: 20, windowSec: 60 }),
  wrap(AuthController.oauthStart)
)
router.get(
  '/oauth/:provider/callback',
  rateLimit({ keyBuilder: r => `rl:ip:${(r as any).ip || r.ip}:oauth:callback`, limit: 30, windowSec: 60 }),
  wrap(AuthController.oauthCallback)
)
router.post(
  '/login',
  rateLimit({ keyBuilder: r => `rl:ip:${(r as any).ip || r.ip}:login`, limit: 5, windowSec: 60 }),
  wrap(AuthController.login)
)

// 兼容前端 httpClient 的 GET 兜底
router.get('/refresh', wrap(AuthController.refresh))
router.post('/refresh', wrap(AuthController.refresh))
router.post('/logout', wrap(AuthController.logout))

// 兼容旧路由
router.post('/password-reset/forgot', wrap(PasswordResetController.forgotPassword))

/* ===== 本地调试（生产 404） ===== */
const isProd = process.env.NODE_ENV === 'production'

router.post('/debug/password-check', async (req, res) => {
  if (isProd) return res.sendStatus(404)
  const { email, plain } = (req.body || {}) as { email?: string; plain?: string }
  if (!email) return res.status(400).json({ ok: false, reason: 'EMAIL_REQUIRED' })
  const [rows]: any = await (pool as any).query(`SELECT id, email, password FROM users WHERE email=? LIMIT 1`, [email])
  const row = rows?.[0]
  if (!row) return res.json({ ok: false, reason: 'USER_NOT_FOUND' })

  const dbHash = String(row.password || '')
  let match = false
  let error: any = null
  try {
    match = bcrypt.compareSync(String(plain ?? ''), dbHash)
  } catch (e) {
    error = String(e)
  }
  return res.json({
    ok: match,
    len: dbHash.length,
    looksLikeBcrypt: /^(\$2[aby]\$)\d{2}\$[./A-Za-z0-9]{53}$/.test(dbHash) && dbHash.length === 60,
    error,
    hash: dbHash,
  })
})

router.post('/debug/reset-password', async (req, res) => {
  if (isProd) return res.sendStatus(404)
  const { email, plain } = (req.body || {}) as { email?: string; plain?: string }
  if (!email || !plain) return res.status(400).json({ ok: false, reason: 'EMAIL_AND_PLAIN_REQUIRED' })
  const hash = bcrypt.hashSync(String(plain), 10)
  const [ret]: any = await (pool as any).query(`UPDATE users SET password=? WHERE email=? LIMIT 1`, [hash, email])
  return res.json({ ok: true, affected: ret?.affectedRows ?? 0, hash })
})

export { router as authRoutes }
export default router
