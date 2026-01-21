import HttpError from '@/common/errors/http-error'
import type { AuthUser } from '@/types/auth'
import { CODES } from '@/types/response'
import { LogService } from '@/modules/logs/services/log.service'
import type { Request } from 'express'
import type { ProctoringEventInput, ProctoringListResult, ProctoringSeverity } from '../domain/proctoring.model'
import { ProctoringRepository } from '../repositories/proctoring.repository'

const DEFAULT_MESSAGES: Record<string, string> = {
  tab_hidden: '检测到切换标签',
  window_blur: '检测到离开考试窗口',
  copy_blocked: '检测到复制行为',
  camera_denied: '摄像头权限被拒绝',
  camera_lost: '摄像头画面中断',
  camera_no_face: '未检测到人脸',
  camera_multi_face: '检测到多人',
  camera_dark: '画面过暗或遮挡',
  mic_denied: '麦克风权限被拒绝',
  mic_lost: '麦克风不可用',
  audio_detected: '检测到疑似交流声音',
}

const pickRole = (u?: AuthUser | null) =>
  (u as any)?.role ?? (u as any)?.roles?.[0]?.code ?? (u as any)?.roles?.[0] ?? undefined

const toSeverity = (val?: string): ProctoringSeverity => {
  const s = String(val || '').toLowerCase()
  if (s === 'critical') return 'critical'
  if (s === 'warn' || s === 'warning') return 'warn'
  return 'info'
}

const severityToLevel = (sev: ProctoringSeverity) => {
  if (sev === 'critical') return 'error'
  if (sev === 'warn') return 'warn'
  return 'info'
}

export class ProctoringService {
  async recordEvent(user: AuthUser | undefined, input: ProctoringEventInput, req?: Request) {
    if (!user?.id) throw new HttpError('未授权', 401, { code: CODES.AUTH_UNAUTHORIZED })
    const examId = Number(input.examId)
    if (!Number.isFinite(examId) || examId <= 0) {
      throw new HttpError('缺少考试ID', 400, { code: CODES.VALIDATION_ERROR })
    }
    const type = String(input.type || '').trim()
    if (!type) throw new HttpError('缺少事件类型', 400, { code: CODES.VALIDATION_ERROR })

    const severity = toSeverity(input.severity)
    const message = input.message || DEFAULT_MESSAGES[type] || 'AI监管事件'

    await LogService.log(
      {
        type: 'exam',
        level: severityToLevel(severity),
        status: severity,
        userId: user.id,
        action: 'proctoring',
        message,
        resourceType: 'exam',
        resourceId: examId,
        details: {
          type,
          taskId: input.taskId,
          meta: input.meta ?? null,
          occurredAt: input.occurredAt ?? new Date().toISOString(),
          source: input.source ?? 'browser',
        },
      },
      req
    )

    return { ok: true }
  }

  async listExamEvents(user: AuthUser | undefined, examId: number, query: any): Promise<ProctoringListResult> {
    if (!user?.id) throw new HttpError('未授权', 401, { code: CODES.AUTH_UNAUTHORIZED })
    const role = pickRole(user)
    const isStaff = role === 'admin' || role === 'teacher'

    const page = Math.max(1, parseInt(String(query?.page || '1')) || 1)
    const limit = Math.max(1, Math.min(100, parseInt(String(query?.limit || '20')) || 20))
    const severity = query?.severity ? toSeverity(String(query.severity)) : undefined
    const userId = isStaff && query?.user_id ? Number(query.user_id) : user.id

    const list = await ProctoringRepository.listByExam({
      examId,
      userId: Number.isFinite(userId) ? userId : undefined,
      severity,
      page,
      limit,
    })
    const summary = await ProctoringRepository.summaryByExam(examId, Number.isFinite(userId) ? userId : undefined)

    return { ...list, summary }
  }
}

export default ProctoringService
