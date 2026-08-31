import { render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import type { CandidateReviewCaseDetail } from '@/shared/api/endpoints/proctoringReview'
import MyProctoringReviewCard from './MyProctoringReviewCard'

const baseCase = (): CandidateReviewCaseDetail => ({
  caseId: '7395c0a5-90c2-4db2-a7f1-eccf6327945d',
  examId: 12,
  taskId: 30,
  attemptId: '81c75367-fb18-42f4-8b97-b8f5c36f8a0c',
  examTitle: '问衡产品能力测评',
  status: 'pending_review',
  outcome: 'pending',
  triggerReasonCode: 'MULTIPLE_FACES',
  version: 1,
  openedAt: '2026-08-30T09:00:00.000Z',
  firstDecidedAt: null,
  appealDeadlineAt: null,
  closedAt: null,
  updatedAt: '2026-08-30T09:00:00.000Z',
  decisions: [],
  messages: [],
  appeal: null,
})

const noop = vi.fn(async () => undefined)
const now = new Date('2026-09-01T10:00:00.000Z')

describe('考生监考复核卡片', () => {
  test('没有本人复核案件时不渲染卡片', () => {
    const { container } = render(
      <MyProctoringReviewCard detail={null} now={now} onRespond={noop} onAppeal={noop} onOpenDetail={vi.fn()} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  test('等待补充时显示最新问题、回复按钮和成绩隔离说明', () => {
    const detail = baseCase()
    detail.status = 'information_requested'
    detail.version = 2
    detail.messages = [{
      messageId: '747b4fc9-de33-4a4f-824e-40081204271c',
      messageType: 'information_request',
      replyToMessageId: null,
      body: '请说明摄像头中断的设备情况。',
      createdAt: '2026-08-30T10:00:00.000Z',
    }]
    render(<MyProctoringReviewCard detail={detail} now={now} onRespond={noop} onAppeal={noop} onOpenDetail={vi.fn()} />)
    expect(screen.getByText('请说明摄像头中断的设备情况。')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '补充说明' })).toBeEnabled()
    expect(screen.getByText('成绩与监考复核相互独立')).toBeInTheDocument()
  })

  test('已排除异常不显示申诉入口', () => {
    const detail = baseCase()
    detail.status = 'decided'
    detail.outcome = 'cleared'
    render(<MyProctoringReviewCard detail={detail} now={now} onRespond={noop} onAppeal={noop} onOpenDetail={vi.fn()} />)
    expect(screen.queryByRole('button', { name: '提交申诉' })).not.toBeInTheDocument()
    expect(screen.getByText('已排除异常')).toBeInTheDocument()
  })

  test('确认违规且在期限内显示一次申诉入口', () => {
    const detail = baseCase()
    detail.status = 'decided'
    detail.outcome = 'violation_confirmed'
    detail.appealDeadlineAt = '2026-09-06T10:00:00.000Z'
    render(<MyProctoringReviewCard detail={detail} now={now} onRespond={noop} onAppeal={noop} onOpenDetail={vi.fn()} />)
    expect(screen.getByRole('button', { name: '提交申诉' })).toBeEnabled()
    expect(screen.getByText(/申诉截止/)).toBeInTheDocument()
  })

  test('申诉过期或已经提交时禁止重复申诉', () => {
    const expired = baseCase()
    expired.status = 'decided'
    expired.outcome = 'violation_confirmed'
    expired.appealDeadlineAt = '2026-08-31T10:00:00.000Z'
    const { rerender } = render(
      <MyProctoringReviewCard detail={expired} now={now} onRespond={noop} onAppeal={noop} onOpenDetail={vi.fn()} />,
    )
    expect(screen.getByRole('button', { name: '申诉已过期' })).toBeDisabled()

    const appealed = baseCase()
    appealed.status = 'appeal_pending'
    appealed.outcome = 'violation_confirmed'
    appealed.appealDeadlineAt = '2026-09-06T10:00:00.000Z'
    appealed.appeal = {
      appealId: 'e7be900b-82ab-4e58-8b02-c45a440f9056',
      reasonCode: 'ENVIRONMENTAL_CAUSE',
      statement: '家人在门口短暂停留。',
      status: 'pending',
      submittedAt: '2026-09-01T10:00:00.000Z',
      resolvedAt: null,
    }
    rerender(<MyProctoringReviewCard detail={appealed} now={now} onRespond={noop} onAppeal={noop} onOpenDetail={vi.fn()} />)
    expect(screen.getByRole('button', { name: '申诉处理中' })).toBeDisabled()
  })
})
