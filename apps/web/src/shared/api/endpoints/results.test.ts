import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resultsApi } from './results'
const mock = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('../core/httpClient', () => ({ api: mock }))

describe('成绩详情数据边界', () => {
  beforeEach(() => vi.clearAllMocks())
  it('失败信封不能作为成绩渲染', async () => {
    mock.get.mockResolvedValue({ success: false, error: '成绩尚未发布' })
    await expect(resultsApi.getDetail(700)).rejects.toThrow('成绩尚未发布')
  })
  it.each([{}, { id: 700 }, { id: 700, questions: {} }])('拒绝结构不完整的成绩', async data => {
    mock.get.mockResolvedValue({ success: true, data })
    await expect(resultsApi.getDetail(700)).rejects.toThrow('成绩数据不完整')
  })
  it('保留有效成绩及零道明细', async () => {
    const data = { id: 700, exam_id: 8, score: 0, questions: [] }
    mock.get.mockResolvedValue({ success: true, data })
    await expect(resultsApi.getDetail(700)).resolves.toEqual(data)
  })
})
