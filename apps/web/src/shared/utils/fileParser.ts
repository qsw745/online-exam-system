import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { ensureArrayFromMaybeCsv } from './q-helpers'

export interface ParsedQuestion {
  title?: string
  content: string
  question_type: 'single_choice' | 'multiple_choice' | 'true_false' | 'short_answer'
  options?: { content: string; is_correct: boolean }[]
  correct_answer?: string
  answer?: string
  knowledge_points?: string[]
  tags?: string[]
  explanation?: string
  difficulty?: 'easy' | 'medium' | 'hard'
  score?: number
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

const ALIAS: Array<[string, string]> = [
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
  ['knowledgepoints', 'knowledge_points'],
  ['knowledge points', 'knowledge_points'],
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

const MAP: Record<string, string> = ALIAS.reduce(
  (m, [a, s]) => ((m[normalizeKey(a)] = s), m),
  {} as Record<string, string>
)
export const mapHeaderToStd = (raw: string) => MAP[normalizeKey(raw)] ?? normalizeKey(raw)

const VALID_TYPES = ['single_choice', 'multiple_choice', 'true_false', 'short_answer'] as const
type QType = (typeof VALID_TYPES)[number]
const optionLabels = ['A', 'B', 'C', 'D', 'E', 'F']
const optionKeysStd = ['option_a', 'option_b', 'option_c', 'option_d', 'option_e', 'option_f'] as const

const isNonEmpty = (v: any) => v !== undefined && v !== null && String(v).trim() !== ''
const pick = (obj: any, keys: string[]) => {
  for (const k of keys) if (isNonEmpty(obj[k])) return obj[k]
  return undefined
}

function parseRow(row: any, headerSet: Set<string>): ParsedQuestion {
  const content = String(pick(row, ['content']) ?? '').trim()
  const t = String(pick(row, ['question_type', 'type']) ?? '').trim() as QType
  if (!content) throw new Error('题目内容不能为空')
  if (!VALID_TYPES.includes(t)) throw new Error(`无效的题目类型: ${t}`)

  const out: ParsedQuestion = { content, question_type: t }

  const has = (aliases: string[]) => {
    const stdKeys = aliases.map(mapHeaderToStd)
    return stdKeys.some(k => headerSet.has(k) || Object.prototype.hasOwnProperty.call(row, k))
  }

  if (has(['title'])) out.title = String(pick(row, ['title']) ?? '').trim() || undefined
  if (has(['difficulty'])) {
    const d = String(pick(row, ['difficulty']) ?? '')
      .trim()
      .toLowerCase()
    if (['easy', 'medium', 'hard'].includes(d)) out.difficulty = d as any
  }
  if (has(['score'])) {
    const s = Number(pick(row, ['score']))
    if (!Number.isNaN(s)) out.score = s
  }
  if (has(['explanation'])) out.explanation = String(pick(row, ['explanation']) ?? '').trim() || undefined
  if (has(['knowledge_points'])) {
    const kp = ensureArrayFromMaybeCsv(pick(row, ['knowledge_points']))
    if (kp.length) out.knowledge_points = kp
  }
  if (has(['tags'])) {
    const tg = ensureArrayFromMaybeCsv(pick(row, ['tags']))
    if (tg.length) out.tags = tg
  }

  if (t === 'single_choice' || t === 'multiple_choice') {
    const opts: { content: string; is_correct: boolean }[] = []
    const correctRaw =
      pick(row, ['correct_answer']) ??
      pick(row, ['answer']) ??
      ((pick(row, ['correct_answers']) as any[]) || []).join(',')
    const set = new Set(
      ensureArrayFromMaybeCsv(correctRaw)
        .map(s => s.toUpperCase())
        .flatMap(s => s.split(','))
        .map(s => s.trim())
        .filter(Boolean)
    )
    optionKeysStd.forEach((k, i) => {
      const v = row[k]
      if (!isNonEmpty(v)) return
      opts.push({ content: String(v).trim(), is_correct: set.has(optionLabels[i]) })
    })
    if (opts.length < 2) throw new Error('选择题至少需要 2 个选项')
    if (!opts.some(o => o.is_correct)) throw new Error('选择题必须有正确答案')
    out.options = opts
    const letters = optionLabels.filter((_, i) => opts[i]?.is_correct)
    out.correct_answer = letters.join(',')
    out.answer = out.correct_answer
  } else if (t === 'true_false') {
    let ans = String(pick(row, ['correct_answer']) ?? pick(row, ['answer']) ?? '')
      .trim()
      .toLowerCase()
    const truthy = ['true', '正确', '對', '对', '是', 'y', 'yes', '1']
    const falsy = ['false', '错误', '錯', '错', '否', 'n', 'no', '0']
    if (![...truthy, ...falsy].includes(ans)) throw new Error('判断题答案必须是 true/false 或 正确/错误/对/错/是/否')
    out.correct_answer = truthy.includes(ans) ? 'true' : 'false'
    out.answer = out.correct_answer
  } else if (t === 'short_answer') {
    const ans = String(pick(row, ['correct_answer']) ?? pick(row, ['answer']) ?? '').trim()
    if (!ans) throw new Error('简答题必须提供参考答案')
    out.correct_answer = ans
    out.answer = ans
  }

  return out
}

const processRaw = (rows: any[], headers: string[]): { data: ParsedQuestion[]; errors: string[] } => {
  const headerSet = new Set(headers)
  const data: ParsedQuestion[] = []
  const errors: string[] = []
  rows.forEach((row, i) => {
    try {
      data.push(parseRow(row, headerSet))
    } catch (e: any) {
      errors.push(`第 ${i + 1} 行：${e?.message || '解析失败'}`)
    }
  })
  return { data, errors }
}

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
          const { data, errors } = processRaw(results.data as any[], fields)
          resolve({ success: true, data, errors, total: (results.data as any[])?.length ?? 0 })
        } catch (error) {
          resolve({ success: false, errors: ['CSV解析错误'] })
        }
      },
      error: error => resolve({ success: false, errors: [`CSV文件读取失败: ${error.message}`] }),
    })
  })

export const parseExcelFile = (file: File): Promise<ParseResult> =>
  new Promise(resolve => {
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array' })
        const sheetName = wb.SheetNames[0]
        const ws = wb.Sheets[sheetName]
        const arr: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][]
        if (!arr.length) return resolve({ success: true, data: [], errors: [], total: 0 })
        const rawHeaders = (arr[0] || []) as string[]
        const stdHeaders = rawHeaders.map(mapHeaderToStd)
        const rows = arr.slice(1).map(row => {
          const obj: Record<string, any> = {}
          stdHeaders.forEach((h, i) => (obj[h] = (row as any[])[i] ?? ''))
          return obj
        })
        const { data: qs, errors } = processRaw(rows, stdHeaders)
        resolve({ success: true, data: qs, errors, total: rows.length })
      } catch {
        resolve({ success: false, errors: ['Excel解析错误'] })
      }
    }
    reader.onerror = () => resolve({ success: false, errors: ['Excel文件读取失败'] })
    reader.readAsArrayBuffer(file)
  })

export const parseFile = async (file: File): Promise<ParseResult> => {
  const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'))
  if (ext === '.csv') return parseCSVFile(file)
  if (ext === '.xlsx' || ext === '.xls') return parseExcelFile(file)
  return { success: false, errors: ['不支持的文件格式，请使用 .xlsx, .xls 或 .csv 文件'] }
}

/** 导出字段顺序（模板也用这个） */
export const buildExportHeaders = () => [
  { key: 'content', label: '题目内容' },
  { key: 'question_type', label: '题目类型' },
  { key: 'difficulty', label: '难度' },
  { key: 'score', label: '分值' },
  { key: 'option_a', label: '选项A' },
  { key: 'option_b', label: '选项B' },
  { key: 'option_c', label: '选项C' },
  { key: 'option_d', label: '选项D' },
  { key: 'option_e', label: '选项E' },
  { key: 'option_f', label: '选项F' },
  { key: 'correct_answer', label: '正确答案' },
  { key: 'knowledge_points', label: '知识点' },
  { key: 'tags', label: '标签' },
  { key: 'explanation', label: '解析' },
]

export { ensureArrayFromMaybeCsv }
