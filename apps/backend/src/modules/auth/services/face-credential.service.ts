import {
  FACE_CONSENT_VERSION,
  FACE_MAX_SAMPLES,
  FACE_ACTION_YAW_MIN,
  DEFAULT_ENROLL_LIVENESS,
  normalizeLivenessLevel,
} from '@/config/face-engine'
import { AdminSettingsService } from '@/modules/admin-settings/services/admin-settings.service'
import {
  FaceCredentialRepository,
  type FaceCredentialSource,
} from '../repositories/face-credential.repository'
import { analyzeFaces } from './face-engine.client'

type ServiceError = Error & { status?: number }

function fail(message: string, status = 400): ServiceError {
  return Object.assign(new Error(message), { status })
}

export type FaceEnrollStatus = {
  enrolled: boolean
  samples: number
  model: string | null
  updatedAt: Date | null
}

export type EnrollParams = {
  userId: number
  images: string[]
  source: FaceCredentialSource
  createdBy: number | null
  /** photo=管理员上传本人照片代录（跳过活体，由管理员确认照片真实性）；默认 capture 摄像头采集 */
  mode?: 'capture' | 'photo'
}

export class FaceCredentialService {
  static async getStatus(userId: number): Promise<FaceEnrollStatus> {
    const rows = await FaceCredentialRepository.listByUser(userId)
    const latest = rows[0]
    return {
      enrolled: rows.length > 0,
      samples: rows.length,
      model: latest?.model ?? null,
      updatedAt: latest?.updated_at ?? null,
    }
  }

  static async enroll(params: EnrollParams): Promise<FaceEnrollStatus> {
    const { userId, images, source, createdBy } = params
    // 照片代录仅限管理员通道：跳过活体（照片无法过活体），真实性由管理员现场确认并留审计
    const isPhotoMode = params.mode === 'photo' && source === 'admin'

    const analysis = await analyzeFaces(images, { needLiveness: !isPhotoMode })
    const agg = analysis.aggregate

    if (!agg.all_single_face) {
      throw fail(isPhotoMode ? '请确保照片中只有本人一张人脸' : '请确保每帧画面中只有本人一张人脸')
    }
    if (!agg.embedding || agg.embedding.length === 0) {
      throw fail(isPhotoMode ? '未能从照片提取到人脸特征，请换一张清晰的正脸照片' : '未能从画面提取到人脸特征，请正对摄像头后重试')
    }

    // 按后台「录入活体等级」校验活体（照片代录跳过）
    if (!isPhotoMode) {
      const settings = await AdminSettingsService.getSafe().catch(() => ({}) as any)
      const level = normalizeLivenessLevel((settings as any).enrollLivenessLevel, DEFAULT_ENROLL_LIVENESS)
      if (level !== 'none') {
        if (!agg.liveness) throw fail('活体检测服务未就绪，暂时无法完成人脸录入', 503)
        if (!agg.liveness.is_real) throw fail('活体检测未通过，请使用真人正脸，勿用照片或录像')
      }
      if (level === 'action' && (agg.motion?.yaw_range ?? 0) < FACE_ACTION_YAW_MIN) {
        throw fail('请按提示缓慢左右转动头部后再录入')
      }
    }

    await FaceCredentialRepository.insert({
      userId,
      model: analysis.model,
      dim: analysis.dim,
      embedding: agg.embedding,
      source,
      createdBy,
      consentVersion: FACE_CONSENT_VERSION,
    })

    // 控制每人样本上限，淘汰最旧
    if (FACE_MAX_SAMPLES > 0) {
      await FaceCredentialRepository.pruneOldest(userId, FACE_MAX_SAMPLES)
    }

    return this.getStatus(userId)
  }

  static async unenroll(userId: number): Promise<number> {
    return FaceCredentialRepository.deleteByUser(userId)
  }
}
