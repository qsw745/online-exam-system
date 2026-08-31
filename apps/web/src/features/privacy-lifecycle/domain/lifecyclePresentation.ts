export const LIFECYCLE_STATUS_CODES = [
  'REQUESTED',
  'SCHEDULED',
  'RUNNING',
  'HELD',
  'RETRYING',
  'ATTENTION_REQUIRED',
  'COMPLETED',
  'COMPLETED_WITH_RESTRICTED_RETENTION',
  'CANCELLED',
] as const

export const LIFECYCLE_STEP_STATUS_CODES = [
  'PENDING',
  'RUNNING',
  'HELD',
  'RETRYING',
  'ATTENTION_REQUIRED',
  'COMPLETED',
] as const

export const HOLDABLE_CATEGORY_CODES = [
  'EXAM_ARCHIVE',
  'PROCTORING_AND_IDENTITY',
  'SECURITY_LOGS',
  'RECEIPT_AND_TOMBSTONE',
] as const

export type LifecycleStatusCode = typeof LIFECYCLE_STATUS_CODES[number]
export type LifecycleStepStatusCode = typeof LIFECYCLE_STEP_STATUS_CODES[number]
export type HoldableCategoryCode = typeof HOLDABLE_CATEGORY_CODES[number]
export type PresentationTone = 'default' | 'blue' | 'gold' | 'orange' | 'red' | 'green'

const STATUS_SET = new Set<string>(LIFECYCLE_STATUS_CODES)
const STEP_STATUS_SET = new Set<string>(LIFECYCLE_STEP_STATUS_CODES)

const STATUS_TONE: Record<LifecycleStatusCode, PresentationTone> = {
  REQUESTED: 'blue',
  SCHEDULED: 'gold',
  RUNNING: 'blue',
  HELD: 'orange',
  RETRYING: 'orange',
  ATTENTION_REQUIRED: 'red',
  COMPLETED: 'green',
  COMPLETED_WITH_RESTRICTED_RETENTION: 'green',
  CANCELLED: 'default',
}

const TERMINAL = new Set<LifecycleStatusCode>([
  'COMPLETED',
  'COMPLETED_WITH_RESTRICTED_RETENTION',
  'CANCELLED',
])

export function lifecycleStatusPresentation(statusValue: unknown): {
  known: boolean
  labelKey: string
  tone: PresentationTone
  terminal: boolean
} {
  const status = String(statusValue ?? '')
  if (!STATUS_SET.has(status)) {
    return {
      known: false,
      labelKey: 'privacyLifecycle.status.unknown',
      tone: 'default',
      terminal: false,
    }
  }
  const knownStatus = status as LifecycleStatusCode
  return {
    known: true,
    labelKey: `privacyLifecycle.status.${knownStatus}`,
    tone: STATUS_TONE[knownStatus],
    terminal: TERMINAL.has(knownStatus),
  }
}

export function stepStatusPresentation(statusValue: unknown): {
  known: boolean
  labelKey: string
  tone: PresentationTone
  canRetry: boolean
} {
  const status = String(statusValue ?? '')
  if (!STEP_STATUS_SET.has(status)) {
    return {
      known: false,
      labelKey: 'privacyLifecycle.stepStatus.unknown',
      tone: 'default',
      canRetry: false,
    }
  }
  const knownStatus = status as LifecycleStepStatusCode
  return {
    known: true,
    labelKey: `privacyLifecycle.stepStatus.${knownStatus}`,
    tone: knownStatus === 'COMPLETED' ? 'green' : knownStatus === 'ATTENTION_REQUIRED' ? 'red' : 'blue',
    canRetry: knownStatus === 'ATTENTION_REQUIRED',
  }
}
