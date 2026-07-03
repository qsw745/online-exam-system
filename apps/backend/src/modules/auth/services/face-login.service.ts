import {
  FACE_MATCH_THRESHOLD,
  FACE_MATCH_THRESHOLD_1N,
  FACE_MATCH_MARGIN_1N,
  FACE_ACTION_YAW_MIN,
  DEFAULT_LOGIN_LIVENESS,
  normalizeLivenessLevel,
  type LivenessLevel,
} from '@/config/face-engine'
import { AdminSettingsService } from '@/modules/admin-settings/services/admin-settings.service'
import { UserRepository } from '../repositories/user.repository'
import { FaceCredentialRepository } from '../repositories/face-credential.repository'
import { analyzeFaces } from './face-engine.client'
import { cosineSimilarity, maxCosineSimilarity } from '../utils/vector'

// 读后台配置的「登录活体等级」（未配置回落到 env 默认）
async function loginLivenessLevel(): Promise<LivenessLevel> {
  const settings = await AdminSettingsService.getSafe().catch(() => ({}) as any)
  return normalizeLivenessLevel((settings as any).loginLivenessLevel, DEFAULT_LOGIN_LIVENESS)
}

type ServiceError = Error & { status?: number }

function fail(message: string, status = 503): ServiceError {
  return Object.assign(new Error(message), { status })
}

export type FaceVerifyReason =
  | 'no_face'
  | 'multiple_faces'
  | 'liveness_failed'
  | 'action_failed'
  | 'not_enrolled'
  | 'verification_failed'

export type FaceVerifyResult =
  | { matched: true; userId: number; email: string; similarity: number }
  | { matched: false; reason: FaceVerifyReason; similarity?: number }

// 分析 + 活体/动作/单脸闸门。通过则返回探针 embedding；否则返回失败原因。
type GateResult = { ok: true; embedding: number[] } | { ok: false; reason: FaceVerifyReason }

export async function analyzeAndGate(images: string[], level: LivenessLevel): Promise<GateResult> {
  const analysis = await analyzeFaces(images, { needLiveness: level !== 'none' })
  const agg = analysis.aggregate

  // 静默活体闸门（silent / action 都要）
  if (level !== 'none') {
    if (!agg.liveness) throw fail('活体检测服务未就绪，暂时无法人脸核验', 503)
    if (!agg.liveness.is_real) return { ok: false, reason: 'liveness_failed' }
  }

  // 动作活体闸门（仅 action）：要求采集期间头部实际转动（静态照片做不到）
  if (level === 'action' && (agg.motion?.yaw_range ?? 0) < FACE_ACTION_YAW_MIN) {
    return { ok: false, reason: 'action_failed' }
  }

  // 单脸 / 特征可用性
  if (!agg.embedding || agg.embedding.length === 0) {
    const anyMulti = analysis.frames.some(f => f.face_count > 1)
    return { ok: false, reason: anyMulti ? 'multiple_faces' : 'no_face' }
  }

  return { ok: true, embedding: agg.embedding }
}

export class FaceLoginService {
  /** 1:1 验证：取指定账号的凭据做余弦比对（用于提供了邮箱的场景） */
  static async verify(email: string, images: string[]): Promise<FaceVerifyResult> {
    const gate = await analyzeAndGate(images, await loginLivenessLevel())
    if (!gate.ok) return { matched: false, reason: gate.reason }

    const loginEmail = String(email || '').trim()
    const user = await UserRepository.findByLogin(loginEmail).catch(() => null)
    if (!user) return { matched: false, reason: 'not_enrolled' }

    const creds = await FaceCredentialRepository.listByUser(user.id)
    if (creds.length === 0) return { matched: false, reason: 'not_enrolled' }

    const similarity = maxCosineSimilarity(gate.embedding, creds.map(c => c.embedding))
    if (similarity >= FACE_MATCH_THRESHOLD) {
      return { matched: true, userId: user.id, email: user.email, similarity }
    }
    return { matched: false, reason: 'verification_failed', similarity }
  }

  /** 1:N 识别：直接刷脸，在全库人脸中找出最匹配的账号（用于不输邮箱的场景） */
  static async identify(images: string[]): Promise<FaceVerifyResult> {
    const gate = await analyzeAndGate(images, await loginLivenessLevel())
    if (!gate.ok) return { matched: false, reason: gate.reason }

    const all = await FaceCredentialRepository.listAllWithUser()
    if (all.length === 0) return { matched: false, reason: 'not_enrolled' }

    // 取每个用户的最高相似度，再找全局最优与次优
    const bestPerUser = new Map<number, { email: string; sim: number }>()
    for (const c of all) {
      const sim = cosineSimilarity(gate.embedding, c.embedding)
      const cur = bestPerUser.get(c.userId)
      if (!cur || sim > cur.sim) bestPerUser.set(c.userId, { email: c.email, sim })
    }

    let best: { userId: number; email: string; sim: number } | null = null
    let secondSim = -1
    for (const [userId, v] of bestPerUser) {
      if (!best || v.sim > best.sim) {
        if (best) secondSim = Math.max(secondSim, best.sim)
        best = { userId, email: v.email, sim: v.sim }
      } else if (v.sim > secondSim) {
        secondSim = v.sim
      }
    }

    if (!best) return { matched: false, reason: 'not_enrolled' }

    // 阈值 + 与次优的差距（防撞脸误识）
    const passThreshold = best.sim >= FACE_MATCH_THRESHOLD_1N
    const passMargin = bestPerUser.size < 2 || best.sim - secondSim >= FACE_MATCH_MARGIN_1N
    if (passThreshold && passMargin) {
      return { matched: true, userId: best.userId, email: best.email, similarity: best.sim }
    }
    return { matched: false, reason: 'verification_failed', similarity: best.sim }
  }
}
