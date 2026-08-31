import type { EncryptedEnvelope, OutboxKeyring } from '../domain/outbox-crypto'
import { decryptOutboxValue } from '../domain/outbox-crypto'
import type { LifecycleMetrics } from './lifecycle-observability'

export type LifecycleOutboxMessage = {
  messageId: string
  requestId: string | null
  dataRegion: 'CN' | 'GLOBAL'
  messageType: string
  recipientEnvelope: EncryptedEnvelope
  payloadEnvelope: EncryptedEnvelope
  attemptCount: number
  expiresAt: Date
}

export type LifecycleOutboxQueueStats = {
  depth: number
  oldestAgeMs: number
}

export interface LifecycleOutboxRepositoryContract {
  purgeExpired(now: Date): Promise<number>
  readQueueStats(now: Date): Promise<LifecycleOutboxQueueStats>
  claimDue(workerId: string, now: Date, leaseMs: number): Promise<LifecycleOutboxMessage | null>
  markSent(workerId: string, messageId: string, now: Date): Promise<void>
  markRetry(workerId: string, messageId: string, errorCode: string, now: Date): Promise<void>
}

export interface LifecycleMailer {
  sendPlainEmail(to: string, subject: string, content: string): Promise<unknown>
}

export function assertLifecycleMailerConfigured(env: Record<string, string | undefined>): void {
  const host = String(env.EMAIL_HOST ?? '').trim()
  const user = String(env.EMAIL_USER ?? '').trim()
  const password = String(env.EMAIL_PASS ?? '').trim()
  const usesPlaceholder = user === 'your_email@qq.com' || password === 'your_email_password'
  if (!host || !user || !password || usesPlaceholder) {
    throw Object.assign(new Error('生命周期消息必须配置真实邮件适配器'), {
      code: 'LIFECYCLE_MAILER_REQUIRED',
    })
  }
}

const ALLOWED_MESSAGE_TYPES = new Set([
  'DELETION_REQUESTED',
  'DELETION_GRACE_7D',
  'DELETION_GRACE_24H',
  'DELETION_CANCELLED',
  'DELETION_COMPLETED',
  'DELETION_RESTRICTED_RETENTION',
  'DELETION_DELAYED',
])

const safeErrorCode = (error: unknown): string => {
  const code = String((error as { code?: unknown })?.code ?? '')
  return /^LIFECYCLE_[A-Z0-9_]{1,80}$/.test(code) ? code : 'LIFECYCLE_OUTBOX_SEND_FAILED'
}

const decryptEnvelope = (keyring: OutboxKeyring, envelope: EncryptedEnvelope): string => {
  const key = keyring[envelope.keyVersion]
  if (!key) {
    throw Object.assign(new Error('未知密钥版本'), { code: 'LIFECYCLE_OUTBOX_KEY_VERSION_UNKNOWN' })
  }
  return decryptOutboxValue(key, envelope)
}

const parsePayload = (value: string): Record<string, unknown> => {
  const parsed = JSON.parse(value)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw Object.assign(new Error('消息载荷格式无效'), { code: 'LIFECYCLE_OUTBOX_PAYLOAD_INVALID' })
  }
  return parsed as Record<string, unknown>
}

const buildMinimalMessage = (message: LifecycleOutboxMessage, payload: Record<string, unknown>): string => {
  const lines = [
    '问衡账号注销通知',
    `请求编号：${message.requestId ?? '无'}`,
    `状态：${String(payload.status ?? message.messageType)}`,
  ]
  if (payload.scheduledFor) lines.push(`计划时间：${String(payload.scheduledFor)}`)
  if (payload.completedAt) lines.push(`完成时间：${String(payload.completedAt)}`)
  if (payload.restrictedRetentionUntil) {
    lines.push(`依法保留最晚时间：${String(payload.restrictedRetentionUntil)}`)
  }
  lines.push('状态查询：请在问衡 App 的账号与隐私页面查看。')
  return lines.join('\n')
}

export async function dispatchLifecycleOutboxOnce(options: {
  repository: LifecycleOutboxRepositoryContract
  keyring: OutboxKeyring
  mailer: LifecycleMailer
  metrics: LifecycleMetrics
  workerId: string
  now: Date
  leaseMs: number
}) {
  const expired = await options.repository.purgeExpired(options.now)
  const queue = await options.repository.readQueueStats(options.now)
  options.metrics.record('lifecycle_outbox_queue_depth', queue.depth, {})
  options.metrics.record('lifecycle_outbox_oldest_age_ms', queue.oldestAgeMs, {})
  options.metrics.record('lifecycle_outbox_expired', expired, {})

  const message = await options.repository.claimDue(options.workerId, options.now, options.leaseMs)
  if (!message) return { claimed: 0, sent: 0, retried: 0, expired }

  try {
    if (!ALLOWED_MESSAGE_TYPES.has(message.messageType)) {
      throw Object.assign(new Error('未知消息类型'), { code: 'LIFECYCLE_OUTBOX_TYPE_INVALID' })
    }
    const recipient = decryptEnvelope(options.keyring, message.recipientEnvelope)
    const payload = parsePayload(decryptEnvelope(options.keyring, message.payloadEnvelope))
    const delivered = await options.mailer.sendPlainEmail(
      recipient,
      '问衡账号注销状态通知',
      buildMinimalMessage(message, payload),
    )
    if (delivered === false) {
      throw Object.assign(new Error('邮件适配器未确认发送'), { code: 'LIFECYCLE_OUTBOX_SEND_FAILED' })
    }
    await options.repository.markSent(options.workerId, message.messageId, options.now)
    options.metrics.record('lifecycle_outbox_sent', 1, { dataRegion: message.dataRegion })
    return { claimed: 1, sent: 1, retried: 0, expired }
  } catch (error) {
    const errorCode = safeErrorCode(error)
    await options.repository.markRetry(options.workerId, message.messageId, errorCode, options.now)
    options.metrics.record('lifecycle_outbox_retried', 1, {
      dataRegion: message.dataRegion,
      errorCode,
    })
    return { claimed: 1, sent: 0, retried: 1, expired }
  }
}
