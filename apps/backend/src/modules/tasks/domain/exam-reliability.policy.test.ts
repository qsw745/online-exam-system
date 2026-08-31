import assert from 'node:assert/strict'
import test from 'node:test'

import {
  ExamReliabilityError,
  assertSubmissionWindow,
  calculateAttemptDeadline,
  decideSubmission,
  normalizeSubmissionIdentity,
  submissionPayloadHash,
} from './exam-reliability.policy'

const ATTEMPT_ID = '6745d94e-7d93-4a39-b348-26d8a979ee7d'
const SUBMISSION_ID = 'cd60e7f2-eed8-42df-88f5-2b86d5504d8c'

test('只接受规范 UUID 作为服务端作答编号和客户端提交编号', () => {
  assert.deepEqual(normalizeSubmissionIdentity(ATTEMPT_ID, SUBMISSION_ID), {
    attemptId: ATTEMPT_ID,
    submissionId: SUBMISSION_ID,
  })
  assert.throws(
    () => normalizeSubmissionIdentity('attempt-1', SUBMISSION_ID),
    (error: unknown) => error instanceof ExamReliabilityError && error.code === 'INVALID_ATTEMPT_ID',
  )
})

test('答案键顺序不同但语义相同时生成同一提交摘要', () => {
  const left = submissionPayloadHash({
    attemptId: ATTEMPT_ID,
    answers: { '12': 'A', '3': 'B,C' },
    timeSpent: 61,
  })
  const right = submissionPayloadHash({
    attemptId: ATTEMPT_ID,
    answers: { '3': 'B,C', '12': 'A' },
    timeSpent: 61,
  })
  assert.equal(left, right)
})

test('同一提交编号和同一内容返回既有结果', () => {
  assert.deepEqual(
    decideSubmission(
      {
        status: 'submitted',
        submissionId: SUBMISSION_ID,
        payloadHash: 'same-hash',
        response: { score: 88, correctCount: 8, questionCount: 10, examResultId: 4 },
      },
      { submissionId: SUBMISSION_ID, payloadHash: 'same-hash' },
    ),
    {
      action: 'replay',
      response: { score: 88, correctCount: 8, questionCount: 10, examResultId: 4 },
    },
  )
})

test('同一提交编号不能携带不同内容', () => {
  assert.throws(
    () =>
      decideSubmission(
        {
          status: 'submitted',
          submissionId: SUBMISSION_ID,
          payloadHash: 'original-hash',
          response: { score: 88, correctCount: 8, questionCount: 10, examResultId: 4 },
        },
        { submissionId: SUBMISSION_ID, payloadHash: 'changed-hash' },
      ),
    (error: unknown) =>
      error instanceof ExamReliabilityError && error.code === 'SUBMISSION_PAYLOAD_MISMATCH',
  )
})

test('已交卷后使用新提交编号不会覆盖成绩', () => {
  assert.throws(
    () =>
      decideSubmission(
        {
          status: 'graded',
          submissionId: SUBMISSION_ID,
          payloadHash: 'same-hash',
          response: { score: 88, correctCount: 8, questionCount: 10, examResultId: 4 },
        },
        { submissionId: 'aa13dbe1-580a-4db5-a9fc-3539713012bf', payloadHash: 'same-hash' },
      ),
    (error: unknown) => error instanceof ExamReliabilityError && error.code === 'EXAM_ALREADY_SUBMITTED',
  )
})

test('截止时间取开始时间加时长与考务结束时间中的较早值', () => {
  assert.equal(
    calculateAttemptDeadline({
      startedAt: '2026-08-30T08:00:00.000Z',
      durationMinutes: 60,
      examEndsAt: '2026-08-30T08:45:00.000Z',
    }),
    '2026-08-30T08:45:00.000Z',
  )
  assert.equal(
    calculateAttemptDeadline({
      startedAt: '2026-08-30T08:00:00.000Z',
      durationMinutes: 30,
      examEndsAt: '2026-08-30T10:00:00.000Z',
    }),
    '2026-08-30T08:30:00.000Z',
  )
})

test('只允许在截止时间后的服务端宽限期内完成离线补交', () => {
  assert.doesNotThrow(() =>
    assertSubmissionWindow('2026-08-30T09:00:00.000Z', new Date('2026-08-30T09:04:59.000Z')),
  )
  assert.throws(
    () => assertSubmissionWindow('2026-08-30T09:00:00.000Z', new Date('2026-08-30T09:05:01.000Z')),
    (error: unknown) => error instanceof ExamReliabilityError && error.code === 'EXAM_ATTEMPT_EXPIRED',
  )
})
