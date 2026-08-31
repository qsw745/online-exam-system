import { describe, expect, it } from 'vitest'

import {
  createAuthoritativeDeadlineClock,
  createPendingSubmission,
  remainingSeconds,
} from './examReliability'

const ATTEMPT_ID = '6745d94e-7d93-4a39-b348-26d8a979ee7d'
const SUBMISSION_ID = 'cd60e7f2-eed8-42df-88f5-2b86d5504d8c'

describe('考试可靠性策略', () => {
  it('用服务端剩余时间和单调时钟计算倒计时，不再次读取本机墙上时间', () => {
    const clock = createAuthoritativeDeadlineClock({
      serverNow: '2026-08-30T08:00:00.000Z',
      deadlineAt: '2026-08-30T08:01:00.000Z',
      monotonicNowMs: 10_000,
    })

    expect(remainingSeconds(clock, 10_000)).toBe(60)
    expect(remainingSeconds(clock, 20_500)).toBe(49)
    expect(remainingSeconds(clock, 80_000)).toBe(0)
  })

  it('待提交快照固定提交编号、答案和形成时间，供断网后原样重试', () => {
    expect(
      createPendingSubmission(
        {
          attemptId: ATTEMPT_ID,
          answers: { '2': 'A', '7': 'B,C' },
          timeSpent: 123,
          reason: 'deadline',
        },
        () => SUBMISSION_ID,
        () => '2026-08-30T08:02:03.000Z',
      ),
    ).toEqual({
      attemptId: ATTEMPT_ID,
      submissionId: SUBMISSION_ID,
      answers: { '2': 'A', '7': 'B,C' },
      timeSpent: 123,
      reason: 'deadline',
      createdAt: '2026-08-30T08:02:03.000Z',
    })
  })

  it('待提交快照会复制答案，后续页面编辑不会改变已经排队的交卷内容', () => {
    const answers = { '2': 'A' }
    const pending = createPendingSubmission(
      { attemptId: ATTEMPT_ID, answers, timeSpent: 1, reason: 'manual' },
      () => SUBMISSION_ID,
    )
    answers['2'] = 'D'
    expect(pending.answers).toEqual({ '2': 'A' })
  })
})
