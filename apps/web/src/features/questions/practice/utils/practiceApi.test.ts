import { beforeEach, describe, expect, it, vi } from 'vitest'
import { addQuestionToFavorites, getQuestionById, isQuestionFavorited, removeQuestionFromFavorites } from './practiceApi'
const mocks = vi.hoisted(() => ({ api: { get: vi.fn() }, favorites: { list: vi.fn(), create: vi.fn(), items: vi.fn(), addItem: vi.fn(), removeItem: vi.fn() } }))
vi.mock('@/shared/api/http', () => ({ api: mocks.api, favoritesApi: mocks.favorites, isSuccess: (r: { success: boolean }) => r.success }))
vi.mock('@/shared/utils/i18n', () => ({ translate: (key: string) => key }))

describe('练习读取与收藏', () => {
  beforeEach(() => vi.resetAllMocks())
  it('读取收藏状态不创建收藏夹', async () => {
    mocks.favorites.list.mockResolvedValue([])
    await expect(isQuestionFavorited('3')).resolves.toBe(false)
    expect(mocks.favorites.create).not.toHaveBeenCalled()
  })
  it('明确收藏时创建收藏夹并调用添加条目接口', async () => {
    mocks.favorites.list.mockResolvedValue([])
    mocks.favorites.create.mockResolvedValue({ id: 7 })
    await addQuestionToFavorites('3', '题目')
    expect(mocks.favorites.addItem).toHaveBeenCalledWith(7, { question_id: 3, title: '题目' })
  })
  it('移除收藏按题目字段匹配，不误用条目 ID', async () => {
    mocks.favorites.list.mockResolvedValue([{ id: 7 }])
    mocks.favorites.items.mockResolvedValue([{ id: 3, question_id: 8 }, { id: 9, question_id: 3 }])
    await removeQuestionFromFavorites('3')
    expect(mocks.favorites.removeItem).toHaveBeenCalledWith(7, 9)
  })
  it('题目接口失败不渲染空白题', async () => {
    mocks.api.get.mockResolvedValue({ success: false, error: '题目不存在' })
    await expect(getQuestionById('3')).rejects.toThrow('题目不存在')
  })
})
