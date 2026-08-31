import bcrypt from 'bcryptjs'

import HttpError from '@/common/errors/http-error'
import {
  digestDeletionStatusToken,
  lifecycleRequestDigest,
  normalizeDeletionStatusToken,
  normalizeLifecycleUuid,
  resolveLifecyclePolicy,
  verifyDeletionStatusToken,
} from '@/modules/privacy-lifecycle/domain/lifecycle.policy'
import type { DeletionMode } from '@/modules/privacy-lifecycle/domain/lifecycle.model'
import {
  ACCOUNT_DELETION_CONFIRMATION,
  ACCOUNT_DELETION_GRACE_DAYS,
  buildAccountDeletionPreview,
  isValidDeletionConfirmation,
} from '../domain/account-deletion.policy'
import {
  ACCOUNT_DELETION_STEPS,
  type AccountDeletionRecord,
  type AccountDeletionRepositoryContract,
  type AccountDeletionUser,
  type DeletionRequestAcceptedResponse,
  type DeletionStatusResponse,
} from '../domain/account-deletion.model'

const DAY_MS = 24 * 60 * 60 * 1000

type AccountDeletionServiceDependencies = {
  verifyPassword: (plain: string, passwordHash: string) => boolean | Promise<boolean>
  revokeSession: (sessionId: string) => Promise<void>
}

export type RequestAccountDeletionInput = {
  requestId: string
  mode: DeletionMode
  statusToken: string
  password: string
  confirmationPhrase: string
}

export type QueryAccountDeletionStatusInput =
  | { requestId: string; statusToken: string }
  | { email: string; password: string }

export type CancelAccountDeletionInput = { email: string; password: string }

const normalizeMode = (value: unknown): DeletionMode => {
  if (value !== 'IMMEDIATE' && value !== 'GRACE_PERIOD') {
    throw new HttpError('注销模式无效', 400, { code: 'LIFECYCLE_MODE_INVALID' })
  }
  return value
}

export function toPublicDeletionStatus(row: AccountDeletionRecord | null): DeletionStatusResponse {
  if (!row) return { status: 'NOT_REQUESTED' }
  return {
    requestId: row.requestId,
    mode: row.mode,
    dataRegion: row.dataRegion,
    status: row.status,
    requestedAt: row.requestedAt,
    scheduledFor: row.scheduledFor,
    startedAt: row.startedAt,
    cancelledAt: row.cancelledAt,
    completedAt: row.completedAt,
    restrictedRetentionUntil: row.restrictedRetentionUntil,
    cancellable:
      row.mode === 'GRACE_PERIOD' &&
      row.startedAt === null &&
      (row.status === 'REQUESTED' || row.status === 'SCHEDULED'),
    steps: row.steps.map(step => ({
      stepCode: step.stepCode,
      category: step.category,
      action: step.action,
      status: step.status,
      plannedCount: step.plannedCount ?? 0,
      processedCount: step.processedCount ?? 0,
      attemptCount: step.attemptCount,
      lastErrorCode: step.lastErrorCode ?? null,
    })),
  }
}

export class AccountDeletionService {
  constructor(
    private readonly repository: AccountDeletionRepositoryContract,
    private readonly clock: () => Date = () => new Date(),
    private readonly dependencies: AccountDeletionServiceDependencies = {
      verifyPassword: (plain, passwordHash) => bcrypt.compareSync(plain, passwordHash),
      revokeSession: async () => undefined,
    },
  ) {}

  preview() {
    return buildAccountDeletionPreview(this.clock())
  }

  private async verifyUserPassword(user: AccountDeletionUser | null, password: unknown): Promise<AccountDeletionUser> {
    const valid =
      user &&
      typeof password === 'string' &&
      password.length > 0 &&
      (await this.dependencies.verifyPassword(password, user.passwordHash))
    if (!user || !valid) {
      throw new HttpError('邮箱或密码错误', 401, { code: 'AUTH_BAD_CREDENTIALS' })
    }
    return user
  }

  async request(userId: number, rawInput: RequestAccountDeletionInput): Promise<DeletionRequestAcceptedResponse> {
    if (!Number.isSafeInteger(userId) || userId <= 0) {
      throw new HttpError('用户身份无效', 401, { code: 'AUTH_UNAUTHORIZED' })
    }
    if (!isValidDeletionConfirmation(rawInput?.confirmationPhrase)) {
      throw new HttpError(`请输入完整确认词：${ACCOUNT_DELETION_CONFIRMATION}`, 400, {
        code: 'LIFECYCLE_CONFIRMATION_INVALID',
      })
    }

    let requestId: string
    try {
      requestId = normalizeLifecycleUuid(rawInput?.requestId, '请求编号')
    } catch {
      throw new HttpError('请求编号无效', 400, { code: 'LIFECYCLE_UUID_INVALID' })
    }
    const mode = normalizeMode(rawInput?.mode)
    let statusToken: string
    try {
      statusToken = normalizeDeletionStatusToken(rawInput?.statusToken)
    } catch {
      throw new HttpError('注销状态凭证无效', 400, { code: 'LIFECYCLE_STATUS_TOKEN_INVALID' })
    }

    const user = await this.verifyUserPassword(
      await this.repository.findUserForReauthentication(userId),
      rawInput?.password,
    )
    if (user.dataRegion !== 'CN' && user.dataRegion !== 'GLOBAL') {
      throw new HttpError('账号缺少有效的数据区域', 409, { code: 'SERVICE_REGION_MISMATCH' })
    }

    const now = this.clock()
    const scheduledFor = mode === 'IMMEDIATE'
      ? new Date(now)
      : new Date(now.getTime() + ACCOUNT_DELETION_GRACE_DAYS * DAY_MS)
    const policySnapshot = resolveLifecyclePolicy({
      dataRegion: user.dataRegion,
      accountType: user.accountType,
      institutionExamRetentionDays: user.institutionExamRetentionDays,
      createdAt: now,
    })
    const preview = buildAccountDeletionPreview(now)
    const statusTokenDigest = digestDeletionStatusToken(statusToken)
    const requestDigest = lifecycleRequestDigest({
      requestId,
      userId,
      dataRegion: user.dataRegion,
      mode,
      statusTokenDigest,
      confirmationPhrase: ACCOUNT_DELETION_CONFIRMATION,
      policyVersion: policySnapshot.version,
    })

    const result = await this.repository.createOrReplay({
      requestId,
      userId,
      dataRegion: user.dataRegion,
      mode,
      requestDigest,
      statusTokenDigest,
      confirmationPhrase: ACCOUNT_DELETION_CONFIRMATION,
      policySnapshot,
      retentionSummary: {
        deleteOrAnonymize: preview.deleteOrAnonymize,
        conditionalRetention: preview.conditionalRetention,
        disclaimer: preview.disclaimer,
      },
      scheduledFor,
      now,
      steps: ACCOUNT_DELETION_STEPS,
    })

    await Promise.allSettled(result.revokedSessionIds.map(sessionId => this.dependencies.revokeSession(sessionId)))
    const publicStatus = toPublicDeletionStatus(result.record)
    if (publicStatus.status === 'NOT_REQUESTED') {
      throw new HttpError('注销申请创建后无法读取', 500, { code: 'LIFECYCLE_REQUEST_READ_FAILED' })
    }
    return { ...publicStatus, statusToken }
  }

  async status(input: QueryAccountDeletionStatusInput): Promise<DeletionStatusResponse> {
    if ('statusToken' in input) {
      let requestId: string
      try {
        requestId = normalizeLifecycleUuid(input.requestId, '请求编号')
      } catch {
        throw new HttpError('注销请求或状态凭证无效', 404, { code: 'LIFECYCLE_STATUS_TOKEN_INVALID' })
      }
      const row = await this.repository.findByStatusCredential(requestId)
      if (!row || !verifyDeletionStatusToken(input.statusToken, row.statusTokenDigest)) {
        throw new HttpError('注销请求或状态凭证无效', 404, { code: 'LIFECYCLE_STATUS_TOKEN_INVALID' })
      }
      return toPublicDeletionStatus(row)
    }

    const email = String(input.email ?? '').trim().toLowerCase()
    const user = await this.verifyUserPassword(
      await this.repository.findUserByEmailForReauthentication(email),
      input.password,
    )
    return toPublicDeletionStatus(await this.repository.findLatestByUser(user.id))
  }

  async cancel(input: CancelAccountDeletionInput): Promise<DeletionStatusResponse> {
    const email = String(input.email ?? '').trim().toLowerCase()
    const user = await this.verifyUserPassword(
      await this.repository.findUserByEmailForReauthentication(email),
      input.password,
    )
    return toPublicDeletionStatus(await this.repository.cancelGraceRequest(user.id, this.clock()))
  }
}
