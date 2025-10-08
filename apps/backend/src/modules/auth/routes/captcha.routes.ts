import { Router } from 'express'
import CaptchaController from '../controllers/captcha.controller'
import { rateLimit } from '@/common/middleware/rate-limit'

const router = Router()

/**
 * 两种取法：
 * 1) <img src="/api/captcha/new"> —— 返回 image/svg+xml
 * 2) GET /api/captcha/new.json  —— 返回 { id, svg, ttl }
 *
 * 限流建议：
 *  - new/new.json：每 IP 每分钟 30 次，超限封禁 2 分钟
 *  - verify：每 IP 每分钟 120 次（足够冗余），超限封禁 1 分钟
 */
router.get(
  '/new',
  rateLimit({
    keyBuilder: r => `rl:ip:${(r as any).ip || r.ip}:captcha:new`,
    limit: 30,
    windowSec: 60,
    blockDurationSec: 120,
  }),
  CaptchaController.newSvg
)

router.get(
  '/new.json',
  rateLimit({
    keyBuilder: r => `rl:ip:${(r as any).ip || r.ip}:captcha:newjson`,
    limit: 30,
    windowSec: 60,
    blockDurationSec: 120,
  }),
  CaptchaController.newJson
)

/** 校验 */
router.post(
  '/verify',
  rateLimit({
    keyBuilder: r => `rl:ip:${(r as any).ip || r.ip}:captcha:verify`,
    limit: 120,
    windowSec: 60,
    blockDurationSec: 60,
  }),
  CaptchaController.verify
)

export { router as captchaRoutes }
export default router
