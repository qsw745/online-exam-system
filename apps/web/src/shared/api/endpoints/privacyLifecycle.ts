import type { DataRegion } from '@/platform/region/accountRegion'
import { api } from '../core/httpClient'
import type { ApiResult } from '../core/types'

export type LifecycleDeletionMode = 'IMMEDIATE' | 'GRACE_PERIOD'
export type LifecycleCategoryCode =
  | 'AUTH_CREDENTIALS'
  | 'FACE_CREDENTIALS'
  | 'PROFILE_AND_SETTINGS'
  | 'USER_CONTENT'
  | 'EXAM_ARCHIVE'
  | 'PROCTORING_AND_IDENTITY'
  | 'MEMBERSHIPS_AND_RANKINGS'
  | 'SECURITY_LOGS'
  | 'ACCOUNT_ROW'
  | 'RECEIPT_AND_TOMBSTONE'

export type LifecycleAdminStep = {
  stepId: string
  stepCode: string
  categoryCode: LifecycleCategoryCode | string
  action: 'DELETE' | 'ANONYMIZE' | 'RESTRICTED_RETENTION' | 'NO_SUBJECT_DATA' | string
  status: string
  plannedCount: number
  processedCount: number
  attemptCount: number
  lastErrorCode: string | null
}

export type LifecycleAdminRequest = {
  requestId: string
  mode: LifecycleDeletionMode
  status: string
  region: DataRegion
  requestedAt: string
  scheduledFor: string
  startedAt: string | null
  completedAt: string | null
  restrictedRetentionUntil: string | null
  steps: LifecycleAdminStep[]
}

export type LifecycleDryRun = {
  categories: Array<{ categoryCode: string; action: string; count: number }>
  coverage: {
    coveredColumnCount?: number
    uncoveredColumnCount?: number
  }
}

export type RetentionHoldPayload = {
  holdId: string
  categoryCode: LifecycleCategoryCode
  scopeType: 'USER_REQUEST' | 'RETENTION_SCAN'
  scopeId: string
  reasonCode: 'LEGAL_DISPUTE' | 'REGULATORY_REQUEST' | 'SECURITY_INCIDENT' | 'CONTRACTUAL_ARCHIVE'
  legalBasisReference: string
  expiresAt: string
}

export type LifecycleOperation = { operationId: string }

const value = (raw: Record<string, unknown>, camel: string, snake: string) => raw[camel] ?? raw[snake]
const nullableString = (input: unknown): string | null => input == null || input === '' ? null : String(input)

function normalizeStep(input: unknown): LifecycleAdminStep {
  const raw = input && typeof input === 'object' ? input as Record<string, unknown> : {}
  return {
    stepId: String(value(raw, 'stepId', 'step_id') ?? ''),
    stepCode: String(value(raw, 'stepCode', 'step_code') ?? ''),
    categoryCode: String(value(raw, 'categoryCode', 'category_code') ?? ''),
    action: String(raw.action ?? ''),
    status: String(raw.status ?? ''),
    plannedCount: Number(value(raw, 'plannedCount', 'planned_count') ?? 0),
    processedCount: Number(value(raw, 'processedCount', 'processed_count') ?? 0),
    attemptCount: Number(value(raw, 'attemptCount', 'attempt_count') ?? 0),
    lastErrorCode: nullableString(value(raw, 'lastErrorCode', 'last_error_code')),
  }
}

export function normalizeLifecycleAdminRequest(input: unknown, region: DataRegion): LifecycleAdminRequest {
  const raw = input && typeof input === 'object' ? input as Record<string, unknown> : {}
  return {
    requestId: String(value(raw, 'requestId', 'request_id') ?? ''),
    mode: String(value(raw, 'mode', 'deletion_mode')) === 'IMMEDIATE' ? 'IMMEDIATE' : 'GRACE_PERIOD',
    status: String(value(raw, 'status', 'execution_status') ?? ''),
    region,
    requestedAt: String(value(raw, 'requestedAt', 'requested_at') ?? ''),
    scheduledFor: String(value(raw, 'scheduledFor', 'scheduled_for') ?? ''),
    startedAt: nullableString(value(raw, 'startedAt', 'started_at')),
    completedAt: nullableString(value(raw, 'completedAt', 'completed_at')),
    restrictedRetentionUntil: nullableString(value(raw, 'restrictedRetentionUntil', 'restricted_retention_until')),
    steps: Array.isArray(raw.steps) ? raw.steps.map(normalizeStep) : [],
  }
}

function unwrap<T>(result: ApiResult<T>): T {
  if (!result.success) {
    throw Object.assign(new Error(result.error || '请求失败'), {
      code: result.code,
      status: result.status,
    })
  }
  return result.data
}

export const privacyLifecycleApi = {
  async listRequests(input: { region: DataRegion; limit?: number; offset?: number }) {
    const raw = unwrap<{ items?: unknown[]; limit?: number; offset?: number }>(
      await api.get('/privacy/lifecycle/requests', {
        params: { limit: input.limit ?? 50, offset: input.offset ?? 0 },
      }),
    )
    return {
      items: (raw.items ?? []).map(item => normalizeLifecycleAdminRequest(item, input.region)),
      limit: Number(raw.limit ?? input.limit ?? 50),
      offset: Number(raw.offset ?? input.offset ?? 0),
    }
  },

  async getRequest(input: { region: DataRegion; requestId: string }) {
    const raw = unwrap<unknown>(await api.get(`/privacy/lifecycle/requests/${encodeURIComponent(input.requestId)}`))
    return normalizeLifecycleAdminRequest(raw, input.region)
  },

  async dryRun(requestId: string): Promise<LifecycleDryRun> {
    const raw = unwrap<any>(await api.post('/privacy/lifecycle/dry-run', { requestId }))
    return {
      coverage: {
        coveredColumnCount: Number(raw?.coverage?.coveredColumnCount ?? 0),
        uncoveredColumnCount: Number(raw?.coverage?.uncoveredColumnCount ?? 0),
      },
      categories: Array.isArray(raw?.categories)
        ? raw.categories.map((item: any) => ({
            categoryCode: String(item?.categoryCode ?? item?.category ?? ''),
            action: String(item?.action ?? ''),
            count: Number(item?.count ?? 0),
          }))
        : [],
    }
  },

  async createHold(payload: RetentionHoldPayload) {
    const { categoryCode, ...rest } = payload
    return unwrap(await api.post('/privacy/lifecycle/holds', { ...rest, category: categoryCode }))
  },

  async releaseHold(holdId: string, operation: LifecycleOperation) {
    return unwrap(await api.post(`/privacy/lifecycle/holds/${encodeURIComponent(holdId)}/release`, operation))
  },

  async extendHold(holdId: string, payload: { expiresAt: string } & LifecycleOperation) {
    return unwrap(await api.post(`/privacy/lifecycle/holds/${encodeURIComponent(holdId)}/extend`, payload))
  },

  async pauseRegion(payload: { reason: string; reviewAt: string } & LifecycleOperation) {
    return unwrap<{ paused: true; reviewAt: string }>(await api.post('/privacy/lifecycle/controls/pause', payload))
  },

  async resumeRegion(operation: LifecycleOperation) {
    return unwrap<{ paused: false }>(await api.post('/privacy/lifecycle/controls/resume', operation))
  },

  async retryStep(stepId: string, operation: LifecycleOperation) {
    return unwrap<{ stepId: string; status: 'PENDING' }>(
      await api.post(`/privacy/lifecycle/steps/${encodeURIComponent(stepId)}/retry`, operation),
    )
  },
}

export type PrivacyLifecycleApi = typeof privacyLifecycleApi
