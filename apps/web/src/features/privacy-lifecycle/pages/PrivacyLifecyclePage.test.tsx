import { App as AntApp } from 'antd'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import type {
  LifecycleAdminRequest,
  PrivacyLifecycleApi,
  RetentionHoldPayload,
} from '@/shared/api/endpoints/privacyLifecycle'
import PrivacyLifecyclePage from './PrivacyLifecyclePage'

const request: LifecycleAdminRequest = {
  requestId: 'b132689c-4a5d-42a2-86c5-3661e62d4d1f',
  mode: 'GRACE_PERIOD',
  status: 'ATTENTION_REQUIRED',
  region: 'CN',
  requestedAt: '2026-08-31T08:00:00.000Z',
  scheduledFor: '2026-09-30T08:00:00.000Z',
  startedAt: '2026-08-31T09:00:00.000Z',
  completedAt: null,
  restrictedRetentionUntil: null,
  steps: [
    {
      stepId: 'c132689c-4a5d-42a2-86c5-3661e62d4d1f',
      stepCode: 'delete_user_content',
      categoryCode: 'USER_CONTENT',
      action: 'DELETE',
      status: 'ATTENTION_REQUIRED',
      plannedCount: 8,
      processedCount: 3,
      attemptCount: 4,
      lastErrorCode: 'LIFECYCLE_HANDLER_RETRY_EXHAUSTED',
    },
    {
      stepId: 'd132689c-4a5d-42a2-86c5-3661e62d4d1f',
      stepCode: 'redact_security_logs',
      categoryCode: 'SECURITY_LOGS',
      action: 'ANONYMIZE',
      status: 'RETRYING',
      plannedCount: 5,
      processedCount: 2,
      attemptCount: 2,
      lastErrorCode: 'LIFECYCLE_HANDLER_TRANSIENT',
    },
  ],
}

const createApi = (overrides: Partial<PrivacyLifecycleApi> = {}) => ({
  listRequests: vi.fn(async () => ({ items: [request], limit: 50, offset: 0 })),
  getRequest: vi.fn(async () => ({
    ...request,
    email: 'private@example.com',
    phone: '13800138000',
    userId: 998,
  } as LifecycleAdminRequest)),
  dryRun: vi.fn(async () => ({
    coverage: { coveredColumnCount: 42, uncoveredColumnCount: 0 },
    categories: [{ categoryCode: 'USER_CONTENT', action: 'DELETE', count: 8 }],
  })),
  createHold: vi.fn(async (payload: RetentionHoldPayload) => ({ holdId: payload.holdId })),
  releaseHold: vi.fn(async () => ({})),
  extendHold: vi.fn(async () => ({})),
  pauseRegion: vi.fn(async payload => ({ paused: true as const, reviewAt: payload.reviewAt })),
  resumeRegion: vi.fn(async () => ({ paused: false as const })),
  retryStep: vi.fn(async stepId => ({ stepId, status: 'PENDING' as const })),
  ...overrides,
}) satisfies PrivacyLifecycleApi

const renderPage = (api: PrivacyLifecycleApi, props: { currentRole?: string; mobile?: boolean } = {}) => render(
  <AntApp>
    <MemoryRouter>
      <PrivacyLifecyclePage
        api={api}
        currentRole={props.currentRole ?? 'admin'}
        currentRegion="CN"
        mobile={props.mobile}
      />
    </MemoryRouter>
  </AntApp>,
)

describe('PrivacyLifecyclePage', () => {
  it('教师被前端拒绝且不会发起管理 API 请求', async () => {
    const api = createApi()
    renderPage(api, { currentRole: 'teacher' })
    expect(await screen.findByText('403')).toBeInTheDocument()
    expect(api.listRequests).not.toHaveBeenCalled()
  })

  it('控制台显示只读区域并且不提供强制完成、跳过或查看原始数据入口', async () => {
    const api = createApi()
    const user = userEvent.setup()
    renderPage(api)

    expect(await screen.findByText('中国大陆区')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '安全预演' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: /强制完成|跳过步骤|查看原始数据/ })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '查看详情' }))
    expect(await screen.findByText('delete_user_content')).toBeInTheDocument()
    expect(screen.queryByText('private@example.com')).not.toBeInTheDocument()
    expect(screen.queryByText('13800138000')).not.toBeInTheDocument()
    expect(screen.queryByText('998')).not.toBeInTheDocument()
  })

  it('暂停必须填写原因和未来复核时间，网络不确定重试复用同一操作编号', async () => {
    const user = userEvent.setup()
    let attempt = 0
    const pauseRegion = vi.fn(async (payload: { reason: string; reviewAt: string; operationId: string }) => {
      attempt += 1
      if (attempt === 1) throw new Error('服务器无响应，请检查网络连接')
      return { paused: true as const, reviewAt: payload.reviewAt }
    })
    const api = createApi({ pauseRegion })
    renderPage(api)

    await user.click(await screen.findByRole('button', { name: '暂停本区处理' }))
    await user.click(screen.getByRole('button', { name: '确认暂停' }))
    expect(await screen.findByText('请输入暂停原因')).toBeInTheDocument()
    expect(screen.getByText('请选择复核时间')).toBeInTheDocument()
    expect(pauseRegion).not.toHaveBeenCalled()

    await user.type(screen.getByLabelText('暂停原因'), '数据库维护窗口')
    await user.type(screen.getByLabelText('复核时间'), '2026-09-01T10:00')
    await user.click(screen.getByRole('button', { name: '确认暂停' }))
    expect(await screen.findByText(/结果尚未确认/)).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.getByRole('dialog', { name: '暂停本区生命周期处理' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '使用同一操作重试' }))

    await waitFor(() => expect(pauseRegion).toHaveBeenCalledTimes(2))
    const first = pauseRegion.mock.calls[0][0]
    const second = pauseRegion.mock.calls[1][0]
    expect(first.operationId).toMatch(/^[0-9a-f-]{36}$/)
    expect(second).toEqual(first)
  })

  it('合法冻结只列允许类别且详情仅给人工处理步骤提供重试', async () => {
    const api = createApi()
    const user = userEvent.setup()
    renderPage(api)

    await user.click(await screen.findByRole('button', { name: '查看详情' }))
    expect(await screen.findAllByRole('button', { name: '人工重试' })).toHaveLength(1)
    await user.click(screen.getByRole('button', { name: '创建合法冻结' }))
    const dialog = await screen.findByRole('dialog', { name: '创建合法冻结' })
    await user.click(within(dialog).getByLabelText('数据类别'))
    expect(await screen.findByText('考试档案')).toBeInTheDocument()
    expect(screen.queryByText('认证凭据')).not.toBeInTheDocument()
    expect(screen.queryByText('人脸凭据')).not.toBeInTheDocument()
    await user.keyboard('{Escape}')
    await user.click(within(dialog).getByLabelText('冻结范围'))
    expect(await screen.findAllByText('账号注销申请')).not.toHaveLength(0)
    expect(screen.queryByText('期限扫描')).not.toBeInTheDocument()
  })

  it('合法冻结网络不确定时保留原表单和冻结编号并用同一载荷重试', async () => {
    const user = userEvent.setup()
    let attempt = 0
    const createHold = vi.fn(async (payload: RetentionHoldPayload) => {
      attempt += 1
      if (attempt === 1) throw new Error('服务器无响应，请检查网络连接')
      return { holdId: payload.holdId }
    })
    const api = createApi({ createHold })
    renderPage(api)

    await user.click(await screen.findByRole('button', { name: '查看详情' }))
    await user.click(await screen.findByRole('button', { name: '创建合法冻结' }))
    const dialog = await screen.findByRole('dialog', { name: '创建合法冻结' })
    await user.click(within(dialog).getByLabelText('数据类别'))
    await user.click(await screen.findByText('考试档案'))
    await user.click(within(dialog).getByLabelText('冻结原因'))
    await user.click(await screen.findByText('法律争议'))
    await user.type(within(dialog).getByLabelText('法律依据或案件编号'), '案号 2026-08-31-01')
    await user.type(within(dialog).getByLabelText('冻结到期时间'), '2026-09-30T10:00')
    await user.click(within(dialog).getByRole('button', { name: '确认创建冻结' }))

    expect(await within(dialog).findByText(/结果尚未确认/)).toBeInTheDocument()
    const originalHoldId = String(createHold.mock.calls[0][0].holdId)
    await user.keyboard('{Escape}')
    expect(screen.getByRole('dialog', { name: '创建合法冻结' })).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: '使用同一操作重试' }))

    await waitFor(() => expect(createHold).toHaveBeenCalledTimes(2))
    expect(createHold.mock.calls[1][0]).toEqual(createHold.mock.calls[0][0])
    expect(createHold.mock.calls[1][0].holdId).toBe(originalHoldId)
  })

  it('未知删除模式失败关闭并禁止创建冻结', async () => {
    const unknownRequest = { ...request, mode: 'UNKNOWN' as const }
    const api = createApi({
      listRequests: vi.fn(async () => ({ items: [unknownRequest], limit: 50, offset: 0 })),
      getRequest: vi.fn(async () => unknownRequest),
    })
    const user = userEvent.setup()
    renderPage(api)
    expect(await screen.findByText('未知模式')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '查看详情' }))
    expect(await screen.findByRole('button', { name: '创建合法冻结' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: '人工重试' })).not.toBeInTheDocument()
  })

  it('未知父状态即使步骤需要人工处理也不显示重试', async () => {
    const unknownRequest = { ...request, status: 'FUTURE_STATUS' }
    const api = createApi({
      listRequests: vi.fn(async () => ({ items: [unknownRequest], limit: 50, offset: 0 })),
      getRequest: vi.fn(async () => unknownRequest),
    })
    const user = userEvent.setup()
    renderPage(api)
    await user.click(await screen.findByRole('button', { name: '查看详情' }))
    expect(await screen.findAllByText('未知状态')).not.toHaveLength(0)
    expect(screen.queryByRole('button', { name: '人工重试' })).not.toBeInTheDocument()
  })

  it('安全预演必须二次确认且只展示类别聚合数量', async () => {
    const api = createApi()
    const user = userEvent.setup()
    renderPage(api)

    await user.click(await screen.findByRole('button', { name: '安全预演' }))
    expect(api.dryRun).not.toHaveBeenCalled()
    expect(screen.getByText('预演只读取类别聚合数量，不执行删除、匿名化、冻结或状态变更。')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '确认并生成聚合预演' }))

    await waitFor(() => expect(api.dryRun).toHaveBeenCalledWith(request.requestId))
    expect(await screen.findByText('这里只展示类别聚合数量，不展示或恢复任何原始个人数据。')).toBeInTheDocument()
    expect(screen.getByText('用户内容')).toBeInTheDocument()
    expect(screen.getByText('删除 · 8')).toBeInTheDocument()
  })

  it('手机模式使用卡片队列且不产生横向表格', async () => {
    renderPage(createApi(), { mobile: true })
    expect(await screen.findByTestId('lifecycle-mobile-queue')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
})
