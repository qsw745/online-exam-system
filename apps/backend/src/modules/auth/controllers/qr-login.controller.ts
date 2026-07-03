import type { Response } from 'express'
import type { AuthRequest } from '@/types/auth'
import type { ApiResponse } from '@/types/response'
import { CODES } from '@/types/response'
import { AuthService } from '../services/auth.service'
import { QrLoginService } from '../services/qr-login.service'
import type { FaceVerifyReason } from '../services/face-login.service'
import { getClientIp } from '@/common/utils/request-ip'
import Geo from '@/common/utils/geo'
import { validateFaceFrames } from '../utils/face-frames'
import { LogService } from '@/modules/logs/services/log.service'

const svc = new AuthService()

const REASON_MESSAGES: Record<FaceVerifyReason | 'expired', string> = {
  no_face: '未检测到人脸，请正对摄像头后重试',
  multiple_faces: '检测到多张人脸，请保持画面中只有本人',
  liveness_failed: '活体检测未通过，请使用真人正脸',
  action_failed: '请按提示缓慢左右转动头部以完成活体检测',
  not_enrolled: '该账号未录入人脸凭据，请改用密码登录',
  verification_failed: '人脸验证未通过，请重试',
  expired: '二维码已过期，请在电脑端重新生成',
}

export class QrLoginController {
  /** PC：生成二维码票据 */
  static async create(req: AuthRequest, res: Response<ApiResponse<any>>) {
    const { email, keep7Days } = (req.body || {}) as any
    const loginEmail = typeof email === 'string' ? email.trim() : ''
    const data = await QrLoginService.create(loginEmail, !!keep7Days)
    return (res as any).ok(data, 'OK')
  }

  /** 手机：打开二维码页，标记已扫描 */
  static async info(req: AuthRequest, res: Response<ApiResponse<any>>) {
    const ticketId = String((req.query?.ticket as string) || '')
    if (!ticketId) return (res as any).badRequest('缺少 ticket')
    const data = await QrLoginService.info(ticketId)
    return (res as any).ok(data, 'OK')
  }

  /** 手机：刷脸授权 */
  static async authorize(req: AuthRequest, res: Response<ApiResponse<any>>) {
    const { ticket, images } = (req.body || {}) as any
    const ticketId = typeof ticket === 'string' ? ticket : ''
    if (!ticketId) return (res as any).badRequest('缺少 ticket')
    const valid = validateFaceFrames(images)
    if (!valid) return (res as any).badRequest('采集数据无效，请重新采集')

    const ip = getClientIp(req) || req.ip || ''
    const ua = req.get('User-Agent') || undefined
    try {
      const result = await QrLoginService.authorize(ticketId, valid)
      await LogService.log({
        type: 'login',
        status: result.ok ? 'success' : 'failed',
        action: '扫码人脸认证',
        message: result.ok ? '手机端扫码人脸认证通过' : `扫码人脸认证未通过：${REASON_MESSAGES[result.reason]}`,
        details: { ticket: ticketId.slice(0, 8), reason: result.ok ? undefined : result.reason },
        ipAddress: ip,
        userAgent: ua,
      } as any)
      if (result.ok) return (res as any).ok({ ok: true }, '认证成功')
      return (res as any).ok(
        { ok: false, reason: result.reason, message: REASON_MESSAGES[result.reason] },
        '认证未通过'
      )
    } catch (error: any) {
      const status = Number(error?.status) || 500
      const message = String(error?.message || '人脸认证失败')
      if (status >= 502 && status <= 504) return (res as any).fail(CODES.INTERNAL_ERROR, status, message)
      if (status === 503) return (res as any).fail(CODES.INTERNAL_ERROR, 503, message)
      return (res as any).internal(message)
    }
  }

  /** PC：轮询票据状态，confirmed 则签发会话并自动登录 */
  static async poll(req: AuthRequest, res: Response<ApiResponse<any>>) {
    const ticketId = String((req.query?.ticket as string) || '')
    const pollToken = String((req.query?.pollToken as string) || '')
    if (!ticketId || !pollToken) return (res as any).badRequest('缺少 ticket 或 pollToken')

    const result = await QrLoginService.poll(ticketId, pollToken)
    if (result.status !== 'confirmed') {
      return (res as any).ok({ status: result.status }, 'OK')
    }

    const ip = getClientIp(req) || req.ip || ''
    const ua = req.get('User-Agent') || undefined
    const { token, user, refresh, persist } = await svc.loginByFace(
      result.email,
      { ip, ua },
      { persist: result.persist }
    )
    const location = await Geo.lookup(ip)
    svc.setRefreshCookie(res, refresh, { persist })
    return (res as any).ok({ status: 'confirmed', token, user, location }, '扫码登录成功')
  }
}
