import { describe, expect, test } from 'vitest'
import {
  actionsForCase,
  conflictMessageKey,
  publicReasonKey,
  statusPresentation,
} from './reviewPresentation'

describe('监考复核展示策略', () => {
  test('待复核案件只显示请求补充、排除异常和确认违规', () => {
    expect(actionsForCase({ status: 'pending_review', outcome: 'pending' })).toEqual([
      'request_information',
      'clear',
      'confirm_violation',
    ])
  })

  test('申诉中只允许申诉成立或驳回，不显示普通复核动作', () => {
    expect(actionsForCase({ status: 'appeal_pending', outcome: 'violation_confirmed' })).toEqual([
      'resolve_appeal_upheld',
      'resolve_appeal_rejected',
    ])
  })

  test('等待考生、已决定、申诉已结束和未知状态都不允许考务写入', () => {
    expect(actionsForCase({ status: 'information_requested', outcome: 'pending' })).toEqual([])
    expect(actionsForCase({ status: 'decided', outcome: 'cleared' })).toEqual([])
    expect(actionsForCase({ status: 'appeal_resolved', outcome: 'violation_confirmed' })).toEqual([])
    expect(actionsForCase({ status: 'future_unknown', outcome: 'pending' })).toEqual([])
  })

  test('全部合法状态有稳定色调和中英文共用文案键', () => {
    expect(statusPresentation('pending_review')).toEqual({
      tone: 'processing',
      labelKey: 'proctoringReview.status.pending_review',
    })
    expect(statusPresentation('information_requested').tone).toBe('warning')
    expect(statusPresentation('decided').tone).toBe('default')
    expect(statusPresentation('appeal_pending').tone).toBe('error')
    expect(statusPresentation('appeal_resolved').tone).toBe('success')
    expect(statusPresentation('future_unknown')).toEqual({
      tone: 'default',
      labelKey: 'proctoringReview.status.unknown',
    })
  })

  test('只有公开原因映射为具体文案，未知内部代码使用通用说明', () => {
    expect(publicReasonKey('IDENTITY_MISMATCH_CONFIRMED')).toBe(
      'proctoringReview.reason.IDENTITY_MISMATCH_CONFIRMED',
    )
    expect(publicReasonKey('DATABASE_INTERNAL_FAILURE')).toBe('proctoringReview.reason.generic')
  })

  test('版本冲突使用明确刷新提示，其余错误使用通用失败提示', () => {
    expect(conflictMessageKey('PROCTORING_REVIEW_VERSION_CONFLICT')).toBe(
      'proctoringReview.error.versionConflict',
    )
    expect(conflictMessageKey('UNKNOWN')).toBe('proctoringReview.error.generic')
  })
})
