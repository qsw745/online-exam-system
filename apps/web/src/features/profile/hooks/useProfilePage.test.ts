import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useProfilePage } from './useProfilePage'
const mocks = vi.hoisted(() => ({
  user: { id: '21', nickname: '原昵称', email: 'student@example.com', role: 'student' },
  get: vi.fn(), update: vi.fn(), upload: vi.fn(), apply: vi.fn(), success: vi.fn(), error: vi.fn(),
}))
vi.mock('@/shared/contexts/AuthContext', () => ({ useAuth: () => ({ user: mocks.user, applyProfile: mocks.apply }) }))
vi.mock('@/shared/contexts/LanguageContext', () => ({ useLanguage: () => ({ t: (key: string) => key }) }))
vi.mock('antd', () => ({ App: { useApp: () => ({ message: { success: mocks.success, error: mocks.error } }) } }))
vi.mock('@/shared/api/endpoints/profile', () => ({ profileApi: { get: mocks.get, update: mocks.update, uploadAvatar: mocks.upload } }))
vi.mock('../utils/avatar', () => ({ getAbsoluteAvatarUrl: (value: string) => value, revokeObjectUrl: vi.fn() }))
const profile = { nickname: '学生', email: 'student@example.com', phone: '123456', bio: '旧签名', school: '学校', class_name: '一班' }
const ok = (data: unknown) => ({ success: true, data })
beforeEach(() => {
  vi.resetAllMocks()
  mocks.user.id = '21'
  mocks.get.mockResolvedValue(ok(profile))
  mocks.update.mockResolvedValue(ok(profile))
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:preview') })
})
describe('个人资料保存边界', () => {
  it('保存失败不会继续上传头像或提示成功，草稿保留', async () => {
    mocks.update.mockResolvedValue({ success: false, error: '邮箱已被占用' })
    const { result } = renderHook(() => useProfilePage())
    await waitFor(() => expect(result.current.initialLoading).toBe(false))
    act(() => { result.current.setForm({ nickname: '新昵称' }); result.current.onAvatarPick(new File(['image'], 'photo.png', { type: 'image/png' })) })
    await act(async () => { await result.current.submit() })
    expect(result.current.saveError).toBe('邮箱已被占用')
    expect(result.current.form.nickname).toBe('新昵称')
    expect(mocks.upload).not.toHaveBeenCalled()
    expect(mocks.success).not.toHaveBeenCalled()
  })
  it('头像失败准确区分已保存的资料，并保留图片供重试', async () => {
    mocks.upload.mockResolvedValue({ success: false, error: '上传中断' })
    const { result } = renderHook(() => useProfilePage())
    await waitFor(() => expect(result.current.initialLoading).toBe(false))
    act(() => result.current.onAvatarPick(new File(['image'], 'photo.png', { type: 'image/png' })))
    await act(async () => { await result.current.submit() })
    expect(result.current.saveError).toContain('个人资料已保存，头像尚未保存')
    expect(result.current.avatarSrc).toBe('blob:preview')
    expect(mocks.apply).toHaveBeenCalledTimes(1)
    mocks.upload.mockResolvedValue(ok({ avatar: '/api/uploads/avatars/saved.png' }))
    await act(async () => { await result.current.submit() })
    expect(result.current.saveError).toBeNull()
    expect(result.current.avatarSrc).toBe('/api/uploads/avatars/saved.png')
    expect(mocks.success).toHaveBeenCalledTimes(1)
  })
  it('可选字段可以清空，连续保存只发送一次', async () => {
    let resolve!: (value: unknown) => void
    mocks.update.mockReturnValue(new Promise(r => { resolve = r }))
    const { result } = renderHook(() => useProfilePage())
    await waitFor(() => expect(result.current.initialLoading).toBe(false))
    act(() => result.current.setForm({ phone: '', bio: '', school: '', class_name: '' }))
    act(() => { void result.current.submit(); void result.current.submit() })
    expect(mocks.update).toHaveBeenCalledTimes(1)
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ phone: '', bio: '', school: '', class_name: '' }))
    await act(async () => resolve(ok({ ...profile, phone: '', bio: '', school: '', class_name: '' })))
  })
  it('晚返回的资料不会覆盖已输入的字段；退出后不继续上传', async () => {
    let read!: (value: unknown) => void
    mocks.get.mockReturnValue(new Promise(r => { read = r }))
    const { result, unmount } = renderHook(() => useProfilePage())
    act(() => result.current.setForm({ nickname: '已输入' }))
    await act(async () => read(ok(profile)))
    expect(result.current.form.nickname).toBe('已输入')
    let save!: (value: unknown) => void
    mocks.update.mockReturnValue(new Promise(r => { save = r }))
    act(() => result.current.onAvatarPick(new File(['image'], 'photo.png', { type: 'image/png' })))
    act(() => { void result.current.submit() })
    unmount()
    await act(async () => save(ok(profile)))
    expect(mocks.upload).not.toHaveBeenCalled()
    expect(mocks.apply).not.toHaveBeenCalled()
  })
  it('加载失败可重试，失败时禁止保存默认资料', async () => {
    mocks.get.mockResolvedValueOnce({ success: false, error: '加载中断' })
    const { result } = renderHook(() => useProfilePage())
    await waitFor(() => expect(result.current.error).toBe('加载中断'))
    await act(async () => { await result.current.submit() })
    expect(mocks.update).not.toHaveBeenCalled()
    act(() => result.current.retry())
    await waitFor(() => expect(result.current.form.nickname).toBe('学生'))
    expect(result.current.error).toBeNull()
  })
})
