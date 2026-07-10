import type { Response } from 'express'
import type { AuthRequest } from '@/types/auth'
import type { ApiResponse } from '@/types/response'
import { CODES } from '@/types/response'
import { FaceCredentialService } from '@/modules/auth/services/face-credential.service'
import { LogService } from '@/modules/logs/services/log.service'
import { getClientIp } from '@/common/utils/request-ip'
import { validateFaceFrames } from '@/modules/auth/utils/face-frames'

function targetUserId(req: AuthRequest): number | null {
  const id = Number(req.params.id)
  return Number.isFinite(id) && id > 0 ? id : null
}

function mapError(res: Response, error: any, fallback: string) {
  const status = Number(error?.status) || 500
  const message = String(error?.message || fallback)
  if (status === 400) return (res as any).badRequest(message)
  if (status >= 502 && status <= 504) return (res as any).fail(CODES.INTERNAL_ERROR, status, message)
  if (status === 503) return (res as any).fail(CODES.INTERNAL_ERROR, 503, message)
  return (res as any).internal(message)
}

// 管理员代录人脸（users 模块，需 admin 权限）
export class UserFaceController {
  static async status(req: AuthRequest, res: Response<ApiResponse<any>>) {
    const id = targetUserId(req)
    if (!id) return (res as any).badRequest('用户 ID 无效')
    const status = await FaceCredentialService.getStatus(id)
    return (res as any).ok(status, 'OK')
  }

  static async enroll(req: AuthRequest, res: Response<ApiResponse<any>>) {
    const id = targetUserId(req)
    if (!id) return (res as any).badRequest('用户 ID 无效')

    const { images, consent, mode } = (req.body || {}) as any
    // 合规：代录同样需要本人同意，由管理员在采集现场确认
    if (consent !== true) {
      return (res as any).badRequest('请先确认已获得该用户本人对人脸采集的同意')
    }
    const enrollMode: 'capture' | 'photo' = mode === 'photo' ? 'photo' : 'capture'
    const valid = validateFaceFrames(images)
    if (!valid) {
      return (res as any).badRequest(
        enrollMode === 'photo' ? '照片数据无效，请上传 1-8 张清晰的人脸照片' : '采集数据无效，请重新采集（1-8 帧画面）'
      )
    }

    const adminId = req.user?.id ?? null
    const ip = getClientIp(req) || req.ip || ''
    const ua = req.get('User-Agent') || undefined
    try {
      const result = await FaceCredentialService.enroll({
        userId: id,
        images: valid,
        source: 'admin',
        createdBy: adminId,
        mode: enrollMode,
      })
      await LogService.log({
        type: 'audit',
        status: 'success',
        userId: adminId ?? undefined,
        action: enrollMode === 'photo' ? '人脸录入(照片代录)' : '人脸录入(代录)',
        message: `管理员为用户 #${id} 录入人脸凭据${enrollMode === 'photo' ? '（照片上传，跳过活体）' : ''}`,
        details: { targetUserId: id, samples: result.samples, source: 'admin', mode: enrollMode },
        ipAddress: ip,
        userAgent: ua,
      } as any)
      return (res as any).ok(result, '人脸录入成功')
    } catch (error: any) {
      return mapError(res, error, '人脸录入失败')
    }
  }

  static async unenroll(req: AuthRequest, res: Response<ApiResponse<any>>) {
    const id = targetUserId(req)
    if (!id) return (res as any).badRequest('用户 ID 无效')
    const removed = await FaceCredentialService.unenroll(id)
    await LogService.log({
      type: 'audit',
      status: 'success',
      userId: req.user?.id ?? undefined,
      action: '人脸解绑(代管)',
      message: `管理员清除用户 #${id} 的人脸凭据`,
      details: { targetUserId: id, removed },
      ipAddress: getClientIp(req) || req.ip || '',
      userAgent: req.get('User-Agent') || undefined,
    } as any)
    return (res as any).ok({ removed }, '已清除该用户人脸')
  }
}
