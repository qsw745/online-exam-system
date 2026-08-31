import assert from 'node:assert/strict'
import test from 'node:test'
import type { ReviewCaseDetail } from './proctoring-review.model.js'
import { buildReviewCaseCsv } from './proctoring-review.csv.js'

const detail: ReviewCaseDetail = {
  caseId: '7395c0a5-90c2-4db2-a7f1-eccf6327945d',
  sessionId: '7cb06150-6f56-45c5-92a1-32163aa6464f',
  examId: 12,
  taskId: 30,
  attemptId: '81c75367-fb18-42f4-8b97-b8f5c36f8a0c',
  userId: 71,
  candidatePublicId: 'WH-CANDIDATE-71',
  candidateDisplayName: '=HYPERLINK("https://example.com")',
  examTitle: '问衡「能力,测评」',
  dataRegion: 'cn',
  status: 'appeal_pending',
  outcome: 'violation_confirmed',
  triggerReasonCode: 'MULTIPLE_FACES',
  version: 3,
  openedAt: '2026-08-30T09:00:00.000Z',
  firstDecidedAt: '2026-08-30T10:00:00.000Z',
  appealDeadlineAt: '2026-09-06T10:00:00.000Z',
  closedAt: null,
  retainUntil: '2027-02-26T09:00:00.000Z',
  updatedAt: '2026-09-01T10:00:00.000Z',
  session: {
    state: 'review_required',
    identityStatus: 'passed',
    startedAt: '2026-08-30T08:30:00.000Z',
    lastHeartbeatAt: '2026-08-30T08:59:00.000Z',
    interruptionStartedAt: null,
    completedAt: null,
  },
  identityChecks: [
    {
      checkId: 'f0cd0d31-95bf-48af-b9a3-d0762a91e9b1',
      result: 'passed',
      reasonCode: null,
      similarity: 0.91,
      livenessPassed: true,
      model: 'server-face-v1',
      checkedAt: '2026-08-30T08:40:00.000Z',
    },
  ],
  events: [
    {
      eventId: '98d0f916-c225-4c83-81a7-7d030f6b10ef',
      sequence: 1,
      type: 'multiple_faces',
      severity: 'critical',
      state: {
        faceCount: 2,
        camera: 'available',
        embedding: [0.1, 0.2],
        image: 'data:image/jpeg;base64,secret',
        audio: 'secret-audio',
        password: 'never-export',
      },
      occurredAt: '2026-08-30T08:55:00.000Z',
      receivedAt: '2026-08-30T08:55:01.000Z',
    },
  ],
  decisions: [
    {
      decisionId: 'f4ef8d69-daf4-4bc5-b384-9c5338a31db5',
      actorUserId: 11,
      action: 'confirm_violation',
      reasonCode: 'MULTIPLE_PERSONS_CONFIRMED',
      comment: '+人工确认「两人」\n第二行',
      caseVersionBefore: 1,
      caseVersionAfter: 2,
      createdAt: '2026-08-30T10:00:00.000Z',
    },
  ],
  messages: [
    {
      messageId: 'c9bd6b4c-e952-4c08-8c8d-06f266071340',
      actorUserId: 71,
      messageType: 'candidate_response',
      replyToMessageId: '747b4fc9-de33-4a4f-824e-40081204271c',
      body: '@家人在门口短暂停留',
      caseVersionBefore: 2,
      caseVersionAfter: 3,
      createdAt: '2026-09-01T09:00:00.000Z',
    },
  ],
  appeal: {
    appealId: 'e7be900b-82ab-4e58-8b02-c45a440f9056',
    userId: 71,
    reasonCode: 'ENVIRONMENTAL_CAUSE',
    statement: '-并未参与答题',
    status: 'pending',
    resolutionDecisionId: null,
    submittedAt: '2026-09-01T10:00:00.000Z',
    resolvedAt: null,
  },
}

test('复核 CSV 包含完整审计时间线并使用 UTF-8 BOM 与 CRLF', () => {
  const csv = buildReviewCaseCsv(detail)
  assert.equal(csv.startsWith('\uFEFF'), true)
  assert.match(csv, /"案件摘要"/)
  assert.match(csv, /"客观事件"/)
  assert.match(csv, /"人工决定"/)
  assert.match(csv, /"复核沟通"/)
  assert.match(csv, /"申诉"/)
  assert.match(csv, /\r\n/)
  assert.match(csv, /问衡「能力,测评」/)
})

test('复核 CSV 阻断公式注入并正确转义双引号与换行', () => {
  const csv = buildReviewCaseCsv(detail)
  assert.match(csv, /"'=HYPERLINK\(""https:\/\/example\.com""\)"/)
  assert.match(csv, /"'\+人工确认「两人」\n第二行"/)
  assert.match(csv, /"'@家人在门口短暂停留"/)
  assert.match(csv, /"'-并未参与答题"/)
})

test('复核 CSV 不导出媒体、生物特征或凭据字段', () => {
  const csv = buildReviewCaseCsv(detail).toLowerCase()
  for (const forbidden of ['embedding', 'image', 'audio', 'password', 'never-export', 'secret-audio']) {
    assert.equal(csv.includes(forbidden), false, `CSV 不应包含 ${forbidden}`)
  }
})
