export type PracticeQuestion = {
  id: string | number
  content: string
  question_type: 'single_choice' | 'multiple_choice' | 'true_false' | 'short_answer' | string
  options?: Array<{ content: string; is_correct: boolean }>
  correct_answer?: number[] | string
  explanation?: string
  difficulty?: string
  knowledge_points?: string[]
}

function parseValue(value: unknown): unknown {
  if (typeof value !== 'string') return value
  try { return JSON.parse(value) } catch { return value }
}

export function normalizePracticeQuestion(raw: any): PracticeQuestion {
  const q = raw?.question ?? raw
  if (!q || !/^[1-9]\d*$/.test(String(q.id)) || typeof q.content !== 'string') {
    throw new Error('题目数据不完整，请重试')
  }
  const type = q.question_type ?? q.type
  const answer = parseValue(q.correct_answer)
  const rawOptions = parseValue(q.options)
  let options = Array.isArray(rawOptions) ? rawOptions.map(option => ({
    content: typeof option === 'string' ? option : String(option?.content ?? option?.text ?? ''),
    is_correct: option?.is_correct === true || option?.is_correct === 1 || option?.is_correct === 'true' || option?.is_correct === '1',
  })) : []
  let correctAnswer = q.correct_answer
  if (type === 'true_false') {
    if (answer === true || answer === 'true' || (Array.isArray(answer) && Number(answer[0]) === 0)) correctAnswer = 'true'
    else if (answer === false || answer === 'false' || (Array.isArray(answer) && Number(answer[0]) === 1)) correctAnswer = 'false'
    else throw new Error('判断题答案不完整，请联系老师检查题目')
  } else if (type === 'single_choice' || type === 'multiple_choice') {
    if (answer != null && answer !== '') {
      const values = Array.isArray(answer) ? answer : String(answer).split(',')
      const correct = values.map(value => /^[A-Za-z]$/.test(String(value).trim())
        ? String(value).trim().toUpperCase().charCodeAt(0) - 65 : Number(value))
      options = options.map((option, index) => ({ ...option, is_correct: correct.includes(index) }))
    }
    if (!options.length || !options.some(option => option.is_correct)) throw new Error('选项或答案不完整，请联系老师检查题目')
  } else if (type !== 'short_answer') {
    throw new Error('暂不支持此题型，请联系老师检查题目')
  }
  return { ...q, question_type: type, options, correct_answer: correctAnswer }
}

export function judgePracticeQuestion(q: PracticeQuestion, selected: number[], aiCorrect?: boolean): boolean {
  if (q.question_type === 'short_answer') return aiCorrect === true
  if (q.question_type === 'true_false') return selected.length === 1 && selected[0] === (q.correct_answer === 'true' ? 0 : 1)
  const correct = q.options?.flatMap((option, index) => option.is_correct ? [index] : []) ?? []
  return correct.length > 0 && selected.length === correct.length && selected.every(index => correct.includes(index))
}

export function parsePracticeGrade(data: any, defaultMaxScore = 10) {
  const rawScore = data?.score
  const rawMax = data?.max_score ?? defaultMaxScore
  const score = Number(rawScore)
  const maxScore = Number(rawMax)
  if (rawScore == null || rawScore === '' || !Number.isFinite(score) || !Number.isFinite(maxScore) || maxScore <= 0 || score < 0 || score > maxScore) {
    throw new Error('AI 评分数据不完整，请重试评分')
  }
  return { score, maxScore, feedback: typeof data.feedback === 'string' ? data.feedback : undefined }
}
