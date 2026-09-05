import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SinglePracticeView from './SinglePracticeView'
import BulkPracticeView from './BulkPracticeView'
const mocks = vi.hoisted(() => ({
  getQuestion: vi.fn(), getByIds: vi.fn(), grade: vi.fn(), explain: vi.fn(), record: vi.fn(),
  favorite: vi.fn(), favoriteIds: vi.fn(), add: vi.fn(), remove: vi.fn(),
  message: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}))
vi.mock('antd', async original => ({ ...await original<typeof import('antd')>(), App: { useApp: () => ({ message: mocks.message }) } }))
vi.mock('@/features/questions/practice/utils/practiceApi', () => ({ getQuestionById: mocks.getQuestion, isQuestionFavorited: mocks.favorite,
  getFavoriteQuestionIds: mocks.favoriteIds, addQuestionToFavorites: mocks.add, removeQuestionFromFavorites: mocks.remove }))
vi.mock('@/shared/api/http', () => ({ wrongQuestions: { recordPractice: mocks.record }, questionsApi: { getByIds: mocks.getByIds }, isSuccess: (r: { success: boolean }) => r.success }))
vi.mock('@/shared/api/endpoints/ai', () => ({ aiApi: { gradeShortAnswer: mocks.grade, explainQuestion: mocks.explain } }))
vi.mock('@/shared/utils/i18n', () => ({ translate: (key: string) => key }))
const multiple = { id: 1, content: '多选题一', question_type: 'multiple_choice', options: [{ content: '选项甲', is_correct: true }, { content: '选项乙', is_correct: true }] }
const short = { id: 2, content: '简答题二', question_type: 'short_answer', correct_answer: '参考答案' }

beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
  mocks.getQuestion.mockImplementation(async (id: string) => id === '1' ? multiple : short)
  mocks.getByIds.mockResolvedValue({ success: true, data: [multiple, short] })
  mocks.favorite.mockResolvedValue(false)
  mocks.favoriteIds.mockResolvedValue(new Set())
  mocks.record.mockResolvedValue({ success: true, data: null })
})

describe('练习触控与异步边界', () => {
  it('单题多选框每点击一次只切换一次', async () => {
    render(<SinglePracticeView ids={['1']} startIndex={0} onExit={vi.fn()} />)
    const option = await screen.findByRole('checkbox', { name: '选项甲' })
    fireEvent.click(option)
    expect(option).toBeChecked()
    fireEvent.click(option)
    expect(option).not.toBeChecked()
  })
  it.each(['single', 'bulk'])('%s 旧收藏查询不会覆盖刚完成的收藏', async mode => {
    let resolve!: (value: never) => void
    const pending = new Promise(r => { resolve = r })
    if (mode === 'single') mocks.favorite.mockReturnValue(pending)
    else mocks.favoriteIds.mockReturnValue(pending)
    render(mode === 'single'
      ? <SinglePracticeView ids={['1']} startIndex={0} onExit={vi.fn()} />
      : <BulkPracticeView ids={['1', '2']} onExit={vi.fn()} />)
    await screen.findByText('多选题一')
    fireEvent.click(screen.getAllByRole('button', { name: 'header.favorites' })[0])
    await screen.findByRole('button', { name: 'visible.2d2cdabf29' })
    await act(async () => resolve((mode === 'single' ? false : new Set(['2'])) as never))
    expect(screen.getAllByRole('button', { name: 'visible.2d2cdabf29' })).toHaveLength(mode === 'single' ? 1 : 2)
  })
  it('切到下一题后忽略上一题晚返回的 AI 评分', async () => {
    let resolve!: (value: unknown) => void
    mocks.grade.mockReturnValue(new Promise(r => { resolve = r }))
    render(<SinglePracticeView ids={['2', '1']} startIndex={0} onExit={vi.fn()} />)
    fireEvent.change(await screen.findByRole('textbox'), { target: { value: '我的解答' } })
    fireEvent.click(screen.getByRole('button', { name: 'exam.submit' }))
    fireEvent.click(screen.getByRole('button', { name: /exam.next/ }))
    await screen.findByText('多选题一')
    await act(async () => resolve({ success: true, data: { score: 8, max_score: 10 } }))
    expect(mocks.record).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'exam.submit' })).toBeDisabled()
    expect(screen.queryByText('auto.1cc7e9cace8/10')).toBeNull()
  })
  it('最后一题可以完成并返回列表，回调只触发一次', async () => {
    const exit = vi.fn()
    render(<SinglePracticeView ids={['1']} startIndex={0} onExit={exit} />)
    await screen.findByText('多选题一')
    fireEvent.click(screen.getByRole('button', { name: /exam.next/ }))
    expect(exit).toHaveBeenCalledTimes(1)
  })
  it('批量多选不重复切换；AI 失败不记错，重试成功后才记录', async () => {
    mocks.grade.mockResolvedValueOnce({ success: false, error: 'AI 暂不可用' }).mockResolvedValueOnce({ success: true, data: { score: 8, max_score: 10 } })
    render(<BulkPracticeView ids={['1', '2']} onExit={vi.fn()} />)
    const first = await screen.findByRole('checkbox', { name: '选项甲' })
    fireEvent.click(first)
    expect(first).toBeChecked()
    fireEvent.click(screen.getByRole('checkbox', { name: '选项乙' }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '我的解答' } })
    fireEvent.click(screen.getByRole('button', { name: /auto.fe82d08c17/ }))
    await screen.findByText(/AI 暂不可用。答案已保留/)
    expect(mocks.record).not.toHaveBeenCalled()
    expect(screen.getByRole('textbox')).toHaveValue('我的解答')
    fireEvent.click(screen.getByRole('button', { name: /auto.fe82d08c17/ }))
    await waitFor(() => expect(mocks.record).toHaveBeenCalledTimes(2))
    expect(mocks.record).toHaveBeenCalledWith({ question_id: 2, is_correct: true, answer: '我的解答' })
    expect(screen.getByRole('textbox')).toBeDisabled()
  })
  it('退出批量练习后晚返回的评分不会继续写练习记录', async () => {
    let resolve!: (value: unknown) => void
    mocks.grade.mockReturnValue(new Promise(r => { resolve = r }))
    const { unmount } = render(<BulkPracticeView ids={['1', '2']} onExit={vi.fn()} />)
    fireEvent.change(await screen.findByRole('textbox'), { target: { value: '我的解答' } })
    fireEvent.click(screen.getByRole('button', { name: /auto.fe82d08c17/ }))
    unmount()
    await act(async () => resolve({ success: true, data: { score: 8, max_score: 10 } }))
    expect(mocks.record).not.toHaveBeenCalled()
  })
})
