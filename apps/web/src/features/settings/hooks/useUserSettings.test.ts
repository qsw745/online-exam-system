import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { normalizeUserSettings, useUserSettings } from './useUserSettings'
const mocks = vi.hoisted(() => ({ user: { id: '21' }, get: vi.fn(), post: vi.fn(), setLanguage: vi.fn(), success: vi.fn() }))
vi.mock('@/shared/contexts/AuthContext', () => ({ useAuth: () => ({ user: mocks.user }) }))
vi.mock('@/shared/contexts/LanguageContext', () => ({ useLanguage: () => ({ language: 'zh-CN', setLanguage: mocks.setLanguage, t: (key: string) => key }) }))
vi.mock('@/shared/api/http', () => ({ api: { get: mocks.get, post: mocks.post } }))
vi.mock('antd', () => ({ App: { useApp: () => ({ message: { success: mocks.success } }) } }))
beforeEach(() => { vi.resetAllMocks(); mocks.user.id = '21'; mocks.get.mockResolvedValue({ success: true, data: {} }) })
describe('用户设置边界', () => {
  it('部分或空配置补齐嵌套字段，保留其他设置，不把字符串 0 当成开启', () => {
    expect(normalizeUserSettings({ notifications: { email: '0' }, privacy: null, appearance: null, security: { phone: '123' } }, 'en-US')).toEqual({
      notifications: { email: false, push: true, sound: true }, privacy: { profile_visibility: 'public', show_activity: true, show_results: true },
      appearance: { language: 'en-US' }, security: { phone: '123' },
    })
  })
  it('加载失败不应用默认语言或允许覆盖服务端设置，重试可恢复', async () => {
    mocks.get.mockResolvedValueOnce({ success: false, error: '读取失败' })
    const { result } = renderHook(() => useUserSettings())
    await waitFor(() => expect(result.current.error).toBe('读取失败'))
    await act(async () => { await result.current.save() })
    expect(mocks.post).not.toHaveBeenCalled()
    expect(mocks.setLanguage).not.toHaveBeenCalled()
    act(() => result.current.retry())
    await waitFor(() => expect(result.current.initialLoading).toBe(false))
    expect(result.current.error).toBeNull()
  })
  it('保存失败不抛出未处理拒绝，保留修改并允许重试', async () => {
    mocks.post.mockResolvedValueOnce({ success: false, error: '保存中断' }).mockResolvedValueOnce({ success: true, data: {} })
    const { result } = renderHook(() => useUserSettings())
    await waitFor(() => expect(result.current.initialLoading).toBe(false))
    act(() => result.current.setSettings(s => ({ ...s, notifications: { ...s.notifications, email: false } })))
    await act(async () => { await result.current.save() })
    expect(result.current.saveError).toBe('保存中断')
    expect(result.current.isDirty).toBe(true)
    expect(mocks.success).not.toHaveBeenCalled()
    await act(async () => { await result.current.save() })
    expect(result.current.isDirty).toBe(false)
  })
  it('连续点击只保存一次，保存中后续修改仍保持待保存', async () => {
    let resolve!: (value: unknown) => void
    mocks.post.mockReturnValue(new Promise(r => { resolve = r }))
    const { result } = renderHook(() => useUserSettings())
    await waitFor(() => expect(result.current.initialLoading).toBe(false))
    act(() => result.current.setSettings(s => ({ ...s, notifications: { ...s.notifications, email: false } })))
    act(() => { void result.current.save(); void result.current.save() })
    expect(mocks.post).toHaveBeenCalledTimes(1)
    act(() => result.current.setSettings(s => ({ ...s, notifications: { ...s.notifications, push: false } })))
    await act(async () => resolve({ success: true, data: {} }))
    expect(result.current.isDirty).toBe(true)
    expect(result.current.settings.notifications.push).toBe(false)
  })
})
