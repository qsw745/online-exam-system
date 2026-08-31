import type { ReviewCaseDetail, ReviewEventSummary } from './proctoring-review.model.js'
import { escapeCsvCell } from './proctoring-review.policy.js'

const EVENT_STATE_KEYS = [
  'camera',
  'microphone',
  'app',
  'faceCount',
  'light',
  'network',
  'screenCaptured',
] as const

const safeEventState = (state: ReviewEventSummary['state']) => {
  const safe: Record<string, unknown> = {}
  for (const key of EVENT_STATE_KEYS) {
    if (state[key] !== undefined) safe[key] = state[key]
  }
  return safe
}

const actorLabel = (detail: ReviewCaseDetail, actorUserId: number) =>
  actorUserId === detail.userId ? detail.candidatePublicId : `staff:${actorUserId}`

export function buildReviewCaseCsv(detail: ReviewCaseDetail): string {
  const rows: unknown[][] = [['类型', '时间', '操作者', '动作或事件', '原因', '说明']]
  rows.push([
    '案件摘要',
    detail.openedAt,
    detail.candidateDisplayName || detail.candidatePublicId,
    detail.examTitle,
    detail.triggerReasonCode,
    `案件 ${detail.caseId}；状态 ${detail.status}；结论 ${detail.outcome}；版本 ${detail.version}`,
  ])
  for (const event of detail.events) {
    rows.push([
      '客观事件',
      event.occurredAt,
      detail.candidatePublicId,
      event.type,
      event.severity,
      JSON.stringify(safeEventState(event.state)),
    ])
  }
  for (const decision of detail.decisions) {
    rows.push([
      '人工决定',
      decision.createdAt,
      actorLabel(detail, decision.actorUserId),
      decision.action,
      decision.reasonCode,
      decision.comment,
    ])
  }
  for (const message of detail.messages) {
    rows.push([
      '复核沟通',
      message.createdAt,
      actorLabel(detail, message.actorUserId),
      message.messageType,
      '',
      message.body,
    ])
  }
  if (detail.appeal) {
    rows.push([
      '申诉',
      detail.appeal.submittedAt,
      detail.candidatePublicId,
      detail.appeal.status,
      detail.appeal.reasonCode,
      detail.appeal.statement,
    ])
  }
  return `\uFEFF${rows.map(row => row.map(escapeCsvCell).join(',')).join('\r\n')}`
}

export default buildReviewCaseCsv
