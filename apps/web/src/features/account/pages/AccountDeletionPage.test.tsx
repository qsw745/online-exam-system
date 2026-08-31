import { App as AntApp } from 'antd'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import type { DeletionStatusCredentialStore } from '@/platform/account-deletion/deletionStatusCredential'
import type { AccountDeletionApi, DeletionStatus } from '@/shared/api/endpoints/accountDeletion'
import AccountDeletionPage from './AccountDeletionPage'

const credential = {
  requestId: 'b132689c-4a5d-42a2-86c5-3661e62d4d1f',
  statusToken: 'BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc',
}

const scheduled: Exclude<DeletionStatus, { status: 'NOT_REQUESTED' }> = {
  requestId: credential.requestId,
  mode: 'GRACE_PERIOD',
  dataRegion: 'CN',
  status: 'SCHEDULED',
  requestedAt: '2026-08-31T08:00:00.000Z',
  scheduledFor: '2026-09-30T08:00:00.000Z',
  startedAt: null,
  cancelledAt: null,
  completedAt: null,
  restrictedRetentionUntil: null,
  cancellable: true,
  steps: [
    {
      stepCode: 'identity',
      category: '身份与登录',
      action: 'DELETE',
      status: 'PENDING',
      plannedCount: 3,
      processedCount: 0,
      attemptCount: 0,
      lastErrorCode: null,
    },
  ],
}

const createStore = (initial: typeof credential | null) => {
  let value = initial
  return {
    store: {
      read: async () => value,
      write: async next => { value = next },
      clear: vi.fn(async () => { value = null }),
    } satisfies DeletionStatusCredentialStore,
    read: () => value,
  }
}

const LocationProbe = () => {
  const location = useLocation()
  return <div data-testid="location">{location.pathname}</div>
}

const renderPage = ({
  api,
  store,
}: {
  api: Pick<AccountDeletionApi, 'status' | 'cancel'>
  store: DeletionStatusCredentialStore
}) => render(
  <AntApp>
    <MemoryRouter initialEntries={['/account-deletion']}>
      <Routes>
        <Route path="*" element={<><AccountDeletionPage api={api} credentialStore={store} /><LocationProbe /></>} />
      </Routes>
    </MemoryRouter>
  </AntApp>,
)

describe('AccountDeletionPage', () => {
  it('存在本机凭证时自动恢复状态且不要求再次输入邮箱密码', async () => {
    const memory = createStore(credential)
    const status = vi.fn(async () => ({ success: true as const, data: scheduled }))
    renderPage({
      api: { status, cancel: vi.fn() },
      store: memory.store,
    })

    expect(await screen.findByText('已安排，等待宽限期结束')).toBeInTheDocument()
    expect(status).toHaveBeenCalledWith(credential)
    expect(screen.queryByLabelText('账号邮箱')).not.toBeInTheDocument()
    expect(screen.getByText('身份与登录')).toBeInTheDocument()
  })

  it('没有本机凭证时提供邮箱和密码恢复查询', async () => {
    const memory = createStore(null)
    renderPage({
      api: { status: vi.fn(), cancel: vi.fn() },
      store: memory.store,
    })

    expect(await screen.findByText('恢复注销进度')).toBeInTheDocument()
    expect(screen.getByLabelText('账号邮箱')).toBeInTheDocument()
    expect(screen.getByLabelText('账号密码')).toBeInTheDocument()
  })

  it('仅可取消的宽限期申请显示二次验证并在成功后清凭证返回登录', async () => {
    const user = userEvent.setup()
    const memory = createStore(credential)
    const cancel = vi.fn(async () => ({
      success: true as const,
      data: { ...scheduled, status: 'CANCELLED' as const, cancellable: false, cancelledAt: '2026-09-01T08:00:00.000Z' },
    }))
    renderPage({
      api: {
        status: async () => ({ success: true, data: scheduled }),
        cancel,
      },
      store: memory.store,
    })

    await user.click(await screen.findByRole('button', { name: '取消注销申请' }))
    await user.type(screen.getByLabelText('账号邮箱'), 'member@example.com')
    await user.type(screen.getByLabelText('账号密码'), 'correct-password')
    await user.click(screen.getByRole('button', { name: '验证并取消申请' }))

    await waitFor(() => expect(cancel).toHaveBeenCalledWith({
      email: 'member@example.com',
      password: 'correct-password',
    }))
    expect(memory.store.clear).toHaveBeenCalledOnce()
    expect(screen.getByTestId('location')).toHaveTextContent('/login')
  })

  it('完成但依法限期保留时明确说明受限数据不再用于产品功能', async () => {
    const restricted: Exclude<DeletionStatus, { status: 'NOT_REQUESTED' }> = {
      ...scheduled,
      status: 'COMPLETED_WITH_RESTRICTED_RETENTION',
      cancellable: false,
      completedAt: '2026-09-01T08:00:00.000Z',
      restrictedRetentionUntil: '2029-09-01T08:00:00.000Z',
    }
    renderPage({
      api: {
        status: async () => ({ success: true, data: restricted }),
        cancel: vi.fn(),
      },
      store: createStore(credential).store,
    })

    expect(await screen.findByText('注销已完成，存在依法限期保留数据')).toBeInTheDocument()
    expect(screen.getByText(/仅用于法定义务与争议处理，不再用于登录、推荐、营销或产品分析/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '取消注销申请' })).not.toBeInTheDocument()
  })
})
