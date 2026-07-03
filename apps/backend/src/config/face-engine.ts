// 人脸引擎（apps/face-engine）调用配置。全部来自环境变量。
export const FACE_ENGINE_URL = (process.env.FACE_ENGINE_URL || 'http://127.0.0.1:8077').replace(/\/+$/, '')
export const FACE_ENGINE_SHARED_SECRET = process.env.FACE_ENGINE_SHARED_SECRET || ''
// CPU 跑 InsightFace 多帧 + 首次模型预热较慢，默认放宽到 30s
export const FACE_ENGINE_TIMEOUT_MS = Number(process.env.FACE_ENGINE_TIMEOUT_MS || 30000)

// 1:1 比对的余弦相似度阈值（ArcFace 经验值 ~0.4，可按线上误识/拒识率调）
export const FACE_MATCH_THRESHOLD = Number(process.env.FACE_MATCH_THRESHOLD || 0.4)

// 1:N 识别（直接刷脸、不输邮箱）阈值更高，并要求最优与次优的相似度差距，防撞脸误识
export const FACE_MATCH_THRESHOLD_1N = Number(process.env.FACE_MATCH_THRESHOLD_1N || 0.45)
export const FACE_MATCH_MARGIN_1N = Number(process.env.FACE_MATCH_MARGIN_1N || 0.05)

// 每个用户最多保留的人脸样本数（多角度），超出按时间淘汰最旧的
export const FACE_MAX_SAMPLES = Number(process.env.FACE_MAX_SAMPLES || 3)

// 合规：当前人脸采集同意书版本，录入时记录到凭据上
export const FACE_CONSENT_VERSION = process.env.FACE_CONSENT_VERSION || '2026-06-v1'

// 活体等级：none=不检测，silent=静默活体，action=静默+动作(转头)
export type LivenessLevel = 'none' | 'silent' | 'action'

export function normalizeLivenessLevel(raw: unknown, fallback: LivenessLevel): LivenessLevel {
  return raw === 'none' || raw === 'silent' || raw === 'action' ? raw : fallback
}

// 环境变量作为「后台未配置时」的默认（向后兼容旧部署）
const FACE_REQUIRE_LIVENESS =
  String(process.env.FACE_REQUIRE_LIVENESS ?? 'true').toLowerCase() !== 'false'
const FACE_REQUIRE_ACTION_LIVENESS =
  String(process.env.FACE_REQUIRE_ACTION_LIVENESS ?? 'false').toLowerCase() === 'true'

export const DEFAULT_LOGIN_LIVENESS: LivenessLevel = FACE_REQUIRE_ACTION_LIVENESS
  ? 'action'
  : FACE_REQUIRE_LIVENESS
    ? 'silent'
    : 'none'
export const DEFAULT_ENROLL_LIVENESS: LivenessLevel = FACE_REQUIRE_LIVENESS ? 'silent' : 'none'

// 判定为"转头"所需的最小 yaw 摆动幅度（度）
export const FACE_ACTION_YAW_MIN = Number(process.env.FACE_ACTION_YAW_MIN || 18)
