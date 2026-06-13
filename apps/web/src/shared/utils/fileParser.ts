// src/shared/utils/fileParser.ts
import Papa from 'papaparse'
import { readSheet } from 'read-excel-file/browser'
import { ensureArrayFromMaybeCsv } from './q-helpers'

// 供 Import/Export 直接复用表头
export { buildExportHeaders } from './q-helpers'

export interface ParsedQuestion {
  title?: string
  content: string
  question_type: 'single_choice' | 'multiple_choice' | 'true_false' | 'short_answer'
  options?: { content: string; is_correct: boolean }[]
  correct_answer?: string
  answer?: string
  knowledge_points?: string[] | string
  tags?: string[] | string
  explanation?: string
  difficulty?: 'easy' | 'medium' | 'hard'
  score?: number
  correct_answers?: string[]
}

export interface ParseResult {
  success: boolean
  data?: ParsedQuestion[]
  errors?: string[]
  total?: number
}

const BOM = '\ufeff'
const normalizeKey = (k: unknown) =>
  String(k ?? '')
    .replace(BOM, '')
    .replace(/\s+/g, '')
    .replace(/[（）()]/g, '')
    .toLowerCase()

/** 表头别名（规范化后） -> 标准字段 */
const ALIAS_ENTRIES: Array<[string, string]> = [
  ['题目标题', 'title'],
  ['标题', 'title'],
  ['title', 'title'],

  ['题目内容', 'content'],
  ['内容', 'content'],
  ['question', 'content'],
  ['content', 'content'],

  ['题目类型', 'question_type'],
  ['类型', 'question_type'],
  ['type', 'question_type'],
  ['question_type', 'question_type'],

  ['难度等级', 'difficulty'],
  ['难度', 'difficulty'],
  ['difficulty', 'difficulty'],

  ['分值', 'score'],
  ['分数', 'score'],
  ['score', 'score'],

  ['知识点', 'knowledge_points'],
  ['知識點', 'knowledge_points'],
  ['knowledge points', 'knowledge_points'],
  ['knowledgepoints', 'knowledge_points'],
  ['knowledge_points', 'knowledge_points'],

  ['标签', 'tags'],
  ['標籤', 'tags'],
  ['labels', 'tags'],
  ['分类', 'tags'],
  ['類別', 'tags'],
  ['tags', 'tags'],
  ['tag', 'tags'],

  ['解析', 'explanation'],
  ['explanation', 'explanation'],

  ['正确答案', 'correct_answer'],
  ['正確答案', 'correct_answer'],
  ['正确答案多选', 'correct_answer'],
  ['正确答案（多选）', 'correct_answer'],
  ['答案', 'answer'],
  ['answer', 'answer'],
  ['correct_answer', 'correct_answer'],
  ['correctanswers', 'correct_answers'],
  ['correct_answers', 'correct_answers'],

  ['选项a', 'option_a'],
  ['选项b', 'option_b'],
  ['选项c', 'option_c'],
  ['选项d', 'option_d'],
  ['选项e', 'option_e'],
  ['选项f', 'option_f'],
  ['optiona', 'option_a'],
  ['optionb', 'option_b'],
  ['optionc', 'option_c'],
  ['optiond', 'option_d'],
  ['optione', 'option_e'],
  ['optionf', 'option_f'],
  ['option_a', 'option_a'],
  ['option_b', 'option_b'],
  ['option_c', 'option_c'],
  ['option_d', 'option_d'],
  ['option_e', 'option_e'],
  ['option_f', 'option_f'],
]

const ALIAS_MAP_NORM_TO_STD: Record<string, string> = ALIAS_ENTRIES.reduce((m, [alias, std]) => {
  m[normalizeKey(alias)] = std
  return m
}, {} as Record<string, string>)

const mapHeaderToStd = (rawHeader: string): string => {
  const nk = normalizeKey(rawHeader)
  return ALIAS_MAP_NORM_TO_STD[nk] ?? nk
}

const VALID_TYPES = ['single_choice', 'multiple_choice', 'true_false', 'short_answer'] as const
type QType = (typeof VALID_TYPES)[number]

/** 题型取值规范化（支持中文/别名） */
const normalizeType = (t: any): QType | null => {
  const s = String(t || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[-]/g, '')
    .replace(/（|）/g, '')
  const map: Record<string, QType> = {
    single_choice: 'single_choice',
    singlechoice: 'single_choice',
    single: 'single_choice',
    单选题: 'single_choice',
    單選題: 'single_choice',

    multiple_choice: 'multiple_choice',
    multiplechoice: 'multiple_choice',
    multiple: 'multiple_choice',
    多选题: 'multiple_choice',
    多選題: 'multiple_choice',

    true_false: 'true_false',
    truefalse: 'true_false',
    tf: 'true_false',
    判断题: 'true_false',
    判斷題: 'true_false',
    true: 'true_false', // 少数模板会写成 true/false 类型，这里也归到判断题

    short_answer: 'short_answer',
    shortanswer: 'short_answer',
    short: 'short_answer',
    essay: 'short_answer',
    简答题: 'short_answer',
    簡答題: 'short_answer',
  }
  return map[s] ?? (VALID_TYPES.includes(s as QType) ? (s as QType) : null)
}

/** 把 "AB" 这种紧凑写法转为数组；也兼容 "A,B" / "A;B" / "A B" */
const parseLetters = (raw: string) => {
  const s = String(raw || '')
    .trim()
    .toUpperCase()
  if (!s) return [] as string[]
  // 若是不含分隔符、且全是 A-F 字母，按字符拆分
  if (!/[,\s;，；]/.test(s) && /^[A-F]+$/.test(s)) return s.split('')
  // 否则按常见分隔符拆
  return s
    .replace(/[，；;]/g, ',')
    .replace(/\s+/g, ',')
    .split(',')
    .map(x => x.trim())
    .filter(Boolean)
}

const optionLabels = ['A', 'B', 'C', 'D', 'E', 'F'] as const
const optionKeysStd = ['option_a', 'option_b', 'option_c', 'option_d', 'option_e', 'option_f'] as const

/* -------------------- CSV / Excel 解析 -------------------- */
export const parseCSVFile = (file: File): Promise<ParseResult> =>
  new Promise(resolve => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: 'greedy',
      encoding: 'UTF-8',
      transformHeader: (h: string) => mapHeaderToStd(h),
      complete: results => {
        try {
          const fields: string[] = (results as any)?.meta?.fields ?? []
          const headerSet = new Set(fields.map(String))
          const { validQuestions, errors } = processRawData(results.data as any[], headerSet)
          resolve({
            success: true,
            data: validQuestions,
            errors,
            total: (results.data as any[])?.length ?? 0,
          })
        } catch (error) {
          resolve({
            success: false,
            errors: [`CSV解析错误: ${error instanceof Error ? error.message : '未知错误'}`],
          })
        }
      },
      error: err => resolve({ success: false, errors: [`CSV文件读取失败: ${err.message}`] }),
    })
  })

export const parseExcelFile = async (file: File): Promise<ParseResult> => {
  try {
    const jsonData = (await readSheet(file)) as any[][]
    if (!jsonData.length) return { success: true, data: [], errors: [], total: 0 }

    const rawHeaders = (jsonData[0] || []) as string[]
    const stdHeaders = rawHeaders.map(h => mapHeaderToStd(h))
    const headerSet = new Set(stdHeaders)

    const rows = jsonData.slice(1)
    const formattedData = rows.map(row => {
      const obj: Record<string, any> = {}
      stdHeaders.forEach((hdr, i) => (obj[hdr] = (row as any[])[i] ?? ''))
      return obj
    })

    const { validQuestions, errors } = processRawData(formattedData, headerSet)
    return { success: true, data: validQuestions, errors, total: formattedData.length }
  } catch (error) {
    return { success: false, errors: [`Excel解析错误: ${error instanceof Error ? error.message : '未知错误'}`] }
  }
}

/* -------------------- 行解析 -------------------- */
const hasField = (headerSet: Set<string> | undefined, row: Record<string, any>, aliases: string[]) => {
  const stdKeys = aliases.map(a => mapHeaderToStd(a))
  const existsInHeader = headerSet ? stdKeys.some(k => headerSet.has(k)) : false
  if (existsInHeader) return true
  return stdKeys.some(k => Object.prototype.hasOwnProperty.call(row, k))
}

const isNonEmpty = (v: any) => v !== undefined && v !== null && String(v).trim() !== ''

const pickFirst = (row: Record<string, any>, stdKeys: string[]) => {
  for (const k of stdKeys.map(mapHeaderToStd)) if (k in row) return row[k]
  return undefined
}

const pickFirstNonEmpty = (row: Record<string, any>, stdKeys: string[]) => {
  for (const k of stdKeys.map(mapHeaderToStd)) {
    const v = row[k]
    if (isNonEmpty(v)) return v
  }
  return undefined
}

const processRawData = (
  rawData: any[],
  headerSet?: Set<string>
): { validQuestions: ParsedQuestion[]; errors: string[] } => {
  const validQuestions: ParsedQuestion[] = []
  const errors: string[] = []

  rawData.forEach((row, index) => {
    try {
      const q = parseQuestionRow(row, index + 1, headerSet)
      if (q) validQuestions.push(q)
    } catch (err) {
      errors.push(`第${index + 1}行: ${err instanceof Error ? err.message : '解析失败'}`)
    }
  })

  return { validQuestions, errors }
}

const parseQuestionRow = (
  row: Record<string, any>,
  _rowIndex: number,
  headerSet?: Set<string>
): ParsedQuestion | null => {
  const content = pickFirstNonEmpty(row, ['content']) || ''
  if (!String(content).trim()) throw new Error('题目内容不能为空')

  const qtype0 = pickFirstNonEmpty(row, ['question_type', 'type'])
  const qtype = normalizeType(qtype0)
  if (!qtype) throw new Error(`无效的题目类型: ${qtype0}`)

  const out: ParsedQuestion = { content: String(content).trim(), question_type: qtype }

  // title
  if (hasField(headerSet, row, ['title', '题目标题', '标题'])) {
    const title = pickFirst(row, ['title'])
    if (isNonEmpty(title)) out.title = String(title).trim()
  }

  // difficulty
  if (hasField(headerSet, row, ['difficulty', '难度', '难度等级'])) {
    const d = String(pickFirst(row, ['difficulty']) ?? '')
      .trim()
      .toLowerCase()
    if (['easy', 'medium', 'hard'].includes(d)) out.difficulty = d as any
  }

  // score
  if (hasField(headerSet, row, ['score', '分值', '分数'])) {
    const s = Number(pickFirst(row, ['score']))
    if (!Number.isNaN(s)) out.score = s
  }

  // explanation
  if (hasField(headerSet, row, ['explanation', '解析'])) {
    const exp = pickFirst(row, ['explanation'])
    if (isNonEmpty(exp)) out.explanation = String(exp).trim()
  }

  // knowledge_points
  if (hasField(headerSet, row, ['knowledge_points', '知识点', '知識點', 'knowledge points'])) {
    const kpRaw = pickFirst(row, ['knowledge_points'])
    const arr = ensureArrayFromMaybeCsv(kpRaw)
    if (arr.length) out.knowledge_points = arr
  }

  // tags
  if (hasField(headerSet, row, ['tags', '标签', '標籤', 'labels', '分类', '類別'])) {
    const tagsRaw = pickFirst(row, ['tags'])
    const arr = ensureArrayFromMaybeCsv(tagsRaw)
    if (arr.length) out.tags = arr
  }

  if (qtype === 'single_choice' || qtype === 'multiple_choice') {
    const opts: { content: string; is_correct: boolean }[] = []
    const optCells = optionKeysStd.map(k => row[k])

    // 正确答案：兼容 AB / A,B / A;B / A B
    const correctRaw =
      pickFirstNonEmpty(row, ['correct_answer']) ||
      pickFirstNonEmpty(row, ['answer']) ||
      pickFirstNonEmpty(row, ['correct_answers']) ||
      ''
    const letters = new Set(parseLetters(String(correctRaw || '')))

    optionLabels.forEach((label, idx) => {
      const cell = optCells[idx]
      if (!isNonEmpty(cell)) return
      opts.push({ content: String(cell).trim(), is_correct: letters.has(label) })
    })

    if (opts.length < 2) throw new Error('选择题至少需要2个选项')
    if (!opts.some(o => o.is_correct)) throw new Error('选择题必须有正确答案')

    out.options = opts
    const ans = optionLabels.filter(l => letters.has(l)).join(',')
    if (ans) {
      out.correct_answer = ans
      out.answer = ans
    }
  } else if (qtype === 'true_false') {
    let ans = String(pickFirstNonEmpty(row, ['correct_answer']) || pickFirstNonEmpty(row, ['answer']) || '')
      .trim()
      .toLowerCase()
    const truthy = ['true', '正确', '對', '对', '是', 'y', 'yes', '1']
    const falsy = ['false', '错误', '錯', '错', '否', 'n', 'no', '0']
    if (![...truthy, ...falsy].includes(ans)) throw new Error('判断题答案必须是: true/false 或 正确/错误/对/错/是/否')
    const normalized = truthy.includes(ans) ? 'true' : 'false'
    out.correct_answer = normalized
    out.answer = normalized
  } else if (qtype === 'short_answer') {
    const ans = pickFirstNonEmpty(row, ['correct_answer']) || pickFirstNonEmpty(row, ['answer']) || ''
    if (!isNonEmpty(ans)) throw new Error('简答题必须提供参考答案')
    out.correct_answer = String(ans).trim()
    out.answer = out.correct_answer
  }

  return out
}

/* -------------------- 主入口 -------------------- */
export const parseFile = async (file: File): Promise<ParseResult> => {
  const lower = file.name.toLowerCase()
  if (lower.endsWith('.csv')) return parseCSVFile(file)
  if (lower.endsWith('.xlsx')) return parseExcelFile(file)
  return { success: false, errors: ['不支持的文件格式，请使用 .xlsx 或 .csv 文件'] }
}

// 也导出一次，方便旧代码从 fileParser 引用
export { ensureArrayFromMaybeCsv }
