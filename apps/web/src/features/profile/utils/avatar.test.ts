import { describe, expect, it, vi } from 'vitest'
import { getAbsoluteAvatarUrl } from './avatar'
vi.mock('@/shared/api/core/httpClient', () => ({ getCurrentApiUrl: () => 'https://cn.example.com/api' }))
describe('头像服务地址', () => {
  it('使用当前数据区的 API origin，不重复拼接 api 路径', () => {
    expect(getAbsoluteAvatarUrl('/api/uploads/avatars/photo.png')).toBe('https://cn.example.com/api/uploads/avatars/photo.png')
    expect(getAbsoluteAvatarUrl('/api/uploads/avatars/photo.png', 'https://global.example.com/api')).toBe('https://global.example.com/api/uploads/avatars/photo.png')
  })
  it('相对资源地址与开发代理路径均可解析', () => {
    expect(getAbsoluteAvatarUrl('uploads/avatars/photo.png', 'https://example.com/api/')).toBe('https://example.com/api/uploads/avatars/photo.png')
    expect(getAbsoluteAvatarUrl('/api/uploads/avatars/photo.png', '/api')).toBe(`${window.location.origin}/api/uploads/avatars/photo.png`)
  })
  it('保留本地预览和完整 URL', () => {
    expect(getAbsoluteAvatarUrl('blob:preview')).toBe('blob:preview')
    expect(getAbsoluteAvatarUrl('https://images.example.com/photo.png')).toBe('https://images.example.com/photo.png')
    expect(getAbsoluteAvatarUrl('')).toBe('')
  })
})
