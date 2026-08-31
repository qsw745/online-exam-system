import type {
  FactualEventType,
  ProctoringDataRegion,
  ProctoringPolicy,
  ProctoringSessionState,
} from './proctoring.policy.js'

export type ProctoringSeverity = 'info' | 'warn' | 'critical'

export type ProctoringEventInput = {
  examId: number
  taskId?: number
  type: string
  severity?: ProctoringSeverity
  message?: string
  meta?: any
  occurredAt?: string
  source?: string
}

export type ProctoringEvent = {
  id: number
  exam_id: number
  user_id: number
  severity: ProctoringSeverity
  type: string
  message: string | null
  meta?: any
  occurred_at?: string | null
  created_at: string
}

export type ProctoringSummary = {
  total: number
  info: number
  warn: number
  critical: number
}

export type ProctoringListResult = {
  items: ProctoringEvent[]
  total: number
  page: number
  limit: number
  summary: ProctoringSummary
}

export type ProctoringAttemptContext = {
  attemptId: string
  examId: number
  taskId: number | null
  userId: number
  resultStatus: string
  dataRegion: ProctoringDataRegion
  ageBand: string
  policy: ProctoringPolicy
  allowMinors: boolean
  examEndsAt: string | null
}

export type ProctoringConsent = {
  consentId: string
  attemptId: string
  examId: number
  userId: number
  dataRegion: ProctoringDataRegion
  policyVersion: string
  noticeVersion: string
  policyDigest: string
  categories: string[]
  acceptedAt: string
  revokedAt: string | null
  expiresAt: string
}

export type ProctoringSession = {
  sessionId: string
  consentId: string
  attemptId: string
  examId: number
  taskId: number | null
  userId: number
  dataRegion: ProctoringDataRegion
  state: ProctoringSessionState
  lastSequence: number
  cameraRequired: boolean
  microphoneRequired: boolean
  identityRequired: boolean
  identityStatus: 'pending' | 'passed' | 'failed' | 'not_required'
  startedAt: string | null
  lastHeartbeatAt: string | null
  interruptionStartedAt: string | null
  completedAt: string | null
  reviewReasonCode: string | null
}

export type ProctoringIdentityCheck = {
  checkId: string
  result: 'passed' | 'failed'
  reasonCode: string | null
  similarity: number | null
  livenessPassed: boolean | null
  model: string | null
}

export type ProctoringSessionDecision = {
  state: ProctoringSessionState
  mayContinue: boolean
  action: 'continue' | 'remain_paused' | 'manual_review' | 'completed'
  reasonCode?: string | null
}

export type StoredProctoringEvent = {
  eventId: string
  sessionId: string
  examId: number
  userId: number
  sequence: number
  type: FactualEventType
  severity: ProctoringSeverity
  state: Record<string, unknown>
  occurredAt: string
  receivedAt: string
}
