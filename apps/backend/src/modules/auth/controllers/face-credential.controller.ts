import type { Response } from 'express'
import type { AuthRequest } from '@/types/auth'
import type { ApiResponse } from '@/types/response'
import { CODES } from '@/types/response'
import { FaceCredentialService } from '../services/face-credential.service'
import { LogService } from '@/modules/logs/services/log.service'
import { getClientIp } from '@/common/utils/request-ip'
import { validateFaceFrames } from '../utils/face-frames'

function getUserId(req: AuthRequest): number | null {
  const id = req.user?.id
  return Number.isFinite(Number(id)) && Number(id) > 0 ? Number(id) : null
}

function mapError(res: Response, error: any, fallback: string) {
  const status = Number(error?.status) || 500
  const message = String(error?.message || fallback)
  if (status === 400) return (res as any).badRequest(message)
  if (status === 401) return (res as any).unauthorized(message)
  if (status >= 502 && status <= 504) return (res as any).fail(CODES.INTERNAL_ERROR, status, message)
  if (status === 503) return (res as any).fail(CODES.INTERNAL_ERROR, 503, message)
  return (res as any).internal(message)
}

export class FaceCredentialController {
  static async status(req: AuthRequest, res: Response<ApiResponse<any>>) {
    const userId = getUserId(req)
    if (!userId) return (res as any).unauthorized('未登录')
    const status = await FaceCredentialService.getStatus(userId)
    return (res as any).ok(status, 'OK')
  }

  static async enroll(req: AuthRequest, res: Response<ApiResponse<any>>) {
    const userId = getUserId(req)
    if (!userId) return (res as any).unauthorized('未登录')

    const { images, consent } = (req.body || {}) as any
    // 合规：人脸是敏感生物特征，录入前必须本人单独同意
    if (consent !== true) {
      return (res as any).badRequest('请先阅读并同意《人脸信息采集授权》后再录入')
    }
    const valid = validateFaceFrames(images)
    if (!valid) {
      return (res as any).badRequest('采集数据无效，请重新采集（1-8 帧画面）')
    }

    const ip = getClientIp(req) || req.ip || ''
    const ua = req.get('User-Agent') || undefined
    try {
      const result = await FaceCredentialService.enroll({
        userId,
        images: valid,
        source: 'self',
        createdBy: userId,
      })
      await LogService.log({
        type: 'audit',
        status: 'success',
        userId,
        action: '人脸录入',
        message: '用户录入人脸凭据',
        details: { samples: result.samples, model: result.model, source: 'self' },
        ipAddress: ip,
        userAgent: ua,
      } as any)
      return (res as any).ok(result, '人脸录入成功')
    } catch (error: any) {
      await LogService.log({
        type: 'audit',
        status: 'failed',
        userId,
        action: '人脸录入',
        message: `人脸录入失败：${String(error?.message || '').slice(0, 120)}`,
        details: { source: 'self' },
        ipAddress: ip,
        userAgent: ua,
      } as any)
      return mapError(res, error, '人脸录入失败')
    }
  }

  static async unenroll(req: AuthRequest, res: Response<ApiResponse<any>>) {
    const userId = getUserId(req)
    if (!userId) return (res as any).unauthorized('未登录')
    const removed = await FaceCredentialService.unenroll(userId)
    await LogService.log({
      type: 'audit',
      status: 'success',
      userId,
      action: '人脸解绑',
      message: '用户解绑人脸凭据',
      details: { removed },
      ipAddress: getClientIp(req) || req.ip || '',
      userAgent: req.get('User-Agent') || undefined,
    } as any)
    return (res as any).ok({ removed }, '已解绑人脸')
  }
}
