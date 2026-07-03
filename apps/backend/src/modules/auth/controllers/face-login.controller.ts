import type { Response } from 'express'
import type { AuthRequest } from '@/types/auth'
import type { ApiResponse } from '@/types/response'
import { CODES } from '@/types/response'
import { AuthService } from '../services/auth.service'
import { FaceLoginService, type FaceVerifyReason } from '../services/face-login.service'
import { LogService } from '@/modules/logs/services/log.service'
import { getClientIp } from '@/common/utils/request-ip'
import Geo from '@/common/utils/geo'
import { validateFaceFrames } from '../utils/face-frames'

const svc = new AuthService()

const REASON_MESSAGES: Record<FaceVerifyReason, string> = {
  no_face: '未检测到人脸，请正对摄像头后重试',
  multiple_faces: '检测到多张人脸，请保持画面中只有本人',
  liveness_failed: '活体检测未通过，请使用真人正脸，勿用照片或录像',
  action_failed: '请按提示缓慢左右转动头部以完成活体检测',
  not_enrolled: '当前账号未录入人脸凭据，请使用密码登录',
  verification_failed: '人脸验证未通过，请重试或使用密码登录',
}

export class FaceLoginController {
  static async faceLogin(req: AuthRequest, res: Response<ApiResponse<any>>) {
    const { email, images, keep7Days } = (req.body || {}) as any
    const loginEmail = typeof email === 'string' ? email.trim() : ''

    const valid = validateFaceFrames(images)
    if (!valid) return (res as any).badRequest('采集数据无效，请重新采集（1-8 帧画面）')

    const ip = getClientIp(req) || req.ip || ''
    const ua = req.get('User-Agent') || undefined

    try {
      // 提供邮箱 → 1:1 验证；未提供 → 1:N 直接刷脸识别
      const result = loginEmail
        ? await FaceLoginService.verify(loginEmail, valid)
        : await FaceLoginService.identify(valid)

      // 业务性失败：返回 reason，前端据此走现有失败/锁定计数逻辑
      if (!result.matched) {
        await LogService.log({
          type: 'login',
          status: 'failed',
          action: '人脸登录',
          message: `人脸登录失败：${REASON_MESSAGES[result.reason]}`,
          details: { email: loginEmail || '(1:N)', reason: result.reason, similarity: (result as any).similarity },
          ipAddress: ip,
          userAgent: ua,
        } as any)
        return (res as any).ok(
          { matched: false, reason: result.reason, message: REASON_MESSAGES[result.reason] },
          '人脸验证未通过'
        )
      }

      // 验证通过 → 用"识别/比对到的账号"签发会话（1:N 时 loginEmail 为空，用 result.email）
      const { token, user, refresh, persist } = await svc.loginByFace(
        result.email,
        { ip, ua },
        { persist: !!keep7Days, similarity: result.similarity }
      )
      const location = await Geo.lookup(ip)
      svc.setRefreshCookie(res, refresh, { persist })
      return (res as any).ok(
        { matched: true, token, user, location, similarity: result.similarity },
        '人脸登录成功'
      )
    } catch (error: any) {
      const status = Number(error?.status) || 500
      const message = String(error?.message || '人脸登录失败')
      if (status >= 502 && status <= 504) return (res as any).fail(CODES.INTERNAL_ERROR, status, message)
      if (status === 503) return (res as any).fail(CODES.INTERNAL_ERROR, 503, message)
      if (status === 400) return (res as any).badRequest(message)
      return (res as any).internal(message)
    }
  }
}
