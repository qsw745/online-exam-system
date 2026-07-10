import type { Response } from 'express'
import { randomUUID } from 'crypto'
import { redis } from '@/common/redis/client'
import type { AuthRequest } from '@/types/auth'
import type { ApiResponse } from '@/types/response'
import { CODES } from '@/types/response'
import { AuthService } from '../services/auth.service'
import { FaceLoginService, type FaceMatchCandidate, type FaceVerifyReason } from '../services/face-login.service'
import { LogService } from '@/modules/logs/services/log.service'
import { getClientIp } from '@/common/utils/request-ip'
import Geo from '@/common/utils/geo'
import { validateFaceFrames } from '../utils/face-frames'

const svc = new AuthService()
const FACE_LOGIN_CHOICE_TTL_SEC = 120
const choiceKey = (ticket: string) => `face:login:choice:${ticket}`

const REASON_MESSAGES: Record<FaceVerifyReason, string> = {
  no_face: '未检测到人脸，请正对摄像头后重试',
  multiple_faces: '检测到多张人脸，请保持画面中只有本人',
  liveness_failed: '活体检测未通过，请使用真人正脸，勿用照片或录像',
  action_failed: '请按提示缓慢左右转动头部以完成活体检测',
  not_enrolled: '没有匹配到已录入的人脸凭据，请使用密码登录',
  verification_failed: '人脸验证未通过，请重试或使用密码登录',
  multiple_matches: '此人脸关联了多个账号，请选择要登录的账号',
}

type FaceLoginChoice = {
  choiceId: string
  userId: number
  email: string
  displayName: string
  maskedEmail: string
  role: string | null
  similarity: number
}

type FaceLoginChoiceTicket = {
  persist: boolean
  candidates: FaceLoginChoice[]
}

function maskEmail(email: string) {
  const [name, domain] = String(email || '').split('@')
  if (!domain) return email
  const head = name.slice(0, Math.min(2, name.length))
  return `${head}${name.length > 2 ? '***' : '*'}@${domain}`
}

function displayNameOf(candidate: FaceMatchCandidate) {
  return candidate.nickname || candidate.username || candidate.email.split('@')[0] || `用户 ${candidate.userId}`
}

async function createChoiceTicket(candidates: FaceMatchCandidate[], persist: boolean) {
  const ticket = randomUUID()
  const choices: FaceLoginChoice[] = candidates.map(candidate => ({
    choiceId: randomUUID(),
    userId: candidate.userId,
    email: candidate.email,
    displayName: displayNameOf(candidate),
    maskedEmail: maskEmail(candidate.email),
    role: candidate.role,
    similarity: candidate.similarity,
  }))
  const payload: FaceLoginChoiceTicket = { persist, candidates: choices }
  await redis.set(choiceKey(ticket), JSON.stringify(payload), 'EX', FACE_LOGIN_CHOICE_TTL_SEC)
  return {
    ticket,
    candidates: choices.map(({ choiceId, displayName, maskedEmail, role }) => ({
      choiceId,
      displayName,
      maskedEmail,
      role,
    })),
  }
}

async function readChoiceTicket(ticket: string): Promise<FaceLoginChoiceTicket | null> {
  const raw = await redis.get(choiceKey(ticket))
  if (!raw) return null
  try {
    return JSON.parse(raw) as FaceLoginChoiceTicket
  } catch {
    return null
  }
}

export class FaceLoginController {
  static async faceLogin(req: AuthRequest, res: Response<ApiResponse<any>>) {
    const { images, keep7Days } = (req.body || {}) as any

    const valid = validateFaceFrames(images)
    if (!valid) return (res as any).badRequest('采集数据无效，请重新采集（1-8 帧画面）')

    const ip = getClientIp(req) || req.ip || ''
    const ua = req.get('User-Agent') || undefined

    try {
      const result = await FaceLoginService.identify(valid, { allowMultipleMatches: true })

      if (!result.matched && result.reason === 'multiple_matches') {
        const selection = await createChoiceTicket(result.candidates, !!keep7Days)
        await LogService.log({
          type: 'login',
          status: 'failed',
          action: '人脸登录',
          message: '人脸登录匹配到多个账号，等待用户选择',
          details: {
            reason: result.reason,
            candidateCount: result.candidates.length,
            candidates: result.candidates.map(item => ({ userId: item.userId, similarity: item.similarity })),
          },
          ipAddress: ip,
          userAgent: ua,
        } as any)
        return (res as any).ok(
          {
            matched: false,
            reason: result.reason,
            selectionRequired: true,
            ticket: selection.ticket,
            candidates: selection.candidates,
            expiresIn: FACE_LOGIN_CHOICE_TTL_SEC,
            message: REASON_MESSAGES[result.reason],
          },
          REASON_MESSAGES[result.reason]
        )
      }

      // 业务性失败：返回 reason，由前端展示具体失败原因
      if (!result.matched) {
        await LogService.log({
          type: 'login',
          status: 'failed',
          action: '人脸登录',
          message: `人脸登录失败：${REASON_MESSAGES[result.reason]}`,
          details: { reason: result.reason, similarity: (result as any).similarity },
          ipAddress: ip,
          userAgent: ua,
        } as any)
        return (res as any).ok(
          { matched: false, reason: result.reason, message: REASON_MESSAGES[result.reason] },
          '人脸验证未通过'
        )
      }

      // 验证通过 → 用识别到的账号签发会话
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

  static async selectFaceLogin(req: AuthRequest, res: Response<ApiResponse<any>>) {
    const { ticket, choiceId } = (req.body || {}) as any
    const ticketId = typeof ticket === 'string' ? ticket : ''
    const selectedChoiceId = typeof choiceId === 'string' ? choiceId : ''
    if (!ticketId || !selectedChoiceId) return (res as any).badRequest('请选择要登录的账号')

    const ip = getClientIp(req) || req.ip || ''
    const ua = req.get('User-Agent') || undefined

    try {
      const payload = await readChoiceTicket(ticketId)
      if (!payload) return (res as any).badRequest('人脸登录选择已过期，请重新刷脸')

      const selected = payload.candidates.find(item => item.choiceId === selectedChoiceId)
      if (!selected) return (res as any).badRequest('无效的登录账号选择，请重新刷脸')

      await redis.del(choiceKey(ticketId))
      const { token, user, refresh, persist } = await svc.loginByFace(
        selected.email,
        { ip, ua },
        { persist: payload.persist, similarity: selected.similarity }
      )
      const location = await Geo.lookup(ip)
      svc.setRefreshCookie(res, refresh, { persist })
      return (res as any).ok(
        { matched: true, token, user, location, similarity: selected.similarity },
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
