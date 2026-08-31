import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { DeletionStatusCredentialStore } from '@/platform/account-deletion/deletionStatusCredential'
import type { AccountDeletionRequestPayload, DeletionPreview } from '@/shared/api/endpoints/accountDeletion'
import AccountDeletionRequestCard from './AccountDeletionRequestCard'

const preview: DeletionPreview = {
  status: 'NOT_REQUESTED',
  confirmationPhrase: '删除问衡账号',
  graceDays: 30,
  scheduledFor: '2026-09-30T08:00:00.000Z',
  deleteOrAnonymize: ['登录凭据与人脸特征', '个人资料与学习偏好'],
  conditionalRetention: ['考试档案依法去身份化限期保留'],
  disclaimer: '注销不可撤销，请确认数据范围。',
}

const accepted = {
  requestId: 'b132689c-4a5d-42a2-86c5-3661e62d4d1f',
  mode: 'IMMEDIATE' as const,
  dataRegion: 'CN' as const,
  status: 'SCHEDULED' as const,
  requestedAt: '2026-08-31T08:00:00.000Z',
  scheduledFor: '2026-08-31T08:00:00.000Z',
  startedAt: null,
  cancelledAt: null,
  completedAt: null,
  restrictedRetentionUntil: null,
  cancellable: false,
  steps: [],
}

const createMemoryStore = () => {
  let value: Awaited<ReturnType<DeletionStatusCredentialStore['read']>> = null
  return {
    store: {
      read: async () => value,
      write: async next => { value = next },
      clear: async () => { value = null },
    } satisfies DeletionStatusCredentialStore,
    read: () => value,
  }
}

describe('AccountDeletionRequestCard', () => {
  it('立即删除明确显示不可取消并在请求前保存固定凭证', async () => {
    const user = userEvent.setup()
    const memory = createMemoryStore()
    const requests: AccountDeletionRequestPayload[] = []
    const clearLoginSession = vi.fn(async () => undefined)
    render(
      <AccountDeletionRequestCard
        api={{
          preview: async () => ({ success: true, data: preview }),
          request: async payload => { requests.push(payload); return { success: true, data: accepted } },
        }}
        credentialStore={memory.store}
        clearLoginSession={clearLoginSession}
        createRequestId={() => accepted.requestId}
        createStatusToken={() => 'BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc'}
      />,
    )
    expect(await screen.findByText('考试档案依法去身份化限期保留')).toBeInTheDocument()
    await user.click(screen.getByLabelText('立即删除'))
    expect(screen.getByText('提交后立即进入不可逆阶段，不能取消。')).toBeInTheDocument()
    await user.type(screen.getByLabelText('当前密码'), 'correct-password')
    await user.type(screen.getByLabelText('确认词'), '删除问衡账号')
    await user.click(screen.getByRole('button', { name: '确认并冻结账号' }))

    await waitFor(() => expect(requests).toHaveLength(1))
    const submitted = requests[0]
    expect(submitted.mode).toBe('IMMEDIATE')
    expect(submitted.requestId).toMatch(/^[0-9a-f-]{36}$/)
    expect(submitted.statusToken).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(memory.read()).toEqual({ requestId: accepted.requestId, statusToken: submitted.statusToken })
    expect(clearLoginSession).toHaveBeenCalledOnce()
  })

  it('网络结果不确定时保留凭证并复用同一请求编号重试', async () => {
    const user = userEvent.setup()
    const memory = createMemoryStore()
    const requests: AccountDeletionRequestPayload[] = []
    render(
      <AccountDeletionRequestCard
        api={{
          preview: async () => ({ success: true, data: preview }),
          request: async payload => {
            requests.push(payload)
            return { success: false, error: '服务器无响应，请检查网络连接' }
          },
        }}
        credentialStore={memory.store}
        clearLoginSession={async () => undefined}
        createRequestId={() => accepted.requestId}
        createStatusToken={() => 'BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc'}
      />,
    )
    await screen.findByText('将删除或匿名化')
    await user.type(screen.getByLabelText('当前密码'), 'correct-password')
    await user.type(screen.getByLabelText('确认词'), '删除问衡账号')
    await user.click(screen.getByRole('button', { name: '确认并冻结账号' }))
    expect(await screen.findByText(/结果尚未确认/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '使用同一请求重试' }))
    await waitFor(() => expect(requests).toHaveLength(2))
    expect(requests[1]).toEqual(requests[0])
    expect(memory.read()?.requestId).toBe(accepted.requestId)
  })

  it('30 天模式明确显示可取消并提交宽限期语义', async () => {
    const user = userEvent.setup()
    const memory = createMemoryStore()
    const requests: AccountDeletionRequestPayload[] = []
    render(
      <AccountDeletionRequestCard
        api={{
          preview: async () => ({ success: true, data: preview }),
          request: async payload => {
            requests.push(payload)
            return {
              success: true,
              data: { ...accepted, mode: 'GRACE_PERIOD', cancellable: true },
            }
          },
        }}
        credentialStore={memory.store}
        clearLoginSession={async () => undefined}
        createRequestId={() => accepted.requestId}
        createStatusToken={() => 'BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc'}
      />,
    )
    await screen.findByText('将删除或匿名化')
    await user.click(screen.getByLabelText('30 天后删除'))
    expect(screen.getByText('提交后有 30 天宽限期，执行开始前可以取消。')).toBeInTheDocument()
    await user.type(screen.getByLabelText('当前密码'), 'correct-password')
    await user.type(screen.getByLabelText('确认词'), '删除问衡账号')
    await user.click(screen.getByRole('button', { name: '确认并冻结账号' }))
    await waitFor(() => expect(requests).toHaveLength(1))
    expect(requests[0].mode).toBe('GRACE_PERIOD')
  })

  it('明确四百段拒绝会清理预存凭证', async () => {
    const user = userEvent.setup()
    const memory = createMemoryStore()
    render(
      <AccountDeletionRequestCard
        api={{
          preview: async () => ({ success: true, data: preview }),
          request: async () => ({ success: false, error: '邮箱或密码错误', status: 401, code: 'AUTH_BAD_CREDENTIALS' }),
        }}
        credentialStore={memory.store}
        clearLoginSession={async () => undefined}
        createRequestId={() => accepted.requestId}
        createStatusToken={() => 'BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc'}
      />,
    )
    await screen.findByText('将删除或匿名化')
    await user.type(screen.getByLabelText('当前密码'), 'wrong-password')
    await user.type(screen.getByLabelText('确认词'), '删除问衡账号')
    await user.click(screen.getByRole('button', { name: '确认并冻结账号' }))
    expect(await screen.findByText('邮箱或密码错误')).toBeInTheDocument()
    expect(memory.read()).toBeNull()
  })
})
