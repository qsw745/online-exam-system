export type KnownReviewStatus =
  | 'pending_review'
  | 'information_requested'
  | 'decided'
  | 'appeal_pending'
  | 'appeal_resolved'

export type ReviewOutcome = 'pending' | 'cleared' | 'violation_confirmed'

export type StaffReviewAction =
  | 'request_information'
  | 'clear'
  | 'confirm_violation'
  | 'resolve_appeal_upheld'
  | 'resolve_appeal_rejected'

export type StatusTone = 'processing' | 'warning' | 'default' | 'error' | 'success'

const STATUS_PRESENTATION: Record<KnownReviewStatus, { tone: StatusTone; labelKey: string }> = {
  pending_review: { tone: 'processing', labelKey: 'proctoringReview.status.pending_review' },
  information_requested: { tone: 'warning', labelKey: 'proctoringReview.status.information_requested' },
  decided: { tone: 'default', labelKey: 'proctoringReview.status.decided' },
  appeal_pending: { tone: 'error', labelKey: 'proctoringReview.status.appeal_pending' },
  appeal_resolved: { tone: 'success', labelKey: 'proctoringReview.status.appeal_resolved' },
}

const PUBLIC_REASON_CODES = new Set([
  'SENSOR_INTERRUPTION_EXPLAINED',
  'IDENTITY_CONFIRMED_MANUALLY',
  'INSUFFICIENT_EVIDENCE',
  'MULTIPLE_PERSONS_CONFIRMED',
  'SCREEN_CAPTURE_CONFIRMED',
  'IDENTITY_MISMATCH_CONFIRMED',
  'UNRESOLVED_SENSOR_INTERRUPTION',
  'CANDIDATE_EXPLANATION_REQUIRED',
  'APPEAL_EVIDENCE_ACCEPTED',
  'APPEAL_EVIDENCE_REJECTED',
  'DEVICE_INTERRUPTION',
  'ENVIRONMENTAL_CAUSE',
  'IDENTITY_ERROR',
  'EVENT_MISINTERPRETED',
  'OTHER',
])

export const isKnownReviewStatus = (value: string): value is KnownReviewStatus => value in STATUS_PRESENTATION

export function statusPresentation(value: string) {
  return isKnownReviewStatus(value)
    ? STATUS_PRESENTATION[value]
    : { tone: 'default' as const, labelKey: 'proctoringReview.status.unknown' }
}

export function actionsForCase(input: { status: string; outcome: string }): StaffReviewAction[] {
  if (!isKnownReviewStatus(input.status)) return []
  if (input.status === 'pending_review' && input.outcome === 'pending') {
    return ['request_information', 'clear', 'confirm_violation']
  }
  if (input.status === 'appeal_pending' && input.outcome === 'violation_confirmed') {
    return ['resolve_appeal_upheld', 'resolve_appeal_rejected']
  }
  return []
}

export function publicReasonKey(value: string | null | undefined): string {
  const normalized = String(value || '').trim().toUpperCase()
  return PUBLIC_REASON_CODES.has(normalized)
    ? `proctoringReview.reason.${normalized}`
    : 'proctoringReview.reason.generic'
}

export function conflictMessageKey(code: string | null | undefined): string {
  return code === 'PROCTORING_REVIEW_VERSION_CONFLICT'
    ? 'proctoringReview.error.versionConflict'
    : 'proctoringReview.error.generic'
}
