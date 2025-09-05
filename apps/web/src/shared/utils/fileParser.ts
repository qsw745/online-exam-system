import * as XLSX from 'xlsx'
import Papa from 'papaparse'

export interface ParsedQuestion {
  // 非必填：有就带上，没提供就不写入（除 content / question_type）
  title?: string
  content: string
  question_type: 'single_choice' | 'multiple_choice' | 'true_false' | 'short_answer'
  options?: { content: string; is_correct: boolean }[]
  // 对选择题：'A' 或 'A,C'
  // 对判断题：'true' / 'false'
  // 对简答题：参考答案文本
  correct_answer?: string
  // 保持兼容
  answer?: string
  knowledge_points?: string[]
  tags?: string[] // 仅当文件存在标签列时才会写入该字段
  explanation?: string
  difficulty?: 'easy' | 'medium' | 'hard'
  score?: number
  // 兼容可能的多选答案数组
  correct_answers?: string[]
}

export interface ParseResult {
  success: boolean
  data?: ParsedQuestion[]
  errors?: string[]
  total?: number
}

/* -------------------- 工具：表头规范化与别名映射 -------------------- */

const BOM = '\ufeff'
const normalizeKey = (k: unknown) =>
  String(k ?? '')
    .replace(BOM, '')
    .replace(/\s+/g, '') // 去空格
    .replace(/[（）()]/g, '') // 去括号
    .toLowerCase()

// 统一后的标准键
// 注意：这里的键是“规范化后的别名文本”
const ALIAS_ENTRIES: Array<[string, string]> = [
  // 标题/内容/类型
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

  // 难度/分值
  ['难度等级', 'difficulty'],
  ['难度', 'difficulty'],
  ['difficulty', 'difficulty'],

  ['分值', 'score'],
  ['分数', 'score'],
  ['score', 'score'],

  // 知识点
  ['知识点', 'knowledge_points'],
  ['知識點', 'knowledge_points'],
  ['knowledgepoints', 'knowledge_points'],
  ['knowledge points', 'knowledge_points'],
  ['knowledge_points', 'knowledge_points'],

  // 标签
  ['标签', 'tags'],
  ['標籤', 'tags'],
  ['labels', 'tags'],
  ['分类', 'tags'],
  ['類別', 'tags'],
  ['tags', 'tags'],
  ['tag', 'tags'],

  // 解析
  ['解析', 'explanation'],
  ['explanation', 'explanation'],

  // 正确答案
  ['正确答案', 'correct_answer'],
  ['正確答案', 'correct_answer'],
  ['正确答案多选', 'correct_answer'],
  ['正确答案（多选）', 'correct_answer'],
  ['答案', 'answer'],
  ['answer', 'answer'],
  ['correct_answer', 'correct_answer'],
  ['correctanswers', 'correct_answers'],
  ['correct_answers', 'correct_answers'],

  // 选项 (A~F)
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
  return ALIAS_MAP_NORM_TO_STD[nk] ?? nk // 未知列保留（用规范化后的键）
}

const ensureArrayFromMaybeCsv = (input: any): string[] => {
  if (Array.isArray(input))
    return input
      .map(String)
      .map(s => s.trim())
      .filter(Boolean)
  if (typeof input === 'string') {
    const normalized = input.replace(/[\r\n]+/g, ',').replace(/[，；;]/g, ',')
    return normalized
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
  }
  if (input != null && (typeof input === 'number' || typeof input === 'boolean')) {
    return [String(input)]
  }
  return []
}

/* -------------------- 主体：CSV / Excel 解析 -------------------- */

// 解析CSV文件
export const parseCSVFile = (file: File): Promise<ParseResult> => {
  return new Promise(resolve => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: 'greedy',
      encoding: 'UTF-8',
      transformHeader: (h: string) => mapHeaderToStd(h),
      complete: results => {
        try {
          // 字段列表已是 transform 后的标准键
          const fields: string[] = (results as any)?.meta?.fields ?? []
          const headerSet = new Set(fields.map(String))
          const questions = processRawData(results.data as any[], headerSet)
          resolve({
            success: true,
            data: questions.validQuestions,
            errors: questions.errors,
            total: (results.data as any[])?.length ?? 0,
          })
        } catch (error) {
          resolve({
            success: false,
            errors: [`CSV解析错误: ${error instanceof Error ? error.message : '未知错误'}`],
          })
        }
      },
      error: error => {
        resolve({
          success: false,
          errors: [`CSV文件读取失败: ${error.message}`],
        })
      },
    })
  })
}

// 解析Excel文件
export const parseExcelFile = (file: File): Promise<ParseResult> => {
  return new Promise(resolve => {
    const reader = new FileReader()

    reader.onload = e => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })

        // 取第一个工作表
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]

        // 原始二维数组：第一行是表头
        const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]
        if (!jsonData.length) {
          resolve({ success: true, data: [], errors: [], total: 0 })
          return
        }

        const rawHeaders = (jsonData[0] || []) as string[]
        const stdHeaders = rawHeaders.map(h => mapHeaderToStd(h))
        const headerSet = new Set(stdHeaders)

        // 组装为对象数组（键用标准化后的 header）
        const rows = jsonData.slice(1)
        const formattedData = rows.map(row => {
          const obj: Record<string, any> = {}
          stdHeaders.forEach((hdr, idx) => {
            obj[hdr] = (row as any[])[idx] ?? ''
          })
          return obj
        })

        const questions = processRawData(formattedData, headerSet)
        resolve({
          success: true,
          data: questions.validQuestions,
          errors: questions.errors,
          total: formattedData.length,
        })
      } catch (error) {
        resolve({
          success: false,
          errors: [`Excel解析错误: ${error instanceof Error ? error.message : '未知错误'}`],
        })
      }
    }

    reader.onerror = () => {
      resolve({
        success: false,
        errors: ['Excel文件读取失败'],
      })
    }

    reader.readAsArrayBuffer(file)
  })
}

/* -------------------- 行解析与校验 -------------------- */

const VALID_TYPES = ['single_choice', 'multiple_choice', 'true_false', 'short_answer'] as const
type QType = (typeof VALID_TYPES)[number]

const optionLabels = ['A', 'B', 'C', 'D', 'E', 'F']
const optionKeysStd = ['option_a', 'option_b', 'option_c', 'option_d', 'option_e', 'option_f'] as const

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
  rowIndex: number,
  headerSet?: Set<string>
): ParsedQuestion | null => {
  // content & type
  const content = pickFirstNonEmpty(row, ['content']) || ''
  const qtypeRaw = pickFirstNonEmpty(row, ['question_type', 'type']) || ''
  if (!content.trim()) throw new Error('题目内容不能为空')
  const qtype = String(qtypeRaw).trim() as QType
  if (!VALID_TYPES.includes(qtype)) {
    throw new Error(`无效的题目类型: ${qtype}，支持的类型: ${VALID_TYPES.join(', ')}`)
  }

  const out: ParsedQuestion = {
    content: content.trim(),
    question_type: qtype,
  }

  // 可选字段：只有当提供了相关列时，才写入到对象里（避免后端被空值覆盖）
  // title
  const hasTitle = hasField(headerSet, row, ['title', '题目标题', '标题'])
  if (hasTitle) {
    const title = pickFirst(row, ['title'])
    if (isNonEmpty(title)) out.title = String(title).trim()
  }

  // difficulty
  const hasDiff = hasField(headerSet, row, ['difficulty', '难度', '难度等级'])
  if (hasDiff) {
    const d = String(pickFirst(row, ['difficulty']) ?? '')
      .trim()
      .toLowerCase()
    if (['easy', 'medium', 'hard'].includes(d)) out.difficulty = d as any
  }

  // score
  const hasScore = hasField(headerSet, row, ['score', '分值', '分数'])
  if (hasScore) {
    const s = Number(pickFirst(row, ['score']))
    if (!Number.isNaN(s)) out.score = s
  }

  // explanation
  const hasExpl = hasField(headerSet, row, ['explanation', '解析'])
  if (hasExpl) {
    const exp = pickFirst(row, ['explanation'])
    if (isNonEmpty(exp)) out.explanation = String(exp).trim()
  }

  // knowledge_points
  const hasKP = hasField(headerSet, row, ['knowledge_points', '知识点', '知識點', 'knowledge points'])
  if (hasKP) {
    const kpRaw = pickFirst(row, ['knowledge_points'])
    const arr = ensureArrayFromMaybeCsv(kpRaw)
    if (arr.length) out.knowledge_points = arr
  }

  // tags（仅当文件确实有“标签列”时才写入；避免覆盖历史标签）
  const hasTags = hasField(headerSet, row, ['tags', '标签', '標籤', 'labels', '分类', '類別'])
  if (hasTags) {
    const tagsRaw = pickFirst(row, ['tags'])
    const arr = ensureArrayFromMaybeCsv(tagsRaw)
    if (arr.length) out.tags = arr
  }

  // 正确答案与选项
  if (qtype === 'single_choice' || qtype === 'multiple_choice') {
    // 选项内容
    const options: { content: string; is_correct: boolean }[] = []

    // 读取标准化的 option_a ~ option_f
    const optCells = optionKeysStd.map(k => row[k])

    // 如果没有标准化键，还尝试从 row 中找“规范化后的 key”
    if (optCells.every(v => !isNonEmpty(v))) {
      // 有些情况下外层没经过表头映射（极少），兜底从原键抓取
      optionKeysStd.forEach((std, i) => {
        const fallback = pickFirstNonEmpty(row, [std])
        optCells[i] = fallback
      })
    }

    // 正确答案
    let correctRaw = pickFirstNonEmpty(row, ['correct_answer']) || pickFirstNonEmpty(row, ['answer']) || ''
    correctRaw = String(correctRaw || '').trim()
    const correctSet = new Set(
      ensureArrayFromMaybeCsv(correctRaw)
        .map(s => s.toUpperCase())
        // 如果是 "A,C" 这种合并一格的情况
        .flatMap(s => s.split(','))
        .map(s => s.trim())
        .filter(Boolean)
    )

    optionLabels.forEach((label, idx) => {
      const cell = optCells[idx]
      if (!isNonEmpty(cell)) return
      options.push({
        content: String(cell).trim(),
        is_correct: correctSet.has(label),
      })
    })

    if (options.length < 2) throw new Error('选择题至少需要2个选项')
    if (!options.some(o => o.is_correct)) throw new Error('选择题必须有正确答案')

    out.options = options
    // 规范化 correct_answer：用大写字母逗号分隔
    const letters = optionLabels.filter(l => correctSet.has(l))
    if (letters.length) {
      out.correct_answer = letters.join(',')
      out.answer = out.correct_answer // 兼容旧字段
    }
  } else if (qtype === 'true_false') {
    let ans = String(pickFirstNonEmpty(row, ['correct_answer']) || pickFirstNonEmpty(row, ['answer']) || '')
      .trim()
      .toLowerCase()
    const truthy = ['true', '正确', '對', '对', '是', 'y', 'yes', '1']
    const falsy = ['false', '错误', '錯', '错', '否', 'n', 'no', '0']
    if (![...truthy, ...falsy].includes(ans)) {
      throw new Error('判断题答案必须是: true/false 或 正确/错误/对/错/是/否')
    }
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

/* -------------------- 小工具函数 -------------------- */

const hasField = (headerSet: Set<string> | undefined, row: Record<string, any>, aliases: string[]) => {
  // 如果我们已经把表头映射为 std 了，优先用 headerSet 判断列是否存在
  const stdKeys = aliases.map(a => mapHeaderToStd(a))
  const existsInHeader = headerSet ? stdKeys.some(k => headerSet.has(k)) : false
  if (existsInHeader) return true
  // 兜底：直接看 row 上是否有这些键
  return stdKeys.some(k => Object.prototype.hasOwnProperty.call(row, k))
}

const pickFirst = (row: Record<string, any>, stdKeys: string[]) => {
  for (const k of stdKeys.map(mapHeaderToStd)) {
    if (k in row) return row[k]
  }
  return undefined
}

const pickFirstNonEmpty = (row: Record<string, any>, stdKeys: string[]) => {
  for (const k of stdKeys.map(mapHeaderToStd)) {
    const v = row[k]
    if (isNonEmpty(v)) return v
  }
  return undefined
}

const isNonEmpty = (v: any) => v !== undefined && v !== null && String(v).trim() !== ''

/* -------------------- 主入口 -------------------- */

export const parseFile = async (file: File): Promise<ParseResult> => {
  const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'))

  switch (ext) {
    case '.csv':
      return parseCSVFile(file)
    case '.xlsx':
    case '.xls':
      return parseExcelFile(file)
    default:
      return { success: false, errors: ['不支持的文件格式，请使用 .xlsx, .xls 或 .csv 文件'] }
  }
}
