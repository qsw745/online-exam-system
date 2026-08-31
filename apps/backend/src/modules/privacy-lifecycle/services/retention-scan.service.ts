import type { DataRegion, LifecycleCategoryCode, LifecycleStatus } from '../domain/lifecycle.model'
import type { LifecycleMetrics } from './lifecycle-observability'

export const RETENTION_SCAN_CATEGORIES = [
  'FACE_CREDENTIALS',
  'EXAM_ARCHIVE',
  'PROCTORING_AND_IDENTITY',
  'SECURITY_LOGS',
  'RECEIPT_AND_TOMBSTONE',
  'OUTBOX_PURGE',
  'DELETION_REMINDERS',
] as const

export type RetentionScanCategory = typeof RETENTION_SCAN_CATEGORIES[number]

export type RetentionScanCreateInput = {
  dataRegion: DataRegion
  category: RetentionScanCategory
  windowStart: Date
  windowEnd: Date
  now: Date
  policyVersion?: string
}

export type RetentionScanRun = {
  scanRunId: string
  dataRegion: DataRegion
  category: RetentionScanCategory
  windowStart: string
  windowEnd: string
  status: LifecycleStatus | 'PENDING'
  resumed: boolean
}

export interface RetentionScanRepositoryContract {
  createOrResume(input: RetentionScanCreateInput): Promise<RetentionScanRun>
}

const assertUtcDayWindow = (start: Date, end: Date): void => {
  const validStart = Number.isFinite(start.getTime())
    && start.getUTCHours() === 0
    && start.getUTCMinutes() === 0
    && start.getUTCSeconds() === 0
    && start.getUTCMilliseconds() === 0
  if (!validStart || end.getTime() - start.getTime() !== 86_400_000) {
    throw Object.assign(new Error('期限扫描必须使用完整 UTC 日窗口'), {
      code: 'LIFECYCLE_RETENTION_WINDOW_INVALID',
    })
  }
}

const metricCategory = (category: RetentionScanCategory): LifecycleCategoryCode => {
  if (category === 'OUTBOX_PURGE' || category === 'DELETION_REMINDERS') return 'RECEIPT_AND_TOMBSTONE'
  return category
}

export async function runRetentionScanOnce(input: RetentionScanCreateInput & {
  repository: RetentionScanRepositoryContract
  metrics: LifecycleMetrics
}): Promise<RetentionScanRun> {
  assertUtcDayWindow(input.windowStart, input.windowEnd)
  if (!RETENTION_SCAN_CATEGORIES.includes(input.category)) {
    throw Object.assign(new Error('期限扫描类别无效'), { code: 'LIFECYCLE_RETENTION_CATEGORY_INVALID' })
  }
  const run = await input.repository.createOrResume(input)
  input.metrics.record('lifecycle_retention_scan_scheduled', 1, {
    dataRegion: input.dataRegion,
    category: metricCategory(input.category),
  })
  return run
}

export function isRetentionEligible(input: {
  retainUntil: Date | null
  activeHoldUntil?: Date | null
  now: Date
}): boolean {
  if (!input.retainUntil || !Number.isFinite(input.retainUntil.getTime())) return false
  if (input.retainUntil.getTime() > input.now.getTime()) return false
  return !input.activeHoldUntil || input.activeHoldUntil.getTime() <= input.now.getTime()
}

export function dueDeletionReminder(input: {
  requestId: string
  scheduledFor: Date
  now: Date
}): { messageType: 'DELETION_GRACE_7D' | 'DELETION_GRACE_24H'; messageKey: string } | null {
  const remaining = input.scheduledFor.getTime() - input.now.getTime()
  if (remaining <= 0) return null
  if (remaining <= 24 * 60 * 60_000) {
    return { messageType: 'DELETION_GRACE_24H', messageKey: `deletion-grace-24h:${input.requestId}` }
  }
  if (remaining <= 7 * 24 * 60 * 60_000) {
    return { messageType: 'DELETION_GRACE_7D', messageKey: `deletion-grace-7d:${input.requestId}` }
  }
  return null
}
