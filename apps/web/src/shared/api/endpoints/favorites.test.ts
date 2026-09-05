import { beforeEach, describe, expect, it, vi } from 'vitest'
import { favoritesApi } from './favorites'
const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), delete: vi.fn() }))
vi.mock('../core/httpClient', () => ({ api: mocks }))

describe('收藏接口失败传播', () => {
  beforeEach(() => vi.resetAllMocks())
  it('读取失败不会伪装为空收藏夹', async () => {
    mocks.get.mockResolvedValue({ success: false, error: '网络错误' })
    await expect(favoritesApi.list()).rejects.toThrow('网络错误')
  })
  it('新增与移除失败必须抛出错误', async () => {
    mocks.post.mockResolvedValue({ success: false, error: '未添加' })
    mocks.delete.mockResolvedValue({ success: false, error: '未移除' })
    await expect(favoritesApi.addItem(7, { question_id: 3 })).rejects.toThrow('未添加')
    await expect(favoritesApi.removeItem(7, 9)).rejects.toThrow('未移除')
  })
})
