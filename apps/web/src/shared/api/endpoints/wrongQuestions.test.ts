import { beforeEach, expect, it, vi } from 'vitest'
import { wrongQuestions } from './wrongQuestions'

const mocks = vi.hoisted(() => ({ post: vi.fn(), get: vi.fn() }))
vi.mock('../core/httpClient', () => ({ api: mocks }))
beforeEach(() => vi.clearAllMocks())

it('普通答题使用包含总练习记录的接口，正确答案不会被直接加入错题本', async () => {
  const payload = { question_id: 7, is_correct: true, answer: [0] }
  await wrongQuestions.recordPractice(payload)
  expect(mocks.post).toHaveBeenCalledWith('/questions/practice', payload)
})

it('已练习筛选读取全部练习，指定错题时保留错题练习查询', async () => {
  await wrongQuestions.getPracticedQuestions()
  expect(mocks.get).toHaveBeenCalledWith('/questions/practiced-questions')
  await wrongQuestions.getPracticedQuestions(9)
  expect(mocks.post).toHaveBeenCalledWith('/wrong-questions/practiced', { wrong_question_id: 9 })
})
