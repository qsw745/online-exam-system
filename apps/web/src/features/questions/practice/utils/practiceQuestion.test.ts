import { describe, expect, it } from 'vitest'
import { judgePracticeQuestion, normalizePracticeQuestion, parsePracticeGrade } from './practiceQuestion'

describe('练习题与评分数据', () => {
  it.each([[true, 0], [false, 1], ['[0]', 0], ['[1]', 1], ['true', 0], ['false', 1]])('判断题答案 %s 正确归一', (answer, selected) => {
    const question = normalizePracticeQuestion({ id: 1, content: '判断题', question_type: 'true_false', correct_answer: answer })
    expect(judgePracticeQuestion(question, [selected as number])).toBe(true)
  })
  it('JSON 选项和字母答案不会丢失，字符串 false 不算正确选项', () => {
    const question = normalizePracticeQuestion({ id: 1, content: '多选题', question_type: 'multiple_choice',
      options: JSON.stringify([{ content: 'A', is_correct: 'false' }, { content: 'B', is_correct: 'false' }]), correct_answer: 'A,B' })
    expect(judgePracticeQuestion(question, [0, 1])).toBe(true)
    expect(judgePracticeQuestion(question, [0])).toBe(false)
    expect(judgePracticeQuestion(question, [])).toBe(false)
  })
  it.each([{}, { id: 1 }, { id: 1, content: '空选项', question_type: 'single_choice', options: [] }])('不完整题目不能作为答错记录', data => {
    expect(() => normalizePracticeQuestion(data)).toThrow()
  })
  it.each([{ score: null }, {}, { score: 10, max_score: 0 }, { score: -1 }, { score: 11, max_score: 10 }])('不完整 AI 评分必须失败', grade => {
    expect(() => parsePracticeGrade(grade)).toThrow('评分数据不完整')
  })
  it('保留有效的零分', () => expect(parsePracticeGrade({ score: 0, max_score: 10 })).toEqual({ score: 0, maxScore: 10, feedback: undefined }))
})
