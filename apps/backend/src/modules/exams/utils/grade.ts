/* eslint-disable @typescript-eslint/no-explicit-any */
// 客观题统一判分：兼容多种存储/提交格式。
// 题库标准答案可能是：选项内容 JSON 数组（AI 生成题）、单个内容字符串、字母、对/错；
// 前端提交可能是：选项字母（"A"/"A,B"）、选项内容、数组。全部归一化成"选项内容集合"再比较。

export type GradableQuestion = {
  question_type?: string | null
  correct_answer?: string | null
  options?: unknown
}

type OptionItem = { content: string; is_correct?: boolean }

const TRUE_WORDS = new Set(['true', 't', '对', '正确', '√', '是', 'yes', 'y'])
const FALSE_WORDS = new Set(['false', 'f', '错', '错误', '×', 'x', '否', 'no', 'n'])

function parseOptions(raw: unknown): OptionItem[] {
  let val: any = raw
  if (typeof val === 'string') {
    try {
      val = JSON.parse(val)
    } catch {
      return []
    }
  }
  if (!Array.isArray(val)) return []
  return val
    .map((item: any) => {
      if (item == null) return null
      if (typeof item === 'string') return { content: item.trim() }
      const content = String(item.content ?? item.label ?? item.text ?? '').trim()
      if (!content) return null
      return { content, is_correct: item.is_correct === true || item.isCorrect === true }
    })
    .filter(Boolean) as OptionItem[]
}

const norm = (s: unknown) => String(s ?? '').trim()
const letterIndex = (token: string): number => {
  if (!/^[A-Za-z]$/.test(token)) return -1
  return token.toUpperCase().charCodeAt(0) - 65
}

/** 把一个 token（字母/内容）归一化为选项内容；无法匹配时原样返回 */
function tokenToContent(token: string, options: OptionItem[]): string {
  const t = norm(token)
  if (!t) return t
  const idx = letterIndex(t)
  if (idx >= 0 && idx < options.length) return options[idx].content
  const hit = options.find(o => o.content === t)
  return hit ? hit.content : t
}

/** 把答案（字符串/数组）拆成 token 集合 */
function toTokens(raw: unknown): string[] {
  if (raw == null) return []
  if (Array.isArray(raw)) return raw.map(norm).filter(Boolean)
  const s = norm(raw)
  if (!s) return []
  // JSON 数组字符串
  if (s.startsWith('[')) {
    try {
      const arr = JSON.parse(s)
      if (Array.isArray(arr)) return arr.map(norm).filter(Boolean)
    } catch {}
  }
  // 连续大写字母（"AB"、"ACD"）视为多个字母
  if (/^[A-Z]{2,6}$/.test(s)) return s.split('')
  return s.split(/[,，;；、\s]+/).filter(Boolean)
}

function normalizeBool(token: string): string | null {
  const t = norm(token).toLowerCase()
  if (TRUE_WORDS.has(t)) return 'true'
  if (FALSE_WORDS.has(t)) return 'false'
  return null
}

export function isAnswerCorrect(question: GradableQuestion, userAnswer: unknown): boolean {
  const type = norm(question.question_type).toLowerCase()
  const options = parseOptions(question.options)

  // 判断题：双方都归一化成 true/false（字母 A/B 按第一/第二个选项映射）
  if (type === 'true_false' || type === 'judge') {
    const uaTokens = toTokens(userAnswer)
    if (!uaTokens.length) return false
    const uaMapped = tokenToContent(uaTokens[0], options)
    const ua = normalizeBool(uaMapped) ?? normalizeBool(uaTokens[0])
    const caTokens = toTokens(question.correct_answer)
    const ca = caTokens.length ? (normalizeBool(tokenToContent(caTokens[0], options)) ?? normalizeBool(caTokens[0])) : null
    return ua != null && ca != null && ua === ca
  }

  // 选择题：归一化成"选项内容集合"后比较（多选要求集合完全一致）
  if (type === 'single_choice' || type === 'multiple_choice' || options.length > 0) {
    // 标准答案集合：优先 options 里的 is_correct 标记，其次 correct_answer
    let correctSet = new Set(options.filter(o => o.is_correct).map(o => o.content))
    if (!correctSet.size) {
      correctSet = new Set(toTokens(question.correct_answer).map(tk => tokenToContent(tk, options)))
    }
    const userSet = new Set(toTokens(userAnswer).map(tk => tokenToContent(tk, options)))
    if (!correctSet.size || !userSet.size) return false
    if (type === 'single_choice') {
      return userSet.size === 1 && correctSet.has([...userSet][0])
    }
    if (userSet.size !== correctSet.size) return false
    for (const v of userSet) if (!correctSet.has(v)) return false
    return true
  }

  // 填空题：忽略首尾空白与大小写的精确匹配（多空按顺序逐一比对）
  if (type === 'fill_blank' || type === 'fill') {
    const ua = toTokens(userAnswer).map(s => s.toLowerCase())
    const ca = toTokens(question.correct_answer).map(s => s.toLowerCase())
    return ca.length > 0 && ua.length === ca.length && ca.every((v, i) => ua[i] === v)
  }

  // 简答题无法自动精确判分：退化为非空且与参考答案完全一致才得分（后续可接 AI 判分）
  return norm(userAnswer) !== '' && norm(userAnswer) === norm(question.correct_answer)
}
