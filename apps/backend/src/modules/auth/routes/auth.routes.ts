/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router, type RequestHandler, type Response } from 'express'
import type { AuthRequest } from '@/types/auth.js'
import { AuthController } from '../controllers/auth.controller.js'
import { PasswordResetController } from '../controllers/password-reset.controller.js'
import { FaceCredentialController } from '../controllers/face-credential.controller.js'
import { FaceLoginController } from '../controllers/face-login.controller.js'
import { QrLoginController } from '../controllers/qr-login.controller.js'
import { EmailVerificationController } from '../controllers/email-verification.controller.js'
import { authenticateToken } from '@/common/middleware/auth'
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
router.post(
  '/face-login',
  rateLimit({ keyBuilder: r => `rl:ip:${(r as any).ip || r.ip}:face-login`, limit: 10, windowSec: 60 }),
  wrap(FaceLoginController.faceLogin)
)
router.post(
  '/face-login/select',
  rateLimit({ keyBuilder: r => `rl:ip:${(r as any).ip || r.ip}:face-login:select`, limit: 10, windowSec: 60 }),
  wrap(FaceLoginController.selectFaceLogin)
)
// ===== 扫码手机刷脸登录 =====
router.post(
  '/qr/create',
  rateLimit({ keyBuilder: r => `rl:ip:${(r as any).ip || r.ip}:qr:create`, limit: 20, windowSec: 60 }),
  wrap(QrLoginController.create)
)
router.get(
  '/qr/poll',
  rateLimit({ keyBuilder: r => `rl:ip:${(r as any).ip || r.ip}:qr:poll`, limit: 120, windowSec: 60 }),
  wrap(QrLoginController.poll)
)
router.get(
  '/qr/info',
  rateLimit({ keyBuilder: r => `rl:ip:${(r as any).ip || r.ip}:qr:info`, limit: 30, windowSec: 60 }),
  wrap(QrLoginController.info)
)
router.post(
  '/qr/authorize',
  rateLimit({ keyBuilder: r => `rl:ip:${(r as any).ip || r.ip}:qr:authorize`, limit: 15, windowSec: 60 }),
  wrap(QrLoginController.authorize)
)
router.post(
  '/qr/cancel',
  rateLimit({ keyBuilder: r => `rl:ip:${(r as any).ip || r.ip}:qr:cancel`, limit: 20, windowSec: 60 }),
  wrap(QrLoginController.cancel)
)
router.post(
  '/qr/select',
  rateLimit({ keyBuilder: r => `rl:ip:${(r as any).ip || r.ip}:qr:select`, limit: 15, windowSec: 60 }),
  wrap(QrLoginController.select)
)

// ===== 人脸凭据录入（自助，需登录态 + 本人同意）=====
router.get('/face/status', authenticateToken, wrap(FaceCredentialController.status))
router.post(
  '/face/enroll',
  authenticateToken,
  rateLimit({ keyBuilder: r => `rl:ip:${(r as any).ip || r.ip}:face:enroll`, limit: 10, windowSec: 60 }),
  wrap(FaceCredentialController.enroll)
)
router.delete('/face/enroll', authenticateToken, wrap(FaceCredentialController.unenroll))

// ===== 注册邮箱验证 =====
router.post('/verify-email', wrap(EmailVerificationController.verify))
router.get('/verify-email', wrap(EmailVerificationController.verify))
router.post(
  '/verify-email/resend',
  rateLimit({ keyBuilder: r => `rl:ip:${(r as any).ip || r.ip}:verify:resend`, limit: 5, windowSec: 300 }),
  wrap(EmailVerificationController.resend)
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
