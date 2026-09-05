import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useResetPassword } from './useResetPassword'
import { useForgotPassword } from './useForgotPassword'
const mocks = vi.hoisted(() => ({ validate: vi.fn(), reset: vi.fn(), forgot: vi.fn(), navigate: vi.fn(), message: { error: vi.fn() } }))
vi.mock('@/shared/api/endpoints/auth', () => ({ validateResetToken: mocks.validate, resetPassword: mocks.reset }))
vi.mock('@/shared/api/http', () => ({ forgotPassword: mocks.forgot }))
vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.navigate }))
vi.mock('antd', () => ({ App: { useApp: () => ({ message: mocks.message }) } }))
vi.mock('@/shared/utils/i18n', () => ({ translate: (value: string) => value }))
const values = { password: 'Example-123', confirmPassword: 'Example-123' }

describe('密码恢复流程', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.useRealTimers())
  it('连续点击只发送一次邮件请求，失败后可以重试', async () => {
    let resolve!: (value: unknown) => void
    mocks.forgot.mockReturnValueOnce(new Promise(r => { resolve = r })).mockResolvedValueOnce({ success: true })
    const { result } = renderHook(() => useForgotPassword())
    act(() => { void result.current.submit(' test@example.com '); void result.current.submit('test@example.com') })
    expect(mocks.forgot).toHaveBeenCalledTimes(1)
    expect(mocks.forgot).toHaveBeenCalledWith('test@example.com')
    await act(async () => resolve({ success: false, error: '网络异常' }))
    await act(async () => { await result.current.submit('test@example.com') })
    expect(result.current.success).toBe(true)
  })
  it('未经验证的链接不能提交密码', async () => {
    mocks.validate.mockResolvedValue({ success: true, data: { valid: false } })
    const { result } = renderHook(() => useResetPassword('a'.repeat(64)))
    await waitFor(() => expect(result.current.status).toBe('invalid'))
    await act(async () => { await result.current.submit(values) })
    expect(mocks.reset).not.toHaveBeenCalled()
  })
  it('防重复重置，成功后倒计时只跳转一次', async () => {
    mocks.validate.mockResolvedValue({ success: true, data: { valid: true } })
    let resolve!: (value: unknown) => void
    mocks.reset.mockReturnValue(new Promise(r => { resolve = r }))
    const { result } = renderHook(() => useResetPassword('a'.repeat(64)))
    await waitFor(() => expect(result.current.status).toBe('form'))
    vi.useFakeTimers()
    act(() => { void result.current.submit(values); void result.current.submit(values) })
    expect(mocks.reset).toHaveBeenCalledTimes(1)
    await act(async () => resolve({ success: true }))
    for (let i = 0; i < 3; i++) await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
    expect(mocks.navigate).toHaveBeenCalledTimes(1)
    expect(mocks.navigate).toHaveBeenCalledWith('/login', { replace: true })
  })
  it('旧令牌的重置响应不污染新链接', async () => {
    mocks.validate.mockResolvedValue({ success: true, data: { valid: true } })
    let resolve!: (value: unknown) => void
    mocks.reset.mockReturnValue(new Promise(r => { resolve = r }))
    const { result, rerender } = renderHook(({ token }) => useResetPassword(token), { initialProps: { token: 'a'.repeat(64) } })
    await waitFor(() => expect(result.current.status).toBe('form'))
    act(() => { void result.current.submit(values) })
    rerender({ token: 'b'.repeat(64) })
    await waitFor(() => expect(result.current.status).toBe('form'))
    await act(async () => resolve({ success: true }))
    expect(result.current.success).toBe(false)
  })
})
