import bcrypt from 'bcryptjs'
import HttpError from '@/common/errors/http-error'
import { SessionStore } from '@/common/session/session.store'
import { UserRepository } from '@/modules/auth/repositories/user.repository'
import { normalizeDataRegion, type DataRegion } from '@/modules/auth/domain/account-region.policy'
import {
  ACCOUNT_DELETION_CONFIRMATION,
  buildAccountDeletionPreview,
  isValidDeletionConfirmation,
} from '../domain/account-deletion.policy'
import { AccountDeletionRepository, type AccountDeletionRow } from '../repositories/account-deletion.repository'

function publicStatus(row: AccountDeletionRow | null) {
  if (!row) return { status: 'NOT_REQUESTED' as const }
  return {
    requestId: row.request_id,
    status: row.status,
    dataRegion: row.data_region,
    requestedAt: new Date(row.requested_at).toISOString(),
    scheduledFor: new Date(row.scheduled_for).toISOString(),
    cancelledAt: row.cancelled_at ? new Date(row.cancelled_at).toISOString() : null,
    completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : null,
    retentionSummary: row.retention_summary_json,
  }
}

async function verifyPassword(email: string, password: string) {
  const user = await UserRepository.findByEmail(String(email || '').trim())
  const valid = user && bcrypt.compareSync(String(password || ''), String(user.password || ''))
  if (!user || !valid) {
    throw new HttpError('邮箱或密码错误', 401, { code: 'AUTH_BAD_CREDENTIALS' })
  }
  return user
}

export class AccountDeletionService {
  preview() {
    return buildAccountDeletionPreview()
  }

  async request(userId: number, password: string, confirmationPhrase: string) {
    if (!isValidDeletionConfirmation(confirmationPhrase)) {
      throw new HttpError(`请输入完整确认词：${ACCOUNT_DELETION_CONFIRMATION}`, 400, {
        code: 'VALIDATION_ERROR',
      })
    }
    const user = await UserRepository.findById(userId)
    if (!user || !bcrypt.compareSync(String(password || ''), String(user.password || ''))) {
      throw new HttpError('当前账号密码错误', 401, { code: 'AUTH_BAD_CREDENTIALS' })
    }
    const dataRegion = normalizeDataRegion(user.data_region) ??
      (process.env.NODE_ENV !== 'production' ? 'CN' : null)
    if (!dataRegion) {
      throw new HttpError('账号缺少有效的数据区域', 409, { code: 'SERVICE_REGION_MISMATCH' })
    }

    const now = new Date()
    const preview = buildAccountDeletionPreview(now)
    const { row, revokedSessionIds } = await AccountDeletionRepository.createPending({
      userId,
      dataRegion: dataRegion as DataRegion,
      confirmationPhrase,
      retentionSummary: {
        deleteOrAnonymize: preview.deleteOrAnonymize,
        conditionalRetention: preview.conditionalRetention,
        disclaimer: preview.disclaimer,
      },
      scheduledFor: new Date(preview.scheduledFor),
      reauthenticatedAt: now,
    })

    await Promise.allSettled(revokedSessionIds.map(jti => SessionStore.revoke(jti)))
    return publicStatus(row)
  }

  async status(email: string, password: string) {
    const user = await verifyPassword(email, password)
    return publicStatus(await AccountDeletionRepository.findLatestByUser(user.id))
  }

  async cancel(email: string, password: string) {
    const user = await verifyPassword(email, password)
    return publicStatus(await AccountDeletionRepository.cancelLatest(user.id))
  }
}
